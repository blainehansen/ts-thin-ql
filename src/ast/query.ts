import { LogError, Int } from '../utils'
import { variableRegex } from '../parserUtils'
import { Column, lookupTable, getTsType } from '../inspect'

import { Action, CqlAtomicPrimitive, CqlPrimitive, tab, quote, esc, paren, maybeJoinWithPrefix, HttpVerb, renderSqlPrimitive, renderTsPrimitive , Arg } from './common'

const pascalCase = require('pascal-case')
const camelCase = require('camel-case')


export class Query implements Action {
	constructor(readonly queryName: string, readonly argsTuple: Arg[], readonly queryBlock: QueryBlock) {}

	renderSql(): [string, HttpVerb, Arg[], string, string] {
		const { queryName, argsTuple, queryBlock } = this

		const queryString = queryBlock.renderSql(argsTuple)

		const argPortion = argsTuple.length > 0 ? `(${argsTuple.map(a => a.argType).join(', ')})` : ''

		const prepareSql = `prepare __tql_query_${queryName} ${argPortion} as\n${queryString}\n;`

		return [queryName, HttpVerb.GET, argsTuple, prepareSql, queryString]
	}

	// renderTs(): [string, HttpVerb, string[], { [argName: string]: string }, string[]] {
	renderTs(): [string, HttpVerb, string, string, string[], string] {
		// this needs to return all the information needed to render
		// - the function itself
		// - the return type for the function
		// - the types for all the arguments
		// so probably a tuple, or displayName, httpVerb, args, argsUsage, and all types

		// for a query, the args are pretty simple, since they're just primitives (and at some point enum values)
		// the args usage will be an options object, so you could return the object itself and the code actually placing all of this in context would do the work of JSON.stringify'ing it or iterating it

		// the code above this will be creating a bunch of base types representing the accessible portions of all the tables,
		// and any global types like enums
		// we'll just assume the existence of those types based on table names

		const { queryName, argsTuple, queryBlock } = this

		const args = argsTuple.map(arg => arg.renderTs()).join(', ')
		const argsUsage = argsTuple.length > 0
			? ', { ' + argsTuple.map(arg => `${arg.argName}: ${arg.argName}`).join(', ') + ' }'
			: ''

		// a query only has one complex and dependent type, which is the return type
		// others will have complex payload types,
		// but even other potential complex types (like setof or composite types)
		// would be defined in the database, and not by tql
		const returnType = queryBlock.renderTs()
		const returnTypeName = pascalCase(queryName) + pascalCase(queryBlock.targetTableName)
		const namedReturnType = `type ${returnTypeName} = ${returnType}`

		// the reason we might choose not to just return a fully rendered string for the function,
		// is because the outer context might have more information about where and how those functions should be rendered
		// like for example if they should be top level exports or in an api object
		// and certainly we need to return the neededTypes separately, since they need to be placed differently in the file
		return [queryName, HttpVerb.GET, args, argsUsage, [namedReturnType], returnTypeName]
	}
}


type DirectiveValue = CqlPrimitive | Arg

function renderSqlDirectiveValue(directiveValue: DirectiveValue) {
	return directiveValue instanceof Arg
		? directiveValue.renderSql()
		: renderSqlPrimitive(directiveValue)
}

export class GetDirective {
	constructor(readonly args: DirectiveValue[], readonly columnNames?: string[]) {}

	renderSql(targetTableName: string) {
		// this actually is the display name
		function getPrimaryKeyColumnNames(tableName: string) {
			const table = lookupTable(tableName)
			const columnNames = table.primaryKeyColumns.map(column => column.columnName)
			if (columnNames.length === 0) throw new LogError(`table: ${tableName} has no primary key`)
			return columnNames
		}

		const columnNames = this.columnNames || getPrimaryKeyColumnNames(targetTableName)
		const args = this.args

		if (columnNames.length !== args.length) throw new LogError("GetDirective column names and args didn't line up: ", columnNames, args)

		const getDirectiveText = columnNames
			.map((columnName, index) => `${targetTableName}.${columnName} = ${renderSqlDirectiveValue(args[index])}`)
			.join(' and ')
		return paren(getDirectiveText)
	}
}

// these are best served with sql literal
// sql literal has to intelligently remove $args though
// like
// fts, normal, plain, phrase
// create a sql literal function, parse it intelligently with opening and closing things
export enum WhereType {
	Eq = '=',
	Lt = '<',
	Lte = '<=',
	Gt = '>',
	Gte = '>=',
	Ne = '!=',
	In = 'in',
	Nin = 'not in',
	Is = 'is',
	Nis = 'is not',
	Bet = 'between',
	Nbet = 'not between',
	Symbet = 'between symmetric',
	Nsymbet = 'not between symmetric',
	Dist = 'is distinct from',
	Ndist = 'is not distinct from',
}

