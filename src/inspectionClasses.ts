import { LogError } from './utils'

export class Table {
	// if a foreign key points at me, that side is a many, unless it has a singular unique constraint
	// if I point at something, I'm a many
	// you have to detect many-to-many by seeing a table that has multiple fromMe
	// for now, we'll just make them trace the path or do embedding
	readonly visibleTables: { [tableName: string]: { remote: boolean, foreignKey: ForeignKey } } = {}
	constructor(
		readonly tableName: string,
		readonly primaryKey: string,
		readonly fields: Field[]
	) {}
}

export type PgInt = { size: 2 | 4 | 8, isSerial: boolean }
export type PgFloat = { size: 4 | 8 }
export type PgText
export type PgBool
export type PgEnum = { name: string, values: string[] }

export type PgType = PgInt | PgFloat | PgText

export class Field {
	constructor(
		readonly fieldName: string,
		readonly fieldType: PgType,
		readonly unique: boolean,
		readonly nullable: boolean,
	) {}
}

let tableLookupMap: { [tableName: string]: Table } = {}

// TODO primaryKey will probably be a field
export function declareTable(tableName: string, primaryKey: string, ...fields: Field[]) {
	tableLookupMap[tableName] = new Table(tableName, primaryKey, fields)
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

export class ForeignKey {
	constructor(
		readonly referredColumn: string,
		readonly pointingColumn: string,
		readonly pointingUnique: boolean,
	) {}
}

// const fkLookupMap: { [fkName: string]: Set } = {}

export function declareForeignKey(
	referredTableName: string, referredColumn: string,
	pointingTableName: string, pointingColumn: string,
	pointingUnique: boolean,
) {
	const foreignKey = new ForeignKey(referredColumn, pointingColumn, pointingUnique)

	const referredTable = lookupTable(referredTableName)
	const pointingTable = lookupTable(pointingTableName)

	// each has a visible reference to the other
	referredTable.visibleTables[pointingTableName] = { remote: true, foreignKey }
	pointingTable.visibleTables[referredTableName] = { remote: false, foreignKey }

	// const existingTables = fkLookupMap[pointingColumn] || new Set()
	// existingTables.add(foreignKey)

	// if someone's pointing to us with a unique foreign key, then both sides are a single object
}
