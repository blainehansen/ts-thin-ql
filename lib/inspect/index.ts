import * as c from '@ts-std/codec'
import { promises as fs } from 'fs'
import '@ts-std/extensions/dist/array'
import '@ts-std/extensions/dist/promise'
import { Client, ClientConfig } from 'pg'
import { Dict, tuple as t } from '@ts-std/types'
import { DefaultDict } from '@ts-std/collections'
import { Result, Ok, Err, Maybe, Some, None } from '@ts-std/monads'

import { PgType } from './inspect_pg_types'

// import { Console } from 'console'
// const console = new Console({ stdout: process.stdout, stderr: process.stderr, inspectOptions: { depth: 5 } })

export const InspectionPrimaryKey = c.loose_object('InspectionPrimaryKey', {
	type: c.literal('p'),
	constrained_column_numbers: c.array(c.number),
})
export type InspectionPrimaryKey = c.TypeOf<typeof InspectionPrimaryKey>

export const InspectionForeignKey = c.loose_object('InspectionForeignKey', {
	type: c.literal('f'),
	referred_table_oid: c.number,
	referred_column_numbers: c.array(c.number),
	constrained_column_numbers: c.array(c.number),
})
export type InspectionForeignKey = c.TypeOf<typeof InspectionForeignKey>

export const InspectionCheckConstraint = c.loose_object('InspectionCheckConstraint', {
	type: c.literal('c'),
	constrained_column_numbers: c.array(c.number),
	check_constraint_expression: c.string,
})
export type InspectionCheckConstraint = c.TypeOf<typeof InspectionCheckConstraint>

export const InspectionUniqueConstraint = c.loose_object('InspectionUniqueConstraint', {
	type: c.literal('u'),
	constrained_column_numbers: c.array(c.number),
})
export type InspectionUniqueConstraint = c.TypeOf<typeof InspectionUniqueConstraint>

export const InspectionConstraint = c.union(
	InspectionPrimaryKey,
	InspectionForeignKey,
	InspectionCheckConstraint,
	InspectionUniqueConstraint,
)
export type InspectionConstraint = c.TypeOf<typeof InspectionConstraint>

export const InspectionGrant = c.object('InspectionGrant', {
	grantee: c.string,
	privilege_type: c.literals('SELECT', 'INSERT', 'UPDATE', 'DELETE'),
})
export type InspectionGrant = c.TypeOf<typeof InspectionGrant>

export const InspectionColumn = c.object('InspectionColumn', {
	name: c.string,
	type: PgType,
	// type_length: c.number,
	column_number: c.number,
	nullable: c.boolean,
	default_value_expression: c.nullable(c.string),
	grants: c.array(InspectionGrant),
	// policies: c.array(InspectionPolicy),
})
export type InspectionColumn = c.TypeOf<typeof InspectionColumn>

export const InspectionTable = c.object('InspectionTable', {
	name: c.string,
	table_oid: c.number,
	type: c.literals('table', 'view', 'materalized_view', 'partitioned_table'),
	columns: c.array(InspectionColumn),
	computed_columns: c.array(c.object('InspectionComputedColumn', {
		name: c.string, type: PgType,
	})),
	constraints: c.array(InspectionConstraint),
	grants: c.array(InspectionGrant),
	// policies: c.array(InspectionPolicy),
})
export type InspectionTable = c.TypeOf<typeof InspectionTable>


export const TypeDefinition = c.object('TypeDefinition', {
	name: c.string,
	definition: c.union(
		// InspectionEnum
		c.array(c.string),
		// InspectionCompositeType
		c.array(c.object('InspectionCompositeTypeField', {
			name: c.string, type: PgType,
		})),
	),
})
export type TypeDefinition = c.TypeOf<typeof TypeDefinition>


export const InspectionProcedureGrant = c.object('InspectionProcedureGrant', {
	grantee: c.string,
	privilege_type: c.literal('EXECUTE'),
})
export type InspectionProcedureGrant = c.TypeOf<typeof InspectionProcedureGrant>

export const InspectionProcedure = c.object('InspectionProcedure', {
	name: c.string,
	volatility: c.literals('immutable', 'stable', 'volatile'),
	return_type: PgType,
	argument_types: c.array(PgType),
	grants: c.array(InspectionProcedureGrant),
})
export type InspectionProcedure = c.TypeOf<typeof InspectionProcedure>


export async function get_client(config: ClientConfig) {
	const client = new Client(config)
	await client.connect()
	return client
}