export class WhereDirective {
	constructor(readonly columnName: string, readonly arg: DirectiveValue, readonly filterType: WhereType) {}

	renderSql(targetTableName: string) {
		return paren(`${targetTableName}.${this.columnName} ${this.filterType} ${renderSqlDirectiveValue(this.arg)}`)
	}
}

export enum OrderByNullsPlacement { First = 'first', Last = 'last' }

export class OrderDirective {
	// TODO probably should be columnDisplayName: string
	constructor(readonly column: string, readonly ascending?: boolean, readonly nullsPlacement?: OrderByNullsPlacement) {}

	renderSql() {
		const directionString = this.ascending === undefined ? '' : this.ascending ? ' asc' : ' desc'
		const nullsString = this.nullsPlacement ? ` nulls ${this.nullsPlacement}` : ''
		return `${this.column}${directionString}${nullsString}`
	}
}

// TODO you can make this regex more robust
// https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
// https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-CONSTANTS
// const globalVariableRegex: RegExp = new RegExp('(\\$\\w*)?' + variableRegex.source + '$?', 'g')
const globalVariableRegex = new RegExp(variableRegex.source + '\\b', 'g')
export class RawSqlStatement {
	constructor(readonly sqlText: string) {}

	renderSql(argsMap: { [argName: string]: Arg }) {
		let renderedSqlText = this.sqlText
		let match
		while ((match = globalVariableRegex.exec(renderedSqlText)) !== null) {
			const argName = match[0].slice(1)
			const arg = argsMap[argName]
			// by continuing rather than throwing an error,
			// we allow them to do whatever they want with dollar quoted strings
			// if they've written something invalid, they'll get an error later on
			if (!arg) continue
			renderedSqlText = renderedSqlText.replace(new RegExp('\\$' + argName + '\\b'), arg.renderSql())
		}

		return renderedSqlText
	}
}

export function makeArgsMap(args: Arg[]) {
	return args.reduce(
		(map, a) => { map[a.argName] = a; return map },
		{} as { [argName: string]: Arg },
	)
}

type QueryObject = QueryBlock | QueryColumn | QueryRawColumn
export class QueryBlock {
	constructor(
		readonly displayName: string,
		readonly targetTableName: string,
		readonly accessObject: TableAccessor,
		readonly isMany: boolean,
		readonly entities: QueryObject[],
		readonly whereDirectives: GetDirective | WhereDirective[],
		readonly orderDirectives: OrderDirective[],
		readonly limit?: DirectiveValue,
		readonly offset?: DirectiveValue,
		readonly useLeft: boolean = true,
	) {}

	renderTs(indentLevel: number = 1) {
			// assume the existence of a type TableName
		const tableTypeName = pascalCase(lookupTable(this.targetTableName).tableName)

		const sameCols: string[] = []
		const renameCols: string[] = []
		const extras: { [displayName: string]: string } = {}
		const childIndentLevel = indentLevel + 1

		for (const entity of this.entities) {
			if (entity instanceof QueryColumn) {
				if (entity.columnName === entity.displayName)
					sameCols.push(entity.columnName)
				else
					renameCols.push(`Rename<${tableTypeName}, ${quote(entity.columnName)}, ${quote(entity.displayName)}>`)
				continue
			}
			if (entity instanceof QueryRawColumn) {
				// TODO is there a way to not make so many database round trips?
				// TODO not bothering with these for now
				// extras[entity.displayName] = getTsType(discoverPgExpressionType(entity.statement))
				continue
			}

			extras[entity.displayName] = entity.renderTs(childIndentLevel)
		}

		const typeStrings = []

		if (sameCols.length > 0)
			typeStrings.push(`Pick<${tableTypeName}, ${sameCols.map(quote).join(' | ')}>`)

		Array.prototype.push.apply(typeStrings, renameCols)

		const extraEntries = Object.entries(extras)
		if (extraEntries.length > 0)
			typeStrings.push(
				'{' + extraEntries
					.map(([displayName, typeText]) => `\n${tab(childIndentLevel)}${displayName}: ${typeText},`)
					.join()
					+ '\n' + tab(indentLevel) + '}'
			)

		const typeText = typeStrings.join('\n' + tab(indentLevel) + '& ')

		return this.isMany
			? paren(typeText) + '[]'
			: typeText
	}

