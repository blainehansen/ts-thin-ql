// import path from 'path'
import webpack from 'webpack'
import { getOptions } from 'loader-utils'
import { parseSource } from '../parser'
import { generateClientApi } from '../index'
import { inspect, declareInspectionResults } from '../inspect'

export default async function(this: webpack.loader.LoaderContext, source: string) {
	const callback = this.async()

	console.log('in actual')
	console.log(source)
	console.log(this.request)

	// // const headerPath = path.resolve('header.js')
	// // this.addDependency(headerPath)
 //  const { useApiObject, ...dbConfig } = getOptions(this)
 //  const tables = declareInspectionResults(await inspect(dbConfig))
	// const actions = parseSource(source)
	// const tsSource = generateClientApi(useApiObject, tables, actions)

	// if (err) return callback(err)
	if (callback === undefined) throw new Error("no callback?")
	// callback(null, tsSource)
	callback(null, 'module.exports = "aggghghgh"')
}
