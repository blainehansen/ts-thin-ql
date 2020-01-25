// import 'mocha'
// import { expect } from 'chai'

// import { lookupTable, declareInspectionResults, _resetTableLookupMap, InspectionTable, InspectionColumn, InspectionConstraint, InspectionPrimaryKey, InspectionForeignKey, InspectionCheckConstraint, InspectionUniqueConstraint } from '../src/inspect'

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
