import * as c from '@ts-std/codec'
import { promises as fs } from 'fs'
import { Dict } from '@ts-std/types'
import { Client, ClientConfig } from 'pg'
import { Maybe, Some, None } from '@ts-std/monads'

import { LogError } from './utils'

import { Console } from 'console'
const console = new Console({ stdout: process.stdout, stderr: process.stderr, inspectOptions: { depth: 5 } })

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


export const InspectionColumn = c.loose_object('InspectionColumn', {
	name: c.string,
	type_name: c.string,
	type_type: c.string,
	type_length: c.number,
	column_number: c.number,
	nullable: c.boolean,
	has_default_value: c.boolean,
	default_value_expression: c.nullable(c.string),
	// access_control_items: Object[],
})
export type InspectionColumn = c.TypeOf<typeof InspectionColumn>

export const InspectionTable = c.loose_object('InspectionTable', {
	name: c.string,
	table_oid: c.number,
	columns: c.array(InspectionColumn),
	constraints: c.array(InspectionConstraint),
	// access_control_items: Object[],
	// policies: Object[],
})
export type InspectionTable = c.TypeOf<typeof InspectionTable>



export async function get_client(config: ClientConfig) {
	const client = new Client(config)
	await client.connect()
	return client
}

export async function inspect(config: ClientConfig) {
	const client = await get_client(config)
	const inspect = await fs.readFile('./lib/inspect.sql', 'utf-8')

	const res = await client.query(inspect)

	console.log(res.rows)
	// console.log(res.rows[0].source)
	// const tables = c.array(InspectionTable).decode(res.rows[0].source).unwrap()

	// // TODO this loop just for experimentation
	// for (const table of tables) {
	// 	console.log(table.name)
	// 	console.log(table.table_oid)
	// 	// console.log(table.access_control_items)
	// 	console.log(table.columns)
	// 	console.log(table.constraints)
	// 	// console.log(table.policies)
	// 	console.log()
	// }

	await client.end()

	// return tables
}


export namespace Registry {
	// let registered_tokens = {} as Dict<TokenDef>
	// export function set_registered_tokens(new_registered_tokens: Dict<TokenDef>) {
	// 	registered_tokens = new_registered_tokens
	// }

	// export function get_token_def(token_name: string): Maybe<TokenDef> {
	// 	return Maybe.from_nillable(registered_tokens[token_name])
	// }

	// export function register_tokens(token_defs: TokenDef[]) {
	// 	registered_tokens = token_defs.unique_index_by('name').unwrap()
	// }

	// export function rawDeclareDumbTableSchema(
	// 	tables: string[],
	// 	// referred, pointing, column, unique
	// 	foreign_keys: [string, string, string, boolean][],
	// ) {
	// 	const names_to_tables: { [table_name: string]: InspectionTable } = {}

	// 	function makeIntColumn(
	// 		name: string, column_number: number,
	// 		nullable = false, has_default_value = true,
	// 	) {
	// 		return {
	// 			name, column_number: column_number, nullable, has_default_value,
	// 			type_name: 'int4', type_type: '', type_length: 4,
	// 		}
	// 	}

	// 	for (const [index, table_name] of tables.entries()) {
	// 		names_to_tables[table_name] = {
	// 			name: table_name,
	// 			table_oid: index,
	// 			columns: [
	// 				makeIntColumn('id', 1)
	// 			],
	// 			constraints: [
	// 				{ type: 'p', pointing_column_numbers: [1] } as InspectionPrimaryKey,
	// 			],
	// 		}
	// 	}

	// 	for (const [index, [referred_name, pointing_name, pointing_column, pointing_unique]] of foreign_keys.entries()) {
	// 		const column_number = index + 10
	// 		const pointing_table = names_to_tables[pointing_name]
	// 		if (!pointing_table) throw new Error(`blaine bad table_name ${pointing_name}`)
	// 		const referred_table = names_to_tables[referred_name]
	// 		if (!referred_table) throw new Error(`blaine bad table_name ${pointing_name}`)

