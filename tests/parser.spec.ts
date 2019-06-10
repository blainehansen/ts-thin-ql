import 'mocha'
import { expect } from 'chai'

import { parseSource } from '../src/parser'

import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, WhereDirective, WhereType, ForeignKeyChain, KeyReference } from '../src/ast/query'


describe('query', () => {
	it('with no args, directives, or nested', () => {
		const queries = parseSource(`query thing: table [
			some_col, other_col
		]`)

		expect(queries).lengthOf(1)

		const query = queries[0]
		expect(query).eql(new Query(
			'thing', [],
			new QueryBlock(
				'thing', 'table', new SimpleTable('table'), true,
				[new QueryColumn('some_col', 'some_col'), new QueryColumn('other_col', 'other_col')],
				[], [], undefined, undefined,
			),
		))
	})

	it('hella layers query', () => {
		const queries = parseSource(`query hellaLayersQuery($id_limit: int = 4): first_level(@where: id <= $id_limit) [
			id
			my_word: word

			seconds: second_level [
				id
				my_word: word

				thirds: third_level(@limit: 1) {
					id
					my_word: word
				}
			]
		]`)

		expect(queries).lengthOf(1)

		const query = queries[0]
		const arg = new Arg(1, 'id_limit', 'int', false, 4)
		expect(query).eql(new Query(
			'hellaLayersQuery', [arg], new QueryBlock(
				'hellaLayersQuery', 'first_level', new SimpleTable('first_level'), true,
				[
					new QueryColumn('id', 'id'),
					new QueryColumn('word', 'my_word'),
					new QueryBlock(
						'seconds', 'second_level', new SimpleTable('second_level'), true,
						[
							new QueryColumn('id', 'id'),
							new QueryColumn('word', 'my_word'),
							new QueryBlock(
								'thirds', 'third_level', new SimpleTable('third_level'), false,
								[
									new QueryColumn('id', 'id'),
									new QueryColumn('word', 'my_word'),
								],
								[], [], 1,
							)
						],
						[], [],
					)
				],
				[new WhereDirective('id', arg, WhereType.Lte)], [],
			))
		)
	})
})
