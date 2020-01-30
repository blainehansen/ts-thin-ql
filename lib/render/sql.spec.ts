import 'mocha'
import { expect } from 'chai'
import '@ts-std/extensions/dist/array'

import * as sql from './sql'
import { boil_string } from '../utils.spec'
import {
	Arg, BooleanOperator, Query, QueryColumn, QueryRawColumn, QueryBlock, SimpleTable, TableChain,
	ColumnName, ForeignKeyChain, KeyReference, WhereDirective,
} from '../ast'
import { _raw_declare_dumb_table_schema, _reset_registered_tables } from '../inspect.spec'

describe('query columns render correctly', () => {
	it('with same name', () => {
		const result = sql.query_column(new QueryColumn('column_name', 'column_name'), 'some_table')
		expect(result).equal(`'column_name', "some_table"."column_name"`)
	})

	it('with different names', () => {
		const result = sql.query_column(new QueryColumn('column_name', 'diff_name'), 'some_table')
		expect(result).equal(`'diff_name', "some_table"."column_name"`)
	})
})

describe('raw sql statements', () => {
	const args = [
		new Arg(1, 'one', 'not checked', false, undefined),
		new Arg(2, 'two', 'not checked', false, undefined),
		new Arg(3, 'three', 'not checked', false, undefined),
		new Arg(4, 'onetwo', 'not checked', false, undefined),
	]

	it('can do simple things', () => {
		let col

		col = new QueryRawColumn('thing', `$one / ((coalesce(some_json, $two) -> 'stuff') :: int * $three)`)
		expect(sql.query_raw_column(col, args)).eql(`'thing', $1 / ((coalesce(some_json, $2) -> 'stuff') :: int * $3)`)

		col = new QueryRawColumn('thing', `$one / ((coalesce(some_json, $one) -> 'stuff') :: int * $one)`)
		expect(sql.query_raw_column(col, args)).eql(`'thing', $1 / ((coalesce(some_json, $1) -> 'stuff') :: int * $1)`)

		col = new QueryRawColumn('thing', `$one / $onetwo`)
		expect(sql.query_raw_column(col, args)).eql(`'thing', $1 / $4`)

		col = new QueryRawColumn('thing', `$one / $onefive`)
		expect(sql.query_raw_column(col, args)).eql(`'thing', $1 / $onefive`)

		// TODO trying to figure out what's a reasonable amount of dollar escaped compatibility
		// sql = new QueryRawColumn('thing', `$one || $one$one dollar escaped text$one$`)
		// expect(sql.renderSql(args)).eql(`$1 || $one$one dollar escaped text$one$`)
	})
})

describe('foreign key chains', () => {
	before(() => _raw_declare_dumb_table_schema(
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
	))
	after(() => _reset_registered_tables())

	it('can handle unambiguous chains', () => {
		let chain, join_conditions

		// starting from b
		// ~~b_id~~c_id~~d
		chain = new ForeignKeyChain([new KeyReference(['b_id']), new KeyReference(['c_id'])], 'd')
		join_conditions = sql.make_join_conditions(chain, 'b', 'b', 'd')
		expect(join_conditions).eql([[ '"b"."id" = "c"."b_id"', 'c', 'c' ], [ '"c"."id" = "d"."c_id"', 'd', 'd' ]])

		// starting from b
		// ~~right_b_id~~d
		chain = new ForeignKeyChain([new KeyReference(['right_b_id'])], 'd')
		join_conditions = sql.make_join_conditions(chain, 'b', 'b', 'd')
		expect(join_conditions).eql([[ '"b"."id" = "d"."right_b_id"', 'd', 'd' ]])

		// starting from b
		// ~~left_b_id~~d
		chain = new ForeignKeyChain([new KeyReference(['left_b_id'])], 'd')
		join_conditions = sql.make_join_conditions(chain, 'b', 'b', 'd')
		expect(join_conditions).eql([[ '"b"."id" = "d"."left_b_id"', 'd', 'd' ]])
	})

	it('can handle qualified', () => {
		let chain, join_conditions

		// starting from a
		// ~~b.a_id~~b
		chain = new ForeignKeyChain([new KeyReference(['a_id'], 'b')], 'b')
		join_conditions = sql.make_join_conditions(chain, 'a', 'a', 'b')
		expect(join_conditions).eql([[ '"a"."id" = "b"."a_id"', 'b', 'b' ]])

		// starting from a
		// ~~d.a_id~~e.d_id~~e
		chain = new ForeignKeyChain([new KeyReference(['a_id'], 'd'), new KeyReference(['d_id'], 'e')], 'e')
		join_conditions = sql.make_join_conditions(chain, 'a', 'a', 'e')
		expect(join_conditions).eql([[ '"a"."id" = "d"."a_id"', 'd', 'd' ], [ '"d"."id" = "e"."d_id"', 'e', 'e' ]])

		// starting from a
		// ~~d.a_id~~f.d_id~~f
		chain = new ForeignKeyChain([new KeyReference(['a_id'], 'd'), new KeyReference(['d_id'], 'f')], 'f')
		join_conditions = sql.make_join_conditions(chain, 'a', 'a', 'f')
		expect(join_conditions).eql([[ '"a"."id" = "d"."a_id"', 'd', 'd' ], [ '"d"."id" = "f"."d_id"', 'f', 'f' ]])
	})

	it('fails if given an incorrect destination', () => {
		const chain = new ForeignKeyChain([new KeyReference(['a_id'], 'b')], 'c')
		expect(() => sql.make_join_conditions(chain, 'a', 'a', 'c')).throw("you've given an incorrect destination_table_name: ")
	})
})