export async function inspect(config: ClientConfig) {
	const [client, __utils, _procedures, _tables, _types] = await Promise.join(
		get_client(config),
		fs.readFile('./lib/inspect/__utils.sql', 'utf-8'), fs.readFile('./lib/inspect/_types.sql', 'utf-8'),
		fs.readFile('./lib/inspect/_tables.sql', 'utf-8'), fs.readFile('./lib/inspect/_procedures.sql', 'utf-8'),
	)

	await client.query(__utils)
	const [procedures_res, tables_res, types_res] = await Promise.join(
		client.query(_procedures), client.query(_tables), client.query(_types)
	)

	const types = c.array(TypeDefinition).decode(types_res.rows[0].results).unwrap()
	const tables = c.array(InspectionTable).decode(tables_res.rows[0].results).unwrap()
	const procedures = c.array(InspectionProcedure).decode(procedures_res.rows[0].results).unwrap()

	await client.end()
	return t(types, tables, procedures)
}



type TableLink = { remote: boolean, foreign_key: ForeignKey }

export class Table<T extends InspectionTable['type'] = InspectionTable['type']> {
	readonly visible_tables = new DefaultDict<TableLink[]>(() => [])
	readonly visible_tables_by_key = new DefaultDict<Dict<TableLink>>(() => ({}))
	readonly grants: { INSERT: string[], SELECT: string[], UPDATE: string[], DELETE: string[] }

	constructor(
		readonly name: string,
		readonly type: T,
		readonly primary_key_columns: Column[],
		readonly unique_constrained_columns: Column[][],
		readonly check_constraints: CheckConstraint[],
		readonly columns: Column[],
		grants: InspectionGrant[],
	) {
		this.grants = grants.group_by_map(g => [g.privilege_type, g.grantee])
	}
}

export class Column {
	readonly grants: { INSERT: string[], SELECT: string[], UPDATE: string[], DELETE: string[] }
	constructor(
		readonly name: string,
		readonly column_type: PgType,
		readonly nullable: boolean,
		readonly default_value_expression: string | null,
		grants: InspectionGrant[],
	) {
		this.grants = grants.group_by_map(g => [g.privilege_type, g.grantee])
	}

	get has_default_value(): boolean {
		return !!this.default_value_expression
	}
}

export class Procedure<V extends InspectionProcedure['type'] = InspectionProcedure['type']> {
	readonly allowed_executors: Dict<true>
	constructor(
		readonly name: string,
		readonly volatility: V,
		readonly return_type: PgType,
		readonly argument_types: PgType[],
		grants: InspectionProcedureGrant[],
	) {
		this.allowed_executors = grants.index_map(g => t(g.grantee, true))
	}
}

export class CheckConstraint {
	constructor(
		readonly columns: Column[],
		readonly expression: string,
	) {}
}

export class ForeignKey {
	constructor(
		readonly referred_table: Table,
		readonly referred_columns: string[],
		readonly pointing_table: Table,
		readonly pointing_columns: string[],
		readonly pointing_unique: boolean,
	) {}
}


type Queryable = Table | Procedure<'immutable' | 'stable'>
type QueryProcedure = Procedure<'immutable' | 'stable'>
type Mutable = Table<'table' | 'partitioned_table'>
type Executable = Procedure<'volatile'>

function procedure_is_queryable(procedure: Procedure) {
	const { return_type, argument_types } = procedure
	return
		argument_types.length === 0
		&& typeof return_type === 'object'
		&& 'inner_type' in procedure.return_type
		&& typeof procedure.return_type.inner_type === 'object'
		&& 'class_name' in procedure.return_type.inner_type
}

function procedure_is_nonvolatile(procedure: Procedure): procedure is Procedure<'immutable' | 'stable'> {
	return procedure.volatility !== 'volatile'
}
function table_is_mutable(table: Table): table is Table<'table' | 'partitioned_table'> {
	return table.volatility === 'table' || table.volatility === 'partitioned_table'
}


// type RegistryManifest<M extends Dict<any>> = { [K in keyof M]: Dict<M[K]> }

// export class Registry<M extends Dict<any> = {}> {
// 	private domains: RegistryManifest<M> = {}

// 	get(key: keyof M, name: string) {
// 		return Maybe.from_nillable((this.domains[key] = this.domains[key] || {})[name])
// 	}
// 	set<_K extends keyof M>(key: _K, new_items: Dict<M[_K]>) {
// 		this.domains[key] = new_items
// 	}
// 	register() {
// 		//
// 	}
// }

