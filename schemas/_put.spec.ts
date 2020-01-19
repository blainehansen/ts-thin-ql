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
})
