// https://webpack.js.org/api/loaders#pitching-loader
// https://github.com/webpack/webpack/issues/9053
// https://github.com/webpack/webpack/pull/7462/files

// https://www.npmjs.com/package/typescript-compiler

import webpack from 'webpack'
import { encode } from 'querystring'
import { getOptions, getRemainingRequest, stringifyRequest } from 'loader-utils'

const actual = require.resolve('./actual')

// this will just return a fake import to get the thing to use
export function pitch(this: webpack.loader.LoaderContext, source: string) {
	const options = getOptions(this)
	const remaining = getRemainingRequest(this)
	const encodedOptions = encode({ useApiObject: options.useApiObject, ...options.dbConfig })
	const newRequest = stringifyRequest(this, `${this.resource}.ts!=!${actual}?${encodedOptions}!${remaining}`)

	console.log('in index')
	console.log(newRequest)
	console.log()
	return `module.exports = require(${newRequest})`
}
