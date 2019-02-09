class Table {
	// if a foreign key points at me, that side is a many, unless it has a singular unique constraint
	// if I point at something, I'm a many
	// you have to detect many-to-many by seeing a table that has multiple fromMe
	// for now, we'll just make them trace the path or do embedding
	constructor(tableName, primaryKey, ...fields) {
		this.tableName = tableName
		this.primaryKey = primaryKey
		// { tableName: [foreignKeys] }
		this.visibleTables = {}
		this.fields = fields
	}
}

class Field {
	constructor(fieldName, fieldType) {
		this.fieldName = fieldName
		this.fieldType = fieldType
	}
}

function lookupTable(tableName) {
	const table = tableLookupMap[tableName]
	if (!table) throw new Error("non-existent table: ", tableName)
	return table
}


class ForeignKey {
	constructor(referredColumn, pointingColumn, pointingUnique) {
		this.referredColumn = referredColumn
		this.pointingColumn = pointingColumn
		this.pointingUnique = pointingUnique
	}
}

const fkLookupMap = {}

function declareForeignKey(referredTableName, referredColumn, pointingTableName, pointingColumn, pointingUnique) {
	const foreignKey = new ForeignKey(referredColumn, pointingColumn, pointingUnique)

	const referredTable = tableLookupMap[referredTableName]
	const pointingTable = tableLookupMap[pointingTableName]

	// each has a visible reference to the other
	referredTable.visibleTables[pointingTableName] = { remote: true, foreignKey }
	pointingTable.visibleTables[referredTableName] = { remote: false, foreignKey }

	const existingTables = fkLookupMap[pointingColumn] || new Set()
	existingTables.add(foreignKey)

	// if someone's pointing to us with a unique foreign key, then both sides are a single object
}

// ##### ^ inspection classes
// ##### query classes



class CqlQuery {
	constructor(queryName, queryBlock, argsTuple) {
		this.queryName = queryName
		this.queryBlock = queryBlock
	}

	render() {
		const { queryName, queryBlock } = this

		// TODO there will be logic here to check if many is required/allowed for the top query

		const queryString = queryBlock.render()

		return `prepare __cq_query_${queryName} as\n${queryString}\n;`
		// return `PREPARE __cq_query_${queryName} (${argsTypes}) AS select ${topFields} from ${topSelectable} ${queryBodyString};`
	}
}


function jsonAgg(displayName, isMany, needGroup) {
	const aliasString = `as ${displayName}`

	// coalesce(nullif(json_agg("projects_projects")::text, '[null]'), '[]')::json
	if (isMany && !needGroup) throw new Error("have an isMany and needGroup is false!", displayName)

	if (!isMany && !needGroup) return `row_to_json(${displayName}) ${aliasString}`

	const addendumString = !isMany && needGroup ? '->1' : ''

	return `json_agg(row_to_json(${displayName}))${addendumString} ${aliasString}`
}

function esc(value) {
	return `\`${value}\``
}

function checkManyCorrectness(pointingUnique, remote, entityIsMany) {
	// basically, something can (must) be a single if the parent is pointing,
	// or if the key is unique (which means it doesn't matter which way)
	const keyIsSingular = pointingUnique || !remote
	if (entityIsMany && keyIsSingular) throw new Error("incorrectly wanting many")
	// they want only one
	if (!entityIsMany && !keyIsSingular) throw new Error("incorrectly wanting only one")
}


class QueryBlock {
	// constructor(displayName, targetTableName, accessObject, isMany, filters, entities) {
	constructor(displayName, targetTableName, accessObject, isMany, entities) {
		this.displayName = displayName
		this.targetTableName = targetTableName
		this.accessObject = accessObject
		this.isMany = isMany
		// this.filters = filters
		this.filters = []
		this.useLeft = true
		// [QueryField | QueryBlock]
		this.entities = entities
	}

