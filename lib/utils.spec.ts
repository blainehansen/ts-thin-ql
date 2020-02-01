import { expect } from 'chai'
import { promises as fs } from 'fs'
import { Client, ClientConfig } from 'pg'

export function e(value: string) {
	return expect(boil_string(value))
}

export function boil_string(value: string) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\( /g, '(')
		.replace(/ \)/g, ')')
		.replace(/\{ /g, '{')
		.replace(/ \}/g, '}')
		.replace(/\[ /g, '[')
		.replace(/ \]/g, ']')
		.replace(/ \: /g, ': ')
		.replace(/;/g, '')
		.trim()
}

export const testing_client_config: ClientConfig = {
	user: 'experiment_user',
	password: 'asdf',
	database: 'experiment_db',
	host: 'localhost',
	port: 5432,
}

export async function testing_client() {
	const client = new Client(testing_client_config)
	await client.connect()
	return client
}

export async function setup_schema_from_files(...filenames: string[]) {
	const client = await testing_client()

	for (const filename of filenames) {
		const sql = await fs.readFile(filename, 'utf-8')
		await client.query(sql)
	}
	await client.end()
}

export async function destroy_schema() {
	const client = await testing_client()
	await client.query(`
		drop schema public cascade;
		create schema public;
		grant all on schema public to experiment_user;
		grant all on schema public to public;
		comment on schema public is 'standard public schema';
	`)
	await client.end()
}
