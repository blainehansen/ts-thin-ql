// // then it can simply create a collection that maps from hash_id to prepared statements,
// // and do whatever (either looking in a hashmap or using a codegen match statement on a codegen enum) to look that up in each request
// // the original json is unnecessary once the prepared statements are done (maybe in the future we'll use it for truly dynamic queries)

// // the client needs an api file that has named functions with the same name as the action,
// // that just calls out to the api with the hash in question


// // the trickier parts of this are how to accept baseUrl and http functions

// // blaine, you need to refactor the toplevel renders to use some inspection context
// // it will be easier to test that way, and more flexible

// import { LogError, Int } from './utils'

// import { promises as fs } from 'fs'
// import { createHash as cryptoCreateHash } from 'crypto'
// import base64 from 'base64url'

// import { getTsType, InspectionTable } from './inspect'

// const pascalCase = require('pascal-case')

// // TODO need to create some Action interface
// // import { Action } from './astQuery'

// type StringMap = { [key: string]: string }
// // type ActionMap = { [key: string]: Action }

// export default async function generate(apiFilename: string, serverFilename = './api.json', clientFilename = './api.ts') {
// 	// const [inspectionResults, actions] = await Promise.all([inspectDatabase(), grabAndParse(apiFilename)])
// 	const inspectionResults: InspectionTable[] = [{
// 		name: 'person', constraints: [], table_oid: 1 as Int, columns: [{
// 			name: 'name', type_name: 'text', nullable: false, has_default_value: false, type_type: '', type_length: 1 as Int, column_number: 1 as Int,
// 		}, {
// 			name: 'cost', type_name: 'int4', nullable: false, has_default_value: true, type_type: '', type_length: 1 as Int, column_number: 1 as Int,
// 		}, {
// 			name: 'other', type_name: 'int4', nullable: true, has_default_value: false, type_type: '', type_length: 1 as Int, column_number: 1 as Int,
// 		}, {
// 			name: 'thing', type_name: 'int4', nullable: true, has_default_value: true, type_type: '', type_length: 1 as Int, column_number: 1 as Int,
// 		}]
// 	}]
// 	const actions = ["stuff", "other", "things"]

// 	// have a running map of action name -> hash (for client)
// 	// have a running map of hash -> sql string (for server)
// 	// const hashToAction: ActionMap = {}
// 	const hashToAction: StringMap = {}
// 	const hashToSql: StringMap = {}

// 	// for each action:
// 	for (const action of actions) {
// 		// TODO
// 		// TODO boil?
// 		// const renderedSql = action.render(inspectionResults)
// 		const renderedSql = action

// 		const hash = base64.encode(cryptoCreateHash('sha256').update(renderedSql, 'utf8').digest())

// 		hashToAction[hash] = action
// 		hashToSql[hash] = renderedSql
// 	}

// 	// write the server json (or rust!) to a file (should take a default parameter)
// 	// write the client ts code to a file
// 	const clientWrite = fs.writeFile(clientFilename, generateClientApi(inspectionResults, hashToAction), 'utf8')
// 	const serverWrite = fs.writeFile(serverFilename, JSON.stringify(hashToSql, null, '\t'), 'utf8')

// 	return Promise.all([serverWrite, clientWrite])
// }


// const FUNCTION_TEMPLATE = `export async function {displayName}({args}) {
// 	return axios.{httpVerb}(baseUrl + '{hash}', {argsUsage})
// }`

// const TYPE_TEMPLATE = `export type {typeName} = {
// 	{fieldDefinitions}
// }`


// // this needs the inspectionResults
// // function generateClientApi(hashToAction: ActionMap) {
// function generateClientApi(hashToAction: StringMap) {
// 	const typeStrings: string[] = ['type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>']
// 	const functionStrings: string[] = []

// 	for (const table of tables) {
// 		// generate full version for each
// 		const typeName = pascalCase(table.name)

// 		const fieldDefinitions = table.columns.map(c => {
// 			// if it has a default value, undefined is okay
// 			// if it's nullable, null is okay
// 			const undefinedSuffix = c.has_default_value ? '?' : ''
// 			const nullableSuffix = !c.nullable ? ' | null' : ''
// 			const typeString = getTsType(c.type)
// 			return `${c.name}: ${typeString}${undefinedSuffix}${nullableSuffix};`
// 		}).join('\n\t')

