import { DefaultObj, Int } from '../src/utils'
import { declareInspectionResults, InspectionTable, InspectionColumn, InspectionConstraint, InspectionPrimaryKey, InspectionForeignKey, InspectionCheckConstraint, InspectionUniqueConstraint } from '../src/inspect'

export function boilString(value: string) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\( /g, '(')
		.replace(/ \)/g, ')')
		.trim()
}


export function rawDeclareDumbTableSchema(
	tables: string[],
	// referred, pointing, column, unique
	foreignKeys: [string, string, string, boolean][],
) {
	const namesToTables: { [tableName: string]: InspectionTable } = {}

	function makeIntColumn(
		name: string, column_number: number,
		nullable = false, has_default_value = true,
	) {
		return {
			name, column_number: column_number, nullable, has_default_value,
			type_name: 'int4', type_type: '', type_length: 4,
		}
	}

	for (const [index, tableName] of tables.entries()) {
		namesToTables[tableName] = {
			name: tableName,
			table_oid: index,
			columns: [
				makeIntColumn('id', 1)
			],
			constraints: [
				{ type: 'p', pointing_column_numbers: [1] } as InspectionPrimaryKey,
			],
		}
	}

	for (const [index, [referredName, pointingName, pointingColumn, pointingUnique]] of foreignKeys.entries()) {
		const columnNumber = index + 10
		const pointingTable = namesToTables[pointingName]
		if (!pointingTable) throw new Error(`blaine bad tableName ${pointingName}`)
		const referredTable = namesToTables[referredName]
		if (!referredTable) throw new Error(`blaine bad tableName ${pointingName}`)

		pointingTable.columns.push(makeIntColumn(pointingColumn, columnNumber, false, false))
		pointingTable.constraints.push(
			{
				type: 'f', referred_table_oid: referredTable.table_oid,
				referred_column_numbers: [1],
				pointing_column_numbers: [columnNumber],
			} as InspectionForeignKey
		)

		if (pointingUnique) {
			pointingTable.constraints.push(
				{ type: 'u', pointing_column_numbers: [columnNumber] } as InspectionUniqueConstraint
			)
		}
	}

	declareInspectionResults(Object.values(namesToTables))
}
