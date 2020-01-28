import { Registry } from './inspect'

export function _reset_registered_tables() {
	registered_tables = {}
}

export function _raw_declare_dumb_table_schema(
	tables: string[],
	// referred, pointing, column, unique
	foreign_keys: [string, string, string, boolean][],
) {
	const names_to_tables: Dict<InspectionTable> = {}

	function make_int_column(
		name: string, column_number: number,
		nullable = false, default_value_expression: string | null = null,
	) {
		return {
			name, column_number, nullable, has_default_value,
			type_name: 'int4', type_type: '', type_length: 4,
		}
	}

	for (const [index, table_name] of tables.entries()) {
		names_to_tables[table_name] = {
			name: table_name,
			table_oid: index,
			columns: [
				make_int_column('id', 1)
			],
			constraints: [
				{ type: 'p', pointing_column_numbers: [1] } as InspectionPrimaryKey,
			],
		}
	}

	for (const [index, [referred_name, pointing_name, pointing_column, pointing_unique]] of foreign_keys.entries()) {
		const column_number = index + 10
		const pointing_table = names_to_tables[pointing_name]
		if (!pointing_table) throw new Error(`blaine bad table_name ${pointing_name}`)
		const referred_table = names_to_tables[referred_name]
		if (!referred_table) throw new Error(`blaine bad table_name ${pointing_name}`)

		pointing_table.columns.push(make_int_column(pointing_column, column_number, false, false))
		pointing_table.constraints.push(
			{
				type: 'f', referred_table_oid: referred_table.table_oid,
				referred_column_numbers: [1],
				pointing_column_numbers: [column_number],
			} as InspectionForeignKey
		)

		if (pointing_unique) {
			pointing_table.constraints.push(
				{ type: 'u', pointing_column_numbers: [column_number] } as InspectionUniqueConstraint
			)
		}
	}

	declare_inspection_results(Object.values(names_to_tables))
}


// import 'mocha'
// import { expect } from 'chai'

// import { lookupTable, declareInspectionResults, _resetTableLookupMap, InspectionTable, InspectionColumn, InspectionConstraint, InspectionPrimaryKey, InspectionForeignKey, InspectionCheckConstraint, InspectionUniqueConstraint } from '../lib/inspect'

// export const basicInspectResults = [{
// 	name: "a_table",
// 	columns: [{
// 		name: "id",
// 		type_name: "int4",
// 		type_type: "b",
// 		type_length: 4,
// 		column_number: 1,
// 		nullable: false,
// 		has_default_value: true
// 	}, {
// 		name: "a_field",
// 		type_name: "text",
// 		type_type: "b",
// 		type_length: -1,
// 		column_number: 2,
// 		nullable: true,
// 		has_default_value: false
// 	}],
// 	table_oid: 16389,
// 	constraints: [{
// 		type: 'p',
// 		pointing_column_numbers: [1],
// 	} as InspectionPrimaryKey]
// }, {
// 	name: "b_table",
// 	columns: [{
// 		name: "id",
// 		type_name: "int4",
// 		type_type: "b",
// 		type_length: 4,
// 		column_number: 1,
// 		nullable: false,
// 		has_default_value: true
// 	}, {
// 		name: "b_field",
// 		type_name: "text",
// 		type_type: "b",
// 		type_length: -1,
// 		column_number: 2,
// 		nullable: true,
// 		has_default_value: false
// 	}],
// 	table_oid: 16400,
// 	constraints: [{
// 		type: 'p',
// 		pointing_column_numbers: [1],
// 	} as InspectionPrimaryKey]
// }, {
// 	name: "through_table",
// 	columns: [{
// 		name: "id",
// 		type_name: "int4",
// 		type_type: "b",
// 		type_length: 4,
// 		column_number: 1,
// 		nullable: false,
// 		has_default_value: true
// 	}, {
// 		name: "a_id",
// 		type_name: "int4",
// 		type_type: "b",
// 		type_length: 4,
// 		column_number: 2,
// 		nullable: true,
// 		has_default_value: false
// 	}, {
// 		name: "b_id",
// 		type_name: "int4",
// 		type_type: "b",
// 		type_length: 4,
// 		column_number: 3,
// 		nullable: true,
// 		has_default_value: false
// 	}, {
// 		name: "word",
// 		type_name: "text",
// 		type_type: "b",
// 		type_length: -1,
// 		column_number: 4,
// 		nullable: true,
// 		has_default_value: false
// 	}],
// 	table_oid: 16411,
// 	constraints: [{
// 		type: 'p',
// 		pointing_column_numbers: [1],
// 	} as InspectionPrimaryKey, {
// 		type: 'f',
// 		referred_table_oid: 16389,
// 		pointing_column_numbers: [2],
// 		referred_column_numbers: [1],
// 	} as InspectionForeignKey, {
// 		type: 'f',
// 		referred_table_oid: 16400,
// 		pointing_column_numbers: [3],
// 		referred_column_numbers: [1],
// 	} as InspectionForeignKey]
// }]

// describe('overall inspection', () => {
// 	it('works', () => {
// 		declareInspectionResults(basicInspectResults)

// 		expect(() => lookupTable('a_table')).not.throw()
// 		expect(() => lookupTable('through_table')).not.throw()
// 		expect(() => lookupTable('b_table')).not.throw()

// 		expect(() => lookupTable('some_table')).throw()
// 	})
// })
