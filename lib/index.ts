// import { promises as fs } from 'fs'
// import { ClientConfig } from 'pg'
// import { inspect as utilInspect } from 'util'

// import { LogError } from './utils'
// import { Action, HttpVerb, Arg } from './ast/common'
// import { parseSource } from './parser'
// import { getTsType, getRustTypes, getClient, Table, InspectionTable, inspect, declareInspectionResults } from './inspect'
// import { testingClientConfig } from '../tests/utils'
// import { PgType } from './pgTypes'

// const process = require('process')
// const chalk = require('chalk')
// const pascalCase = require('pascal-case')
// const snakeCase = require('snake-case')



// export async function readAndParse(apiFilename: string) {
// 	const source = await fs.readFile(apiFilename, 'utf8')
// 	return parseSource(source)
// }


// export default async function generate(apiFilename: string, serverFilename = './api.rs', clientFilename = './api.ts') {
// 	const [tables, actions] = await Promise.all([
// 		(async () => declareInspectionResults(await inspect(testingClientConfig)))(),
// 		readAndParse(apiFilename),
// 	])

// 	const clientWrite = fs.writeFile(clientFilename, generateClientApi(true, tables, actions), 'utf8')
// 	const serverWrite = async () => fs.writeFile(serverFilename, await generateRustRouter(testingClientConfig, actions), 'utf8')

// 	return Promise.all([serverWrite(), clientWrite])
// }
