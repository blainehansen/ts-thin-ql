import 'mocha'
import { expect } from 'chai'

import * as ts from './ts'
import { boil_string } from '../utils.spec'
import {
	Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, WhereDirective,
	ForeignKeyChain, KeyReference,
} from '../ast'


describe('correctly renders typescript return types', () => {
	it('with simple query', () => {
		const q = (is_many: boolean) => new Query('layers', [], new QueryBlock(
			'first_level', 'first_level', new SimpleTable('first_level'), is_many,
			[
				new QueryColumn('word', 'word'),
			],
			[], [], is_many ? undefined : 1, undefined, true,
		))

		{
			const rendered = boil_string(ts.Query(q(true)).map(n => ts.print_node(n)).join('\n'))
			expect(rendered).equal(boil_string(`
				export type Layers = (Pick<_pg_types.FirstLevel, "word">)[]
				export function layers() {
					return http.get("/query/layers") as PayloadPromise<Layers>
				}
			`))
		}
		{
			const rendered = boil_string(ts.Query(q(false)).map(n => ts.print_node(n)).join('\n'))
			expect(rendered).equal(boil_string(`
				export type Layers = Pick<_pg_types.FirstLevel, "word">
				export function layers() {
					return http.get("/query/layers") as PayloadPromise<Layers>
				}
			`))
		}
	})

	it('with more complex query', () => {
		const arg = new Arg(1, 'id_limit', 'int', false, 4)
		const q = new Query('hella_layers', [arg], new QueryBlock(
			'hella_layers', 'first_level', new SimpleTable('first_level'), true,
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
							[], [], 1, undefined, true,
						)
					],
					[], [], undefined, undefined, true,
				)
			],
			[], [], undefined, undefined, true,
		))

		const rendered = boil_string(ts.Query(q).map(n => ts.print_node(n)).join('\n'))
		expect(rendered).equal(boil_string(`
			export type HellaLayers = (Pick<_pg_types.FirstLevel, "id">
				& Rename<_pg_types.FirstLevel, "word", "my_word">
				& {
					seconds: (Pick<_pg_types.SecondLevel, "id">
						& Rename<_pg_types.SecondLevel, "word", "my_word">
						& {
							thirds: Pick<_pg_types.ThirdLevel, "id">
							& Rename<_pg_types.ThirdLevel, "word", "my_word">
					})[]
				})[]

			export function hella_layers(id_limit: number = 4) {
				return http.get("/query/hella_layers", { id_limit }) as PayloadPromise<HellaLayers>
			}
		`))
	})
})
