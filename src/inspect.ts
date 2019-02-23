import { LogError, Int } from './utils'
import { PgType, PgInt, PgFloat, PgText, PgBool, PgEnum, Table, Column, ForeignKey } from './inspectionClasses'

function getColumnType(typeText: string) {
	switch (typeText) {
		case 'int2':
			return { size: 2, isSerial: false } as PgInt
		case 'int4':
			return { size: 4, isSerial: false } as PgInt
		case 'int8':
			return { size: 8, isSerial: false } as PgInt
		case 'text':
			return { maxSize: undefined } as PgText
		case 'bool':
			return {} as PgBool
		default:
			throw new LogError("unsupported column type:", typeText)
	}
}

async function inspect() {
	const fs = require('fs')
	const { Client } = require('pg')

	const client = new Client({
	  user: 'user',
	  password: 'asdf',
	  database: 'experiment_db',
	  host: 'localhost',
	  port: 5432,
	})

	await client.connect()

	const inspectionQuery = fs.readFileSync('./src/inspectionQuery.sql', { encoding: 'utf-8' })

	const res = await client.query(inspectionQuery)

	// so we'll go through all of these,
	// and go through all the columns and connect the to constraints
	for (const table of res.rows) {
		// const columnNumberMap: { [num: Int]: Column } = {}
		console.log(table)

		// const uniqueColumns: Set<Int> = new Set()

		// for (const constraint of table.constraints) {
		// 	// we'll use these to figure out what the primary and foreign keys are, and if they're unique

		// 	switch (constraint.type) {
		// 		// case 'c':
		// 		// 	break
		// 		case 'p':
		// 			break
		// 		case 'f':
		// 			break
		// 		case 'u':
		// 			if (constraint.constrained_column_numbers.length !== 1) throw new LogError("don't yet support multiple unique:", table)
		// 			uniqueColumns.add(constraint.constrained_column_numbers[0] as Int)
		// 			break
		// 		default:
		// 			throw new LogError("unsupported constraint type:", constraint.type)
		// 	}
		// }

		// for (const column of table.columns) {
		// 	const columnNumber = column.column_number as Int
		// 	const columnType = getColumnType(column.type_name)
		// 	// type_type
		// 	columnNumberMap[columnNumber] = new Column(column.name, columnType, uniqueColumns.has(columnNumber), !column.must_not_null)
		// }


		// // do something to build a table object
		// new Table()
	}

	await client.end()
}

inspect()

module.exports = inspect
