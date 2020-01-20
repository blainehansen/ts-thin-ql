import 'mocha'
import { expect } from 'chai'

import { testing_client, setup_schema_from_files, destroy_schema } from '../src/utils.spec'

describe('put blog.sql', async () => {
	beforeEach(async () => await setup_schema_from_files('./schemas/_functions.sql', './schemas/blog.sql'))
	afterEach(async () => await destroy_schema())

	it('basic put', async () => {
		const client = await testing_client()
		const query = `
			with _person_rows as (
				select $1 :: jsonb as _value
			)
			update person set
				first_name = (_person_rows._value->>'first_name') :: text,
				last_name = (_person_rows._value->>'last_name') :: text,
				organization_id = (_person_rows._value->>'organization_id') :: int,
				preferred_weapons = array(select jsonb_array_elements_text(_person_rows._value->'preferred_weapons')) :: text[]
			from _person_rows
			where id = (_person_rows._value->>'id') :: int
			returning *
		`
		expect((await client.query(`
			select id, first_name, last_name, organization_id, preferred_weapons from person where id = 2
		`)).rows).eql([{
			id: 2, first_name: "Luke", last_name: "Skywalker", organization_id: 2, preferred_weapons: ['stolen blaster', 'green lightsaber'],
		}])
		expect((await client.query(query, [{
			id: 2, first_name: "Luke", last_name: null, organization_id: 1, preferred_weapons: ['green lightsaber'],
		}])).rows.length).eql(1)

		expect((await client.query(`
			select id, first_name, last_name, organization_id, preferred_weapons from person where id = 2
		`)).rows).eql([{
			id: 2, first_name: "Luke", last_name: null, organization_id: 1, preferred_weapons: ['green lightsaber'],
		}])

		await client.end()
	})

	it('multiple put', async () => {
		const client = await testing_client()
		const query = `
			with _person_rows as (
				select "value" as _value
				from jsonb_array_elements($1)
			)
			update person set
				first_name = (_person_rows._value->>'first_name') :: text,
				last_name = (_person_rows._value->>'last_name') :: text,
				organization_id = (_person_rows._value->>'organization_id') :: int,
				preferred_weapons = array(select jsonb_array_elements_text(_person_rows._value->'preferred_weapons')) :: text[]
			from _person_rows
			where id = (_person_rows._value->>'id') :: int
			returning *
		`

		expect((await client.query(`
			select id, first_name, last_name, organization_id, preferred_weapons from person where id in (1, 2)
		`)).rows).deep.members([{
			id: 1, first_name: "Darth", last_name: "Vader", organization_id: 1, preferred_weapons: ['red lightsaber'],
		}, {
			id: 2, first_name: "Luke", last_name: "Skywalker", organization_id: 2, preferred_weapons: ['stolen blaster', 'green lightsaber'],
		}])

		expect((await client.query(query, [JSON.stringify([{
			id: 1, first_name: "Darth", last_name: "Father", organization_id: null, preferred_weapons: ['red lightsaber', 'bare hands'],
		}, {
			id: 2, first_name: "Luke", last_name: null, organization_id: 1, preferred_weapons: ['green lightsaber'],
		}])])).rows.length).eql(2)

		expect((await client.query(`
			select id, first_name, last_name, organization_id, preferred_weapons from person where id in (1, 2)
		`)).rows).deep.members([{
			id: 1, first_name: "Darth", last_name: "Father", organization_id: null, preferred_weapons: ['red lightsaber', 'bare hands'],
		}, {
			id: 2, first_name: "Luke", last_name: null, organization_id: 1, preferred_weapons: ['green lightsaber'],
		}])

		await client.end()
	})

	it('put with association delete', async () => {
		const client = await testing_client()

		await client.query(`
			with
			_organization_rows as (
				select
					_value as _organization,
					(_value->>'id') :: int as _organization_id,
					(_value->>'name') :: text as "name"
				from jsonb_array_elements($1) as _(_value)
			),

			_person_rows as (
				select
					*, _value ? 'id' as __needs_update,
					case _value ? 'id' when true then (_value->>'id') :: int else nextval('person_id_seq'::regclass) end as _person_id,
					(_value->>'first_name') :: text as first_name
				from (select _organization_id, jsonb_array_elements(_organization->'people') as _value from _organization_rows) _
			),

			_update_organization as (
				update organization set
					name = _organization_rows.name
				from _organization_rows
				where id = _organization_rows._organization_id
			),

			_insert_person as (
				insert into person (id, organization_id, first_name)
				select _person_id, _organization_id, first_name
				from _person_rows
				where not _person_rows.__needs_update
			),

			_update_person as (
				update person set
					organization_id = _person_rows._organization_id
				from _person_rows
				where id = _person_rows._person_id and _person_rows.__needs_update
			),

			_delete_person as (
				delete from person where
					-- is in the parent
					exists (select from _organization_rows where organization_id = _organization_rows._organization_id)
					-- but isn't in what we just did
					and not exists (select from _person_rows where id = _person_rows._person_id)
			)

			select true
		`, [JSON.stringify([{
			id: 1, name: "Galactic Empire",
			people: [{
				first_name: "Sheev",
			}],
		}])])

		expect((await client.query(`
			select id, name from organization where id = 1
		`)).rows).eql([{
			id: 1, name: "Galactic Empire",
		}])

		expect((await client.query('select * from post where person_id = 1')).rows).eql([])
		expect((await client.query('select * from post where person_id != 1')).rows.length).eql(5)
		expect((await client.query(`
			select id, first_name from person where organization_id = 1
		`)).rows).eql([{
			id: 7, first_name: "Sheev",
		}])
		expect((await client.query('select * from person where organization_id != 1 or organization_id is null')).rows.length).eql(5)

		await client.end()
	})
})
