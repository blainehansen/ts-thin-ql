import 'mocha'
import { expect } from 'chai'

// // to do a general upsert, we need a type like this:
// type Upsert<T> =
// 	| CoreFields<T>
// 	| CoreFields<T> & PrimaryKeyFields<T>

// with that in hand, we can split the json rows into two groups, the insert group and the update group with this where clause and its inverse
// _json_entity ? 'primary_key_field' ... and other primary_key_fields

// then we can take those two groups (realized as temporary tables) and separately insert/update them

// also, given a patch object, we can have if() functions or switch statements that use the '?' operator to update the field to either the json value or the existing row value


import { boil_string, testing_client, setup_schema_from_files, destroy_schema } from '../src/utils.spec'

describe('insert blog.sql', async () => {
	beforeEach(async () => await setup_schema_from_files('./schemas/_functions.sql', './schemas/blog.sql'))
	afterEach(async () => await destroy_schema())

	it('basic insert', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			insert into organization (name) (
				select name
				from jsonb_populate_record(null::organization, $1)
			)
			returning *
		`, [{ name: 'Moisture Farmers' }])
		expect(rows).eql([{ id: 4, name: 'Moisture Farmers' }])
		await client.end()
	})

	it('single insert with single association', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			with _person as (
				insert into person (first_name) (
					select first_name
					from jsonb_populate_record(null::person, $1)
				) returning id
			)
			insert into vehicle (name, person_id) (
				select _vehicle.name, _person.id
				from
					_person
					inner join jsonb_populate_record(null::vehicle, $1->'vehicle') as _vehicle
						on $1 ? 'vehicle'
			)
			returning *
		`, [{ first_name: 'Aunt Baroo', vehicle: { name: 'Sand Speeder' } }])

		expect(rows).eql([ { id: 1, name: 'Sand Speeder', person_id: 7 } ])
		expect((await client.query(`
			select id, first_name from person where id = 7
		`)).rows).eql([{ id: 7, first_name: 'Aunt Baroo' }])

		await client.end()
	})

	it('single insert with null single association', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			with _person as (
				insert into person (first_name) (
					select first_name
					from jsonb_populate_record(null::person, $1)
				) returning id
			)
			insert into vehicle (name, person_id) (
				select _vehicle.name, _person.id
				from
					_person
					inner join jsonb_populate_record(null::vehicle, $1->'vehicle') as _vehicle
						on $1 ? 'vehicle'
			)
			returning *
		`, [{ first_name: 'Aunt Baroo' }])

		expect(rows).eql([])
		expect((await client.query(`
			select id, first_name from person where id = 7
		`)).rows).eql([{ id: 7, first_name: 'Aunt Baroo' }])

		expect((await client.query(`
			select * from vehicle
		`)).rows).eql([])

		await client.end()
	})

	it('insert with multiple association', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			with _person as (
				insert into person (first_name) (
					select first_name
					from jsonb_populate_record(null::person, $1)
				) returning id
			)
			insert into post (title, excerpt, body, person_id) (
				select _post.title, _post.excerpt, _post.body, _person.id
				from
					_person
					inner join jsonb_populate_recordset(null::post, $1->'posts') as _post
						on true
			)
			returning *
		`, [{ first_name: 'Aunt Baroo', posts: [{
			title: 'Luke!', excerpt: 'Luke!', body: 'Luke!',
		}, {
			title: 'Lars!', excerpt: 'Lars!', body: 'Lars!',
		}] }])

		console.log(rows)
		// expect(rows).eql([])
		// expect((await client.query(`
		// 	select id, first_name from person where id = 7
		// `)).rows).eql([{ id: 7, first_name: 'Aunt Baroo' }])

		// expect((await client.query(`
		// 	select * from vehicle
		// `)).rows).eql([])

		await client.end()
	})


	// scary dynamic sql??
	// https://stackoverflow.com/questions/39442003/postgresql-dynamic-insert-on-column-names
	// https://dba.stackexchange.com/questions/163962/insert-values-from-a-record-variable-into-a-subclass-table/164224#164224
	// https://dba.stackexchange.com/questions/52826/insert-values-from-a-record-variable-into-a-table

	it('insert multiple with single association', async () => {
		const client = await testing_client()

		const { rows } = await client.query(`
			with _person as (
				insert into person (first_name)
				select value->'first_name'
				from jsonb_array_elements($1) with ordinality as _(value, _row_number)
				returning id, _row_number
			)

			select _person.id, unnest()

			with _input_rows as (
				-- select array_agg(value) as value, array_agg(value->'vehicle') as vehicle
				select _row_number, value
				from jsonb_array_elements($1)
			),

			_person as (
				insert into person (first_name)
				select value->'first_name'
				from _input_rows
				-- select _value->'first_name'
				-- from _input_rows, unnest(value) as _value
				returning id
			)

				select _person.id, _input_rows.vehicle from _person, _input_rows
			-- _zip as (
			-- )
			-- insert into vehicle (person_id, name)
			-- select u.__person.id, u.__vehicle->'name'
			-- from unnest(_person._ids, _input_rows.vehicle) as u(__person, __vehicle)
			-- returning *
		`, [JSON.stringify([{
			first_name: "Aunt Baroo",
			vehicle: { name: 'thing' },
		}, {
			first_name: "C3PO",
			vehicle: { name: 'whatevs' },
		}])])

		console.log(rows)

		await client.end()
	})


	// it('insert multiple with multiple association', async () => {
	// 	const client = await testing_client()

	// 	const { rows } = await client.query(`
	// 		with __input_rows as (
	// 			select
	// 				jsonb_populate_record(null::person, value) as _person,
	// 				value->'posts' as posts
	// 			from jsonb_array_elements($1)
	// 		),

	// 		_person as (
	// 			insert into person (first_name) (
	// 				select first_name
	// 				from __input_rows._person
	// 			) returning id
	// 		)

	// 		insert into post (title, excerpt, body, person_id) (
	// 			select _post.title, _post.excerpt, _post.body, _person.id
	// 			from
	// 				_person
	// 				inner join jsonb_populate_recordset(null::post, $1->'posts') as _post
	// 					on true
	// 		)
	// 		returning *

	// 		select
	// 			 as p,
	// 			value->'posts' as posts
	// 		from jsonb_array_elements($1)
	// 	`, [JSON.stringify([{
	// 		first_name: "Aunt Baroo",
	// 		posts: [{
	// 			title: "Luke!", excerpt: "Luke!", body: "Luke!"
	// 		}, {
	// 			title: "Lars!", excerpt: "Lars!", body: "Lars!"
	// 		}]
	// 	}, {
	// 		first_name: "C3PO",
	// 		posts: [{
	// 			title: "Goodness me!", excerpt: "Goodness me!", body: "Goodness me!"
	// 		}, {
	// 			title: "Oh nooooo!", excerpt: "Oh nooooo!", body: "Oh nooooo!"
	// 		}]
	// 	}])])

	// 	console.log(rows)

	// 	await client.end()
	// })
})
