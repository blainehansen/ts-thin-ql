import ts = require('typescript')
import { Delete as _Delete, WhereDirective } from '../ast'


export function Delete(d: _Delete) {
	return ts.createFunctionDeclaration(
		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
		undefined, ts.createIdentifier(d.name),
		// generics
		[ts.createTypeParameterDeclaration(
				ts.createIdentifier('DUDE'),
				ts.createTypeReferenceNode(ts.createIdentifier('thing'), undefined),
				undefined,
			)],
		[
			ts.createParameter(
				undefined, undefined, undefined,
				ts.createIdentifier('a'), undefined,
				ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword), undefined,
			),
		],
		ts.createTypeReferenceNode(ts.createIdentifier('stuff'), undefined),
		ts.createBlock([
			ts.createReturn(
				ts.createAsExpression(
					ts.createIdentifier('b'),
					ts.createTypeReferenceNode(ts.createIdentifier('R'), [
						ts.createTypeReferenceNode(ts.createIdentifier('thing'), undefined),
					]),
				),
			),
		], true),
	)
}

// export function Query(q: _Query) {
// 	// this needs to return all the information needed to render
// 	// - the function itself
// 	// - the return type for the function
// 	// - the types for all the arguments
// 	// so probably a tuple, or displayName, httpVerb, args, argsUsage, and all types

// 	// for a query, the args are pretty simple, since they're just primitives (and at some point enum values)
// 	// the args usage will be an options object, so you could return the object itself and the code actually placing all of this in context would do the work of JSON.stringify'ing it or iterating it

// 	// the code above this will be creating a bunch of base types representing the accessible portions of all the tables,
// 	// and any global types like enums
// 	// we'll just assume the existence of those types based on table names

// 	const { queryName, argsTuple, queryBlock } = this

// 	const args = argsTuple.map(arg => arg.renderTs()).join(', ')
// 	const argsUsage = argsTuple.length > 0
// 		? ', { ' + argsTuple.map(arg => `${arg.argName}: ${arg.argName}`).join(', ') + ' }'
// 		: ''

// 	// a query only has one complex and dependent type, which is the return type
// 	// others will have complex payload types,
// 	// but even other potential complex types (like setof or composite types)
// 	// would be defined in the database, and not by tql
// 	const returnType = queryBlock.renderTs()
// 	const returnTypeName = pascalCase(queryName) + pascalCase(queryBlock.targetTableName)
// 	const namedReturnType = `type ${returnTypeName} = ${returnType}`

// 	// the reason we might choose not to just return a fully rendered string for the function,
// 	// is because the outer context might have more information about where and how those functions should be rendered
// 	// like for example if they should be top level exports or in an api object
// 	// and certainly we need to return the neededTypes separately, since they need to be placed differently in the file
// 	return [queryName, HttpVerb.GET, args, argsUsage, [namedReturnType], returnTypeName]
// }

// function query_block(query_block: QueryBlock, indentLevel: number = 1) {
// 		// assume the existence of a type TableName
// 	const tableTypeName = pascalCase(lookupTable(this.targetTableName).tableName)

// 	const sameCols: string[] = []
// 	const renameCols: string[] = []
// 	const extras: { [displayName: string]: string } = {}
// 	const childIndentLevel = indentLevel + 1

// 	for (const entity of this.entities) {
// 		if (entity instanceof QueryColumn) {
// 			if (entity.columnName === entity.displayName)
// 				sameCols.push(entity.columnName)
// 			else
// 				renameCols.push(`Rename<${tableTypeName}, ${quote(entity.columnName)}, ${quote(entity.displayName)}>`)
// 			continue
// 		}
// 		if (entity instanceof QueryRawColumn) {
// 			// TODO is there a way to not make so many database round trips?
// 			// TODO not bothering with these for now
// 			// extras[entity.displayName] = getTsType(discoverPgExpressionType(entity.statement))
// 			continue
// 		}

// 		extras[entity.displayName] = entity.renderTs(childIndentLevel)
// 	}

// 	const typeStrings = []

// 	if (sameCols.length > 0)
// 		typeStrings.push(`Pick<${tableTypeName}, ${sameCols.map(quote).join(' | ')}>`)

// 	Array.prototype.push.apply(typeStrings, renameCols)

// 	const extraEntries = Object.entries(extras)
// 	if (extraEntries.length > 0)
// 		typeStrings.push(
// 			'{' + extraEntries
// 				.map(([displayName, typeText]) => `\n${tab(childIndentLevel)}${displayName}: ${typeText},`)
// 				.join()
// 				+ '\n' + tab(indentLevel) + '}'
// 		)

// 	const typeText = typeStrings.join('\n' + tab(indentLevel) + '& ')

// 	return this.isMany
// 		? paren(typeText) + '[]'
// 		: typeText
// }
