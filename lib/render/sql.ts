import { tuple as t } from '@ts-std/types'
import { LogError, NonEmpty, exhaustive, exec } from '../utils'
import {
	Action, HttpVerb, Delete as _Delete, Query as _Query, Arg, ColumnName, QueryColumn, QueryRawColumn, QueryBlock,
	TableAccessor, ForeignKeyChain,
	GetDirective, WhereDirective, DirectiveValue, OrderDirective,
} from '../ast'
import { get_table } from '../inspect'

export function render_action(actions: Action[]) {
	return actions.map(action => {
		const rendered_args = action.args.length !== 0
			? '(' + action.args.map(arg => arg.arg_type).join(', ') + ') '
			: ''
		return t(
			`prepare __tql_${action.type.toLowerCase()}_${action.name} ${rendered_args}as `,
			renderer(action, sql_functions),
		)
	})
}


export function Delete(d: _Delete) {
	return [
		`delete from ${d.table_name}`,
		where_clause(d.where_directives, d.table_name),
	].join('\n')
}

export function where_directive({ left, right, operator }: WhereDirective, parent_display_name: string) {
	return `${directive_value(left, parent_display_name)} ${operator} ${directive_value(right, parent_display_name)}`
}

export function where_clause(where_directives: WhereDirective[], parent_display_name: string) {
	return [
		'where (',
		'\t' + where_directives.map(w => where_directive(w, parent_display_name)).join(' and '),
		')',
	].join('\n')
}

export function directive_value(value: DirectiveValue, parent_display_name: string): string {
	if (typeof value === 'string')
		return `'${escape_single(value)}'`
	if (value === null || typeof value !== 'object')
		return '' + value

	if (Array.isArray(value))
		return `(${value.map(d => directive_value(d, parent_display_name)).join(', ')})`
	if ('column_name' in value)
		return `${esc(parent_display_name)}.${esc(value.column_name)}`
	if ('arg_name' in value)
		return `$${value.index}`

	exhaustive(value)
}

export function order_directive({ column, ascending, nulls_placement }: OrderDirective, parent_display_name: string) {
	const direction_string = ascending === undefined ? '' : ascending ? ' asc' : ' desc'
	const nulls_string = nulls_placement ? ` nulls ${nulls_placement}` : ''
	return `${esc(parent_display_name)}.${esc(column)}${direction_string}${nulls_string}`
}



export function Query({ args, block }: _Query) {
	return query_block(block, args, [])
}

export function get_directive({ column_names, args }: GetDirective, target_table_name: string) {
	// this actually is the display name
	const final_column_names = column_names || exec(() => {
		const table = get_table(target_table_name).unwrap()
		const column_names = table.primary_key_columns.map(column => column.name)
		if (column_names.length === 0) throw new LogError([`table: ${target_table_name} has no primary key`])
		return column_names
	})

	if (final_column_names.length !== args.length)
		throw new LogError(["GetDirective column names and args didn't line up: ", final_column_names, args])

	const get_directive_text = final_column_names
		.map((column_name, index) => `${esc(target_table_name)}.${esc(column_name)} = ${directive_value(args[index], target_table_name)}`)
		.join(' and ')
	return get_directive_text
}

function as_clause(table_name: string, display_name: string) {
	return `${esc(table_name)} as ${esc(display_name)}`
}

type JoinCondition = [string, string, string]

