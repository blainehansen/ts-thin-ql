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
})
