import 'mocha'
import { expect } from 'chai'

import { testing_client, setup_schema_from_files, destroy_schema } from '../src/utils.spec'

describe('patch blog.sql', async () => {
	beforeEach(async () => await setup_schema_from_files('./schemas/_functions.sql', './schemas/blog.sql'))
	afterEach(async () => await destroy_schema())

	it('basic patch', async () => {
		const client = await testing_client()
		const query = `
			with _person_rows as (
				select $1 :: jsonb as _value
			)
			update person set
				first_name = case _person_rows._value ? 'first_name'
					when true then (_person_rows._value->>'first_name') :: text
					else person.first_name
				end,

				last_name = case _person_rows._value ? 'last_name'
					when true then (_person_rows._value->>'last_name') :: text
					else person.last_name
				end,

				organization_id = case _person_rows._value ? 'organization_id'
					when true then (_person_rows._value->>'organization_id') :: int
					else person.organization_id
				end,

				preferred_weapons = case _person_rows._value ? 'preferred_weapons'
					when true then array(select jsonb_array_elements_text(_person_rows._value->'preferred_weapons')) :: text[]
					else person.preferred_weapons
				end

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
			id: 2, last_name: null, organization_id: 1,
		}])).rows.length).eql(1)
		expect((await client.query(`
			select id, first_name, last_name, organization_id, preferred_weapons from person where id = 2
		`)).rows).eql([{
			id: 2, first_name: "Luke", last_name: null, organization_id: 1, preferred_weapons: ['stolen blaster', 'green lightsaber'],
		}])

		expect((await client.query(query, [{
			id: 2, first_name: "Han", organization_id: null, preferred_weapons: [],
		}])).rows.length).eql(1)
		expect((await client.query(`
			select id, first_name, last_name, organization_id, preferred_weapons from person where id = 2
		`)).rows).eql([{
			id: 2, first_name: "Han", last_name: null, organization_id: null, preferred_weapons: [],
		}])

		await client.end()
	})
})