describe('query with arguments', () => {
	before(() => _raw_declare_dumb_table_schema(['root'], []))
	after(() => _reset_registered_tables())

	const arg = new Arg(1, 'id', 'int', false, undefined)
	const q = new Query(
		'thing', [arg],
		new QueryBlock(
			'root_display', 'root', new SimpleTable('root'), true,
			[
				new QueryColumn('root_column', 'root_column'),
			],
			[new WhereDirective(
				new ColumnName('id'),
				arg,
				BooleanOperator.Eq,
			)],
			[],
			undefined, undefined, true,
		)
	)

	it('many', () => {
		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'root_column', "root_display"."root_column"
				) as "root_display"
				from
					"root" as "root_display"
				where "root_display"."id" = $1
			)) :: text as __value
		`))
	})

	it('single', () => {
		(q.block as any).is_many = false
		// TODO this likely will fail to render once we are actually intelligently checking for manyness
		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select json_build_object(
				'root_column', "root_display"."root_column"
			) :: text as __value
			from
				"root" as "root_display"
			where "root_display"."id" = $1
		`))
	})
})


describe('single layer query', () => {
	before(() => _raw_declare_dumb_table_schema(['root'], []))
	after(() => _reset_registered_tables())

	it('compiles correctly with no args', () => {
		const q = new Query(
			'thing', [],
			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryColumn('root_column', 'root_column'),
				],
				[], [],
				undefined, undefined, true,
			)
		)

		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'root_column', "root"."root_column"
				) as "root"
				from
					"root" as "root"
			)) :: text as __value
		`))
	})

	it('compiles correctly with default and no default args', () => {
		const q = new Query(
			'thing', [new Arg(1, 'id', 'int', false, undefined), new Arg(2, 'amount', 'int', false, 2000)],

			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryColumn('root_column', 'root_column'),
					new QueryColumn('other_column', 'diff_other_column'),
					new QueryColumn('diff_column', 'diff_column'),
				],
				[], [], undefined, undefined, true
			)
		)

		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'root_column', "root"."root_column",
					'diff_other_column', "root"."other_column",
					'diff_column', "root"."diff_column"
				) as "root"
				from
					"root" as "root"
			)) :: text as __value
		`))
	})
})

