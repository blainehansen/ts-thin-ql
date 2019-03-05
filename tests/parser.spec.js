const mocha = require('mocha')
const { expect } = require('chai')
const { parseSource } = require('../src/parser')

const { declareTable, declareForeignKey, _resetTableLookupMap, PgInt, Column } = require('../dist/inspectionClasses')
const { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, FilterDirective, FilterType, ForeignKeyChain, KeyReference } = require('../dist/astClasses')


describe('query', () => {
	it('with no args, directives, or nested', () => {
		const queries = parseSource(`query thing: table [
			some_col, other_col
		]`)

		expect(queries).lengthOf(1)

		expect(queries[0]).eql(new Query(
			'thing', [],
			new QueryBlock(
				'thing', 'table', new SimpleTable('table'), true,
				[new QueryColumn('some_col', 'some_col'), new QueryColumn('other_col', 'other_col')],
				[], [], undefined, undefined,
			),
		))
	})
})
