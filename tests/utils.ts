import { promises as fs } from 'fs'
import { DefaultObj, Int } from '../src/utils'
import { declareInspectionResults, inspect, InspectionTable, InspectionColumn, InspectionConstraint, InspectionPrimaryKey, InspectionForeignKey, InspectionCheckConstraint, InspectionUniqueConstraint } from '../src/inspect'

import { Client, ClientConfig } from 'pg'

export function boilString(value: string) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\( /g, '(')
		.replace(/ \)/g, ')')
		.replace(/\{ /g, '{')
		.replace(/ \}/g, '}')
		.trim()
}

export const testingClientConfig: ClientConfig = {
	user: 'experiment_user',
	password: 'asdf',
	database: 'experiment_db',
	host: 'localhost',
	port: 5432,
}

async function testingClient() {
	const client = new Client(testingClientConfig)
	await client.connect()
	return client
}

export async function setupSchemaFromFiles(...filenames: string[]) {
	const client = await testingClient()

	for (const filename of filenames) {
		const sql = await fs.readFile(filename, 'utf-8')
		await client.query(sql)
	}
	await client.end()

	declareInspectionResults(await inspect(testingClientConfig))
}

export async function destroySchema() {
	const client = await testingClient()
	await client.query(`
		drop schema public cascade;
		create schema public;
		grant all on schema public to experiment_user;
		grant all on schema public to public;
		comment on schema public is 'standard public schema';
	`)
	await client.end()
}

export function rawDeclareDumbTableSchema(
	tables: string[],
	// referred, pointing, column, unique
	foreignKeys: [string, string, string, boolean][],
) {
	const namesToTables: { [tableName: string]: InspectionTable } = {}

	function makeIntColumn(
		name: string, column_number: number,
		nullable = false, has_default_value = true,
	) {
		return {
			name, column_number: column_number, nullable, has_default_value,
			type_name: 'int4', type_type: '', type_length: 4,
		}
	}

	for (const [index, tableName] of tables.entries()) {
		namesToTables[tableName] = {
			name: tableName,
			table_oid: index,
			columns: [
				makeIntColumn('id', 1)
			],
			constraints: [
				{ type: 'p', pointing_column_numbers: [1] } as InspectionPrimaryKey,
			],
		}
	}

	for (const [index, [referredName, pointingName, pointingColumn, pointingUnique]] of foreignKeys.entries()) {
		const columnNumber = index + 10
		const pointingTable = namesToTables[pointingName]
		if (!pointingTable) throw new Error(`blaine bad tableName ${pointingName}`)
		const referredTable = namesToTables[referredName]
		if (!referredTable) throw new Error(`blaine bad tableName ${pointingName}`)

		pointingTable.columns.push(makeIntColumn(pointingColumn, columnNumber, false, false))
		pointingTable.constraints.push(
			{
				type: 'f', referred_table_oid: referredTable.table_oid,
				referred_column_numbers: [1],
				pointing_column_numbers: [columnNumber],
			} as InspectionForeignKey
		)

		if (pointingUnique) {
			pointingTable.constraints.push(
				{ type: 'u', pointing_column_numbers: [columnNumber] } as InspectionUniqueConstraint
			)
		}
	}

	declareInspectionResults(Object.values(namesToTables))
}
