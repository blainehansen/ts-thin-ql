import { LogError, Int } from './utils'
import { Table, Column, ForeignKey, lookupTable, declareForeignKey, checkManyCorrectness } from './inspectionClasses'


type QueryObject = QueryBlock | QueryColumn


// so the entire query takes a list of args, all variable names with possible defaults (and implied types that will be checked by prepare or can be inferred from inspection)
// then query blocks themselves have a list of filters and directives

type CqlAtomicPrimitive = string | number | boolean | null
// TODO this will get more advanced as time goes on
type CqlPrimitive = CqlAtomicPrimitive | CqlAtomicPrimitive[]


export class Arg {
	constructor(
		readonly index: Int,
		readonly argName: string,
		readonly argType: string,
		readonly defaultValue?: CqlPrimitive
	) {}

	render() {
		return `$${this.index}`
	}
}

export class Query {
	constructor(readonly queryName: string, readonly argsTuple: Arg[], readonly queryBlock: QueryBlock) {}

	render() {
		const { queryName, argsTuple, queryBlock } = this

		// TODO there will be logic here to check if many is required/allowed for the top query

		const queryString = queryBlock.render()

		const argPortion = argsTuple.length > 0 ? `(${argsTuple.map(a => a.argType).join(', ')})` : ''

		// TODO this needs to do one last jsonAgg or row_to_json, using the isMany of the first block
		return `prepare __cq_query_${queryName} ${argPortion} as\n${queryString}\n;`
	}
}


function jsonAgg(displayName: string, isMany: boolean, needGroup: boolean) {
	const aliasString = `as ${displayName}`

	// coalesce(nullif(json_agg("projects_projects")::text, '[null]'), '[]')::json
	if (isMany && !needGroup) throw new LogError("have an isMany and needGroup is false!", displayName)

	if (!isMany && !needGroup) return `row_to_json(${displayName}) ${aliasString}`

	const addendumString = !isMany && needGroup ? '->1' : ''

	return `json_agg(row_to_json(${displayName}))${addendumString} ${aliasString}`
}

function esc(value: string) {
	return `"${value}"`
}

function maybeJoinWithPrefix(prefix: string, joinString: string, strings: string[]) {
	return strings.length > 0 ? prefix + strings.join(joinString) : ''
}


function renderPrimitive(primitive: CqlPrimitive) {
	return '' + primitive
}

type DirectiveValue = CqlPrimitive | Arg

function renderDirectiveValue(directiveValue: DirectiveValue) {
	return directiveValue instanceof Arg
		? directiveValue.render()
		: renderPrimitive(directiveValue)
}

class GetDirective {
	constructor(readonly column: Column, readonly arg: DirectiveValue) {
		if (!column.unique) throw new LogError("can't call get with a non-unique column")
	}

	render() {
		return `${this.column} = ${renderDirectiveValue(this.arg)}`
	}
}

// these are best served with sql literal
// sql literal has to intelligently remove $args though
// like
// fts, normal, plain, phrase
// create a sql literal function, parse it intelligently with opening and closing things
enum FilterType {
	Eq, Lt, Lte, Gt, Gte, Ne, In, Nin, Is, Nis, Bet, Nbet, Symbet, Nsymbet, Dist, Ndist,
}

class FilterDirective {
	static operatorTexts = {
		[FilterType.Eq]: '=',
		[FilterType.Lt]: '<',
		[FilterType.Lte]: '<=',
		[FilterType.Gt]: '>',
		[FilterType.Gte]: '>=',
		[FilterType.Ne]: '!=',
		[FilterType.In]: 'in',
		[FilterType.Nin]: 'not in',
		[FilterType.Is]: 'is',
		[FilterType.Nis]: 'is not',
		[FilterType.Bet]: 'between',
		[FilterType.Nbet]: 'not between',
		[FilterType.Symbet]: 'between symmetric',
		[FilterType.Nsymbet]: 'not between symmetric',
		[FilterType.Dist]: 'is distinct from',
		[FilterType.Ndist]: 'is not distinct from',
	}

	constructor(readonly column: Column, readonly arg: DirectiveValue, readonly filterType: FilterType) {}

	render() {
		const operatorText = FilterDirective.operatorTexts[this.filterType]

		return `${this.column} ${operatorText} ${renderDirectiveValue(this.arg)}`
	}
}

// class FilterObjDirective {
// 	constructor(arg) {
// 		// code...
// 	}
// }

class OrderDirective {
	constructor(readonly column: QueryColumn, readonly ascending: boolean) {}

	render() {
		const directionString = this.ascending ? ' asc' : ' desc'
		return `${this.column.displayName}${directionString}`
	}
}


export class QueryBlock {
	readonly useLeft: boolean
	constructor(
		readonly displayName: string,
		readonly targetTableName: string,
		readonly accessObject: TableAccessor,
		readonly isMany: boolean,
		// readonly whereDirectives: GetDirective | FilterObjDirective | FilterDirective[],
		readonly whereDirectives: GetDirective | FilterDirective[],
		readonly orderDirectives: OrderDirective[],
		readonly entities: QueryObject[],
		readonly limit?: Int,
		readonly offset?: Int,
	) {
		this.useLeft = true
	}