	// 		pointing_table.columns.push(makeIntColumn(pointing_column, column_number, false, false))
	// 		pointing_table.constraints.push(
	// 			{
	// 				type: 'f', referred_table_oid: referred_table.table_oid,
	// 				referred_column_numbers: [1],
	// 				pointing_column_numbers: [column_number],
	// 			} as InspectionForeignKey
	// 		)

	// 		if (pointing_unique) {
	// 			pointing_table.constraints.push(
	// 				{ type: 'u', pointing_column_numbers: [column_number] } as InspectionUniqueConstraint
	// 			)
	// 		}
	// 	}

	// 	declare_inspection_results(Object.values(names_to_tables))
	// }
}




type TableLink = { remote: boolean, foreign_key: ForeignKey }


export class Table {
	// TODO want to include many-to-many auto-detection
	// if a foreign key points at me, that side is a many, unless it has a singular unique constraint
	// if I point at something, I'm a many
	// you have to detect many-to-many by seeing a table that has multiple fromMe

	// the visible_tables map needs to have an array of tablelinks,
	// since a table can be visible from another in many different ways
	readonly visible_tables: Dict<Tablelink> = {}
	// readonly visible_tables: Dict<Tablelink[]> = {}

	// whereas by key
	readonly visible_tables_by_key: Dict<Dict<Tablelink>> = {}
	// readonly visible_tables_by_key: { [key_name: string]: { [table_name: string]: Tablelink } } = {}

	constructor(
		readonly table_name: string,
		readonly primary_key_columns: Column[],
		readonly unique_constrained_columns: Column[][],
		// readonly checkConstraints: CheckConstraint[],
		readonly columns: Column[],
	) {}
}

// export class CheckConstraint {
// 	constructor(
// 		columns: Column[],
// 		expression: string,
// 	) {}

// 	renderTsCheck() {}
// 	renderRustCheck() {}
// }

