// import 'mocha'
// import { expect } from 'chai'

// import webpack from 'webpack'
// import memoryfs from 'memory-fs'
// import { resolve as pathResolve } from 'path'

// import { testingClientConfig, setupSchemaFromFiles, destroySchema } from './utils'


// async function compiler(fixture: string): Promise<webpack.Stats> {
// 	const wp = webpack({
// 		context: __dirname,
// 		entry: `./${fixture}`,
// 		output: {
// 			path: pathResolve(__dirname),
// 			filename: 'bundle.js',
// 		},
// 		module: {
// 			rules: [{
// 				test: /\.ts$/,
// 				use: [{
// 					loader: 'ts-loader',
// 				}]
// 			}, {
// 				test: /\.tql$/,
// 				use: [{
// 					loader: pathResolve(__dirname, '../src/loader/index.ts'),
// 					options: {
// 						useApiObject: true,
// 						dbConfig: testingClientConfig,
// 					},
// 				}]
// 			}]
// 		}
// 	})

// 	wp.outputFileSystem = new memoryfs()

// 	return new Promise((resolve, reject) => {
// 		wp.run((err: Error, stats: webpack.Stats) => {
// 			if (err) reject(err)
// 			if (stats.hasErrors()) reject(new Error(stats.toJson().errors.join('\n')))

// 			resolve(stats)
// 		})
// 	})
// }


// describe('webpack loader', () => {
// 	// before(async () => setupSchemaFromFiles('./schemas/_functions.sql', './schemas/simple-layers.sql'))
// 	// after(async () => destroySchema())

// 	it('does stuff', async () => {
// 	  const stats = await compiler('loader.spec.tql')
// 	  const m = stats.toJson().modules
// 	  if (m === undefined) throw new Error()
// 	  console.log(m.length)
// 	  const output = m[0].source

// 		console.log(output)
// 	  expect(true).true
// 	})
// })