	// we do this join condition in addition to our filters
	render(parentJoinCondition?: string) {
		const { displayName, targetTableName, whereDirectives, orderDirectives, entities, limit, offset } = this
		const table = lookupTable(targetTableName)

		let needGroup = false

		const columnSelectStrings: string[] = []
		const embedSelectStrings: Array<[string, boolean]> = []
		const joinStrings: string[] = []

		for (const entity of entities) {
			if (entity instanceof QueryColumn) {
				columnSelectStrings.push(`${displayName}.${entity.render()}`)
				continue
			}

			const { useLeft, displayName: entityDisplayName, isMany: entityIsMany } = entity
			if (entityIsMany) needGroup = true
			embedSelectStrings.push([entityDisplayName, entityIsMany])

			const joinConditions = entity.accessObject.makeJoinConditions(displayName, targetTableName, entityIsMany)
			const finalJoin = joinConditions.pop()
			if (!finalJoin) throw new LogError("no final join condition, can't proceed", finalJoin)
			const [finalCond, , ] = finalJoin

			const joinTypeString = useLeft ? 'left' : 'inner'
			const basicJoins = joinConditions.map(([cond, disp, tab]) => `${joinTypeString} join ${tab} as ${disp} on ${cond}`)
			Array.prototype.push.apply(joinStrings, basicJoins)
			// and now to push the final one
			joinStrings.push(`${joinTypeString} join lateral (${entity.render(finalCond)}) as ${entityDisplayName} on true` )
		}

		const selectString = columnSelectStrings
			.concat(embedSelectStrings.map(
				// if we don't need to group, we don't need to agg
				([disp, isMany]) => jsonAgg(disp, isMany, needGroup)
			))
			.join(', ')

		const joinString = joinStrings.join('\n\t')

		const parentJoinStrings = parentJoinCondition ? [`(${parentJoinCondition})`] : []

		const wherePrefix = 'where '
		// const whereString = whereDirectives instanceof GetDirective || whereDirectives instanceof FilterObjDirective
		const whereString = whereDirectives instanceof GetDirective
			? wherePrefix + whereDirectives.render()
			: maybeJoinWithPrefix(wherePrefix, ' and ', parentJoinStrings.concat(whereDirectives.map(w => `(${w.render()})`)))

		const groupString = needGroup
			? `group by ${displayName}.${table.primaryKey}`
			: ''

		const orderString = maybeJoinWithPrefix('order by ', ', ', orderDirectives.map(o => o.render()))

		const limitString = limit ? `limit ${limit}` : ''
		const offsetString = offset ? `offset ${offset}` : ''

		return `
			select ${selectString}
			from
				${targetTableName} as ${displayName}
				${joinString}
			${whereString}
			${groupString}
			${orderString}
			${limitString}
			${offsetString}
		`
	}
}

// class ClusterBlock {
// 	constructor() {
// 	}
// }

// class SpreadBlock {
// 	constructor() {
// 	}
// }

interface TableAccessor {
	makeJoinConditions(
		previousDisplayName: string, previousTableName: string, entityIsMany: boolean
	): Array<[string, string, string]>;
}

abstract class BasicTableAccessor implements TableAccessor {
	constructor(readonly tableNames: string[]) {}

	makeJoinConditions(previousDisplayName: string, previousTableName: string, entityIsMany: boolean) {
		const joinConditions: Array<[string, string, string]> = []

		let previousTable = lookupTable(previousTableName)
		for (const joinTableName of this.tableNames) {
			const joinTable = lookupTable(joinTableName)
			const joinDisplayName = joinTableName

			// here we do all the keying logic
			const visibleTable = previousTable.visibleTables[joinTableName]
			if (!visibleTable) throw new LogError("can't get to table: ", previousTableName, joinTableName)
			// if (visibleTable.length !== 1) throw new LogError("ambiguous: ", tableName, entityTableName)

			const { remote, foreignKey: { referredColumn, pointingColumn, pointingUnique } } = visibleTable
			checkManyCorrectness(pointingUnique, remote, entityIsMany)

			// if this says remote, then we're being pointed at
			const [previousKey, joinKey] = remote
				? [referredColumn, pointingColumn]
				: [pointingColumn, referredColumn]

			const joinCondition = `${previousDisplayName}.${previousKey} = ${joinDisplayName}.${joinKey}`
			joinConditions.push([joinCondition, joinDisplayName, joinTableName])

			previousTableName = joinTableName
			previousTable = joinTable
			previousDisplayName = joinDisplayName
		}

		return joinConditions
	}
}

export class SimpleTable extends BasicTableAccessor {
	constructor(tableName: string) {
		super([tableName])
	}
}

export class TableChain extends BasicTableAccessor {
	constructor(...tableNames: string[]) {
		super(tableNames)
		const tableNamesLength = tableNames.length
		if (tableNamesLength === 0) throw new LogError("can't have empty table chain")
		if (tableNamesLength === 1) throw new LogError("can't have table chain with only one element: ", tableNames)
	}
}

// class ForeignKeyChain implements TableAccessor {
// 	constructor(...maybeQualifiedForeignKeys) {
// 		// the last one should be a table name
// 		this.maybeQualifiedForeignKeys = maybeQualifiedForeignKeys
// 	}

// 	makeJoinConditions(previousDisplayName: string, previousTableName: string, entityIsMany: boolean) {
// 		const joinConditions = []

// 		let previousTable = lookupTable(previousTableName)

// 		for (const fkName of this.maybeQualifiedForeignKeys) {
// 			if (fkName.tableName) {
// 				const fkTableName = fkName.tableName

// 				const visibleTable = previousTable.visibleTables[fkTableName]
// 				if (!visibleTable) throw new LogError("can't get to table: ", previousTableName, fkTableName)
// 			}

// 			previousTable =
// 		}

// 		return joinConditions
// 	}
// }


export class QueryColumn {
	constructor(readonly columnName: string, readonly displayName: string) {}

	render() {
		return `${this.columnName} as ${this.displayName}`
	}
}