export function query_block(
	{ display_name, target_table_name, is_many, use_left, entities, where_directives, order_directives, limit, offset }: QueryBlock,
	args: Arg[], parent_join_conditions: JoinCondition[],
) {
	get_table(target_table_name).unwrap()

	const attr_select_strings: string[] = []

	const [is_root, join_strings, extra_join_conditions] = parent_join_conditions.length === 0
		? [true, [as_clause(target_table_name, display_name)], []]
		: exec(() => {
			const [[first_cond, first_tab, first_display], ...rest_conditions] = parent_join_conditions

			const join_type_string = use_left ? 'left' : 'inner'
			const rest_joins = rest_conditions.map(([cond, disp, tab]) => `${join_type_string} join ${as_clause(tab, disp)} on ${cond}`)
			return t(
				false,
				[as_clause(first_tab, first_display)].concat(rest_joins),
				[first_cond],
			)
		})

	// TODO
	// const current_table = get_table(target_table_name).unwrap()
	// const is_many = inspect.determine_is_many(parent_table, current_table)

	// single, left: left join lateral (${entity}) as ${entity.display_name} on true
	// single, inner: inner join lateral (${entity}) as ${entity.display_name} on true
	// multiple, left: left join lateral (select array_to_json(array(${entity}))) as ${entity.display_name} on true
	// multiple, inner: inner join lateral (select array_to_json(array(${entity}))) as ${entity.display_name} on true **
	// ** additional where clause entry: json_array_length(${entity.display_name}.${entity.display_name}) != 0
	for (const entity of entities) {
		if (entity.type === 'QueryColumn') {
			attr_select_strings.push(query_column(entity, display_name))
			continue
		}
		if (entity.type === 'QueryRawColumn') {
			attr_select_strings.push(query_raw_column(entity, args))
			continue
		}

		if (!entity.use_left && is_many)
			extra_join_conditions.push(`json_array_length(${entity.display_name}.${entity.display_name}) != 0`)

		attr_select_strings.push(`'${entity.display_name}', ${esc(entity.display_name)}.${esc(entity.display_name)}`)

		const join_type_string = entity.use_left ? 'left' : 'inner'
		const join_conditions = make_join_conditions(entity.access_object, display_name, target_table_name, entity.display_name)
		const rendered_block = query_block(entity, args, join_conditions)
		join_strings.push(`${join_type_string} join lateral (${rendered_block}) as ${esc(entity.display_name)} on true` )
	}

	const select_string = `jsonb_build_object(${attr_select_strings.join(', ')})`

	const join_string = join_strings.join('\n\t')

	const where_string = exec(() => {
		if (Array.isArray(where_directives)) {
			const where_strings = where_directives.map(w => where_directive(w, display_name))
			const conditions = extra_join_conditions.concat(where_strings)
			return conditions.length > 0 ? `where ${conditions.join(' and ')}` : ''
		}
		// if (!is_root) throw new LogError(["using a @get directive in a nested object doesn't make any sense"])
		return `where ${get_directive(where_directives, display_name)}`
	})

	const limit_string = limit ? `limit ${directive_value(limit, display_name)}` : ''
	const order_string = order_directives.length > 0 ? ` order by ${order_directives.map(o => order_directive(o, display_name)).join(', ')}` : ''
	const offset_string = offset ? `offset ${directive_value(offset, display_name)}` : ''

	const root_postfix = ' :: text as __value'
	const name_postfix = ` as ${esc(display_name)}`
	const [internal_postfix, wrapped_postfix] = is_many
		? is_root ? ['', root_postfix] : ['', name_postfix]
		: is_root ? [root_postfix, ''] : ['', '']
	// const [internal_postfix, wrapped_postfix] = is_many
	// 	? is_root ? [name_postfix, root_postfix] : [name_postfix, name_postfix]
	// 	: is_root ? [root_postfix, ''] : [name_postfix, '']

	const internal_select_string = [
		`select ${select_string}${internal_postfix}`,
		'from',
		`	${join_string}`,
		`${where_string}`,
		`${order_string}`,
		`${limit_string}`,
		`${offset_string}`,
	].join('\n')

	const wrapped_select_string = is_many
		? `select array_to_json(array(${internal_select_string}))`
		: internal_select_string

	return wrapped_select_string + wrapped_postfix
}


export function make_join_conditions(
	access_object: TableAccessor, previous_display_name: string, previous_table_name: string, target_display_name: string
): NonEmpty<[string, string, string]> {
	if (access_object.type === 'ForeignKeyChain')
		return foreign_key_chain_join_conditions(access_object, previous_display_name, previous_table_name, target_display_name)
	// if (access_object.type === 'ColumnKeyChain')
	// 	return column_key_chain_join_conditions(access_object, previous_display_name, previous_table_name, target_display_name)

	const table_names: NonEmpty<string> = access_object.type === 'SimpleTable'
		? [access_object.table_name]
		: access_object.table_names

	const join_conditions = [] as unknown as NonEmpty<[string, string, string]>

	let previous_table = get_table(previous_table_name).unwrap()
	const last_index = table_names.length - 1
	for (const [index, join_table_name] of table_names.entries()) {
		const join_table = get_table(join_table_name).unwrap()
		const join_display_name = index === last_index ? target_display_name : join_table_name

		const visible_table = previous_table.visible_tables.get(join_table_name)
		if (visible_table.length === 0) throw new LogError(["can't get to table: ", previous_table_name, join_table_name])
		if (visible_table.length !== 1) throw new LogError(["ambiguous: ", previous_table_name, join_table_name])

		const [{ remote, foreign_key: { referred_columns, pointing_columns, pointing_unique } }] = visible_table
		// check_many_correctness(pointing_unique, remote, entity_is_many)

		const [previous_keys, join_keys] = remote
			? [referred_columns, pointing_columns]
			: [pointing_columns, referred_columns]

		const join_condition = construct_join_key(previous_display_name, previous_keys, join_display_name, join_keys)

		join_conditions.push([join_condition, join_display_name, join_table_name])

		previous_table_name = join_table_name
		previous_table = join_table
		previous_display_name = join_display_name
	}

	return join_conditions
}