	// we do this join condition in addition to our filters
	render(parentJoinCondition = undefined) {
		const { displayName, targetTableName, filters, entities } = this
		const table = lookupTable(targetTableName)

		let needGroup = false

		const fieldSelectStrings = []
		const embedSelectStrings = []
		const joinStrings = []

		for (const entity of entities) {
			if (entity instanceof QueryField) {
				fieldSelectStrings.push(`${displayName}.${entity.render()}`)
				continue
			}
			if (!(entity instanceof QueryBlock)) throw new Error("only QueryField and QueryBlock allowed: ", entity)

			const { useLeft, displayName: entityDisplayName, isMany: entityIsMany } = entity
			if (entityIsMany) needGroup = true
			embedSelectStrings.push([entityDisplayName, entityIsMany])

			const joinConditions = entity.accessObject.makeJoinConditions(displayName, targetTableName, entityIsMany)
			const [finalCond, , ] = joinConditions.pop()

			const joinTypeString = useLeft ? 'left' : 'inner'
			const basicJoins = joinConditions.map(([cond, disp, tab]) => `${joinTypeString} join ${tab} as ${disp} on ${cond}`)
			Array.prototype.push.apply(joinStrings, basicJoins)
			// and now to push the final one
			joinStrings.push(`${joinTypeString} join lateral (${entity.render(finalCond)}) as ${entityDisplayName} on true` )
		}

		const selectString = fieldSelectStrings
			.concat(embedSelectStrings.map(
				// if we don't need to group, we don't need to agg
				([disp, isMany]) => jsonAgg(disp, isMany, needGroup)
			))
			.join(', ')

		const joinString = joinStrings.join('\n\t')

		// const filterStrings = filters.map(f => f.render())
		const filterStrings = filters
		const finalFilterStrings = parentJoinCondition
			? [parentJoinCondition].concat(filterStrings)
			: filterStrings
		const filterString = finalFilterStrings.length > 0
			? "where " + finalFilterStrings.map(s => `(${s})`).join(' and ')
			: ''

		const groupString = needGroup
			? `group by ${displayName}.${table.primaryKey}`
			: ''

		return `
			select ${selectString}
			from
				${targetTableName} as ${displayName}
				${joinString}
			${filterString}
			${groupString}
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

class SimpleTable {
	constructor(tableName) {
		this.tableNames = [tableName]
	}

	makeJoinConditions(previousDisplayName, previousTableName, entityIsMany) {
		const joinConditions = []

		let previousTable = lookupTable(previousTableName)
		for (const joinTableName of this.tableNames) {
			const joinTable = lookupTable(joinTableName)
			const joinDisplayName = joinTableName

			// here we do all the keying logic
			const visibleTable = previousTable.visibleTables[joinTableName]
			if (!visibleTable) throw new Error("can't get to table: ", previousTableName, joinTableName)
			// if (visibleTable.length !== 1) throw new Error("ambiguous: ", tableName, entityTableName)

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

class TableChain extends SimpleTable {
	constructor(...tableNames) {
		const tableNamesLength = tableNames.length
		if (tableNamesLength === 0) throw new Error("can't have empty table chain")
		if (tableNamesLength === 1) throw new Error("can't have table chain with only one element: ", tableNames)

		this.tableNames = tableNames
	}
}

class ForeignKeyChain {
	constructor(...maybeQualifiedForeignKeys) {
		// the last one should be a table name
		this.maybeQualifiedForeignKeys = maybeQualifiedForeignKeys
	}

	makeJoinConditions(previousDisplayName, previousTableName, entityIsMany) {
		const joinConditions = []

		let previousTable = lookupTable(previousTableName)

		for (const fkName of this.maybeQualifiedForeignKeys) {
			if (fkName.tableName) {
				const fkTableName = fkName.tableName

				const visibleTable = previousTable.visibleTables[fkTableName]
				if (!visibleTable) throw new Error("can't get to table: ", previousTableName, fkTableName)
			}

			previousTable =
		}

		return joinConditions
	}
}


class QueryField {
	constructor(displayName, fieldName) {
		this.displayName = displayName
		this.fieldName = fieldName
	}

	render() {
		return `${this.fieldName} as ${this.displayName}`
	}
}


// displayName, targetTableName, accessObject, isMany, entities

const tableLookupMap = {
	root: new Table('root', 'id'),
	right: new Table('right', 'id'),
	b: new Table('b', 'id'),
	c: new Table('c', 'id'),
}
declareForeignKey('right', 'id', 'root', 'right_id', false)
declareForeignKey('root', 'id', 'b', 'root_id', false)
declareForeignKey('b', 'id', 'c', 'b_id', false)

const q = new CqlQuery(
	'thing',
	new QueryBlock(
		'root', 'root', new SimpleTable('root'), true,
		[
			new QueryField('root_field', 'root_field'),
			new QueryBlock(
				'right', 'right', new SimpleTable('right'), false,
				[
					new QueryField('right_field', 'right_field')
				]
			),
			new QueryBlock(
				'b', 'b', new SimpleTable('b'), true,
				[
					new QueryField('b_field', 'b_field'),
					new QueryBlock(
						'c', 'c', new SimpleTable('c'), true,
						[
							new QueryField('c_field', 'c_field')
						]
					),
				]
			),
		]
	)
)


// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	b: new Table('b', 'id'),
// }
// declareForeignKey('a', 'id', 'b', 'a_id', false)

// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'b', 'b', new SimpleTable('b'), true,
// 		[
// 			new QueryField('b_field', 'b_field'),
// 			new QueryBlock(
// 				'a', 'a', new SimpleTable('a'), false,
// 				[
// 					new QueryField('a_field', 'a_field')
// 				]
// 			)
// 		]
// 	)
// )



// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	mid: new Table('mid', 'id'),
// 	b: new Table('b', 'id'),
// }
// declareForeignKey('a', 'id', 'mid', 'a_id', false)
// declareForeignKey('b', 'id', 'mid', 'b_id', false)

// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'a', 'a', new SimpleTable('a'), true,
// 		[
// 			new QueryField('a_field', 'a_field'),
// 			new QueryBlock(
// 				'b', 'b', new TableChain('mid', 'b'), true,
// 				[
// 					new QueryField('b_field', 'b_field')
// 				]
// 			)
// 		]
// 	)
// )



// const tableLookupMap = {
// 	a: new Table('a', 'id'),
// 	b: new Table('b', 'id'),
// }
// declareForeignKey('a', 'id', 'b', 'a_id', false)

// const q = new CqlQuery(
// 	'thing',
// 	new QueryBlock(
// 		'a', 'a', new SimpleTable('a'), true,
// 		[
// 			new QueryField('a_field', 'a_field'),
// 			new QueryBlock(
// 				'b', 'b', new SimpleTable('b'), true,
// 				[
// 					new QueryField('b_field', 'b_field')
// 				]
// 			)
// 		]
// 	)
// )


console.log(q.render())