// export const Registry = new Registry<{
// 	type_definitions: TypeDefinition,
// 	queryables: Queryable,
// 	query_procedures: QueryProcedure,
// 	mutables: Mutable,
// 	executable: Executable,
// }>()


export namespace Registry {
	let registered_type_definitions: Dict<TypeDefinition> = {}
	export function get_type_definition(type_definition_name: string): Maybe<TypeDefinition> {
		return Maybe.from_nillable(registered_type_definitions[type_definition_name])
	}
	export function set_registered_type_definitions(new_registered_type_definitions: Dict<TypeDefinition>) {
		registered_type_definitions = new_registered_type_definitions
	}
	export function register_type_definitions(type_definitions: TypeDefinition[]) {
		registered_type_definitions = type_definitions.unique_index_by('name').unwrap()
	}

	let registered_queryables: Dict<Queryable> = {}
	export function get_queryable(queryable_name: string): Maybe<Queryable> {
		return Maybe.from_nillable(registered_queryables[queryable_name])
	}
	export function set_registered_queryables(new_registered_queryables: Dict<Queryable>) {
		registered_queryables = new_registered_queryables
	}
	export function register_queryables(queryables: Queryable[]) {
		registered_queryables = queryables.unique_index_by('name').unwrap()
	}

	let registered_query_procedures: Dict<QueryProcedure> = {}
	export function get_query_procedure(query_procedure_name: string): Maybe<QueryProcedure> {
		return Maybe.from_nillable(registered_query_procedures[query_procedure_name])
	}
	export function set_registered_query_procedures(new_registered_query_procedures: Dict<QueryProcedure>) {
		registered_query_procedures = new_registered_query_procedures
	}
	export function register_query_procedures(query_procedures: QueryProcedure[]) {
		registered_query_procedures = query_procedures.unique_index_by('name').unwrap()
	}

	let registered_mutables: Dict<Mutable> = {}
	export function get_mutable(mutable_name: string): Maybe<Mutable> {
		return Maybe.from_nillable(registered_mutables[mutable_name])
	}
	export function set_registered_mutables(new_registered_mutables: Dict<Mutable>) {
		registered_mutables = new_registered_mutables
	}
	export function register_mutables(mutables: Mutable[]) {
		registered_mutables = mutables.unique_index_by('name').unwrap()
	}

	let registered_executables: Dict<Executable> = {}
	export function get_executable(executable_name: string): Maybe<Executable> {
		return Maybe.from_nillable(registered_executables[executable_name])
	}
	export function set_registered_executables(new_registered_executables: Dict<Executable>) {
		registered_executables = new_registered_executables
	}
	export function register_executables(executables: Executable[]) {
		registered_executables = tables.unique_index_by('name').unwrap()
	}
}

