import * as fs from 'fs'
import { LogError } from './utils'
import { Client, ClientConfig } from 'pg'
import { PgType, PgInt, PgFloat, PgText, PgBool, PgEnum } from './pgTypes'


type TableLink = { remote: boolean, foreignKey: ForeignKey }
type VisibleTable = { [tableName: string]: TableLink }


export class Table {
	// TODO want to include many-to-many auto-detection
	// if a foreign key points at me, that side is a many, unless it has a singular unique constraint
	// if I point at something, I'm a many
	// you have to detect many-to-many by seeing a table that has multiple fromMe

	// the visibleTables map needs to have an array of tablelinks,
	// since a table can be visible from another in many different ways
	readonly visibleTables: VisibleTable = {}
	// readonly visibleTables: { [tableName: string]: Tablelink[] } = {}

	// whereas by key
	readonly visibleTablesByKey: { [keyName: string]: VisibleTable } = {}
	// readonly visibleTablesByKey: { [keyName: string]: { [tableName: string]: Tablelink } } = {}

	constructor(
		readonly tableName: string,
		readonly primaryKeyColumns: Column[],
		readonly uniqueConstrainedColumns: Column[][],
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
		readonly columnName: string,
		readonly columnType: PgType,
		readonly nullable: boolean,
		readonly hasDefaultValue: boolean,
		// readonly isSerial: boolean,
		// readonly defaultValueExpression: string | null,
	) {}
}


export class ForeignKey {
	constructor(
		readonly referredTable: Table,
		readonly referredColumns: string[],
		readonly pointingTable: Table,
		readonly pointingColumns: string[],
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


export type InspectionColumn = {
	name: string,
	type_name: string,
	type_type: string,
	type_length: number,
	column_number: number,
	nullable: boolean,
	has_default_value: boolean,
}

export type InspectionConstraint =
	InspectionPrimaryKey
	| InspectionForeignKey
	| InspectionCheckConstraint
	| InspectionUniqueConstraint

export type InspectionPrimaryKey = {
	type: 'p',
	pointing_column_numbers: number[],
}

export type InspectionForeignKey = {
	type: 'f',
	referred_table_oid: number,
	referred_column_numbers: number[],
	pointing_column_numbers: number[],
}

export type InspectionCheckConstraint = {
	type: 'c'
	pointing_column_numbers: number[],
	check_constraint_expression: string,
}

export type InspectionUniqueConstraint = {
	type: 'u'
	pointing_column_numbers: number[],
}

export type InspectionTable = {
	name: string,
	table_oid: number,
	columns: InspectionColumn[],
	constraints: InspectionConstraint[],
}


export function declareInspectionResults(tables: InspectionTable[]) {
	const oidTables: { [table_oid: number]: InspectionTable } = {}
	const oidUniques: { [table_oid: number]: Column[][] } = {}

	for (const table of tables) {
		const { name: tableName, table_oid, columns: inspectionColumns, constraints } = table

		const columnsMap = inspectionColumns.reduce((obj, inspectionColumn) => {
			obj[inspectionColumn.name] = new Column(
				inspectionColumn.name,
				getColumnType(inspectionColumn.type_name),
				inspectionColumn.nullable,
				inspectionColumn.has_default_value,
			)
			return obj
		}, {} as { [columnName: string]: Column })

		function getColumn(inspectionColumn: InspectionColumn): Column {
			const columnName = inspectionColumn.name
			const column = columnsMap[columnName]
			if (!column) throw new LogError(`column ${columnName} couldn't be found in the columnsMap?`, columnsMap)
			return column
		}

		const primaryKeyConstraint = constraints.find(constraint => constraint.type === 'p')
		const primaryKeyColumns = primaryKeyConstraint === undefined
			? []
			: inspectionColumns
				.filter(column => primaryKeyConstraint.pointing_column_numbers.includes(column.column_number))
				.map(getColumn)

		const uniqueConstrainedColumns = constraints
			.filter(constraint => constraint.type === 'u')
			.map(
				constraint => inspectionColumns
					.filter(column => constraint.pointing_column_numbers.includes(column.column_number))
					.map(getColumn)
			)

		// TODO include primaryKeyColumns in uniqueConstrainedColumns?

		const normalColumns = Object.values(columnsMap)

		tableLookupMap[tableName] = new Table(
			tableName,
			primaryKeyColumns,
			uniqueConstrainedColumns,
			normalColumns,
		)

		oidTables[table_oid as number] = table
		oidUniques[table_oid as number] = uniqueConstrainedColumns
	}

	for (const pointingTable of tables) {
		const foreignKeyConstraints = pointingTable.constraints
			.filter((constraint): constraint is InspectionForeignKey => constraint.type === 'f')

		for (const { referred_table_oid, referred_column_numbers, pointing_column_numbers } of foreignKeyConstraints) {
			const referredTable = oidTables[referred_table_oid]

			const referredNames = referredTable.columns
				.filter(column => referred_column_numbers.includes(column.column_number))
				.map(column => column.name)
			const pointingNames = pointingTable.columns
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
			// then the key is pointingUnique
			// to determine if the constraint is a subset
			// go through the uniqueConstrainedNames, and every one of those must be inside the key
			const pointingUnique = (oidUniques[pointingTable.table_oid] || [])
				.some(
					uniqueColumns => uniqueColumns
						.map(column => column.columnName).every(uniqueName => pointingNames.includes(uniqueName))
				)

			declareForeignKey(
				referredTable.name, referredNames,
				pointingTable.name, pointingNames,
				pointingUnique,
			)
		}
	}
}

// export class KeyLookupMap {
// 	readonly visibleTablesByKey: { [keyName: string]: VisibleTable } = {}
// 	constructor() {}

// 	get(pointingColumns: string[], tableName: string) {
// 		const pointingColumnsKey = pointingColumns.join(',')
// 		return (visibleTablesByKey[pointingColumnsKey] || {})[tableName]
// 	}

// 	set(pointingColumns: string[], value) {

// 	}
// }

function declareForeignKey(
	referredTableName: string, referredColumns: string[],
	pointingTableName: string, pointingColumns: string[],
	pointingUnique: boolean,
) {
	// if someone's pointing to us with a unique foreign key, then both sides are a single object
	const referredTable = lookupTable(referredTableName)
	const pointingTable = lookupTable(pointingTableName)

	const foreignKey = new ForeignKey(referredTable, referredColumns, pointingTable, pointingColumns, pointingUnique)

	// each has a visible reference to the other
	const referredVisibleTable = { remote: true, foreignKey }
	const pointingVisibleTable = { remote: false, foreignKey }

	referredTable.visibleTables[pointingTableName] = referredVisibleTable
	pointingTable.visibleTables[referredTableName] = pointingVisibleTable

	const pointingColumnsKey = pointingColumns.join(',')
	referredTable.visibleTablesByKey[pointingColumnsKey] = referredTable.visibleTablesByKey[pointingColumnsKey] || {}
	referredTable.visibleTablesByKey[pointingColumnsKey][pointingTableName] = referredVisibleTable
	pointingTable.visibleTablesByKey[pointingColumnsKey] = pointingTable.visibleTablesByKey[pointingColumnsKey] || {}
	pointingTable.visibleTablesByKey[pointingColumnsKey][referredTableName] = pointingVisibleTable
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
