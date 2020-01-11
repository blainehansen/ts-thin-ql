import 'mocha'
import { expect } from 'chai'

import { render_sql } from './render'
import { Delete, WhereDirective, BooleanOperator } from './ast'

import { e, boil_string } from './utils.spec'

describe('render_sql', () => it('works', () => {
	const d = new Delete('some_table', [new WhereDirective('some_column', 4, BooleanOperator.Eq)])
	e(render_sql(d)).eql(boil_string(`
		delete from some_table where (some_column = 4)
	`))
}))
