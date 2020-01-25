import 'mocha'
import { expect } from 'chai'

import { PgInt } from '../../src/pgTypes'
import { boilString, rawDeclareDumbTableSchema, setupSchemaFromFiles, destroySchema } from '../utils'
import { HttpVerb } from '../../src/ast/common'
import { _resetTableLookupMap, inspect, declareInspectionResults, Column } from '../../src/inspect'
import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, WhereDirective, WhereType, ForeignKeyChain, KeyReference, RawSqlStatement } from '../../src/ast/query'


describe('correctly renders typescript return types', () => {
	before(async () => setupSchemaFromFiles('./schemas/_functions.sql', './schemas/simple-layers.sql'))
	after(async () => destroySchema())

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
})