export function foreign_key_chain_join_conditions(
	{ key_references, destination_table_name }: ForeignKeyChain,
	previous_display_name: string, previous_table_name: string, target_display_name: string,
) {
	const join_conditions = [] as unknown as NonEmpty<[string, string, string]>

	let previous_table = get_table(previous_table_name).unwrap()

	const last_index = key_references.length - 1
	for (const [index, { key_names, table_name }] of key_references.entries()) {
		const visible_tables_map = previous_table.visible_tables_by_key.get(key_names.join(','))
		let visible_table
		if (table_name) {
			visible_table = visible_tables_map[table_name]
			if (!visible_table) throw new LogError(["table_name has no key ", key_names])
		}
		else {
			const visible_tables = Object.values(visible_tables_map)
			if (visible_tables.length !== 1) throw new LogError(["keyName is ambiguous: ", key_names])
			visible_table = visible_tables[0]
		}

		const { remote, foreign_key: { referred_table, referred_columns, pointing_table, pointing_columns, pointing_unique } } = visible_table

		const [previous_keys, join_table, join_keys] = remote
			? [referred_columns, pointing_table, pointing_columns]
			: [pointing_columns, referred_table, referred_columns]
		const join_table_name = join_table.name
		const join_display_name = index === last_index ? target_display_name : join_table_name

		const join_condition = construct_join_key(previous_display_name, previous_keys, join_display_name, join_keys)
		join_conditions.push([join_condition, join_display_name, join_table_name])

		previous_table_name = join_table_name
		previous_table = join_table
		previous_display_name = join_display_name
	}

	if (previous_table_name !== destination_table_name)
		throw new LogError(["you've given an incorrect destination_table_name: ", previous_table_name, destination_table_name])

	return join_conditions
}

// function column_key_chain_join_conditions() {
// 	//
// }

export function construct_join_key(previous_display_name: string, previous_keys: string[], join_display_name: string, join_keys: string[]) {
	if (previous_keys.length !== join_keys.length) throw new LogError(["some foreign keys didn't line up: ", previous_keys, join_keys])

	const join_condition_text = previous_keys
		.map((previous_key, index) => {
			const join_key = join_keys[index]
			if (!join_key) throw new LogError(["some foreign keys didn't line up: ", previous_keys, join_keys])
			return `${esc(previous_display_name)}.${esc(previous_key)} = ${esc(join_display_name)}.${esc(join_key)}`
		})
		.join(' and ')

	return join_condition_text
}


export function query_column({ display_name, column_name }: QueryColumn, target_table_name: string) {
	return `'${display_name || column_name}', ${esc(target_table_name)}.${esc(column_name)}`
}

// const global_variable_regex = new RegExp(variable_regex.source + '\\b', 'g')
const global_variable_regex = /\$\w+\b/g
// TODO you can make this regex more robust
// https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
// https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-CONSTANTS
// const global_variable_regex: RegExp = new RegExp('(\\$\\w*)?' + variable_regex.source + '$?', 'g')
export function query_raw_column({ display_name, sql_text }: QueryRawColumn, args: Arg[]) {
	const args_map = args.unique_index_by('arg_name').unwrap()
	let rendered_sql_text = sql_text.slice()
	let match
	while (match = global_variable_regex.exec(rendered_sql_text)) {
		const arg_name = match[0].slice(1)
		const arg = args_map[arg_name]
		// by continuing rather than throwing an error,
		// we allow them to do whatever they want with dollar quoted strings
		// if they've written something invalid, they'll get an error later on
		if (!arg) continue
		rendered_sql_text = rendered_sql_text.replace(new RegExp('\\$' + arg_name + '\\b'), `$${arg.index}`)
	}

	return `'${display_name}', ${rendered_sql_text}`
}



