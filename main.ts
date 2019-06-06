// import { parseSource } from './src/parser'
import { generateClientApi } from './src/index'
import { declareInspectionResults, inspect } from './src/inspect'
import { setupSchemaFromFiles, destroySchema, testingClientConfig } from './tests/utils'
import { Query, Arg, QueryBlock, QueryColumn, SimpleTable, TableChain, WhereDirective, WhereType, ForeignKeyChain, KeyReference, RawSqlStatement } from './src/ast/query'


async function main() {
	// await setupSchemaFromFiles('./schemas/_functions.sql', './schemas/simple-layers.sql')
	// await destroySchema()

	const inspectionTables = await inspect(testingClientConfig)
	const tables = declareInspectionResults(inspectionTables)

	const arg = new Arg(1, 'id_limit', 'int', false, 4)
	const q = new Query('hellaLayersQuery', [arg], new QueryBlock(
		'first_level', 'first_level', new SimpleTable('first_level'), true,
		[
			new QueryColumn('id', 'id'),
			new QueryColumn('word', 'my_word'),
			new QueryBlock(
				'seconds', 'second_level', new SimpleTable('second_level'), true,
				[
					new QueryColumn('id', 'id'),
					new QueryColumn('word', 'my_word'),
					new QueryBlock(
						'thirds', 'third_level', new SimpleTable('third_level'), false,
						[
							new QueryColumn('id', 'id'),
							new QueryColumn('word', 'my_word'),
						],
						[], [], 1,
					)
				],
				[], [],
			)
		],
		[new WhereDirective('id', arg, WhereType.Lte)], [],
	))

	console.log(generateClientApi(false, tables, [q]))


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
}


main()
