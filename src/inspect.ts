import * as fs from 'fs'
import { Client, ClientConfig } from 'pg'
import { LogError, Int } from './utils'
import { PgType, PgInt, PgFloat, PgText, PgBool, PgEnum } from './pgTypes'


type VisibleTable = { [tableName: string]: { remote: boolean, foreignKey: ForeignKey } }

export class Table {
	// if a foreign key points at me, that side is a many, unless it has a singular unique constraint
	// if I point at something, I'm a many
	// you have to detect many-to-many by seeing a table that has multiple fromMe
	// for now, we'll just make them trace the path or do embedding
	readonly visibleTables: VisibleTable = {}
	readonly visibleTablesByKey: { [keyName: string]: VisibleTable } = {}
	constructor(
		readonly tableName: string,
		// readonly primaryKeyColumns: Column[],
		readonly primaryKeyColumns: Column,
		readonly columns: Column[],
	) {
		// TODO check that the primaryKey
	}
}

export class Column {
	constructor(
		readonly columnName: string,
		readonly columnType: PgType,
		readonly unique: boolean,
		readonly nullable: boolean,
	) {}
}


export class ForeignKey {
	constructor(
		readonly referredTable: Table,
		// readonly referredColumns: string[],
		readonly referredColumn: string,
		readonly pointingTable: Table,
		// readonly pointingColumns: string[],
		readonly pointingColumn: string,
		readonly pointingUnique: boolean,
	) {}
}

let tableLookupMap: { [tableName: string]: Table } = {}

export function _resetTableLookupMap() {
	tableLookupMap = {}
}

export function lookupTable(tableName: string) {
	const table = tableLookupMap[tableName]
	if (!table) throw new LogError("non-existent table: ", tableName)
	return table
}


function determineColumnMany() {

}


type InspectionColumn = {
	name: string,
	type_name: string,
	type_type: string,
	type_length: Int,
	column_number: Int,
	nullable: boolean,
	has_default_value: boolean,
}

type InspectionConstraint = {
	type: string,
	referred_table_oid: Int,
	referred_column_numbers: Int[],
	pointing_column_numbers: Int[],
	check_constraint_expression: null | string,
}

export type InspectionTable = {
	name: string,
	table_oid: Int,
	columns: InspectionColumn[],
	constraints: InspectionConstraint[],
}


export function declareInspectionResults(tables: InspectionTable[]) {
	// keep a big list of constraints mapped to their table oid's
	// const runningConstraints: { [table_oid: Int]: InspectionConstraint[] } = {}
	const oidTables: { [table_oid: number]: InspectionTable } = {}
	// const tableUniques = { [table_oid: Int]: {  } } = {}

	for (const table of tables) {
		const { name, table_oid, columns, constraints } = table
		// find the primary in the constraints
		// TODO this should be relaxed and made more flexible
		const primaryKeyConstraint = constraints.find(c => c.type === 'p')
		if (!primaryKeyConstraint) throw new LogError("no primary key for table:", name)

		// find the column that matches up with it and its name
		// primaryKeyConstraint.pointing_column_numbers
		const primaryKeyColumns = columns.filter(c => primaryKeyConstraint.pointing_column_numbers.includes(c.column_number))
		// if (primaryKeyColumns.length !== 1) throw new LogError("too many or too few columns in primary key:", primaryKeyColumns)

		_declareTable(name, primaryKeyColumns[0].name)

		// runningConstraints[table_oid] = constraints
		oidTables[table_oid as number] = table
	}

	for (const pointingTable of tables) {
		const foreignKeyConstraints = pointingTable.constraints.filter(c => c.type === 'f')
		for (const { referred_table_oid, referred_column_numbers, pointing_column_numbers } of foreignKeyConstraints) {
			const referredTable = oidTables[referred_table_oid]

			const referredColumns = referredTable.columns.filter(c => referred_column_numbers.includes(c.column_number))
			if (referredColumns.length !== 1) throw new LogError("too many referredColumns: ", referredColumns)
			const pointingColumns = pointingTable.columns.filter(c => pointing_column_numbers.includes(c.column_number))
			if (pointingColumns.length !== 1) throw new LogError("too many pointingColumns: ", pointingColumns)

			const referredColumn = referredColumns[0]
			const pointingColumn = pointingColumns[0]

			// TODO
			// here pointingUnique is true if all the constrained columns of a foreign key
			// are also fully constrained by a set of unique constraints that covers exactly the foreign key
			// if a unique constraint includes some column that's *not* in the foreign key, it doesn't count
			// so we simply must ask if there exist valid unique constraints as defined above
			// for each of the columns in the foreign key
			const pointingUnique = false

			_declareForeignKey(
				referredTable.name, referredColumn.name,
				pointingTable.name, pointingColumn.name,
				pointingUnique,
			)
		}
	}
}