export function Insert(i: _Insert) {
	const [unpack_clauses, insert_clauses] = insert_block(i, undefined)
	const all_clauses = unpack_clauses.concat(insert_clauses).join(',\n\n')
	return [
		'with',
		all_clauses,
		'select true',
	].join('\n')
}

export function insert_block(
	{ given_name, target_table_name, is_many, blocks }: InsertBlock,
	parent_name: string | undefined,
): [string[], string[]] {
	const table = Registry.get_mutable(target_table_name).unwrap()

	// TODO we'll allow the insert table name to have table_name(key, other_key)
	// much like key chains

	const links = table.visible_tables.get(parent_name)
	if (links.length === 0) throw new LogError(["can't get to table: ", parent_name, target_table_name])
	if (links.length !== 1) throw new LogError(["ambiguous: ", parent_name, target_table_name])

	const [{ remote, foreign_key: { referred_columns, pointing_columns } }] = links
	if (!remote) throw new LogError([`${target_table_name} was listed as an insert child to ${parent_name}, but it doesn't point there`])
	const pointing_columns_index = pointing_columns.index_by(s => s)

	const pointing_names =
		Array.zip_equal(referred_columns, pointing_columns).unwrap()
		.map(([referred_name, pointing_name]) => `${referred_name} as ${pointing_name}`)
		.join(', ')

	const self_name = `__${target_table_name}`
	const parent_clause = `__${parent_name}_rows`

	const unpack_from = parent_name === undefined
		? is_many
			? `jsonb_array_elements($1) as _(_value)`
			: `(select $1) as _(_value)`
		: is_many
			? `(select ${pointing_names}, jsonb_array_elements(${parent_name}->'${given_name}') as _value from ${parent_clause}) _`
			: `(select ${pointing_names}, ${parent_name}->'${given_name}' as _value from ${parent_clause}) _`

	const raw_names = []
	const unpack_segments = []
	// TODO this is a place where we can filter out columns that the current role isn't allowed to insert
	for (const { name: column_name, column_type } of table.columns) {
		if (pointing_columns_index[column_name] !== undefined) {
			raw_names.push(pointing_columns_index[column_name])
			unpack_segments.push(pointing_columns_index[column_name])
			continue
		}

		raw_names.push(column_name)
		unpack_segments.push(column_unpack(column_name, pg_type(column_type)))
	}

	const self_unpack_clause = [
		`${self_name} as (`,
		'	select',
		unpack_segments.join(',\n'),
		`	from ${unpack_from}`,
		')',
	].join('\n')

	const rendered_raw_names = raw_names.join(', ')

	const self_insert_clause = [
		`__insert_${self_name} as (`,
		`	insert into ${target_table_name} (${rendered_raw_names})`,
		`	select ${rendered_raw_names}`,
		`	from ${self_name}`,
		')',
	].join('\n')

	const total_unpack_clauses = [self_unpack_clause]
	const total_insert_clauses = [self_insert_clause]
	for (const block of blocks) {
		const [unpack_clauses, insert_clauses] = insert_block(block, target_table_name)
		total_unpack_clauses.push_all(unpack_clauses)
		total_insert_clauses.push_all(insert_clauses)
	}

	return [unpack_clauses, insert_clauses]
}

export function pg_type(type: PgType) {
	return (type in BaseType) ? type
		: 'inner_type' in type ? `${pg_type(type.inner_type)}[]`
		: 'enum_name' in type ? type.enum_name
		: type.class_name
}

function column_unpack(name: string, type: string, default_value_expression?: string) {
	return default_value_expression !== undefined
		? `	case _value ? '${name}'`
			+ ` when true then (_value->>'${name}') :: ${type}`
			+ ` else ${default_value_expression}`
			+ ` end as ${name}`
		: `	(_value->>'${name}') :: ${type} as ${name}`
}



export function escape_single(value: string) {
	return value.replace(/(')/g, "\\'")
}

export function indent(value: string, level: number) {
	const tabs = '\t'.repeat(level)
	return value.split(/\s*\n/).map(s => tabs + s).join('\n')
}

export function quote(value: string) {
	return `'${value}'`
}

export function esc(value: string) {
	return `"${value}"`
}

export function paren(value: string) {
	return `(${value})`
}

function lines(...strings: string[]) {
	return strings.join('\n')
}