describe('complex queries', () => {
	it('a with child b', () => {
		_raw_declare_dumb_table_schema(['a', 'b'], [['a', 'b', 'a_id', false]])

		const q = new Query(
			'thing', [],
			new QueryBlock(
				'b', 'b', new SimpleTable('b'), true,
				[
					new QueryColumn('b_column', 'b_column'),
					new QueryBlock(
						'a', 'a', new SimpleTable('a'), false,
						[
							new QueryColumn('a_column', 'a_column')
						],
						[], [], undefined, undefined, true,
					)
				],
				[], [], undefined, undefined, true,
			)
		)
		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'b_column', "b"."b_column",
					'a', "a"."a"
				) as "b"
				from
					"b" as "b"
					left join lateral (
						select json_build_object(
							'a_column', "a"."a_column"
						) as "a"
						from "a" as "a"
						where "b"."a_id" = "a"."id"
					) as "a" on true
			)) :: text as __value
		`))

		_reset_registered_tables()
	})

	it('root with single right and children b and c', () => {
		_raw_declare_dumb_table_schema(['root', 'right', 'b', 'c'], [
			['right', 'root', 'right_id', false],
			['root', 'b', 'root_id', false],
			['b', 'c', 'b_id', false],
		])

		const q = new Query(
			'thing', [],
			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryColumn('root_column', 'root_column'),
					new QueryBlock(
						'right', 'right', new SimpleTable('right'), false,
						[
							new QueryColumn('right_column', 'right_column')
						],
						[], [], undefined, undefined, true,
					),
					new QueryBlock(
						'b', 'b', new SimpleTable('b'), true,
						[
							new QueryColumn('b_column', 'b_column'),
							new QueryBlock(
								'c', 'c', new SimpleTable('c'), true,
								[
									new QueryColumn('c_column', 'c_column')
								],
								[], [], undefined, undefined, true,
							),
						],
						[], [], undefined, undefined, true,
					),
				],
				[], [], undefined, undefined, true,
			)
		)
		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'root_column', "root"."root_column",
					'right', "right"."right",
					'b', "b"."b"
				) as "root"
				from
					"root" as "root"

					left join lateral (
						select json_build_object(
							'right_column', "right"."right_column"
						) as "right"
						from
							"right" as "right"
						where "root"."right_id" = "right"."id"
					) as "right" on true

					left join lateral (select array_to_json(array(
						select json_build_object(
							'b_column', "b"."b_column",
							'c', "c"."c"
						) as "b"
						from
							"b" as "b"
							left join lateral (select array_to_json(array(
								select json_build_object(
									'c_column', "c"."c_column"
								) as "c"
								from
									"c" as "c"
								where "b"."id" = "c"."b_id"
							)) as "c") as "c" on true
						where "root"."id" = "b"."root_id"
					)) as "b") as "b" on true

			)) :: text as __value
		`))

		_reset_registered_tables()
	})

	it('a through mid to b', () => {
		_raw_declare_dumb_table_schema(['a', 'mid', 'b'], [
			['a', 'mid', 'a_id', false],
			['b', 'mid', 'b_id', false],
		])

		const q = new Query(
			'thing', [],
			new QueryBlock(
				'a', 'a', new SimpleTable('a'), true,
				[
					new QueryColumn('a_column', 'a_column'),
					new QueryBlock(
						'b', 'b', new TableChain(['mid', 'b']), true,
						[
							new QueryColumn('b_column', 'b_column')
						],
						[], [], undefined, undefined, true,
					)
				],
				[], [], undefined, undefined, true,
			)
		)
		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'a_column', "a"."a_column",
					'b', "b"."b"
				) as "a"
				from
					"a" as "a"

					left join lateral (select array_to_json(array(
						select json_build_object(
							'b_column', "b"."b_column"
						) as "b"
						from
							"mid" as "mid"
							left join "b" as "b"
								on "mid"."b_id" = "b"."id"
						where "a"."id" = "mid"."a_id"
					)) as "b") as "b" on true

			)) :: text as __value
		`))

		_reset_registered_tables()
	})

	it('first/second/third/other levels', () => {
		_raw_declare_dumb_table_schema(['first_level', 'second_level', 'third_level', 'other_level'], [
			['first_level', 'second_level', 'first_level_id', false],
			['second_level', 'third_level', 'second_level_id', false],
			['first_level', 'other_level', 'first_level_id', false],
		])

		const q = new Query(
			'thing', [],
			new QueryBlock(
				'first_level', 'first_level', new SimpleTable('first_level'), true,
				[
					new QueryColumn('first_column', 'first_column'),

					new QueryBlock(
						'second_level', 'second_level', new SimpleTable('second_level'), true,
						[
							new QueryColumn('second_column', 'second_column'),
							new QueryBlock(
								'third_level', 'third_level', new SimpleTable('third_level'), true,
								[
									new QueryColumn('third_column', 'third_column'),
								],
								[], [], undefined, undefined, true,
							),
						],
						[], [], undefined, undefined, true,
					),

					new QueryBlock(
						'other_level', 'other_level', new SimpleTable('other_level'), true,
						[
							new QueryColumn('other_column', 'other_column'),
						],
						[], [], undefined, undefined, true,
					),
				],
				[], [], undefined, undefined, true,
			),
		)
		const rendered = boil_string(sql.Query(q))
		expect(rendered).equal(boil_string(`
			select array_to_json(array(
				select json_build_object(
					'first_column', "first_level"."first_column",
					'second_level', "second_level"."second_level",
					'other_level', "other_level"."other_level"
				) as "first_level"
				from
					"first_level" as "first_level"

					left join lateral (select array_to_json(array(
						select json_build_object(
							'second_column', "second_level"."second_column",
							'third_level', "third_level"."third_level"
						) as "second_level"
						from
							"second_level" as "second_level"

							left join lateral (select array_to_json(array(
								select json_build_object(
									'third_column', "third_level"."third_column"
								) as "third_level"
								from
									"third_level" as "third_level"
								where "second_level"."id" = "third_level"."second_level_id"
							)) as "third_level") as "third_level" on true

						where "first_level"."id" = "second_level"."first_level_id"

					)) as "second_level") as "second_level" on true

					left join lateral (select array_to_json(array(
						select json_build_object(
							'other_column', "other_level"."other_column"
						) as "other_level"
						from
							"other_level" as "other_level"
						where "first_level"."id" = "other_level"."first_level_id"
					)) as "other_level") as "other_level" on true

			)) :: text as __value
		`))

		_reset_registered_tables()
	})
})
