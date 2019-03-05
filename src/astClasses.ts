import { LogError, Int } from './utils'
import { Table, Column, ForeignKey, lookupTable, declareForeignKey, checkManyCorrectness } from './inspectionClasses'


type QueryObject = QueryBlock | QueryColumn


// TODO this will get more advanced as time goes on
type CqlAtomicPrimitive = string | number | boolean | null
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

		const queryString = queryBlock.render()

		const argPortion = argsTuple.length > 0 ? `(${argsTuple.map(a => a.argType).join(', ')})` : ''

		return `prepare __cq_query_${queryName} ${argPortion} as\n${queryString}\n;`
	}
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

export class GetDirective {
	constructor(readonly column: Column, readonly arg: DirectiveValue) {
		if (!column.unique) throw new LogError("can't call get with a non-unique column")
	}

	render(targetTableName: string) {
		return `${targetTableName}.${this.column.columnName} = ${renderDirectiveValue(this.arg)}`
	}
}

// these are best served with sql literal
// sql literal has to intelligently remove $args though
// like
// fts, normal, plain, phrase
// create a sql literal function, parse it intelligently with opening and closing things
export enum FilterType {
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

export class FilterDirective {
	constructor(readonly column: Column, readonly arg: DirectiveValue, readonly filterType: FilterType) {}

	render(targetTableName: string) {
		return `${targetTableName}.${this.column.columnName} ${this.filterType} ${renderDirectiveValue(this.arg)}`
	}
}

export enum OrderByNullsPlacement { First = 'first', Last = 'last' }

export class OrderDirective {
	// TODO probably should be columnDisplayName: string
	constructor(readonly column: string, readonly ascending?: boolean, readonly nullsPlacement?: OrderByNullsPlacement) {}

	render() {
		const directionString = this.ascending === undefined ? '' : this.ascending ? ' asc' : ' desc'
		const nullsString = this.nullsPlacement ? '' : ` nulls ${this.nullsPlacement}`
		return `${this.column}${directionString}${nullsString}`
	}
}


export class QueryBlock {
	readonly useLeft: boolean
	constructor(
		readonly displayName: string,
		readonly targetTableName: string,
		readonly accessObject: TableAccessor,
		readonly isMany: boolean,
		readonly entities: QueryObject[],
		readonly whereDirectives: GetDirective | FilterDirective[],
		readonly orderDirectives: OrderDirective[],
		readonly limit?: DirectiveValue,
		readonly offset?: DirectiveValue,
	) {
		this.useLeft = true
		// TODO probably somewhere up the chain (or here) we can check whether the isMany agreeds with reality
		// mostly whether our accessObject points to something unique? or if there's a single GetDirective in our whereDirectives
	}