// 		const typeString = TYPE_TEMPLATE
// 			.replace('{typeName}', typeName)
// 			.replace('{fieldDefinitions}', fieldDefinitions)

// 		typeStrings.push(typeString)
// 		typeStrings.push(`type Patch${typeName} = Partial<${typeName}>`)
// 	}

// 	for (const [hash, action] of Object.entries(hashToAction)) {
// 		// TODO
// 		// const displayName = action.displayName
// 		const displayName = action

// 		// each action results in a single function that takes the arguments required
// 		// and *possibly* a series of payload classes

// 		let httpVerb = 'post'
// 		let needsBody = true
// 		// // insert, put, patch, upsert, and replace, all have bodies and need typed payloads
// 		// // query, queryfunc, and update, all don't have bodies, so only query parameters
// 		// // func *could* be slightly more complex, if we allow things like setof
// 		// let httpVerb
// 		// let needsBody
// 		// if (action instanceof Query || action instanceof QueryFunc) {
// 		// 	httpVerb = 'get'
// 		// 	needsBody = false
// 		// }
// 		// else if (action instanceof Func) {
// 		// 	httpVerb = 'post'
// 		// 	// TODO this could be more complicated if we allow funcs accepting `setof`
// 		// 	needsBody = false
// 		// }
// 		// else if (action instanceof Insert || action instanceof Upsert) {
// 		// 	httpVerb = 'post'
// 		// 	needsBody = true
// 		// }
// 		// else if (action instanceof Put) {
// 		// 	httpVerb = 'put'
// 		// 	needsBody = true
// 		// }
// 		// else if (action instanceof Patch) {
// 		// 	httpVerb = 'patch'
// 		// 	needsBody = true
// 		// }
// 		// else if (action instanceof Delete) {
// 		// 	httpVerb = 'delete'
// 		// 	needsBody = false
// 		// }


// 		// each of these will need a type that's the base,
// 		// with any disallowed columns omitted,
// 		// and then extend that base with what relationships are allowed
// 		// this is only the case for inserts/upserts/replace

// 		const bodyTypeName = pascalCase(displayNameBody)
// 		// this would act as a prefix to all association ones


// 		const bodyPrepend = needsBody ? `data: ${bodyTypeName}, ` : ''

// 		// TODO you'll have to sort defaulted things to the end (maybe the parser should do that instead?)
// 		const args = 'arg: string, def: boolean = true'

// 		// const [argNames, tsTypes, defaultValues] =

// 		// const args = bodyPrepend + action.argsTuple.map(arg => {
// 		// 	const tsType = postgresToTsTypeMap[arg.argType]
// 		// 	const defaultValue = arg.defaultValue
// 		// 	const defaultAppend = defaultValue !== undefined ? ` = ${renderPrimitive(defaultValue)}` : ''
// 		// 	return `${arg.argName}: ${tsType}${defaultAppend}`
// 		// }).join(', ')

// 		const innerArgsUsage = 'arg: arg, def: def'
// 		// const innerArgsUsage = action.argsTuple.map(arg => `${arg.argName}: ${arg.argName},`).join(',\n\t\t')
// 		const bodyUsagePrepend = needsBody ? 'data, ' : ''
// 		const argsUsage = bodyUsagePrepend + `{ params: { ${innerArgsUsage} } }`

// 		const renderedFunction = FUNCTION_TEMPLATE
// 			.replace('{displayName}', displayName)
// 			.replace('{args}', args)
// 			.replace('{httpVerb}', httpVerb)
// 			.replace('{hash}', hash)
// 			.replace('{argsUsage}', argsUsage)

// 		functionStrings.push(renderedFunction)
// 	}

// 	return typeStrings.concat(functionStrings).join('\n\n')
// }

// // async function inspectDatabase() {
// // 	//
// // }

// // async function grabAndParse(apiFilename) {
// // 	const apiSource = await fs.readFile(apiFilename, 'utf8')
// // 	return parser.parseSource(apiSource)
// // }



// // generate('./src/utils.ts')
