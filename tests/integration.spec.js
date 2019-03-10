const mocha = require('mocha')
const { expect } = require('chai')
const { parseSource } = require('../src/parser')
const { boilString } = require('./utils')

const inspectionResults = [{
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
		referred_column_numbers: null,
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
		referred_column_numbers: null,
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
		referred_column_numbers: null,
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
}]


const { declareInspectionResults, _resetTableLookupMap, Column } = require('../dist/inspect')
const { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, GetDirective, WhereDirective, OrderDirective, WhereType, ForeignKeyChain, KeyReference } = require('../dist/astClasses')

describe('integration a_results', () => {
	before(() => {
		declareInspectionResults(inspectionResults)
	})

	// TODO add a default value to this, once you can parse strings
	const querySource = `query a_results($arg: text): a_table(@get: id = 1) {
		a_value: a_field
		through_table(@order: id asc, @limit: 3) [
			id, word
			b_record: b_table(@where: b_value = $arg) {
				id, b_value: b_field
			}
		]
	}`

	let queries

	it('parses correctly', () => {
		queries = parseSource(querySource)
		expect(queries).lengthOf(1)

		const query = queries[0]
		expect(query).eql(new Query(
			'a_results', [new Arg(1, 'arg', 'text')],
			new QueryBlock(
				'a_results', 'a_table', new SimpleTable('a_table'), false,
				[
					new QueryColumn('a_field', 'a_value'),
					new QueryBlock(
						'through_table', 'through_table', new SimpleTable('through_table'), true,
						[
							new QueryColumn('id', 'id'), new QueryColumn('word', 'word'),
							new QueryBlock(
								'b_record', 'b_table', new SimpleTable('b_table'), false,
								[new QueryColumn('id', 'id'), new QueryColumn('b_field', 'b_value')],
								[new WhereDirective('b_value', new Arg(1, 'arg', 'text'), WhereType.Eq)], [], undefined, undefined
							),
						],
						[], [new OrderDirective('id', true)], 3, undefined,
					),
				],
				// [new GetDirective(new Column('id', 'int4', true, false), 1)], [], undefined, undefined,
				new GetDirective('id', 1), [], undefined, undefined,
			),
		))

		// console.log(query.render())
	})


	// it('renders correctly', () => {
	// 	const sql = boilString(query.render())
	// 	expect(sql).eql(boilString(`
	// 		prepare __cq_query_thing as
	// 		select
	// 			json_agg(json_build_object(
	// 				'some_col', thing.some_col,
	// 				'other_col', thing.other_col
	// 			)) as thing
	// 		from
	// 			table as thing
	// 		;
	// 	`))
	// })

	after(() => {
		_resetTableLookupMap()
	})
})
