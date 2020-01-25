import * as c from '@ts-std/codec'
import { promises as fs } from 'fs'
import { Dict } from '@ts-std/types'
import { Client, ClientConfig } from 'pg'
import { Maybe, Some, None } from '@ts-std/monads'

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
	const inspect = await fs.readFile('./src/inspect.sql', 'utf-8')

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
	// let registered_rules = {} as Dict<Rule>
	// export function set_registered_rules(new_registered_rules: Dict<Rule>) {
	// 	registered_rules = new_registered_rules
	// }
	// let registered_macros = {} as Dict<Macro>
	// export function set_registered_macros(new_registered_macros: Dict<Macro>) {
	// 	registered_macros = new_registered_macros
	// }
	// let registered_virtual_lexers = {} as Dict<VirtualLexerUsage>
	// export function set_registered_virtual_lexers(new_registered_virtual_lexers: Dict<VirtualLexerUsage>) {
	// 	registered_virtual_lexers = new_registered_virtual_lexers
	// }

	// export function get_token(token_name: string): Maybe<string> {
	// 	if (token_name in registered_tokens)
	// 		return Some(token_name)

	// 	for (const virtual_lexer of Object.values(registered_virtual_lexers))
	// 		if (token_name in virtual_lexer.exposed_tokens)
	// 			return Some(token_name)

	// 	return None
	// }
	// export function get_token_def(token_name: string): Maybe<TokenDef> {
	// 	return Maybe.from_nillable(registered_tokens[token_name])
	// }
	// export function get_rule(rule_name: string): Maybe<Rule> {
	// 	return Maybe.from_nillable(registered_rules[rule_name])
	// }
	// export function get_macro(macro_name: string): Maybe<Macro> {
	// 	return Maybe.from_nillable(registered_macros[macro_name])
	// }

	// export function register_tokens(token_defs: TokenDef[]) {
	// 	registered_tokens = token_defs.unique_index_by('name').unwrap()
	// }
	// export function register_rules(rules: Rule[]) {
	// 	registered_rules = rules.unique_index_by('name').unwrap()
	// }
	// export function register_macros(macros: Macro[]) {
	// 	registered_macros = macros.unique_index_by('name').unwrap()
	// }
	// export function register_virtual_lexers(virtual_lexers: VirtualLexerUsage[]) {
	// 	registered_virtual_lexers = virtual_lexers.unique_index_by('virtual_lexer_name').unwrap()
	// }

	// export function rawDeclareDumbTableSchema(
	// 	tables: string[],
	// 	// referred, pointing, column, unique
	// 	foreignKeys: [string, string, string, boolean][],
	// ) {
	// 	const namesToTables: { [tableName: string]: InspectionTable } = {}

	// 	function makeIntColumn(
	// 		name: string, column_number: number,
	// 		nullable = false, has_default_value = true,
	// 	) {
	// 		return {
	// 			name, column_number: column_number, nullable, has_default_value,
	// 			type_name: 'int4', type_type: '', type_length: 4,
	// 		}
	// 	}

	// 	for (const [index, tableName] of tables.entries()) {
	// 		namesToTables[tableName] = {
	// 			name: tableName,
	// 			table_oid: index,
	// 			columns: [
	// 				makeIntColumn('id', 1)
	// 			],
	// 			constraints: [
	// 				{ type: 'p', pointing_column_numbers: [1] } as InspectionPrimaryKey,
	// 			],
	// 		}
	// 	}

	// 	for (const [index, [referredName, pointingName, pointingColumn, pointingUnique]] of foreignKeys.entries()) {
	// 		const columnNumber = index + 10
	// 		const pointingTable = namesToTables[pointingName]
	// 		if (!pointingTable) throw new Error(`blaine bad tableName ${pointingName}`)
	// 		const referredTable = namesToTables[referredName]
	// 		if (!referredTable) throw new Error(`blaine bad tableName ${pointingName}`)

	// 		pointingTable.columns.push(makeIntColumn(pointingColumn, columnNumber, false, false))
	// 		pointingTable.constraints.push(
	// 			{
	// 				type: 'f', referred_table_oid: referredTable.table_oid,
	// 				referred_column_numbers: [1],
	// 				pointing_column_numbers: [columnNumber],
	// 			} as InspectionForeignKey
	// 		)

	// 		if (pointingUnique) {
	// 			pointingTable.constraints.push(
	// 				{ type: 'u', pointing_column_numbers: [columnNumber] } as InspectionUniqueConstraint
	// 			)
	// 		}
	// 	}

	// 	declareInspectionResults(Object.values(namesToTables))
	// }
}






