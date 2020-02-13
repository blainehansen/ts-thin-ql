import ts = require('typescript')
import pascal_case = require('pascal-case')
import '@ts-std/extensions/dist/array'

import { Table } from '../inspect'
import { PgType, BaseType } from '../inspect_pg_types'
import {
	Action, Arg, CqlPrimitive, CqlAtomicPrimitive,
	Delete as _Delete, Query as _Query, QueryBlock, Insert as _Insert
} from '../ast'


export function render_action(action: Action) {
	switch (action.type) {
		case 'Delete': return Delete(action)
		case 'Query': return Query(action)
	}
}


function codegen_api_module(config_http_location: string, table_types_location: string, actions: Action[]) {
	return [
		[
			`import { http } from '${config_http_location}'`,
			`import * as _pg_types from '${table_types_location}'`,
			`import { PayloadPromise, ActionPromise } from 'thin-ql'`,
			'type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>',
			'type Rename<T, K extends keyof T, N extends string> = { [_ in N]: T[K] }',
		].join('\n'),
		actions
			.flat_map(render_action)
			.map(n => print_node(n))
			.join('\n\n')
	].join('\n\n')
}

function create_type_ref(node: string | ts.QualifiedName, type_arguments?: ts.TypeNode[] | undefined) {
	return ts.createTypeReferenceNode(node, type_arguments)
}