	// we do this join condition in addition to our filters
	render(parentJoinCondition?: string) {
		const { displayName, targetTableName, isMany, whereDirectives, orderDirectives, entities, limit, offset } = this
		// const table = lookupTable(targetTableName)
		lookupTable(targetTableName)

		const columnSelectStrings: string[] = []
		const embedSelectStrings: string[] = []
		const joinStrings: string[] = []

		for (const entity of entities) {
			if (entity instanceof QueryColumn) {
				columnSelectStrings.push(entity.render(displayName))
				continue
			}

			const { useLeft, displayName: entityDisplayName } = entity
			// the embed query gives the whole aggregation the alias of the displayName
			embedSelectStrings.push(`'${entityDisplayName}', ${entityDisplayName}.${entityDisplayName}`)

			const joinConditions = entity.accessObject.makeJoinConditions(displayName, targetTableName)
			const finalJoin = joinConditions.pop()
			if (!finalJoin) throw new LogError("no final join condition, can't proceed", finalJoin)
			const [finalCond, , ] = finalJoin

			const joinTypeString = useLeft ? 'left' : 'inner'
			const basicJoins = joinConditions.map(([cond, disp, tab]) => `${joinTypeString} join ${tab} as ${disp} on ${cond}`)
			Array.prototype.push.apply(joinStrings, basicJoins)
			// and now to push the final one
			joinStrings.push(`${joinTypeString} join lateral (${entity.render(finalCond)}) as ${entityDisplayName} on true` )
		}

		// this moment is where we decide whether to use json_agg or not
		// the embed queries have already handled themselves,
		// so we're simply asking if this current query will return multiple
		const selectString = `json_build_object(${columnSelectStrings.concat(embedSelectStrings).join(', ')})`
		const finalSelectString = (isMany ? `json_agg(${selectString})` : selectString) + ` as ${displayName}`

		const joinString = joinStrings.join('\n\t')

		const parentJoinStrings = parentJoinCondition ? [`(${parentJoinCondition})`] : []

		const wherePrefix = 'where '
		// TODO what happens when something's embedded but has a GetDirective?
		// we probably shouldn't allow that, since it makes no sense
		const whereString = whereDirectives instanceof GetDirective
			? wherePrefix + whereDirectives.render(displayName)
			: maybeJoinWithPrefix(wherePrefix, ' and ', parentJoinStrings.concat(whereDirectives.map(w => `(${w.render(displayName)})`)))

		const orderString = maybeJoinWithPrefix('order by ', ', ', orderDirectives.map(o => o.render()))

		const limitString = limit ? `limit ${renderDirectiveValue(limit)}` : ''
		const offsetString = offset ? `offset ${renderDirectiveValue(offset)}` : ''

		return `
			select ${finalSelectString}
			from
				${targetTableName} as ${displayName}
				${joinString}
			${whereString}
			${orderString}
			${limitString}
			${offsetString}
		`
	}
}


interface TableAccessor {
	makeJoinConditions(
		previousDisplayName: string, previousTableName: string
	): Array<[string, string, string]>;

	getTargetTableName(): string;
}

abstract class BasicTableAccessor implements TableAccessor {
	constructor(readonly tableNames: string[]) {}

	getTargetTableName() {
		const tableNames = this.tableNames
		return tableNames[tableNames.length - 1]
	}

	makeJoinConditions(previousDisplayName: string, previousTableName: string) {
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
			// checkManyCorrectness(pointingUnique, remote, entityIsMany)

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
	constructor(tableNames: string[]) {
		if (tableNames.length === 0) throw new LogError("can't have empty TableChain: ")
		if (tableNames.length === 1) throw new LogError("can't have TableChain with only one table: ", tableNames)

		super(tableNames)
	}
}



export class KeyReference {
	constructor(readonly keyName: string, readonly tableName?: string) {}
}

// this is going to be a chain of only foreignKey's, not any column
// which means it will just be useful to disambiguate normal joins
// ~~some_key~~some_other~~table_name.key~~key~~destination_table_name
export class ForeignKeyChain implements TableAccessor {
	constructor(readonly keyReferences: KeyReference[], readonly destinationTableName: string) {
		lookupTable(destinationTableName)
	}

	getTargetTableName() {
		return this.destinationTableName
	}

	makeJoinConditions(previousDisplayName: string, previousTableName: string) {
		const joinConditions: Array<[string, string, string]> = []

		let previousTable = lookupTable(previousTableName)

		for (const { keyName, tableName } of this.keyReferences) {
			const visibleTablesMap = previousTable.visibleTablesByKey[keyName] || {}
			let visibleTable
			if (tableName) {
				visibleTable = visibleTablesMap[tableName]
				if (!visibleTable) throw new LogError("tableName has no key ", keyName)
			}
			else {
				const visibleTables = Object.values(visibleTablesMap)
				if (visibleTables.length !== 1) throw new LogError("keyName is ambiguous: ", keyName)
				visibleTable = visibleTables[0]
			}

			const { remote, foreignKey: { referredTable, referredColumn, pointingTable, pointingColumn, pointingUnique } } = visibleTable

			// if this says remote, then we're being pointed at
			const [previousKey, joinTable, joinKey] = remote
				? [referredColumn, pointingTable, pointingColumn]
				: [pointingColumn, referredTable, referredColumn]
			const joinTableName = joinTable.tableName
			const joinDisplayName = joinTableName

			const joinCondition = `${previousDisplayName}.${previousKey} = ${joinDisplayName}.${joinKey}`
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

	render(targetTableName: string) {
		return `'${this.displayName}', ${targetTableName}.${this.columnName}`
	}
}
