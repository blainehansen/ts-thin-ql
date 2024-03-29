import 'mocha'
import { expect } from 'chai'

import { render_sql, render_ts } from './index'
import { Delete, WhereDirective, BooleanOperator, ColumnName } from '../ast'

import { e, boil_string as b } from '../utils.spec'

const actions = [
	new Delete('some_table', 'some_table', [], [
		new WhereDirective(new ColumnName('some_table', 'some_column'), 4, BooleanOperator.Eq),
		new WhereDirective(new ColumnName('some_table', 'different_column'), [1, 2, 3], BooleanOperator.Nin),
	]),

	new Query()
]

describe('render_sql', () => it('works', () => {
	const [[p, s]] = render_sql(actions)
	expect([[p, b(s)]]).eql([
		[
			'prepare __tql_delete_some_table as ',
			`delete from some_table where ("some_table"."some_column" = 4 and "some_table"."different_column" not in (1, 2, 3))`,
		]
	])
}))


// describe('render_ts', () => it('works', () => {
// 	export namespace _delete {
// 		export function some_table() {
// 			return axios.delete('/delete/some_table') as ResultPromise<void, HttpError>
// 		}
// 	}

// 	e(render_ts(actions)).map(print_node).eql([
// 		b(`
// 			//
// 		`)
// 	])
// }))