	// we do this join condition in addition to our filters
	renderSql(args: Arg[], parentJoinCondition?: string) {
		const { displayName, targetTableName, isMany, entities, whereDirectives, orderDirectives, limit, offset } = this
		// const table = lookupTable(targetTableName)
		lookupTable(targetTableName)

		// TODO
		// const currentTable = lookupTable(targetTableName)
		// const isMany = inspect.determineIsMany(parentTable, currentTable)

		const columnSelectStrings: string[] = []
		const embedSelectStrings: string[] = []
		const joinStrings: string[] = []

		const argsMap = makeArgsMap(args)

		for (const entity of entities) {
			if (entity instanceof QueryColumn) {
				columnSelectStrings.push(entity.renderSql(displayName))
				continue
			}
			if (entity instanceof QueryRawColumn) {
				columnSelectStrings.push(entity.renderSql(argsMap))
				continue
			}

			const { useLeft, displayName: entityDisplayName } = entity
			// the embed query gives the whole aggregation the alias of the displayName
			embedSelectStrings.push(`'${entityDisplayName}', ${entityDisplayName}.${entityDisplayName}`)

			const joinConditions = entity.accessObject.makeJoinConditions(displayName, targetTableName, entityDisplayName)
			const finalJoin = joinConditions.pop()
			if (!finalJoin) throw new LogError("no final join condition, can't proceed", finalJoin)
			const [finalCond, , ] = finalJoin

			const joinTypeString = useLeft ? 'left' : 'inner'
			const basicJoins = joinConditions.map(([cond, disp, tab]) => `${joinTypeString} join ${tab} as ${disp} on ${cond}`)
			Array.prototype.push.apply(joinStrings, basicJoins)
			// and now to push the final one
			joinStrings.push(`${joinTypeString} join lateral (${entity.renderSql(args, finalCond)}) as ${entityDisplayName} on true` )
		}

		// this moment is where we decide whether to use json_agg or not
		// the embed queries have already handled themselves,
		// so we're simply asking if this current query will return multiple
		const selectString = `json_build_object(${columnSelectStrings.concat(embedSelectStrings).join(', ')})`

		const joinString = joinStrings.join('\n\t')

		const parentJoinStrings = parentJoinCondition ? [parentJoinCondition] : []

		const wherePrefix = 'where '
		// TODO what happens when something's embedded but has a GetDirective?
		// we probably shouldn't allow that, since it makes no sense
		const whereString = whereDirectives instanceof GetDirective
			? wherePrefix + whereDirectives.renderSql(displayName)
			: maybeJoinWithPrefix(wherePrefix, ' and ', parentJoinStrings.concat(whereDirectives.map(w => w.renderSql(displayName))))

		// TODO if !isMany then order and limit and where aren't allowed
		const orderString = maybeJoinWithPrefix(' order by ', ', ', orderDirectives.map(o => o.renderSql()))
		const finalSelectString = (isMany ? `json_agg(${selectString}${orderString}) :: text` : selectString) + ` as ${displayName}`

		const limitString = limit ? `limit ${renderSqlDirectiveValue(limit)}` : ''
		const offsetString = offset ? `offset ${renderSqlDirectiveValue(offset)}` : ''

		return `
			select ${finalSelectString}
			from
				${targetTableName} as ${displayName}
				${joinString}
			${whereString}
			${limitString}
			${offsetString}
		`
	}
}


interface TableAccessor {
	makeJoinConditions(
		previousDisplayName: string, previousTableName: string, targetDisplayName: string
	): Array<[string, string, string]>,

	getTargetTableName(): string,
}

abstract class BasicTableAccessor implements TableAccessor {
	constructor(readonly tableNames: string[]) {}

	getTargetTableName() {
		const tableNames = this.tableNames
		return tableNames[tableNames.length - 1]
	}

	makeJoinConditions(previousDisplayName: string, previousTableName: string, targetDisplayName: string) {
		const joinConditions: Array<[string, string, string]> = []

		let previousTable = lookupTable(previousTableName)
		const lastIndex = this.tableNames.length - 1
		for (const [index, joinTableName] of this.tableNames.entries()) {
			const joinTable = lookupTable(joinTableName)
			const joinDisplayName = index === lastIndex ? targetDisplayName : joinTableName

			// here we do all the keying logic
			const visibleTable = previousTable.visibleTables[joinTableName]
			if (!visibleTable) throw new LogError("can't get to table: ", previousTableName, joinTableName)
			// if (visibleTable.length !== 1) throw new LogError("ambiguous: ", tableName, entityTableName)

			const { remote, foreignKey: { referredColumns, pointingColumns, pointingUnique } } = visibleTable
			// checkManyCorrectness(pointingUnique, remote, entityIsMany)

			const [previousKeys, joinKeys] = remote
				? [referredColumns, pointingColumns]
				: [pointingColumns, referredColumns]

			const joinCondition = constructJoinKey(previousDisplayName, previousKeys, joinDisplayName, joinKeys)

			joinConditions.push([joinCondition, joinDisplayName, joinTableName])

			previousTableName = joinTableName
			previousTable = joinTable
			previousDisplayName = joinDisplayName
		}

		return joinConditions
	}
}