// import { promises as fs } from 'fs'
// import { LogError } from './utils'
// import { Client, ClientConfig } from 'pg'
// import { PgType, PgInt, PgFloat, PgText, PgBool, PgEnum, PgTypeDeterminant } from './pgTypes'


// type TableLink = { remote: boolean, foreignKey: ForeignKey }
// type VisibleTable = { [tableName: string]: TableLink }


// export class Table {
// 	// TODO want to include many-to-many auto-detection
// 	// if a foreign key points at me, that side is a many, unless it has a singular unique constraint
// 	// if I point at something, I'm a many
// 	// you have to detect many-to-many by seeing a table that has multiple fromMe

// 	// the visibleTables map needs to have an array of tablelinks,
// 	// since a table can be visible from another in many different ways
// 	readonly visibleTables: VisibleTable = {}
// 	// readonly visibleTables: { [tableName: string]: Tablelink[] } = {}

// 	// whereas by key
// 	readonly visibleTablesByKey: { [keyName: string]: VisibleTable } = {}
// 	// readonly visibleTablesByKey: { [keyName: string]: { [tableName: string]: Tablelink } } = {}

// 	constructor(
// 		readonly tableName: string,
// 		readonly primaryKeyColumns: Column[],
// 		readonly uniqueConstrainedColumns: Column[][],
// 		// readonly checkConstraints: CheckConstraint[],
// 		readonly columns: Column[],
// 	) {}
// }

// // export class CheckConstraint {
// // 	constructor(
// // 		columns: Column[],
// // 		expression: string,
// // 	) {}

// // 	renderTsCheck() {}
// // 	renderRustCheck() {}
// // }

// export class Column {
// 	constructor(
// 		readonly columnName: string,
// 		readonly columnType: PgType,
// 		readonly nullable: boolean,
// 		readonly hasDefaultValue: boolean,
// 		// readonly defaultValueExpression: string | null,
// 	) {}
// 	// get isSerial: boolean,
// }


// export class ForeignKey {
// 	constructor(
// 		readonly referredTable: Table,
// 		readonly referredColumns: string[],
// 		readonly pointingTable: Table,
// 		readonly pointingColumns: string[],
// 		readonly pointingUnique: boolean,
// 	) {}
// }

// let tableLookupMap: { [tableName: string]: Table } = {}

// export function _resetTableLookupMap() {
// 	tableLookupMap = {}
// }

// export function lookupTable(tableName: string) {
// 	const table = tableLookupMap[tableName]
// 	if (!table) throw new LogError("non-existent table: ", tableName)
// 	return table
// }

// export function declareInspectionResults(tables: InspectionTable[]): Table[] {
// 	const oidTables: { [table_oid: number]: InspectionTable } = {}
// 	const oidUniques: { [table_oid: number]: Column[][] } = {}

// 	for (const table of tables) {
// 		const { name: tableName, table_oid, columns: inspectionColumns, constraints } = table

// 		const columnsMap = inspectionColumns.reduce((obj, inspectionColumn) => {
// 			obj[inspectionColumn.name] = new Column(
// 				inspectionColumn.name,
// 				getColumnType(inspectionColumn.type_name),
// 				inspectionColumn.nullable,
// 				inspectionColumn.has_default_value,
// 			)
// 			return obj
// 		}, {} as { [columnName: string]: Column })

// 		function getColumn(inspectionColumn: InspectionColumn): Column {
// 			const columnName = inspectionColumn.name
// 			const column = columnsMap[columnName]
// 			if (!column) throw new LogError(`column ${columnName} couldn't be found in the columnsMap?`, columnsMap)
// 			return column
// 		}

// 		const primaryKeyConstraint = constraints.find(constraint => constraint.type === 'p')
// 		const primaryKeyColumns = primaryKeyConstraint === undefined
// 			? []
// 			: inspectionColumns
// 				.filter(column => primaryKeyConstraint.pointing_column_numbers.includes(column.column_number))
// 				.map(getColumn)

// 		const uniqueConstrainedColumns = constraints
// 			.filter(constraint => constraint.type === 'u')
// 			.map(
// 				constraint => inspectionColumns
// 					.filter(column => constraint.pointing_column_numbers.includes(column.column_number))
// 					.map(getColumn)
// 			)

