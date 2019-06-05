// the client needs an api file that has named functions with the same name as the action,
// that just calls out to the api with the hash in question

// the trickier parts of this are how to accept baseUrl and http functions

import { promises as fs } from 'fs'

import { LogError } from './utils'
import { Action } from './ast/common'
import { parseSource } from './parser'
import { getTsType, Table, InspectionTable } from './inspect'

const pascalCase = require('pascal-case')

// what do we actually want?
// a function to generate typescript api
// a function to generate rust router
// a wrapper function to grab an api file and read/parse it

export async function readAndParse(apiFilename: string) {
	const source = await fs.readFile(apiFilename, 'utf8')
	return parseSource(source)
}


export function generateClientApi(tables: Table[], actions: Action[]) {
	const typeStrings = [
		'type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>',
		'type Rename<T, K extends keyof T, N extends string> = { [P in N]: T[K] }',
	]
	const functionStrings: string[] = []

	for (const table of tables) {
		// create a type for each table, containing all the *accessible* fields (as determined by the intended role's aclitems)
		// // generate full version for each
		// const typeName = pascalCase(table.name)

		// const fieldDefinitions = table.columns.map(c => {
		// 	// if it has a default value, undefined is okay
		// 	// if it's nullable, null is okay
		// 	const undefinedSuffix = c.has_default_value ? '?' : ''
		// 	const nullableSuffix = !c.nullable ? ' | null' : ''
		// 	const typeString = getTsType(c.type)
		// 	return `${c.name}: ${typeString}${undefinedSuffix}${nullableSuffix};`
		// }).join('\n\t')

		// a type should be unioned with null if it is nullable,
		// and unioned with undefined if it has a default value,
		// and not included at all if the an acl says the role can't select/insert/update it

		// const typeString = TYPE_TEMPLATE
		// 	.replace('{typeName}', typeName)
		// 	.replace('{fieldDefinitions}', fieldDefinitions)

		// typeStrings.push(typeString)
		// typeStrings.push(`type Patch${typeName} = Partial<${typeName}>`)
	}

	for (const action of actions) {
		const [displayName, httpVerb, args, argsUsage, neededTypes] = action.renderTs()

		// each action results in a single function that takes the arguments required
		// and *possibly* a series of payload types

		Array.prototype.push.apply(typeStrings, neededTypes)

		// each of these will need a type that's the base,
		// with any disallowed columns omitted,
		// and then extend that base with what relationships are allowed
		// this is only the case for inserts/upserts/replace

		// const bodyTypeName = pascalCase(displayNameBody)
		// this would act as a prefix to all association ones

		// const bodyPrepend = needsBody ? `data: ${bodyTypeName}, ` : ''


		// const args = bodyPrepend + action.argsTuple.map(arg => {
		// 	const tsType = postgresToTsTypeMap[arg.argType]
		// 	const defaultValue = arg.defaultValue
		// 	const defaultAppend = defaultValue !== undefined ? ` = ${renderPrimitive(defaultValue)}` : ''
		// 	return `${arg.argName}: ${tsType}${defaultAppend}`
		// }).join(', ')

		// const innerArgsUsage = action.argsTuple.map(arg => `${arg.argName}: ${arg.argName},`).join(',\n\t\t')
		// const bodyUsagePrepend = needsBody ? 'data, ' : ''
		// const argsUsage = bodyUsagePrepend + `{ params: { ${innerArgsUsage} } }`

		// const renderedFunction = FUNCTION_TEMPLATE
		// 	.replace('{displayName}', displayName)
		// 	.replace('{args}', args)
		// 	.replace('{httpVerb}', httpVerb)
		// 	.replace('{hash}', hash)
		// 	.replace('{argsUsage}', argsUsage)

		// functionStrings.push(renderedFunction)
	}

	return typeStrings.concat(functionStrings).join('\n\n')
}


// export default async function generate(apiFilename: string, serverFilename = './api.rs', clientFilename = './api.ts') {
// 	const [inspectionResults, actions] = await Promise.all([inspectDatabase(), grabAndParse(apiFilename)])

// 	// const hashToAction: ActionMap = {}
// 	const hashToAction: StringMap = {}
// 	const hashToSql: StringMap = {}

// 	// for each action:
// 	for (const action of actions) {
// 		const renderedSql = action.renderSql(inspectionResults)

// 		hashToAction[hash] = action
// 		hashToSql[hash] = renderedSql
// 	}

// 	// write the server json (or rust!) to a file (should take a default parameter)
// 	// write the client ts code to a file
// 	const clientWrite = fs.writeFile(clientFilename, generateClientApi(inspectionResults, hashToAction), 'utf8')
// 	const serverWrite = fs.writeFile(serverFilename, JSON.stringify(hashToSql, null, '\t'), 'utf8')

// 	return Promise.all([serverWrite, clientWrite])
// }