function constructJoinKey(previousDisplayName: string, previousKeys: string[], joinDisplayName: string, joinKeys: string[]) {
	if (previousKeys.length !== joinKeys.length) throw new LogError("some foreign keys didn't line up: ", previousKeys, joinKeys)

	const joinConditionText = previousKeys
		.map((previousKey, index) => {
			const joinKey = joinKeys[index]
			if (!joinKey) throw new LogError("some foreign keys didn't line up: ", previousKeys, joinKeys)
			return `${previousDisplayName}.${previousKey} = ${joinDisplayName}.${joinKey}`
		})
		.join(' and ')

	return paren(joinConditionText)
}

export class SimpleTable extends BasicTableAccessor {
	constructor(tableName: string) {
		super([tableName])
	}
}

export class TableChain extends BasicTableAccessor {
	constructor(tableNames: string[]) {
		if (tableNames.length === 0) throw new LogError("can't have empty TableChain: ")
		if (tableNames.length === 1) throw new LogError("can't have TableChain with only one table: ", tableNames)

		super(tableNames)
	}
}



export class KeyReference {
	constructor(readonly keyNames: string[], readonly tableName?: string) {}
}

// this is going to be a chain of only foreignKey's, not any column
// which means it will just be useful to disambiguate normal joins
// ~~some_key~~some_other~~table_name.key~~key~~destination_table_name
// for composite keys, must give table_name and use parens
// ~~some_key~~some_other~~table_name(key, other_key)~~key~~destination_table_name
export class ForeignKeyChain implements TableAccessor {
	constructor(readonly keyReferences: KeyReference[], readonly destinationTableName: string) {
		lookupTable(destinationTableName)
	}

	getTargetTableName() {
		return this.destinationTableName
	}

	makeJoinConditions(previousDisplayName: string, previousTableName: string, targetDisplayName: string) {
		const joinConditions: Array<[string, string, string]> = []

		let previousTable = lookupTable(previousTableName)

		const lastIndex = this.keyReferences.length - 1
		for (const [index, { keyNames, tableName }] of this.keyReferences.entries()) {

			const visibleTablesMap = previousTable.visibleTablesByKey[keyNames.join(',')] || {}
			let visibleTable
			if (tableName) {
				visibleTable = visibleTablesMap[tableName]
				if (!visibleTable) throw new LogError("tableName has no key ", keyNames)
			}
			else {
				const visibleTables = Object.values(visibleTablesMap)
				if (visibleTables.length !== 1) throw new LogError("keyName is ambiguous: ", keyNames)
				visibleTable = visibleTables[0]
			}

			const { remote, foreignKey: { referredTable, referredColumns, pointingTable, pointingColumns, pointingUnique } } = visibleTable

			const [previousKeys, joinTable, joinKeys] = remote
				? [referredColumns, pointingTable, pointingColumns]
				: [pointingColumns, referredTable, referredColumns]
			const joinTableName = joinTable.tableName
			const joinDisplayName = index === lastIndex ? targetDisplayName : joinTableName

			const joinCondition = constructJoinKey(previousDisplayName, previousKeys, joinDisplayName, joinKeys)
			joinConditions.push([joinCondition, joinDisplayName, joinTableName])

			previousTableName = joinTableName
			previousTable = joinTable
			previousDisplayName = joinDisplayName
		}

		if (previousTableName !== this.destinationTableName)
			throw new LogError("you've given an incorrect destinationTableName: ", previousTableName, this.destinationTableName)

		return joinConditions
	}
}



// this is for lining up arbitrary columns, no restrictions at all (except for column type)
// ~local_col=some_col~same_table_col=qualified.other_col~destination_table_name
// export class ColumnKeyChain implements TableAccessor {
// 	constructor() {
// 	}

// 	makeJoinConditions(previousDisplayName: string, previousTableName: string, entityIsMany: boolean) {
// 	}
// }


export class QueryColumn {
	constructor(readonly columnName: string, readonly displayName: string) {}

	renderSql(targetTableName: string) {
		return `'${this.displayName}', ${targetTableName}.${this.columnName}`
	}
}

export class QueryRawColumn {
	constructor(readonly statement: RawSqlStatement, readonly displayName: string) {}

	renderSql(argsMap: { [argName: string]: Arg }) {
		return `'${this.displayName}', ${this.statement.renderSql(argsMap)}`
	}
}
