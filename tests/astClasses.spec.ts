import 'mocha'
import { expect } from 'chai'

import { declareTable, declareForeignKey, _resetTableLookupMap } from '../src/inspectionClasses'
import { CqlQuery, Arg, QueryBlock, QueryField, SimpleTable, TableChain } from '../src/astClasses'


function boilString(value: string) {
	return value.replace(/\s+/g, ' ').trim()
}

describe('query fields render correctly', () => {
	it('with same name', () => {
		const result = new QueryField('field_name', 'field_name').render()
		expect(result).equal("field_name as field_name")
	})

	it('with different names', () => {
		const result = new QueryField('field_name', 'diff_name').render()
		expect(result).equal("field_name as diff_name")
	})
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
		const q = new CqlQuery(
			'thing', [],
			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryField('root_field', 'root_field'),
				]
			)
		)
		const sql = boilString(q.render())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing as
			select root.root_field as root_field
			from
				root as root
			;
		`))
	})

	it('compiles correctly with default and no default args', () => {
		const q = new CqlQuery(
			'thing', [new Arg('id', 'int'), new Arg('amount', 'int', 2000)],
			new QueryBlock(
				'root', 'root', new SimpleTable('root'), true,
				[
					new QueryField('root_field', 'root_field'),
					new QueryField('other_field', 'diff_other_field'),
					new QueryField('diff_field', 'diff_field'),
				]
			)
		)
		const sql = boilString(q.render())

		expect(sql).equal(boilString(`
			prepare __cq_query_thing (int, int) as
			select
				root.root_field as root_field,
				root.other_field as diff_other_field,
				root.diff_field as diff_field
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
// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'root', 'root', new SimpleTable('root'), true,
// 		[
// 			new QueryField('root_field', 'root_field'),
// 			new QueryBlock(
// 				'right', 'right', new SimpleTable('right'), false,
// 				[
// 					new QueryField('right_field', 'right_field')
// 				]
// 			),
// 			new QueryBlock(
// 				'b', 'b', new SimpleTable('b'), true,
// 				[
// 					new QueryField('b_field', 'b_field'),
// 					new QueryBlock(
// 						'c', 'c', new SimpleTable('c'), true,
// 						[
// 							new QueryField('c_field', 'c_field')
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

// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'b', 'b', new SimpleTable('b'), true,
// 		[
// 			new QueryField('b_field', 'b_field'),
// 			new QueryBlock(
// 				'a', 'a', new SimpleTable('a'), false,
// 				[
// 					new QueryField('a_field', 'a_field')
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

// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'a', 'a', new SimpleTable('a'), true,
// 		[
// 			new QueryField('a_field', 'a_field'),
// 			new QueryBlock(
// 				'b', 'b', new TableChain('mid', 'b'), true,
// 				[
// 					new QueryField('b_field', 'b_field')
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

// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'a', 'a', new SimpleTable('a'), true,
// 		[
// 			new QueryField('a_field', 'a_field'),
// 			new QueryBlock(
// 				'b', 'b', new SimpleTable('b'), true,
// 				[
// 					new QueryField('b_field', 'b_field')
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
// const q = new CqlQuery(
// 	'firstQuery',
// 	new QueryBlock(
// 		'first_level', 'first_level', true,
// 		[
// 			new QueryField('first_field', 'first_field'),

// 			new QueryBlock(
// 				'second_level', 'second_level', true,
// 				[
// 					new QueryField('second_field', 'second_field'),
// 					new QueryBlock(
// 						'third_level', 'third_level', true,
// 						[
// 							new QueryField('third_field', 'third_field'),
// 						],
// 					),
// 				],
// 			),

// 			new QueryBlock(
// 				'other_level', 'other_level', true,
// 				[
// 					new QueryField('other_field', 'other_field'),
// 				],
// 			),
// 		],
// 	),
// )
