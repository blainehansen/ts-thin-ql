import { Action, CqlAtomicPrimitive, CqlPrimitive, tab, quote, esc, paren, maybeJoinWithPrefix, HttpVerb, renderSqlPrimitive, renderTsPrimitive, Arg } from './common'

export class DeleteSingle implements Action {
	constructor(
		readonly deleteName: string,
		readonly tableName: string,
		readonly argsTuple: Arg[],
		readonly getDirective: GetDirective,
	) {}

	renderSql(): [string, HttpVerb, Arg[], string, string] {
		const { deleteName, tableName, argsTuple, getDirective } = this

		const queryString = `DELETE from ${tableName} where ${w.renderSql(displayName)}`
		const prepareSql = `prepare __tql_query_${deleteName} ${argPortion} as \n${queryString}\;`

		return [deleteName, HttpVerb.DELETE, argsTuple, prepareSql, queryString]
	}

	renderTs(): [string, HttpVerb, string, string, string[], string] {
		const { deleteName, tableName, argsTuple } = this

		const args = argsTuple.map(arg => arg.renderTs()).join(', ')
		const argsPaths = argsTuple.map(arg => '${' + arg.argName + '}').join('/')
		const argsUsage = ' + `/' + argsPaths + '`'

		return [deleteName, HttpVerb.DELETE, args, argsUsage, [], 'void']
	}
}


export class DeleteMany implements Action {
	constructor(
		readonly deleteName: string,
		readonly tableName: string,
		readonly argsTuple: Arg[],
		readonly whereDirectives: WhereDirective[],
	) {
		if (whereDirectives.length === 0)
			throw new Error("delete many actions must have some filters")
	}

	renderSql(): [string, HttpVerb, Arg[], string, string] {
		const { deleteName, tableName, argsTuple, whereDirectives } = this

		const whereString = whereDirectives.map(w => w.renderSql(tableName)).join(' and ')
		const queryString = `DELETE from ${tableName} where ${whereString}`
		const prepareSql = `prepare __tql_query_${deleteName} ${argPortion} as \n${queryString}\;`

		return [deleteName, HttpVerb.POST, argsTuple, prepareSql, queryString]
	}

	renderTs(): [string, HttpVerb, string, string, string[], string] {
		const { deleteName, tableName, argsTuple } = this

		const args = argsTuple.map(arg => arg.renderTs()).join(', ')
		const argsUsage = argsTuple.length > 0
			? ', { ' + argsTuple.map(arg => `${arg.argName}: ${arg.argName}`).join(', ') + ' }'
			: ''

		return [deleteName, HttpVerb.POST, args, argsUsage, [], 'void']
	}
}
