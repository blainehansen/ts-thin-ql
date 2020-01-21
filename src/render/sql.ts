import { exhaustive, exec } from '../utils'
import { HttpVerb, Delete as _Delete, WhereDirective, DirectiveValue, OrderDirective } from '../ast'

export function Delete(d: _Delete) {
	return [
		`delete from ${d.table_name}`,
		where_clause(d.where_directives),
	].join('\n')
}

function where_clause(where_directives: WhereDirective[]) {
	return [
		'where (',
		'\t' + where_directives
			.map(({ left, right, operator }) => `${directive_value(left)} ${operator} ${directive_value(right)}`)
			.join(' and '),
		')',
	].join('\n')
}

function directive_value(value: DirectiveValue): string {
	if (typeof value === 'string')
		return `'${escape_single(value)}'`
	if (value === null || typeof value !== 'object')
		return '' + value

	if (Array.isArray(value))
		return `(${value.map(directive_value).join(', ')})`
	if ('table_name' in value)
		return `${esc(value.table_name)}.${esc(value.column_name)}`
	if ('arg_name' in value)
		return `$${value.index}`

	exhaustive(value)
}

function order_directive({ column, ascending, nulls_placement }: OrderDirective) {
	const direction_string = ascending === undefined ? '' : ascending ? ' asc' : ' desc'
	const nulls_string = nulls_placement ? ` nulls ${nulls_placement}` : ''
	return `${column}${direction_string}${nulls_string}`
}

