import 'mocha'
import { expect } from 'chai'

import { PgInt } from '../../src/pgTypes'
import { boilString, rawDeclareDumbTableSchema, setupSchemaFromFiles, destroySchema } from '../utils'
import { HttpVerb } from '../../src/ast/common'
import { _resetTableLookupMap, inspect, declareInspectionResults, Column } from '../../src/inspect'
import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, WhereDirective, WhereType, ForeignKeyChain, KeyReference, RawSqlStatement } from '../../src/ast/query'


describe('correctly renders typescript return types', () => {
	before(async () => setupSchemaFromFiles('./schemas/_functions.sql', './schemas/simple-layers.sql'))

	// displayName
	// targetTableName
	// accessObject
	// isMany
	// entities
	// whereDirectives
	// orderDirectives
	it('with simple query', () => {
		const q = (isMany: boolean) => new Query('layersQuery', [], new QueryBlock(
			'first_level', 'first_level', new SimpleTable('first_level'), isMany,
			[
				new QueryColumn('word', 'word')
			],
			[], [],
			isMany ? undefined : 1,
		))

		{
			const [displayName, httpVerb, args, argsUsage, neededTypes] = q(true).renderTs()

			expect(displayName).eql('layersQuery')
			expect(httpVerb === HttpVerb.GET).true
			expect(args).eql('')
			expect(argsUsage).eql('')
			expect(neededTypes).eql([`type LayersQueryFirstLevel = (Pick<FirstLevel, 'word'>)[]`])
		}

		{
			const [displayName, httpVerb, args, argsUsage, neededTypes] = q(false).renderTs()

			expect(displayName).eql('layersQuery')
			expect(httpVerb === HttpVerb.GET).true
			expect(args).eql('')
			expect(argsUsage).eql('')
			expect(neededTypes).eql([`type LayersQueryFirstLevel = Pick<FirstLevel, 'word'>`])
		}
	})

	it('with more complex query', () => {
		const arg = new Arg(1, 'id_limit', 'int', false, 4)
		const q = new Query('hellaLayersQuery', [arg], new QueryBlock(
			'first_level', 'first_level', new SimpleTable('first_level'), true,
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

		const [displayName, httpVerb, args, argsUsage, neededTypes] = q.renderTs()

		expect(displayName).eql('hellaLayersQuery')
		expect(httpVerb === HttpVerb.GET).true
		expect(args).eql('id_limit: number = 4')
		expect(argsUsage).eql('{ id_limit: id_limit }')
		expect(neededTypes).lengthOf(1)
		expect(boilString(neededTypes[0])).eql(boilString(`
			type HellaLayersQueryFirstLevel = (Pick<FirstLevel, 'id'>
				& Rename<FirstLevel, 'word', 'my_word'>
				& {
					seconds: (Pick<SecondLevel, 'id'>
					& Rename<SecondLevel, 'word', 'my_word'>
					& {
						thirds: Pick<ThirdLevel, 'id'>
						& Rename<ThirdLevel, 'word', 'my_word'>,
					})[],
				})[]
		`))
	})

	after(async () => destroySchema())
})



describe('query columns renderSql correctly', () => {
	it('with same name', () => {
		const result = new QueryColumn('column_name', 'column_name').renderSql('some_table')
		expect(result).equal("'column_name', some_table.column_name")
	})

	it('with different names', () => {
		const result = new QueryColumn('column_name', 'diff_name').renderSql('some_table')
		expect(result).equal("'diff_name', some_table.column_name")
	})
})

describe('raw sql statements', () => {
	const argsMap = [
		new Arg(1, 'one', 'not checked', false),
		new Arg(2, 'two', 'not checked', false),
		new Arg(3, 'three', 'not checked', false),
		new Arg(4, 'onetwo', 'not checked', false),
	].reduce(
		(map, a) => { map[a.argName] = a; return map },
		{} as { [argName: string]: Arg },
	)

	it('can do simple things', () => {
		let sql

		sql = new RawSqlStatement(`$one / ((coalesce(some_json, $two) -> 'stuff') :: int * $three)`)
		expect(sql.renderSql(argsMap)).eql(`$1 / ((coalesce(some_json, $2) -> 'stuff') :: int * $3)`)

		sql = new RawSqlStatement(`$one / ((coalesce(some_json, $one) -> 'stuff') :: int * $one)`)
		expect(sql.renderSql(argsMap)).eql(`$1 / ((coalesce(some_json, $1) -> 'stuff') :: int * $1)`)

		sql = new RawSqlStatement(`$one / $onetwo`)
		expect(sql.renderSql(argsMap)).eql(`$1 / $4`)

		sql = new RawSqlStatement(`$one / $onefive`)
		expect(sql.renderSql(argsMap)).eql(`$1 / $onefive`)

		// TODO trying to figure out what's a reasonable amount of dollar escaped compatibility
		// sql = new RawSqlStatement(`$one || $one$one dollar escaped text$one$`)
		// expect(sql.renderSql(argsMap)).eql(`$1 || $one$one dollar escaped text$one$`)
	})
})

describe('foreign key chains', () => {
	before(() => {
		rawDeclareDumbTableSchema(
			['a', 'b', 'c', 'd', 'e', 'f'],
			[
				['a', 'b', 'a_id', false],
				['b', 'c', 'b_id', false],
				['c', 'd', 'c_id', false],
				['b', 'd', 'right_b_id', false],
				['b', 'd', 'left_b_id', false],
				['a', 'd', 'a_id', false],
				['d', 'e', 'd_id', false],
				['d', 'f', 'd_id', false],
			],
		)
	})

	it('can handle unambiguous chains', () => {
		let chain, joinConditions

		// starting from b
		// ~~b_id~~c_id~~d
		chain = new ForeignKeyChain([new KeyReference(['b_id']), new KeyReference(['c_id'])], 'd')
		joinConditions = chain.makeJoinConditions('b', 'b', 'd')
		expect(joinConditions).lengthOf(2)
		expect(joinConditions).eql([[ '(b.id = c.b_id)', 'c', 'c' ], [ '(c.id = d.c_id)', 'd', 'd' ]])

		// starting from b
		// ~~right_b_id~~d
		chain = new ForeignKeyChain([new KeyReference(['right_b_id'])], 'd')
		joinConditions = chain.makeJoinConditions('b', 'b', 'd')
		expect(joinConditions).lengthOf(1)
		expect(joinConditions).eql([[ '(b.id = d.right_b_id)', 'd', 'd' ]])

		// starting from b
		// ~~left_b_id~~d
		chain = new ForeignKeyChain([new KeyReference(['left_b_id'])], 'd')
		joinConditions = chain.makeJoinConditions('b', 'b', 'd')
		expect(joinConditions).lengthOf(1)
		expect(joinConditions).eql([[ '(b.id = d.left_b_id)', 'd', 'd' ]])
	})

	it('can handle qualified', () => {
		let chain, joinConditions

		// starting from a
		// ~~b.a_id~~b
		chain = new ForeignKeyChain([new KeyReference(['a_id'], 'b')], 'b')
		joinConditions = chain.makeJoinConditions('a', 'a', 'b')
		expect(joinConditions).lengthOf(1)
		expect(joinConditions).eql([[ '(a.id = b.a_id)', 'b', 'b' ]])

		// starting from a
		// ~~d.a_id~~e.d_id~~e
		chain = new ForeignKeyChain([new KeyReference(['a_id'], 'd'), new KeyReference(['d_id'], 'e')], 'e')
		joinConditions = chain.makeJoinConditions('a', 'a', 'e')
		expect(joinConditions).lengthOf(2)
		expect(joinConditions).eql([[ '(a.id = d.a_id)', 'd', 'd' ], [ '(d.id = e.d_id)', 'e', 'e' ]])

		// starting from a
		// ~~d.a_id~~f.d_id~~f
		chain = new ForeignKeyChain([new KeyReference(['a_id'], 'd'), new KeyReference(['d_id'], 'f')], 'f')
		joinConditions = chain.makeJoinConditions('a', 'a', 'f')
		expect(joinConditions).lengthOf(2)
		expect(joinConditions).eql([[ '(a.id = d.a_id)', 'd', 'd' ], [ '(d.id = f.d_id)', 'f', 'f' ]])
	})

	it('fails if given an incorrect destination', () => {
		const chain = new ForeignKeyChain([new KeyReference(['a_id'], 'b')], 'c')
		expect(() => chain.makeJoinConditions('a', 'a', 'c')).throw("you've given an incorrect destinationTableName: ")
	})

	after(() => {
		_resetTableLookupMap()
	})
})


describe('query with arguments', () => {
	before(() => {
		rawDeclareDumbTableSchema(['root'], [])
	})

	const arg = new Arg(1, 'id', 'int', false)

	it('renders correctly', () => {
		const q = new Query(
			'thing', [arg],
			new QueryBlock(
				'root_display', 'root', new SimpleTable('root'), true,
				[
					new QueryColumn('root_column', 'root_column'),
				],
				[new WhereDirective(
					'id',
					arg,
					WhereType.Eq,
				)],
				[],
				undefined, undefined
			)
		)

		const sql = boilString(q.renderSql())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing (int) as
			select
				json_agg(json_build_object(
					'root_column', root_display.root_column
				)) as root_display
			from
				root as root_display
			where (root_display.id = $1)
			;
		`))
	})

	after(() => {
		_resetTableLookupMap()
	})
})


describe('single layer query', () => {
	before(() => {
		rawDeclareDumbTableSchema(['root'], [])
	})

	it('compiles correctly with no args', () => {
		const q = new Query(
			'thing', [],
			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryColumn('root_column', 'root_column'),
				],
				[], [],
				undefined, undefined
			)
		)
		const sql = boilString(q.renderSql())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing as
			select
				json_agg(json_build_object(
					'root_column', root.root_column
				)) as root
			from
				root as root
			;
		`))
	})

	it('compiles correctly with default and no default args', () => {
		const q = new Query(
			'thing', [new Arg(1, 'id', 'int', false), new Arg(2, 'amount', 'int', false, 2000)],

			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryColumn('root_column', 'root_column'),
					new QueryColumn('other_column', 'diff_other_column'),
					new QueryColumn('diff_column', 'diff_column'),
				],
				[], [],
				undefined, undefined,
			)
		)
		const sql = boilString(q.renderSql())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing (int, int) as
			select
				json_agg(json_build_object(
					'root_column', root.root_column,
					'diff_other_column', root.other_column,
					'diff_column', root.diff_column
				)) as root

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


// _declareTable('root', 'id')
// _declareTable('right', 'id')
// _declareTable('b', 'id')
// _declareTable('c', 'id')

// _declareForeignKey('right', 'id', 'root', 'right_id', false)
// _declareForeignKey('root', 'id', 'b', 'root_id', false)
// _declareForeignKey('b', 'id', 'c', 'b_id', false)

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
// console.log(q.renderSql())

// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	b: new Table('b', 'id'),
// }
// _declareForeignKey('a', 'id', 'b', 'a_id', false)

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
// _declareForeignKey('a', 'id', 'mid', 'a_id', false)
// _declareForeignKey('b', 'id', 'mid', 'b_id', false)

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
// _declareForeignKey('a', 'id', 'b', 'a_id', false)

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
// _declareForeignKey('first_level', 'id', 'second_level', 'first_level_id', false)
// _declareForeignKey('second_level', 'id', 'third_level', 'second_level_id', false)
// _declareForeignKey('first_level', 'id', 'other_level', 'first_level_id', false)

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
