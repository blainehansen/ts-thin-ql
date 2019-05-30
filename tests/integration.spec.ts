import 'mocha'
import { expect } from 'chai'

import { parseSource } from '../src/parser'
import { boilString } from './utils'

import { basicInspectResults } from './inspect.spec'

import { declareInspectionResults, _resetTableLookupMap, Column } from '../src/inspect'
import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, GetDirective, WhereDirective, OrderDirective, WhereType, ForeignKeyChain, KeyReference } from '../src/astQuery'

describe('integration a_results', () => {
	before(() => {
		declareInspectionResults(basicInspectResults)
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