// 		// TODO include primaryKeyColumns in uniqueConstrainedColumns?

// 		const normalColumns = Object.values(columnsMap)

// 		tableLookupMap[tableName] = new Table(
// 			tableName,
// 			primaryKeyColumns,
// 			uniqueConstrainedColumns,
// 			normalColumns,
// 		)

// 		oidTables[table_oid as number] = table
// 		oidUniques[table_oid as number] = uniqueConstrainedColumns
// 	}

// 	for (const pointingTable of tables) {
// 		const foreignKeyConstraints = pointingTable.constraints
// 			.filter((constraint): constraint is InspectionForeignKey => constraint.type === 'f')

// 		for (const { referred_table_oid, referred_column_numbers, pointing_column_numbers } of foreignKeyConstraints) {
// 			const referredTable = oidTables[referred_table_oid]

// 			const referredNames = referredTable.columns
// 				.filter(column => referred_column_numbers.includes(column.column_number))
// 				.map(column => column.name)
// 			const pointingNames = pointingTable.columns
// 				.filter(column => pointing_column_numbers.includes(column.column_number))
// 				.map(column => column.name)

// 			// if *any subset* of the columns in a key have a unique constraint,
// 			// then the entire key must be unique
// 			// for example, if there's a three column key, (one, two, three), and one must be unique,
// 			// then by extension the combination of the three must be as well
// 			// since if one is repeated (which is necessary for a combination to be repeated), that's a violation of one's uniqueness
// 			// also, if two and three must be unique together, then if a combination of them is repeated,
// 			// (which is necessary for a combination to be repeated), that's a violation of the combination's uniqueness

// 			// go through all unique constraints
// 			// if any of those constraints is a subset of the pointing columns of this key
// 			// then the key is pointingUnique
// 			// to determine if the constraint is a subset
// 			// go through the uniqueConstrainedNames, and every one of those must be inside the key
// 			const pointingUnique = (oidUniques[pointingTable.table_oid] || [])
// 				.some(
// 					uniqueColumns => uniqueColumns
// 						.map(column => column.columnName).every(uniqueName => pointingNames.includes(uniqueName))
// 				)

// 			declareForeignKey(
// 				referredTable.name, referredNames,
// 				pointingTable.name, pointingNames,
// 				pointingUnique,
// 			)
// 		}
// 	}

// 	return Object.values(tableLookupMap)
// }

// // export class KeyLookupMap {
// // 	readonly visibleTablesByKey: { [keyName: string]: VisibleTable } = {}
// // 	constructor() {}

// // 	get(pointingColumns: string[], tableName: string) {
// // 		const pointingColumnsKey = pointingColumns.join(',')
// // 		return (visibleTablesByKey[pointingColumnsKey] || {})[tableName]
// // 	}

// // 	set(pointingColumns: string[], value) {

// // 	}
// // }

// function declareForeignKey(
// 	referredTableName: string, referredColumns: string[],
// 	pointingTableName: string, pointingColumns: string[],
// 	pointingUnique: boolean,
// ) {
// 	// if someone's pointing to us with a unique foreign key, then both sides are a single object
// 	const referredTable = lookupTable(referredTableName)
// 	const pointingTable = lookupTable(pointingTableName)

// 	const foreignKey = new ForeignKey(referredTable, referredColumns, pointingTable, pointingColumns, pointingUnique)

// 	// each has a visible reference to the other
// 	const referredVisibleTable = { remote: true, foreignKey }
// 	const pointingVisibleTable = { remote: false, foreignKey }

// 	referredTable.visibleTables[pointingTableName] = referredVisibleTable
// 	pointingTable.visibleTables[referredTableName] = pointingVisibleTable

// 	const pointingColumnsKey = pointingColumns.join(',')
// 	referredTable.visibleTablesByKey[pointingColumnsKey] = referredTable.visibleTablesByKey[pointingColumnsKey] || {}
// 	referredTable.visibleTablesByKey[pointingColumnsKey][pointingTableName] = referredVisibleTable
// 	pointingTable.visibleTablesByKey[pointingColumnsKey] = pointingTable.visibleTablesByKey[pointingColumnsKey] || {}
// 	pointingTable.visibleTablesByKey[pointingColumnsKey][referredTableName] = pointingVisibleTable
// }


