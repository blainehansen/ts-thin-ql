import { LogError, Int } from './utils'

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
		readonly primaryKey: Column,
		readonly columns: Column[],
	) {
		// TODO check that the primaryKey
	}
}

enum PgIntBrand {}
export type PgInt = { size: 2 | 4 | 8, isSerial: boolean } & PgIntBrand
enum PgFloatBrand {}
export type PgFloat = { size: 4 | 8 } & PgFloatBrand
enum PgTextBrand {}
export type PgText = { maxSize?: Int } & PgTextBrand
enum PgBoolBrand {}
export type PgBool = {} & PgBoolBrand
enum PgEnumBrand {}
export type PgEnum = { name: string, values: string[] } & PgEnumBrand

export type PgType = PgInt | PgFloat | PgText | PgBool | PgEnum

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
		readonly referredColumn: string,
		readonly pointingTable: Table,
		readonly pointingColumn: string,
		readonly pointingUnique: boolean,
	) {}
}


let tableLookupMap: { [tableName: string]: Table } = {}

export function declareTable(tableName: string, primaryKey: string, ...columns: Column[]) {
	tableLookupMap[tableName] = new Table(
		tableName,
		new Column(primaryKey, { size: 4, isSerial: true } as PgInt, true, false),
		columns,
	)
}

export function _resetTableLookupMap() {
	tableLookupMap = {}
}

export function lookupTable(tableName: string) {
	const table = tableLookupMap[tableName]
	if (!table) throw new LogError("non-existent table: ", tableName)
	return table
}

export function checkManyCorrectness(pointingUnique: boolean, remote: boolean, entityIsMany: boolean) {
	// basically, something can (must) be a single if the parent is pointing,
	// or if the key is unique (which means it doesn't matter which way)
	const keyIsSingular = pointingUnique || !remote
	if (entityIsMany && keyIsSingular) throw new LogError("incorrectly wanting many")
	// they want only one
	if (!entityIsMany && !keyIsSingular) throw new LogError("incorrectly wanting only one")
}

export function declareForeignKey(
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

// export function linkForeignKey()
