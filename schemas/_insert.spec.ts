import 'mocha'
import { expect } from 'chai'

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

	it('insert with single association', async () => {
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

	it('insert with null single association', async () => {
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


	it('insert multiple with single association', async () => {
		const client = await testing_client()

					// jsonb_populate_record(null::person, value) as _person,
					// value->'vehicle' as vehicle
					// , __input_rows.value->'vehicle'
			// with __input_rows as (
			// )

			// insert into person (first_name) (
			// 	select first_name
			// 	from (select * from jsonb_populate_record(null::person, __input_rows.value)) a
			// ) returning id
		const { rows } = await client.query(`
			with _input_rows as (
				select array_agg(value) as __original, array_agg(value->'vehicle') as vehicle
				from jsonb_array_elements($1)
			)

			insert into person (first_name) (
				with a as (select jsonb_populate_record(null::person, v) from unnest())
				select original->'first_name'
				from _input_rows
			) returning id
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
