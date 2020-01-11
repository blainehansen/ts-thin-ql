import * as c from '@ts-std/codec'
import { promises as fs } from 'fs'
import { Client, ClientConfig } from 'pg'

import { Console } from 'console'
const console = new Console({ stdout: process.stdout, stderr: process.stderr, inspectOptions: { depth: 5 } })

export const InspectionPrimaryKey = c.loose_object('InspectionPrimaryKey', {
	type: c.literal('p'),
	constrained_column_numbers: c.array(c.number),
})
export type InspectionPrimaryKey = c.TypeOf<typeof InspectionPrimaryKey>

export const InspectionForeignKey = c.loose_object('InspectionForeignKey', {
	type: c.literal('f'),
	referred_table_oid: c.number,
	referred_column_numbers: c.array(c.number),
	constrained_column_numbers: c.array(c.number),
})
export type InspectionForeignKey = c.TypeOf<typeof InspectionForeignKey>

export const InspectionCheckConstraint = c.loose_object('InspectionCheckConstraint', {
	type: c.literal('c'),
	constrained_column_numbers: c.array(c.number),
	check_constraint_expression: c.string,
})
export type InspectionCheckConstraint = c.TypeOf<typeof InspectionCheckConstraint>

export const InspectionUniqueConstraint = c.loose_object('InspectionUniqueConstraint', {
	type: c.literal('u'),
	constrained_column_numbers: c.array(c.number),
})
export type InspectionUniqueConstraint = c.TypeOf<typeof InspectionUniqueConstraint>

export const InspectionConstraint = c.union(
	InspectionPrimaryKey,
	InspectionForeignKey,
	InspectionCheckConstraint,
	InspectionUniqueConstraint,
)
export type InspectionConstraint = c.TypeOf<typeof InspectionConstraint>


export const InspectionColumn = c.loose_object('InspectionColumn', {
	name: c.string,
	type_name: c.string,
	type_type: c.string,
	type_length: c.number,
	column_number: c.number,
	nullable: c.boolean,
	has_default_value: c.boolean,
	// access_control_items: Object[],
})
export type InspectionColumn = c.TypeOf<typeof InspectionColumn>

export const InspectionTable = c.loose_object('InspectionTable', {
	name: c.string,
	table_oid: c.number,
	columns: c.array(InspectionColumn),
	constraints: c.array(InspectionConstraint),
	// access_control_items: Object[],
	// policies: Object[],
})
export type InspectionTable = c.TypeOf<typeof InspectionTable>



export async function get_client(config: ClientConfig) {
	const client = new Client(config)
	await client.connect()
	return client
}

export async function inspect(config: ClientConfig) {
	const client = await get_client(config)
	const inspect = await fs.readFile('./src/inspect.sql', 'utf-8')

	const res = await client.query(inspect)

	console.log(res.rows)
	// console.log(res.rows[0].source)
	// const tables = c.array(InspectionTable).decode(res.rows[0].source).unwrap()

	// // TODO this loop just for experimentation
	// for (const table of tables) {
	// 	console.log(table.name)
	// 	console.log(table.table_oid)
	// 	// console.log(table.access_control_items)
	// 	console.log(table.columns)
	// 	console.log(table.constraints)
	// 	// console.log(table.policies)
	// 	console.log()
	// }

	await client.end()

	// return tables
}