function create_pg_type_ref(name: string) {
	return create_type_ref(ts.createQualifiedName(
		ts.createIdentifier('_pg_types'), ts.createIdentifier(name),
	))
}

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, omitTrailingSemicolon: true })
export function print_node(node: ts.Node, filename = '') {
	const result_file = ts.createSourceFile(filename, '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)
	return printer.printNode(ts.EmitHint.Unspecified, node, result_file)
}


export function create_type(type: string | PgType, nullable: boolean): ts.TypeNode {
	const base_type =
		typeof type === 'string' ? type in BaseType
			? ts.createKeywordTypeNode(BaseType[type as BaseType].ts_type)
			: create_type_ref(type)
		: 'inner_type' in type ? create_array_type(create_type(type.inner_type, false))
		: 'enum_name' in type ? create_pg_type_ref(type.enum_name)
		: create_pg_type_ref(type.class_name)

	return nullable
		? ts.createUnionTypeNode([base_type, ts.createNull()])
		: base_type
}

function create_array_type(inner_type: ts.TypeNode) {
	return ts.createArrayTypeNode(ts.createParenthesizedType(inner_type))
}

function create_complex_type(intersection_items: ts.TypeNode[], is_many: boolean) {
	const bare_type = intersection_items.length === 1
		? intersection_items[0]
		: ts.createIntersectionTypeNode(intersection_items)

	return is_many
		? create_array_type(bare_type)
		: bare_type
}

function exported_type(name: string, definition: ts.TypeNode) {
	return ts.createTypeAliasDeclaration(
		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
		name, undefined, definition,
	)
}

function render_default_value(default_value: CqlPrimitive): ts.Expression
function render_default_value(default_value: CqlPrimitive | undefined): ts.Expression | undefined
function render_default_value(default_value: CqlPrimitive | undefined): any {
	if (default_value === undefined) return undefined
	if (default_value === null) return ts.createNull()

	if (typeof default_value === 'string') return ts.createStringLiteral(default_value)
	if (typeof default_value === 'number') return ts.createNumericLiteral('' + default_value)
	if (typeof default_value === 'boolean') return default_value ? ts.createTrue() : ts.createFalse()

	return ts.createArrayLiteral(
		(default_value as CqlAtomicPrimitive[]).map(v => render_default_value(v as CqlPrimitive)),
		false,
	)
}

function payload_promise(type_name: string) {
	return create_type_ref('PayloadPromise', [create_type_ref(type_name)])
}
const action_promise = create_type_ref('ActionPromise')


function api_function(action: Action, is_mutation: boolean, return_or_data_type: ts.TypeNode) {
	const { name, args } = action
	const http_verb = Action.http_verb(action)

	const [parameters, parameters_usage, return_type] = is_mutation
		? [
			[ts.createParameter(undefined, undefined, undefined, 'data', undefined, return_or_data_type, undefined)],
			[ts.createIdentifier('data')],
			action_promise,
		]
		: [
			args.map(({ arg_name, arg_type, nullable, default_value }) => ts.createParameter(
				undefined, undefined, undefined, arg_name, undefined,
				create_type(arg_type, nullable),
				render_default_value(default_value),
			)),
			args.length > 0
				? [ts.createObjectLiteral([ts.createPropertyAssignment(
						'params',
						ts.createObjectLiteral(
							args.map(arg => ts.createShorthandPropertyAssignment(arg.arg_name, undefined)),
							false,
						),
					)], false)]
				: [],
			return_or_data_type,
		]

	return ts.createFunctionDeclaration(
		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
		undefined, name, [], parameters, undefined,
		ts.createBlock([ts.createReturn(
			ts.createAsExpression(
				ts.createCall(
					ts.createPropertyAccess(ts.createIdentifier('http'), http_verb),
					undefined,
					([ts.createStringLiteral(`/${action.type.toLowerCase()}/${name}`)] as ts.Expression[])
						.concat(parameters_usage),
				),
				return_type,
			),
		)], true),
	)
}

export function Delete(_delete: _Delete) {
	return [api_function(_delete, true, blah)]
}

export function Query(query: _Query) {
	const return_type = query_block(query.block)
	const return_type_name = pascal_case(query.name)

	return [
		exported_type(return_type_name, return_type),
		api_function(query, false, payload_promise(return_type_name)),
	]
}

function query_block({ target_table_name, entities, is_many }: QueryBlock) {
	const table_type = create_pg_type_ref(pascal_case(target_table_name))
	const pick_fields = []
	const renamed_fields = []
	const extra_fields = []

	for (const entity of entities) {
		if (entity.type === 'QueryColumn') {
			if (entity.display_name && entity.column_name !== entity.display_name)
				renamed_fields.push(create_type_ref('Rename', [
					table_type,
					ts.createLiteralTypeNode(ts.createStringLiteral(entity.column_name)),
					ts.createLiteralTypeNode(ts.createStringLiteral(entity.display_name)),
				]))
			else
				pick_fields.push(ts.createLiteralTypeNode(ts.createStringLiteral(entity.column_name)))
			continue
		}
		if (entity.type === 'QueryRawColumn') {
			// TODO is there a way to not make so many database round trips?
			// TODO not bothering with these for now
			// extra_fields[entity.display_name] = get_ts_type(discover_pg_expression_type(entity.statement))
			continue
		}

		extra_fields.push(ts.createPropertySignature(
			undefined, ts.createIdentifier(entity.display_name),
			undefined, query_block(entity), undefined,
		))
	}

	const intersection_items: ts.TypeNode[] = []

	if (pick_fields.length > 0)
		intersection_items.push(create_type_ref('Pick', [
			table_type,
			ts.createUnionTypeNode(pick_fields),
		]))

	if (renamed_fields.length > 0)
		intersection_items.push_all(renamed_fields)

	if (extra_fields.length > 0)
		intersection_items.push(ts.createTypeLiteralNode(extra_fields))

	return create_complex_type(intersection_items, is_many)
}


function column_to_type_field({ name, has_default_value, column_type, nullable }: Column) {
	return ts.createPropertySignature(
		undefined, name,
		has_default_value ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
		create_type(column_type, nullable), undefined,
	)
}

export function render_table({ name: table_name, columns, primary_key_columns }: Table) {
	// TODO want to filter this to only the *accessible* fields (as determined by the intended role's aclitems)
	const rendered_columns = columns.map(column_to_type_field)
	const type_name = pascal_case(table_name)
	const ref = create_type_ref(type_name)
	return [
		exported_type(type_name, ts.createTypeLiteralNode(rendered_columns)),
		exported_type(`Insert${type_name}`, create_type_ref('Omit', [
			ref,
			ts.createUnionTypeNode(primary_key_columns.map(c => ts.createLiteralTypeNode(ts.createStringLiteral(c.name))))
		])),
		// TODO this needs to be more complex
		// we should first omit all the primary key fields before Partial
		exported_type(`Patch${type_name}`, create_type_ref('Partial', [ref])),
	]
}


export function Insert(insert: _Insert) {
	const payload_type = insert_block(insert.block, undefined)
	const payload_type_name = pascal_case(insert.name)

	return [
		exported_type(payload_type_name, payload_type),
		api_function(insert, true create_type_ref(return_type_name))
	]
}


function insert_block(
	{ target_table_name, is_many, blocks }: InsertBlock,
	parent_name: string | undefined,
) {
	const type_name = pascal_case(target_table_name)
	const nested = ts.createTypeLiteralNode(blocks.map(block => ts.createPropertySignature(
		undefined, ts.createIdentifier(block.given_name), undefined,
		insert_block(block, target_table_name), undefined,
	)))
	return create_complex_type([create_type_ref(`Insert${type_name}`), nested], is_many)
}
