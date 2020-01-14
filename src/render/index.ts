import ts = require('typescript')
import { tuple as t } from '@ts-std/types'
import { Action, ActionManifest } from '../ast'

function renderer<R>(
	action: Action,
	render_functions: { [K in keyof ActionManifest]: (action: ActionManifest[K]) => R },
): R {
	return render_functions[action.type](action)
}


import * as sql_functions from './sql'

export function render_sql(actions: Action[]) {
	return actions.map(action => {
		const rendered_args = action.args.length !== 0
			? '(' + action.args.map(arg => arg.arg_type).join(', ') + ') '
			: ''
		return t(
			`prepare __tql_${action.type.toLowerCase()}_${action.name} ${rendered_args}as `,
			renderer(action, sql_functions),
		)
	})
}


import * as ts_functions from './ts'

export function render_ts(actions: Action[]) {
	const items = {
		'Delete': { name: '_delete', items: [] as ts.FunctionDeclaration[] },
		// 'Query': { name: 'query', items: [] as ts.FunctionDeclaration[] },
	}

	for (const action of actions) {
		items[action.type].items.push(renderer(action, ts_functions))
	}

	return Object.values(items).map(({ name, items }) => ts.createModuleDeclaration(
		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.createIdentifier(name),
		ts.createModuleBlock(items),
		ts.NodeFlags.Namespace,
	))
}


// import * as rs_functions from './rs'

// export function render_rs(actions: Action[]) {
// 	const items = {
// 		'Delete': { name: '_delete', items: [] as ts.FunctionDeclaration[] },
// 		// 'Query': { name: 'query', items: [] as ts.FunctionDeclaration[] },
// 	}

// 	for (const action of actions) {
// 		items[action.type].items.push(renderer(action, ts_functions))
// 	}

// 	return Object.values(items).map(({ name, items }) => ts.createModuleDeclaration(
// 		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
// 		ts.createIdentifier(name),
// 		ts.createModuleBlock(items),
// 		ts.NodeFlags.Namespace,
// 	))
// }
