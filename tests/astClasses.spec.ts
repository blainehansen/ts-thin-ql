import 'mocha'
import { expect } from 'chai'

import { declareTable, declareForeignKey, _resetTableLookupMap, PgInt, Column } from '../src/inspectionClasses'
import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, FilterDirective, FilterType } from '../src/astClasses'


function boilString(value: string) {
	return value.replace(/\s+/g, ' ').trim()
}

describe('query columns render correctly', () => {
	it('with same name', () => {
		const result = new QueryColumn('column_name', 'column_name').render()
		expect(result).equal("column_name as column_name")
	})

	it('with different names', () => {
		const result = new QueryColumn('column_name', 'diff_name').render()
		expect(result).equal("column_name as diff_name")
	})
})


describe('query with arguments', () => {
	const q = new Query(
		'thing', [new Arg(1, 'id', 'int'), new Arg(2, 'amount', 'int', 2000)],
		new QueryBlock(
			'root', 'root', new SimpleTable('root'), true,
			[new FilterDirective(new Column('thing', { size: 4, isSerial: false } as PgInt, false, false), 5, FilterType.Eq)],
			[],
			[
				new QueryColumn('root_column', 'root_column'),
			],
			null, null
		)
	)
})


describe('single layer query', () => {
	before(() => {
		declareTable('root', 'id')
		// declareTable('right', 'id')
		// declareTable('b', 'id')
		// declareTable('c', 'id')

		// declareForeignKey('right', 'id', 'root', 'right_id', false)
		// declareForeignKey('root', 'id', 'b', 'root_id', false)
		// declareForeignKey('b', 'id', 'c', 'b_id', false)
	})

	it('compiles correctly with no args', () => {
		const q = new Query(
			'thing', [],
			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[], [],
				[
					new QueryColumn('root_column', 'root_column'),
				],
				null, null
			)
		)
		const sql = boilString(q.render())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing as
			select root.root_column as root_column
			from
				root as root
			;
		`))
	})

	it('compiles correctly with default and no default args', () => {
		const q = new Query(
			'thing', [new Arg(1, 'id', 'int'), new Arg(2, 'amount', 'int', 2000)],
			// displayName: string,
			// targetTableName: string,
			// accessObject: TableAccessor,
			// isMany: boolean,
			// whereDirectives: GetDirective | FilterDirective[],
			// orderDirectives: OrderDirective[],
			// entities: QueryObject[],
			// limit?: Int,
			// offset?: Int,

			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[], [],
				[
					new QueryColumn('root_column', 'root_column'),
					new QueryColumn('other_column', 'diff_other_column'),
					new QueryColumn('diff_column', 'diff_column'),
				],
				null, null,
			)
		)
		const sql = boilString(q.render())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing (int, int) as
			select
				root.root_column as root_column,
				root.other_column as diff_other_column,
				root.diff_column as diff_column
			from
				root as root
			;
		`))
	})

	after(() => {
		_resetTableLookupMap()
	})
})

// describe('queries renders correctly', () => {
	// beforeEach(() => {
	// })

	// afterEach(() => {
	// 	_resetTableLookupMap()
	// })
// })


// declareTable('root', 'id')
// declareTable('right', 'id')
// declareTable('b', 'id')
// declareTable('c', 'id')

// declareForeignKey('right', 'id', 'root', 'right_id', false)
// declareForeignKey('root', 'id', 'b', 'root_id', false)
// declareForeignKey('b', 'id', 'c', 'b_id', false)

// displayName, targetTableName, accessObject, isMany, entities
// const q = new Query(
// 	'thing',
// 	new QueryBlock(
// 		'root', 'root', new SimpleTable('root'), true,
// 		[
// 			new QueryColumn('root_column', 'root_column'),
// 			new QueryBlock(
// 				'right', 'right', new SimpleTable('right'), false,
// 				[
// 					new QueryColumn('right_column', 'right_column')
// 				]
// 			),
// 			new QueryBlock(
// 				'b', 'b', new SimpleTable('b'), true,
// 				[
// 					new QueryColumn('b_column', 'b_column'),
// 					new QueryBlock(
// 						'c', 'c', new SimpleTable('c'), true,
// 						[
// 							new QueryColumn('c_column', 'c_column')
// 						]
// 					),
// 				]
// 			),
// 		]
// 	)
// )


// TODO the actual subject of the test
// console.log(q.render())

// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	b: new Table('b', 'id'),
// }
// declareForeignKey('a', 'id', 'b', 'a_id', false)

// const q = new Query(
// 	'thing',
// 	new QueryBlock(
// 		'b', 'b', new SimpleTable('b'), true,
// 		[
// 			new QueryColumn('b_column', 'b_column'),
// 			new QueryBlock(
// 				'a', 'a', new SimpleTable('a'), false,
// 				[
// 					new QueryColumn('a_column', 'a_column')
// 				]
// 			)
// 		]
// 	)
// )



// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	mid: new Table('mid', 'id'),
// 	b: new Table('b', 'id'),
// }
// declareForeignKey('a', 'id', 'mid', 'a_id', false)
// declareForeignKey('b', 'id', 'mid', 'b_id', false)

// const q = new Query(
// 	'thing',
// 	new QueryBlock(
// 		'a', 'a', new SimpleTable('a'), true,
// 		[
// 			new QueryColumn('a_column', 'a_column'),
// 			new QueryBlock(
// 				'b', 'b', new TableChain('mid', 'b'), true,
// 				[
// 					new QueryColumn('b_column', 'b_column')
// 				]
// 			)
// 		]
// 	)
// )



// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	b: new Table('b', 'id'),
// }
// declareForeignKey('a', 'id', 'b', 'a_id', false)

// const q = new Query(
// 	'thing',
// 	new QueryBlock(
// 		'a', 'a', new SimpleTable('a'), true,
// 		[
// 			new QueryColumn('a_column', 'a_column'),
// 			new QueryBlock(
// 				'b', 'b', new SimpleTable('b'), true,
// 				[
// 					new QueryColumn('b_column', 'b_column')
// 				]
// 			)
// 		]
// 	)
// )



// const tableLookupMap = {
// 	first_level: new Table('first_level', 'id'),
// 	second_level: new Table('second_level', 'id'),
// 	third_level: new Table('third_level', 'id'),
// 	other_level: new Table('other_level', 'id'),
// }
// declareForeignKey('first_level', 'id', 'second_level', 'first_level_id', false)
// declareForeignKey('second_level', 'id', 'third_level', 'second_level_id', false)
// declareForeignKey('first_level', 'id', 'other_level', 'first_level_id', false)

// have to add a bunch of parameters to all this
// const q = new Query(
// 	'firstQuery',
// 	new QueryBlock(
// 		'first_level', 'first_level', true,
// 		[
// 			new QueryColumn('first_column', 'first_column'),

// 			new QueryBlock(
// 				'second_level', 'second_level', true,
// 				[
// 					new QueryColumn('second_column', 'second_column'),
// 					new QueryBlock(
// 						'third_level', 'third_level', true,
// 						[
// 							new QueryColumn('third_column', 'third_column'),
// 						],
// 					),
// 				],
// 			),

// 			new QueryBlock(
// 				'other_level', 'other_level', true,
// 				[
// 					new QueryColumn('other_column', 'other_column'),
// 				],
// 			),
// 		],
// 	),
// )
