// the client needs an api file that has named functions with the same name as the action,
// that just calls out to the api with the hash in question

// the trickier parts of this are how to accept baseUrl and http functions

import { promises as fs } from 'fs'
import { ClientConfig } from 'pg'
import { inspect as utilInspect } from 'util'
import { Option, Some, None } from "@usefultools/monads"

import { LogError } from './utils'
import { Action } from './ast/common'
import { parseSource } from './parser'
import { getTsType, getClient, Table, InspectionTable } from './inspect'
import { PgType } from './pgTypes'

const chalk = require('chalk')
const pascalCase = require('pascal-case')


export async function readAndParse(apiFilename: string) {
	const source = await fs.readFile(apiFilename, 'utf8')
	return parseSource(source)
}


// TODO consider adding decoding step
// https://github.com/joanllenas/ts.data.json
export const NAMED_EXPORT_FUNCTION_TEMPLATE = `async function {displayName}({args}) {
	return axios.{httpVerb}(baseUrl + '/{displayName}', {argsUsage}) as {returnType}
}`

// this could instead be derived from the other,
// just remove "export" and "function" and add a tab to each line
export const API_OBJECT_FUNCTION_TEMPLATE = `
	async {displayName}({args}) {
		return axios.{httpVerb}(b as {returnType}aseUrl + '/{displayName}', {argsUsage})
	},`


export const TYPE_TEMPLATE = `export type {typeName} = {
	{fieldDefinitions}
}`

const process = require('process')

export async function generateRustRouter(config: ClientConfig, actions: Action[]) {
	const client = await getClient(config)

	const validations = actions
		.map(action => {
			const [queryName, sql] = action.renderSql()
			return client.query(sql)
				.then(_ => None)
				.catch(e => Some([queryName, sql, e]))
		})

	const errors = (await Promise.all(validations))
		.filter(r => r.is_some())
		.map(r => {
			const [queryName, sql, { message }] = r.unwrap()
			return { message, queryName, sql }
		})

	await client.end()

	if (errors.length > 0) {
		process.exitCode = 1

		const e = chalk.bold.red
		const g = chalk.gray
		const v = chalk.bold.green
		const s = chalk.bold.cyan

		console.error(
			e("Some of the sql generated from your tql actions isn't correct according to postgres.\n")
			+ e("Here are the ones that failed:\n\n")
			+ errors
				.map(({ message, queryName, sql }) => g(
					`  message: ${v(message)}\n  queryName: ${v(queryName)}\n  sql:\n\t${s(sql)}`
				))
				.join('\n\n')
		)
	}

	// otherwise we'll get on to the business of generating rust!
}

export function generateClientApi(useApiObject: boolean, tables: Table[], actions: Action[]) {
	const typeStrings = [
		'type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>',
		'type Rename<T, K extends keyof T, N extends string> = { [P in N]: T[K] }',
	]
	const functionStrings: string[] = []

	for (const table of tables) {
		const typeName = pascalCase(table.tableName)

		// TODO want to filter this to only the *accessible* fields (as determined by the intended role's aclitems)
		// and maybe not include serial primary keys
		const fieldDefinitions = table.columns.map(col => {
			const undefinedSuffix = col.hasDefaultValue ? '?' : ''
			const nullableSuffix = col.nullable ? ' | null' : ''
			const typeString = PgType.getTsType(col.columnType)
			return `${col.columnName}${undefinedSuffix}: ${typeString}${nullableSuffix};`
		}).join('\n\t')

		const typeString = `type ${typeName} = {\n\t${fieldDefinitions}\n}`

		typeStrings.push(typeString)
		typeStrings.push(`type Patch${typeName} = Partial<${typeName}>`)
	}

	for (const action of actions) {
		const [displayName, httpVerb, args, argsUsage, neededTypes, returnTypeName] = action.renderTs()

		Array.prototype.push.apply(typeStrings, neededTypes)

		const template = useApiObject ? API_OBJECT_FUNCTION_TEMPLATE : NAMED_EXPORT_FUNCTION_TEMPLATE
		const renderedFunction = template
			.replace(/\{displayName\}/g, displayName)
			.replace(/\{args\}/g, args)
			.replace(/\{httpVerb\}/g, httpVerb.toLowerCase())
			.replace(/\{argsUsage\}/g, argsUsage)
			.replace(/\{returnType\}/g, returnTypeName)

		functionStrings.push(renderedFunction)
	}

	const finalStrings = useApiObject
		? typeStrings.concat([`default {${functionStrings.join('\n\n')}\n}`])
		: typeStrings.concat(functionStrings)

	return finalStrings.map(s => 'export ' + s).join('\n\n')
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
