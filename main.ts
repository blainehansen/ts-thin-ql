// import whatever functions for inspection and declaration
import { declareInspectionResults, inspect } from './src/inspect'

// import whatever functions for parsing
import { parseSource } from './src/parser'

import { setupSchemaFromFile, destroySchema } from './tests/utils'


async function main() {
	// use the object to render and print
	// const tables = inspect({
	// 	user: 'user',
	// 	password: 'asdf',
	// 	database: 'experiment_db',
	// 	host: 'localhost',
	// 	port: 5432,
	// })

	await setupSchemaFromFile('./schema.sql')
	// await destroySchema()

	// declareInspectionResults(tables)

	// // const src = fs.readFileSync('./src/testSrc.gql', { encoding: 'utf-8' })
	// // console.log(src)
	// // parser.lexer.reset(src)
	// // for (let tok of parser.lexer) console.log(tok)
	// // parser.reset(src)
	// // const api = parser.api()

	// const querySource = `
	// query students($arg: string): a_table(@get: id = 1) {
	// 	a_value: a_field
	// 	through_table(@order: id asc, @limit: 3) [
	// 		id, word
	// 		b_record: b_table(@where: b_value in $arg) {
	// 			id, b_value: b_field
	// 		}
	// 	]
	// }`
	// const queries = parseSource(querySource)

	// for (const query of queries) {
	// 	console.log('query:', query)
	// 	console.log('rendered:', query.render())
	// }
}


main()
