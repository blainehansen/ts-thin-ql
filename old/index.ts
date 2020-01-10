// the client needs an api file that has named functions with the same name as the action,
// that just calls out to the api with the hash in question

// the trickier parts of this are how to accept baseUrl and http functions

import { promises as fs } from 'fs'
import { ClientConfig } from 'pg'
import { inspect as utilInspect } from 'util'
import { Option, Some, None } from "@usefultools/monads"

import { LogError } from './utils'
import { Action, HttpVerb, Arg } from './ast/common'
import { parseSource } from './parser'
import { getTsType, getRustTypes, getClient, Table, InspectionTable, inspect, declareInspectionResults } from './inspect'
import { testingClientConfig } from '../tests/utils'
import { PgType } from './pgTypes'

const process = require('process')
const chalk = require('chalk')
const pascalCase = require('pascal-case')
const snakeCase = require('snake-case')



// TODO consider adding decoding step
// https://github.com/joanllenas/ts.data.json
const NAMED_EXPORT_FUNCTION_TEMPLATE = `async function {displayName}({args}) {
	return axios.{httpVerb}(baseUrl + '/{displayName}'{argsUsage}) as {returnType}
}`

// this could instead be derived from the other,
// just remove "export" and "function" and add a tab to each line
const API_OBJECT_FUNCTION_TEMPLATE = `
	async {displayName}({args}) {
		return axios.{httpVerb}(baseUrl + '/{displayName}'{argsUsage}) as Promise<AxiosResponse<{returnType}>>
	},`


const TYPE_TEMPLATE = `export type {typeName} = {
	{fieldDefinitions}
}`

const RUST_ROUTER_TEMPLATE = `make_api!(

	no_args: [
		{no_args_items}
	],

	args: [
		{args_items}
	],

);
`


export async function readAndParse(apiFilename: string) {
	const source = await fs.readFile(apiFilename, 'utf8')
	return parseSource(source)
}


export default async function generate(apiFilename: string, serverFilename = './api.rs', clientFilename = './api.ts') {
	const [tables, actions] = await Promise.all([
		(async () => declareInspectionResults(await inspect(testingClientConfig)))(),
		readAndParse(apiFilename),
	])

	const clientWrite = fs.writeFile(clientFilename, generateClientApi(true, tables, actions), 'utf8')
	const serverWrite = async () => fs.writeFile(serverFilename, await generateRustRouter(testingClientConfig, actions), 'utf8')

	return Promise.all([serverWrite(), clientWrite])
}


async function generateRustRouter(config: ClientConfig, actions: Action[]) {
	const client = await getClient(config)

	let no_args_index = 0
	let args_index = 0

	const rendered = actions
		.map(action => {
			const [name, verb, args, prepare, sql] = action.renderSql()

			if (args.length === 0)
				return [no_args_index++, name, verb, args, prepare, sql] as [number, string, HttpVerb, Arg[], string, string]
			else
				return [args_index++, name, verb, args, prepare, sql] as [number, string, HttpVerb, Arg[], string, string]
		})


	const validations = rendered
		.map(
			([_index, name, _verb, _args, prepare, _sql]) => client.query(prepare)
				.then(_ => None)
				.catch(e => Some([name, prepare, e]))
		)

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
	// const connectionParams: string[] = []
	// const routeParams: string[] = []

	const no_args_items: string[] = []
	const args_items: string[] = []

	for (const [initalIndex, name, httpVerb, args, _prepare, sql] of rendered) {
		const typeName = pascalCase(name)
		const funcName = snakeCase(name)
		const httpVerbText = httpVerb.toLowerCase()

		// Posts, posts, "/posts", get, 0, r##"select array_agg(title) :: text from post"##;
		// Post, post, "/post/{post_id}/{msg}", get, 1, r##"select json_build_object('title', post.title, 'msg', $2) :: text from post where id = $1"##, [post_id, i32, INT4; msg, String, TEXT];

		const haveArgs = args.length !== 0

		const [index, argsRouteText, argsText] = haveArgs
			? [
				no_args_index + initalIndex,
				`/${args.map(arg => `{${arg.argName}}`).join('/')}`,
				`, [${args.map(arg => [arg.argName, ...getRustTypes(arg.argType, arg.nullable)].join(', ')).join('; ')}]`,
			]
			: [initalIndex, '', '']

		const item = `${typeName}, ${funcName}, "/${funcName}${argsRouteText}", ${httpVerbText}, ${index}, r##"${sql}"##${argsText}`

		if (haveArgs) args_items.push(item)
		else no_args_items.push(item)
	}


	return RUST_ROUTER_TEMPLATE
		.replace('{args_items}', args_items.join('; '))
		.replace('{no_args_items}', no_args_items.join('; '))
}


function generateClientApi(useApiObject: boolean, tables: Table[], actions: Action[]) {
	const typeStrings = [
		`const baseUrl = 'http://localhost:5050/'`,
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

	return `import axios, { AxiosResponse } from 'axios'\n` + finalStrings.map(s => 'export ' + s).join('\n\n')
}