export function declare_inspection_results(
	types: TypeDefinition[], inspection_tables: InspectionTable[], inspection_procedures: InspectionProcedure[],
): [TypeDefinition[], Table[], ] {
	const oid_tables: Dict<InspectionTable> = {}
	const oid_uniques: Dict<Column[][]> = {}

	const tables = [] as Table[]

	for (const table of inspection_tables) {
		const { name: table_name, table_oid, columns: inspection_columns, constraints, grants } = table
		const columns_map = inspection_columns.unique_index_map(inspection_column => t(
			inspection_column.column_number,
			new Column(
				inspection_column.name,
				inspection_column.type_name,
				inspection_column.nullable,
				inspection_column.default_value_expression,
				inspection_column.grants,
			),
		)).unwrap()

		function get_column_by_number(column_number: number): Column {
			return Maybe.from_nillable(columns_map[column_number]).unwrap()
		}

		const primary_key_constraint = constraints.find(constraint => constraint.type === 'p')
		const primary_key_columns = primary_key_constraint === undefined
			? []
			: primary_key_constraint.constrained_column_numbers.map(get_column_by_number)

		const unique_constrained_columns = constraints
			.filter(constraint => constraint.type === 'u')
			.map(constraint => constraint.constrained_column_numbers.map(get_column_by_number))
			.concat([primary_key_columns])

		const check_constraints = constraints
			.filter((constraint): constraint is InspectionCheckConstraint => constraint.type === 'c')
			.map(constraint => new CheckConstraint(
				constraint.constrained_column_numbers.map(get_column_by_number),
				constraint.check_constraint_expression,
			))

		const all_columns = Object.values(columns_map)

		tables.push(new Table(
			table_name,
			primary_key_columns,
			unique_constrained_columns,
			check_constraints,
			all_columns,
			grants,
		))

		oid_tables[table_oid] = table
		oid_uniques[table_oid] = unique_constrained_columns
	}

	const table_map = tables.unique_index_by('name').unwrap()

	for (const pointing_table of inspection_tables) {
		const foreign_key_constraints = pointing_table.constraints
			.filter((constraint): constraint is InspectionForeignKey => constraint.type === 'f')

		for (const { referred_table_oid, referred_column_numbers, constrained_column_numbers } of foreign_key_constraints) {
			const referred_table = oid_tables[referred_table_oid]!

			const referred_names = referred_table.columns
				.filter(column => referred_column_numbers.includes(column.column_number))
				.map(column => column.name)
			const pointing_names = pointing_table.columns
				.filter(column => constrained_column_numbers.includes(column.column_number))
				.map(column => column.name)

			// if *any subset* of the columns in a key have a unique constraint,
			// then the entire key must be unique
			// for example, if there's a three column key, ("one", "two", "three"), and "one" must be unique,
			// then by extension the combination of the three must be as well
			// since if one is repeated (which is necessary for a combination to be repeated), that's a violation of one's uniqueness
			// also, if two and three must be unique together, then if a combination of them is repeated,
			// (which is necessary for a total combination to be repeated), that's a violation of the combination's uniqueness

			// go through all unique constraints
			// if any of those constraints is a subset of the pointing columns of this key
			// then the key is pointing_unique
			// to determine if the constraint is a subset
			// go through the unique_constrained_names, and every one of those must be inside the key
			const pointing_unique = (oid_uniques[pointing_table.table_oid] || [])
				.some(
					unique_columns => unique_columns
						.map(column => column.name).every(unique_name => pointing_names.includes(unique_name))
				)

			declare_foreign_key(
				table_map[referred_table.name]!, referred_names,
				table_map[pointing_table.name]!, pointing_names,
				pointing_unique,
			)
		}
	}

	const procedures = inspection_procedures.map(p => new Procedure(
		name: p.name,
		volatility: p.volatility,
		return_type: p.return_type,
		argument_types: p.argument_types,
		grants: p.grants,
	))

	Registry.register_type_definitions(types)

	const mutables = tables.filter(table_is_mutable)
	Registry.register_mutables(mutables)

	const nonvolatiles = procedures.filter(procedure_is_nonvolatile)
	const [queryables, query_procedures] = nonvolatiles.split_by(procedure_is_queryable)
	Registry.register_queryables(tables.concat(queryables))
	Registry.register_query_procedures(query_procedures)

	const executables = procedures.filter((e): e is Procedure<'volatile'> => !procedure_is_nonvolatile(e))
	Registry.register_executables(executables)


	return Object.values(registered_queryables)
}


function declare_foreign_key(
	referred_table: Table, referred_columns: string[],
	pointing_table: Table, pointing_columns: string[],
	pointing_unique: boolean,
) {
	// if someone's pointing to us with a unique foreign key, then both sides are a single object
	const foreign_key = new ForeignKey(referred_table, referred_columns, pointing_table, pointing_columns, pointing_unique)
	const pointing_table_name = pointing_table.name
	const referred_table_name = referred_table.name

	// each has a visible reference to the other
	const referred_visible_table = { remote: true, foreign_key }
	const pointing_visible_table = { remote: false, foreign_key }

	referred_table.visible_tables.get(pointing_table_name).push(referred_visible_table)
	pointing_table.visible_tables.get(referred_table_name).push(pointing_visible_table)

	const pointing_columns_key = pointing_columns.join(',')
	referred_table.visible_tables_by_key.get(pointing_columns_key)[pointing_table_name] = referred_visible_table
	pointing_table.visible_tables_by_key.get(pointing_columns_key)[referred_table_name] = pointing_visible_table
}


export function check_many_correctness(pointing_unique: boolean, remote: boolean, entity_is_many: boolean): Result<void, boolean> {
	// basically, something can (must) be a single if the parent is pointing,
	// or if the key is unique (which means it doesn't matter which way)
	const key_is_singular = pointing_unique || !remote

	// incorrectly wanting many
	if (entity_is_many && key_is_singular) return Err(true)
	// incorrectly wanting only one
	if (!entity_is_many && !key_is_singular) return Err(false)

	return Ok(undefined as void)
}

// TODO will want functions to detect if an insert/update could throw errors
// such as a constraint or policy violation
// we can easily have a discriminated type that exposes these potential problems