export class Column {
	constructor(
		readonly column_name: string,
		readonly column_type: PgType,
		readonly nullable: boolean,
		readonly has_default_value: boolean,
		// readonly default_value_expression: string | null,
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

let table_lookup_map: { [table_name: string]: Table } = {}

export function _resetTableLookupMap() {
	table_lookup_map = {}
}

export function lookup_table(table_name: string) {
	const table = table_lookup_map[table_name]
	if (!table) throw new LogError("non-existent table: ", table_name)
	return table
}

export function declare_inspection_results(tables: InspectionTable[]): Table[] {
	const oid_tables: { [table_oid: number]: InspectionTable } = {}
	const oid_uniques: { [table_oid: number]: Column[][] } = {}

	for (const table of tables) {
		const { name: table_name, table_oid, columns: inspection_columns, constraints } = table

		const columns_map = inspection_columns.reduce((obj, inspection_column) => {
			obj[inspection_column.name] = new Column(
				inspection_column.name,
				get_column_type(inspection_column.type_name),
				inspection_column.nullable,
				inspection_column.has_default_value,
			)
			return obj
		}, {} as { [column_name: string]: Column })

		function getColumn(inspection_column: InspectionColumn): Column {
			const column_name = inspection_column.name
			const column = columns_map[column_name]
			if (!column) throw new LogError(`column ${column_name} couldn't be found in the columns_map?`, columns_map)
			return column
		}

		const primaryKeyConstraint = constraints.find(constraint => constraint.type === 'p')
		const primary_key_columns = primaryKeyConstraint === undefined
			? []
			: inspection_columns
				.filter(column => primaryKeyConstraint.pointing_column_numbers.includes(column.column_number))
				.map(getColumn)

		const unique_constrained_columns = constraints
			.filter(constraint => constraint.type === 'u')
			.map(
				constraint => inspection_columns
					.filter(column => constraint.pointing_column_numbers.includes(column.column_number))
					.map(getColumn)
			)

		// TODO include primary_key_columns in unique_constrained_columns?

		const normalColumns = Object.values(columns_map)

		table_lookup_map[table_name] = new Table(
			table_name,
			primary_key_columns,
			unique_constrained_columns,
			normalColumns,
		)

		oid_tables[table_oid as number] = table
		oid_uniques[table_oid as number] = unique_constrained_columns
	}

	for (const pointing_table of tables) {
		const foreign_key_constraints = pointing_table.constraints
			.filter((constraint): constraint is InspectionForeignKey => constraint.type === 'f')

		for (const { referred_table_oid, referred_column_numbers, pointing_column_numbers } of foreign_key_constraints) {
			const referred_table = oid_tables[referred_table_oid]

			const referred_names = referred_table.columns
				.filter(column => referred_column_numbers.includes(column.column_number))
				.map(column => column.name)
			const pointing_names = pointing_table.columns
				.filter(column => pointing_column_numbers.includes(column.column_number))
				.map(column => column.name)

			// if *any subset* of the columns in a key have a unique constraint,
			// then the entire key must be unique
			// for example, if there's a three column key, (one, two, three), and one must be unique,
			// then by extension the combination of the three must be as well
			// since if one is repeated (which is necessary for a combination to be repeated), that's a violation of one's uniqueness
			// also, if two and three must be unique together, then if a combination of them is repeated,
			// (which is necessary for a combination to be repeated), that's a violation of the combination's uniqueness

			// go through all unique constraints
			// if any of those constraints is a subset of the pointing columns of this key
			// then the key is pointing_unique
			// to determine if the constraint is a subset
			// go through the uniqueConstrainedNames, and every one of those must be inside the key
			const pointing_unique = (oid_uniques[pointing_table.table_oid] || [])
				.some(
					unique_columns => unique_columns
						.map(column => column.column_name).every(unique_name => pointing_names.includes(unique_name))
				)

			declare_foreign_key(
				referred_table.name, referred_names,
				pointing_table.name, pointing_names,
				pointing_unique,
			)
		}
	}

	return Object.values(table_lookup_map)
}

// export class KeyLookupMap {
// 	readonly visible_tables_by_key: { [key_name: string]: VisibleTable } = {}
// 	constructor() {}

// 	get(pointing_columns: string[], table_name: string) {
// 		const pointing_columns_key = pointing_columns.join(',')
// 		return (visible_tables_by_key[pointing_columns_key] || {})[table_name]
// 	}

// 	set(pointing_columns: string[], value) {

// 	}
// }

function declare_foreign_key(
	referred_table_name: string, referred_columns: string[],
	pointing_table_name: string, pointing_columns: string[],
	pointing_unique: boolean,
) {
	// if someone's pointing to us with a unique foreign key, then both sides are a single object
	const referred_table = lookup_table(referred_table_name)
	const pointing_table = lookup_table(pointing_table_name)

	const foreign_key = new ForeignKey(referred_table, referred_columns, pointing_table, pointing_columns, pointing_unique)

	// each has a visible reference to the other
	const referred_visible_table = { remote: true, foreign_key }
	const pointing_visible_table = { remote: false, foreign_key }

	referred_table.visible_tables[pointing_table_name] = referred_visible_table
	pointing_table.visible_tables[referred_table_name] = pointing_visible_table

	const pointing_columns_key = pointing_columns.join(',')
	referred_table.visible_tables_by_key[pointing_columns_key] = referred_table.visible_tables_by_key[pointing_columns_key] || {}
	referred_table.visible_tables_by_key[pointing_columns_key][pointing_table_name] = referred_visible_table
	pointing_table.visible_tables_by_key[pointing_columns_key] = pointing_table.visible_tables_by_key[pointing_columns_key] || {}
	pointing_table.visible_tables_by_key[pointing_columns_key][referred_table_name] = pointing_visible_table
}


export function check_many_correctness(pointing_unique: boolean, remote: boolean, entity_is_many: boolean) {
	// basically, something can (must) be a single if the parent is pointing,
	// or if the key is unique (which means it doesn't matter which way)
	const key_is_singular = pointing_unique || !remote
	if (entity_is_many && key_is_singular) throw new LogError("incorrectly wanting many")
	// they want only one
	if (!entity_is_many && !key_is_singular) throw new LogError("incorrectly wanting only one")
}

// export class DbClient {
// 	private client: Client

// 	static async create(config: ClientConfig) {
// 		const db_client = new DbClient(config)
// 		await db_client.connect()
// 	}

// 	private constructor(config: ClientConfig) {
// 		this.client = new Client(config)
// 	}

// 	inspect() {

// 	}
// }
