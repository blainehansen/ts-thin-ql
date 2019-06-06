import 'mocha'
import { expect } from 'chai'

import { resolve as pathResolve } from 'path'
import webpack from 'webpack'
import memoryfs from 'memory-fs'

async function compiler(fixture: string): Promise<webpack.Stats> {
	const wp = webpack({
		context: __dirname,
		entry: `./${fixture}`,
		output: {
			path: pathResolve(__dirname),
			filename: 'bundle.js',
		},
		module: {
			rules: [
				{
					test: /\.tql$/,
					use: [{
						loader: pathResolve(__dirname, '../src/loader.ts'),
						options: {
							name: 'Alice'
						},
					}]
				}
			]
		}
	})

	wp.outputFileSystem = new memoryfs()

	return new Promise((resolve, reject) => {
		wp.run((err: Error, stats: webpack.Stats) => {
			if (err) reject(err)
			if (stats.hasErrors()) reject(new Error(stats.toJson().errors.join('\n')))

			resolve(stats)
		})
	})
}


describe('webpack loader', () => {
	it('does stuff', async () => {
	  const stats = await compiler('loader.spec.tql')
	  const m = stats.toJson().modules
	  if (m === undefined) throw new Error()
	  const output = m[0].source

	  expect(output).eql('export default "Hey Alice!\\n"')
	})
})
