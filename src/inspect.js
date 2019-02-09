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
	console.log(res.rows)
	await client.end()
}

inspect()

module.exports = inspect

