import 'mocha'
import { expect } from 'chai'

import { lookupTable, declareInspectionResults, _resetTableLookupMap } from '../src/inspect'

describe('overall inspection', () => {
	it('works', () => {
		declareInspectionResults([{
			name: "a_table",
			columns: [{
				name: "id",
				type_name: "int4",
				type_type: "b",
				type_length: 4,
				column_number: 1,
				must_not_null: true,
				has_default_value: true
			}, {
				name: "a_field",
				type_name: "text",
				type_type: "b",
				type_length: -1,
				column_number: 2,
				must_not_null: false,
				has_default_value: false
			}],
			table_oid: 16389,
			constraints: [{
				type: "p",
				referred_table_oid: 0,
				pointing_column_numbers: [1],
				referred_column_numbers: [],
				check_constraint_expression: null
			}]
		}, {
			name: "b_table",
			columns: [{
				name: "id",
				type_name: "int4",
				type_type: "b",
				type_length: 4,
				column_number: 1,
				must_not_null: true,
				has_default_value: true
			}, {
				name: "b_field",
				type_name: "text",
				type_type: "b",
				type_length: -1,
				column_number: 2,
				must_not_null: false,
				has_default_value: false
			}],
			table_oid: 16400,
			constraints: [{
				type: "p",
				referred_table_oid: 0,
				pointing_column_numbers: [1],
				referred_column_numbers: [],
				check_constraint_expression: null
			}]
		}, {
			name: "through_table",
			columns: [{
				name: "id",
				type_name: "int4",
				type_type: "b",
				type_length: 4,
				column_number: 1,
				must_not_null: true,
				has_default_value: true
			}, {
				name: "a_id",
				type_name: "int4",
				type_type: "b",
				type_length: 4,
				column_number: 2,
				must_not_null: false,
				has_default_value: false
			}, {
				name: "b_id",
				type_name: "int4",
				type_type: "b",
				type_length: 4,
				column_number: 3,
				must_not_null: false,
				has_default_value: false
			}, {
				name: "word",
				type_name: "text",
				type_type: "b",
				type_length: -1,
				column_number: 4,
				must_not_null: false,
				has_default_value: false
			}],
			table_oid: 16411,
			constraints: [{
				type: "p",
				referred_table_oid: 0,
				pointing_column_numbers: [1],
				referred_column_numbers: [],
				check_constraint_expression: null
			}, {
				type: "f",
				referred_table_oid: 16389,
				pointing_column_numbers: [2],
				referred_column_numbers: [1],
				check_constraint_expression: null
			}, {
				type: "f",
				referred_table_oid: 16400,
				pointing_column_numbers: [3],
				referred_column_numbers: [1],
				check_constraint_expression: null
			}]
		}])

		expect(() => lookupTable('a_table')).not.throw()
		expect(() => lookupTable('through_table')).not.throw()
		expect(() => lookupTable('b_table')).not.throw()

		expect(() => lookupTable('some_table')).throw()
	})
})
