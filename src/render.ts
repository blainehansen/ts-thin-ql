import { Action, ActionManifest } from './ast'

function renderer<R>(
	action: Action,
	render_functions: { [K in keyof ActionManifest]: (params: { [action_key in K]: ActionManifest[K] }) => R },
): R {
	return render_functions[action.type]({ [action.type]: action})
}


import sql_delete from './sql/delete'

const sql_functions = {
	'Delete': sql_delete,
}
export function render_sql(action: Action) {
	return renderer(action, sql_functions)
}