// export function checkManyCorrectness(pointingUnique: boolean, remote: boolean, entityIsMany: boolean) {
// 	// basically, something can (must) be a single if the parent is pointing,
// 	// or if the key is unique (which means it doesn't matter which way)
// 	const keyIsSingular = pointingUnique || !remote
// 	if (entityIsMany && keyIsSingular) throw new LogError("incorrectly wanting many")
// 	// they want only one
// 	if (!entityIsMany && !keyIsSingular) throw new LogError("incorrectly wanting only one")
// }

// function getColumnType(typeText: string): PgType {
// 	switch (typeText) {
// 		case 'int2':
// 			return { type: PgTypeDeterminant.INT, size: 2, isSerial: false }
// 		case 'int4':
// 			return { type: PgTypeDeterminant.INT, size: 4, isSerial: false }
// 		case 'int8':
// 			return { type: PgTypeDeterminant.INT, size: 8, isSerial: false }
// 		case 'text':
// 			return { type: PgTypeDeterminant.TEXT, maxSize: undefined }
// 		case 'bool':
// 			return { type: PgTypeDeterminant.BOOL }
// 		default:
// 			throw new LogError("unsupported column type:", typeText)
// 	}
// }

// export function getTsType(typeText: string, nullable: boolean = false) {
// 	const nullablePortion = nullable ? ' | null' : ''
// 	let giveText: string
// 	switch (typeText) {
// 		case 'int2': case 'smallint':
// 		case 'int4': case 'int':
// 		case 'int8': case 'bigint':
// 		case 'numeric': case 'decimal':
// 			giveText = 'number'
// 			break
// 		case 'text':
// 			giveText = 'string'
// 			break
// 		case 'bool': case 'boolean':
// 			giveText = 'boolean'
// 			break
// 		default:
// 			// TODO there needs to be logic here to get custom types like enums
// 			// those could absolutely be needed by the client api
// 			throw new LogError("unsupported column type:", typeText)
// 	}

// 	return giveText + nullablePortion
// }

// export function getRustTypes(typeText: string, nullable: boolean = false): [string, string] {
// 	let rustType = ''
// 	let tokioType = ''
// 	switch (typeText) {
// 		case 'int2': case 'smallint':
// 			rustType = 'i16'; tokioType = 'INT2'
// 			break
// 		case 'int4': case 'int':
// 			rustType = 'i32'; tokioType = 'INT4'
// 			break
// 		case 'int8': case 'bigint':
// 			rustType = 'i64'; tokioType = 'INT8'
// 			break
// 		// case 'numeric': case 'decimal': case 'float': case 'real': case 'double':
// 		case 'text':
// 			rustType = 'String'; tokioType = 'TEXT'
// 			break
// 		case 'char':
// 			rustType = 'i8'; tokioType = 'CHAR'
// 			break
// 		case 'bool': case 'boolean':
// 			rustType = 'bool'; tokioType = 'BOOL'
// 			break
// 		default:
// 			// TODO there needs to be logic here to get custom types like enums
// 			// those could absolutely be needed by the client api
// 			throw new LogError("unsupported column type:", typeText)
// 	}

// 	return nullable
// 		? [`Option<${rustType}>`, tokioType]
// 		: [rustType, tokioType]
// }

// export async function getClient(config: ClientConfig) {
// 	const client = new Client(config)
// 	await client.connect()
// 	return client
// }

// // export class DbClient {
// // 	private client: Client

// // 	static async create(config: ClientConfig) {
// // 		const dbClient = new DbClient(config)
// // 		await dbClient.connect()
// // 	}

// // 	private constructor(config: ClientConfig) {
// // 		this.client = new Client(config)
// // 	}

// // 	inspect() {

// // 	}
// // }

// export async function inspect(config: ClientConfig) {
// 	const client = await getClient(config)
// 	const inspect = await fs.readFile('./src/inspect.sql', 'utf-8')

// 	const res = await client.query(inspect)

// 	// const tables = res.rows[0].source as InspectionTable[] | null
// 	const tables = res.rows[0].source as InspectionTable[]

// 	// // TODO this loop just for experimentation
// 	// for (const table of tables) {
// 	// 	console.log(table.name)
// 	// 	console.log(table.table_oid)
// 	// 	// console.log(table.access_control_items)
// 	// 	console.log(table.columns)
// 	// 	console.log(table.constraints)
// 	// 	// console.log(table.policies)
// 	// 	console.log()
// 	// }

// 	await client.end()

// 	return tables
// }
