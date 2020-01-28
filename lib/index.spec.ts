// import 'mocha'
// import { expect } from 'chai'

// import { parseSource } from '../../lib/parser'
// import { boilString } from '../utils'

// import { basicInspectResults } from '../inspect.spec'

// import { declareInspectionResults, _resetTableLookupMap, Column } from '../../lib/inspect'
// import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, GetDirective, WhereDirective, OrderDirective, WhereType, ForeignKeyChain, KeyReference } from '../../lib/ast/query'

// describe('integration a_results', () => {
// 	before(() => {
// 		declareInspectionResults(basicInspectResults)
// 	})

// 	const querySource = `query a_results($arg: text): a_table(@get: id = 1) {
// 		a_value: a_field
// 		through_table(@order: id asc, @limit: 3) [
// 			id, word
// 			b_record: b_table(@where: b_field = $arg) {
// 				id, b_value: b_field
// 			}
// 		]
// 	}`

// 	let queries

// 	it('parses and renders correctly', () => {
// 		queries = parseSource(querySource)
// 		expect(queries).lengthOf(1)

// 		const query = queries[0]
// 		expect(query).eql(new Query(
// 			'a_results', [new Arg(1, 'arg', 'text', false)],
// 			new QueryBlock(
// 				'a_results', 'a_table', new SimpleTable('a_table'), false,
// 				[
// 					new QueryColumn('a_field', 'a_value'),
// 					new QueryBlock(
// 						'through_table', 'through_table', new SimpleTable('through_table'), true,
// 						[
// 							new QueryColumn('id', 'id'), new QueryColumn('word', 'word'),
// 							new QueryBlock(
// 								'b_record', 'b_table', new SimpleTable('b_table'), false,
// 								[new QueryColumn('id', 'id'), new QueryColumn('b_field', 'b_value')],
// 								[new WhereDirective('b_field', new Arg(1, 'arg', 'text', false), WhereType.Eq)], [], undefined, undefined
// 							),
// 						],
// 						[], [new OrderDirective('id', true)], 3, undefined,
// 					),
// 				],
// 				new GetDirective([1], ['id']), [], undefined, undefined,
// 			),
// 		))

// 		expect(boilString(query.renderSql())).eql(boilString(`
// 			prepare __cq_query_a_results (text) as

// 			select
// 				json_build_object(
// 					'a_value', a_results.a_field,
// 					'through_table', through_table.through_table
// 				) as a_results
// 			from
// 				a_table as a_results

// 				left join lateral (
// 					select
// 						json_agg(json_build_object(
// 							'id', through_table.id,
// 							'word', through_table.word,
// 							'b_record', b_record.b_record
// 						) order by id asc) as through_table

// 					from
// 						through_table as through_table
// 						left join lateral (
// 							select
// 								json_build_object(
// 									'id', b_record.id,
// 									'b_value', b_record.b_field
// 								) as b_record
// 							from
// 								b_table as b_record
// 							where (through_table.b_id = b_record.id) and (b_record.b_field = $1)
// 						) as b_record on true

// 					where (a_results.id = through_table.a_id)
// 					limit 3

// 				) as through_table on true

// 			where (a_results.id = 1)
// 			;
// 		`))
// 	})

// 	after(() => {
// 		_resetTableLookupMap()
// 	})
// })