function escape_single(value: string) {
	return value.replace(/(')/g, "\\'")
}

function indent(value: string, level: number) {
	const tabs = '\t'.repeat(level)
	return value.split(/\s*\n/).map(s => tabs + s).join('\n')
}

function quote(value: string) {
	return `'${value}'`
}

function esc(value: string) {
	return `"${value}"`
}

function paren(value: string) {
	return `(${value})`
}



export function Query({ query_name, args_tuple, query_block }: _Query) {
	const query_string = render_query_block(query_block, args_tuple)
	return [query_name, HttpVerb.GET, args_tuple, query_string]
}

function render_get_directive({ column_names, args }: GetDirective, target_table_name: string) {
	// this actually is the display name
	const final_column_names = column_names || exec(() => {
		const table = lookup_table(target_table_name)
		const column_names = table.primaryKeyColumns.map(column => column.columnName)
		if (column_names.length === 0) throw new LogError(`table: ${target_table_name} has no primary key`)
		return column_names
	})

	if (final_column_names.length !== args.length)
		throw new LogError("GetDirective column names and args didn't line up: ", final_column_names, args)

	const getDirectiveText = final_column_names
		.map((columnName, index) => `${target_table_name}.${columnName} = ${renderSqlDirectiveValue(args[index])}`)
		.join(' and ')
	return paren(getDirectiveText)
}


// // TODO you can make this regex more robust
// // https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
// // https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-CONSTANTS
// // const globalVariableRegex: RegExp = new RegExp('(\\$\\w*)?' + variableRegex.source + '$?', 'g')
// const globalVariableRegex = new RegExp(variableRegex.source + '\\b', 'g')

// function raw_sql_statement(s: RawSqlStatement) {
// 	let renderedSqlText = this.sqlText
// 	let match
// 	while ((match = globalVariableRegex.exec(renderedSqlText)) !== null) {
// 		const argName = match[0].slice(1)
// 		const arg = argsMap[argName]
// 		// by continuing rather than throwing an error,
// 		// we allow them to do whatever they want with dollar quoted strings
// 		// if they've written something invalid, they'll get an error later on
// 		if (!arg) continue
// 		renderedSqlText = renderedSqlText.replace(new RegExp('\\$' + argName + '\\b'), arg.renderSql())
// 	}

// 	return renderedSqlText
// }

// export function makeArgsMap(args: Arg[]) {
// 	return args.reduce(
// 		(map, a) => { map[a.argName] = a; return map },
// 		{} as { [argName: string]: Arg },
// 	)
// }


// // we do this join condition in addition to our filters
// function query_block(query_block: QueryBlock, args: Arg[], parentJoinCondition?: string) {
// 	const { displayName, targetTableName, isMany, entities, whereDirectives, orderDirectives, limit, offset } = this
// 	// const table = lookup_table(targetTableName)
// 	lookup_table(targetTableName)

// 	// TODO
// 	// const currentTable = lookup_table(targetTableName)
// 	// const isMany = inspect.determineIsMany(parentTable, currentTable)

// 	const columnSelectStrings: string[] = []
// 	const embedSelectStrings: string[] = []
// 	const joinStrings: string[] = []

// 	const argsMap = makeArgsMap(args)

// 	for (const entity of entities) {
// 		if (entity instanceof QueryColumn) {
// 			columnSelectStrings.push(entity.renderSql(displayName))
// 			continue
// 		}
// 		if (entity instanceof QueryRawColumn) {
// 			columnSelectStrings.push(entity.renderSql(argsMap))
// 			continue
// 		}

// 		const { useLeft, displayName: entityDisplayName } = entity
// 		// the embed query gives the whole aggregation the alias of the displayName
// 		embedSelectStrings.push(`'${entityDisplayName}', ${entityDisplayName}.${entityDisplayName}`)

// 		const joinConditions = entity.accessObject.makeJoinConditions(displayName, targetTableName, entityDisplayName)
// 		const finalJoin = joinConditions.pop()
// 		if (!finalJoin) throw new LogError("no final join condition, can't proceed", finalJoin)
// 		const [finalCond, , ] = finalJoin

// 		const joinTypeString = useLeft ? 'left' : 'inner'
// 		const basicJoins = joinConditions.map(([cond, disp, tab]) => `${joinTypeString} join ${tab} as ${disp} on ${cond}`)
// 		Array.prototype.push.apply(joinStrings, basicJoins)
// 		// and now to push the final one
// 		joinStrings.push(`${joinTypeString} join lateral (${entity.renderSql(args, finalCond)}) as ${entityDisplayName} on true` )
// 	}

// 	// this moment is where we decide whether to use json_agg or not
// 	// the embed queries have already handled themselves,
// 	// so we're simply asking if this current query will return multiple
// 	const selectString = `json_build_object(${columnSelectStrings.concat(embedSelectStrings).join(', ')})`

// 	const joinString = joinStrings.join('\n\t')

// 	const parentJoinStrings = parentJoinCondition ? [parentJoinCondition] : []

// 	const wherePrefix = 'where '
// 	// TODO what happens when something's embedded but has a GetDirective?
// 	// we probably shouldn't allow that, since it makes no sense
// 	const whereString = whereDirectives instanceof GetDirective
// 		? wherePrefix + whereDirectives.renderSql(displayName)
// 		: maybeJoinWithPrefix(wherePrefix, ' and ', parentJoinStrings.concat(whereDirectives.map(w => w.renderSql(displayName))))

// 	// TODO if !isMany then order and limit and where aren't allowed
// 	const orderString = maybeJoinWithPrefix(' order by ', ', ', orderDirectives.map(o => o.renderSql()))
// 	const finalSelectString = (isMany ? `json_agg(${selectString}${orderString}) :: text` : selectString) + ` as ${displayName}`

// 	const limitString = limit ? `limit ${renderSqlDirectiveValue(limit)}` : ''
// 	const offsetString = offset ? `offset ${renderSqlDirectiveValue(offset)}` : ''

// 	return `
// 		select ${finalSelectString}
// 		from
// 			${targetTableName} as ${displayName}
// 			${joinString}
// 		${whereString}
// 		${limitString}
// 		${offsetString}
// 	`
// }


// function query_column(q: QueryColumn, targetTableName: string) {
// 	return `'${this.displayName}', ${targetTableName}.${this.columnName}`
// }
// function query_raw_column(q: QueryRawColumn, argsMap: { [argName: string]: Arg }) {
// 	return `'${this.displayName}', ${this.statement.renderSql(argsMap)}`
// }


// interface TableAccessor {
// 	makeJoinConditions(
// 		previousDisplayName: string, previousTableName: string, targetDisplayName: string
// 	): Array<[string, string, string]>,

// 	getTargetTableName(): string,
// }

// abstract class BasicTableAccessor implements TableAccessor {
// 	constructor(readonly tableNames: string[]) {}

// 	getTargetTableName() {
// 		const tableNames = this.tableNames
// 		return tableNames[tableNames.length - 1]
// 	}

// 	makeJoinConditions(previousDisplayName: string, previousTableName: string, targetDisplayName: string) {
// 		const joinConditions: [string, string, string][] = []

// 		let previousTable = lookup_table(previousTableName)
// 		const lastIndex = this.tableNames.length - 1
// 		for (const [index, joinTableName] of this.tableNames.entries()) {
// 			const joinTable = lookup_table(joinTableName)
// 			const joinDisplayName = index === lastIndex ? targetDisplayName : joinTableName

// 			// here we do all the keying logic
// 			const visibleTable = previousTable.visibleTables[joinTableName]
// 			if (!visibleTable) throw new LogError("can't get to table: ", previousTableName, joinTableName)
// 			// if (visibleTable.length !== 1) throw new LogError("ambiguous: ", tableName, entityTableName)

// 			const { remote, foreignKey: { referredColumns, pointingColumns, pointingUnique } } = visibleTable
// 			// checkManyCorrectness(pointingUnique, remote, entityIsMany)

// 			const [previousKeys, joinKeys] = remote
// 				? [referredColumns, pointingColumns]
// 				: [pointingColumns, referredColumns]

// 			const joinCondition = constructJoinKey(previousDisplayName, previousKeys, joinDisplayName, joinKeys)

// 			joinConditions.push([joinCondition, joinDisplayName, joinTableName])

// 			previousTableName = joinTableName
// 			previousTable = joinTable
// 			previousDisplayName = joinDisplayName
// 		}

// 		return joinConditions
// 	}
// }

// function constructJoinKey(previousDisplayName: string, previousKeys: string[], joinDisplayName: string, joinKeys: string[]) {
// 	if (previousKeys.length !== joinKeys.length) throw new LogError("some foreign keys didn't line up: ", previousKeys, joinKeys)

// 	const joinConditionText = previousKeys
// 		.map((previousKey, index) => {
// 			const joinKey = joinKeys[index]
// 			if (!joinKey) throw new LogError("some foreign keys didn't line up: ", previousKeys, joinKeys)
// 			return `${previousDisplayName}.${previousKey} = ${joinDisplayName}.${joinKey}`
// 		})
// 		.join(' and ')

// 	return paren(joinConditionText)
// }

// export class SimpleTable extends BasicTableAccessor {
// 	constructor(tableName: string) {
// 		super([tableName])
// 	}
// }

// export class TableChain extends BasicTableAccessor {
// 	constructor(tableNames: string[]) {
// 		if (tableNames.length === 0) throw new LogError("can't have empty TableChain: ")
// 		if (tableNames.length === 1) throw new LogError("can't have TableChain with only one table: ", tableNames)

// 		super(tableNames)
// 	}
// }



// export class KeyReference {
// 	constructor(readonly keyNames: string[], readonly tableName?: string) {}
// }

// // this is going to be a chain of only foreignKey's, not any column
// // which means it will just be useful to disambiguate normal joins
// // ~~some_key~~some_other~~table_name.key~~key~~destination_table_name
// // for composite keys, must give table_name and use parens
// // ~~some_key~~some_other~~table_name(key, other_key)~~key~~destination_table_name
// export class ForeignKeyChain implements TableAccessor {
// 	constructor(readonly keyReferences: KeyReference[], readonly destinationTableName: string) {
// 		lookup_table(destinationTableName)
// 	}

// 	getTargetTableName() {
// 		return this.destinationTableName
// 	}

// 	makeJoinConditions(previousDisplayName: string, previousTableName: string, targetDisplayName: string) {
// 		const joinConditions: Array<[string, string, string]> = []

// 		let previousTable = lookup_table(previousTableName)

// 		const lastIndex = this.keyReferences.length - 1
// 		for (const [index, { keyNames, tableName }] of this.keyReferences.entries()) {

// 			const visibleTablesMap = previousTable.visibleTablesByKey[keyNames.join(',')] || {}
// 			let visibleTable
// 			if (tableName) {
// 				visibleTable = visibleTablesMap[tableName]
// 				if (!visibleTable) throw new LogError("tableName has no key ", keyNames)
// 			}
// 			else {
// 				const visibleTables = Object.values(visibleTablesMap)
// 				if (visibleTables.length !== 1) throw new LogError("keyName is ambiguous: ", keyNames)
// 				visibleTable = visibleTables[0]
// 			}

// 			const { remote, foreignKey: { referredTable, referredColumns, pointingTable, pointingColumns, pointingUnique } } = visibleTable

// 			const [previousKeys, joinTable, joinKeys] = remote
// 				? [referredColumns, pointingTable, pointingColumns]
// 				: [pointingColumns, referredTable, referredColumns]
// 			const joinTableName = joinTable.tableName
// 			const joinDisplayName = index === lastIndex ? targetDisplayName : joinTableName

// 			const joinCondition = constructJoinKey(previousDisplayName, previousKeys, joinDisplayName, joinKeys)
// 			joinConditions.push([joinCondition, joinDisplayName, joinTableName])

// 			previousTableName = joinTableName
// 			previousTable = joinTable
// 			previousDisplayName = joinDisplayName
// 		}

// 		if (previousTableName !== this.destinationTableName)
// 			throw new LogError("you've given an incorrect destinationTableName: ", previousTableName, this.destinationTableName)

// 		return joinConditions
// 	}
// }



// this is for lining up arbitrary columns, no restrictions at all (except for column type)
// ~local_col=some_col~same_table_col=qualified.other_col~destination_table_name
// export class ColumnKeyChain implements TableAccessor {
// 	constructor() {
// 	}

// 	makeJoinConditions(previousDisplayName: string, previousTableName: string, entityIsMany: boolean) {
// 	}
// }



// will basically need functions to render blocks for insert/put/patch/delete that will need awareness of the parent block
// and of course the target table and the mutation level will matter