export function _declareTable(tableName: string, primaryKey: string, ...columns: Column[]) {
	tableLookupMap[tableName] = new Table(
		tableName,
		new Column(primaryKey, { size: 4, isSerial: true } as PgInt, true, false),
		columns,
	)
}

export function _declareForeignKey(
	referredTableName: string, referredColumn: string,
	pointingTableName: string, pointingColumn: string,
	pointingUnique: boolean,
) {
	// if someone's pointing to us with a unique foreign key, then both sides are a single object
	const referredTable = lookupTable(referredTableName)
	const pointingTable = lookupTable(pointingTableName)

	const foreignKey = new ForeignKey(referredTable, referredColumn, pointingTable, pointingColumn, pointingUnique)


	// each has a visible reference to the other
	const referredVisibleTable = { remote: true, foreignKey }
	const pointingVisibleTable = { remote: false, foreignKey }

	referredTable.visibleTables[pointingTableName] = referredVisibleTable
	pointingTable.visibleTables[referredTableName] = pointingVisibleTable

	referredTable.visibleTablesByKey[pointingColumn] = referredTable.visibleTablesByKey[pointingColumn] || {}
	referredTable.visibleTablesByKey[pointingColumn][pointingTableName] = referredVisibleTable
	pointingTable.visibleTablesByKey[pointingColumn] = pointingTable.visibleTablesByKey[pointingColumn] || {}
	pointingTable.visibleTablesByKey[pointingColumn][referredTableName] = pointingVisibleTable
}


export function checkManyCorrectness(pointingUnique: boolean, remote: boolean, entityIsMany: boolean) {
	// basically, something can (must) be a single if the parent is pointing,
	// or if the key is unique (which means it doesn't matter which way)
	const keyIsSingular = pointingUnique || !remote
	if (entityIsMany && keyIsSingular) throw new LogError("incorrectly wanting many")
	// they want only one
	if (!entityIsMany && !keyIsSingular) throw new LogError("incorrectly wanting only one")
}

function getColumnType(typeText: string) {
	switch (typeText) {
		case 'int2':
			return { size: 2, isSerial: false } as PgInt
		case 'int4':
			return { size: 4, isSerial: false } as PgInt
		case 'int8':
			return { size: 8, isSerial: false } as PgInt
		case 'text':
			return { maxSize: undefined } as PgText
		case 'bool':
			return {} as PgBool
		default:
			throw new LogError("unsupported column type:", typeText)
	}
}

export function getTsType(typeText: string) {
	switch (typeText) {
		case 'int2':
		case 'int4':
		case 'int8':
			return 'number'
		case 'text':
			return 'string'
		case 'bool':
			return 'boolean'
		default:
			throw new LogError("unsupported column type:", typeText)
	}
}

export async function inspect(config: ClientConfig) {
	const client = new Client(config)

	await client.connect()

	const inspect = fs.readFileSync('./src/inspect.sql', { encoding: 'utf-8' })

	const res = await client.query(inspect)

	const tables = res.rows[0].source as InspectionTable[]
	// so we'll go through all of these,
	// and go through all the columns and connect the to constraints
	for (const table of tables) {
		// const columnNumberMap: { [num: Int]: Column } = {}
		console.log(table.name)
		console.log(table.table_oid)
		console.log(table.columns)
		console.log(table.constraints)
		console.log()

		// const uniqueColumns: Set<Int> = new Set()

		// for (const constraint of table.constraints) {
		// 	// we'll use these to figure out what the primary and foreign keys are, and if they're unique

		// 	switch (constraint.type) {
		// 		// case 'c':
		// 		// 	break
		// 		case 'p':
		// 			break
		// 		case 'f':
		// 			break
		// 		case 'u':
		// 			if (constraint.pointing_column_numbers.length !== 1) throw new LogError("don't yet support multiple unique:", table)
		// 			uniqueColumns.add(constraint.pointing_column_numbers[0] as Int)
		// 			break
		// 		default:
		// 			throw new LogError("unsupported constraint type:", constraint.type)
		// 	}
		// }

		// for (const column of table.columns) {
		// 	const columnNumber = column.column_number as Int
		// 	const columnType = getColumnType(column.type_name)
		// 	// type_type
		// 	columnNumberMap[columnNumber] = new Column(column.name, columnType, uniqueColumns.has(columnNumber), !column.nullable)
		// }


		// // do something to build a table object
		// new Table()
	}

	await client.end()

	return tables
}
