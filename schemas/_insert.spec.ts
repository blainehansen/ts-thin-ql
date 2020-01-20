import 'mocha'
import { expect } from 'chai'

// // to do a general upsert, we need a type like this:
// type Upsert<T> =
// 	| CoreFields<T>
// 	| CoreFields<T> & PrimaryKeyFields<T>

// with that in hand, we can split the json rows into two groups, the insert group and the update group with this where clause and its inverse
// _json_entity ? 'primary_key_field' ... and other primary_key_fields

// then we can take those two groups (realized as temporary tables) and separately insert/update them

import { boil_string, testing_client, setup_schema_from_files, destroy_schema } from '../src/utils.spec'

describe('insert blog.sql', async () => {
	beforeEach(async () => await setup_schema_from_files('./schemas/_functions.sql', './schemas/blog.sql'))
	afterEach(async () => await destroy_schema())

	it('insert nested', async () => {
		const client = await testing_client()

		await client.query(`
			with
			_organization_rows as (
				select nextval('organization_id_seq'::regclass) as _organization_id, value as _organization
				from jsonb_array_elements($1)
			),

			_person_rows as (
				select _organization_id, nextval('person_id_seq'::regclass) as _person_id, jsonb_array_elements(_organization->'people') as _person
				from _organization_rows
			),

			_vehicle_rows as (
				select _person_id, nextval('vehicle_id_seq'::regclass) as _vehicle_id, _person->'vehicle' as _vehicle
				from _person_rows
			),

			_post_rows as (
				select _person_id, jsonb_array_elements(_person->'posts') as _post
				from _person_rows
			),

			_insert_organization as (
				insert into organization (id, "name")
				select _organization_id, _organization->>'name'
				from _organization_rows
			),

			_insert_person as (
				insert into person (organization_id, id, first_name)
				select _organization_id, _person_id, _person->>'first_name'
				from _person_rows
			),

			_insert_vehicle as (
				insert into vehicle (person_id, id, "name")
				select _person_id, _vehicle_id, _vehicle->>'name'
				from _vehicle_rows
				where _vehicle is not null
			),

			_insert_post as (
				insert into post (person_id, title)
				select _person_id, _post->>'title'
				from _post_rows
			)

			select true
		`, [JSON.stringify([{
			name: "Bounty Hunters",
			people: [{
				first_name: "Boba",
				vehicle: { name: "Slave 1" },
				posts: [{ title: "No Disintegrations!!??!" }, { title: "He's no good to me dead" }]
			}, {
				first_name: "IG-88",
				posts: []
			}]
		}, {
			name: "Ewoks",
			people: []
		}])])

		expect((await client.query(`
			select * from organization where id in (4, 5)
		`)).rows).deep.members([{
			id: 4, name: "Bounty Hunters",
		}, {
			id: 5, name: "Ewoks",
		}])

		expect((await client.query(`
			select id, first_name, organization_id from person where organization_id in (4, 5)
		`)).rows).deep.members([{
			id: 7, first_name: "Boba", organization_id: 4,
		}, {
			id: 8, first_name: "IG-88", organization_id: 4,
		}])
		expect((await client.query(`
			select id, title, person_id from post where person_id in (7, 8)
		`)).rows).deep.members([{
			id: 11, title: "No Disintegrations!!??!", person_id: 7,
		}, {
			id: 12, title: "He's no good to me dead", person_id: 7,
		}])
		expect((await client.query(`
			select * from vehicle
		`)).rows).deep.members([{
			id: 1, name: "Slave 1", person_id: 7,
		}])

		await client.end()
	})

	// it seems then that there are really two types of inserts
	// - normal ones, where every association is merely inserted and no attempt will be made to split anything
	// these normal ones will probably have stricter incoming types, not allowing any associations to have any primary key fields at all
	// - "insertdeep", where associations will be mutated and destroyed and whatever to make the final state exactly correspond
	// insertdeep is essentially an aggressive patch where the roots are mandatory inserts
	// this does seem to suggest that for all of these association mutating methods, we could potentially allow directives or something to control where the association should be put or patched! it's possible to be incredibly granular with this "unpack/split" system
	// probably there are three levels:
	// - associate only (the default since it's the least mutating), merely looks for foreign keys and updates only them
	// - patch
	// - put

	// association delete should also be opt in
	// we could have some sort of "exact" or "delete_extra" modifier

	// all of insert/put/patch should have a "deep" variant that turns all of this stuff on,
	// otherwise the only kind allowed for all associations is the root kind
	// essentially in the associations of a "deep" variant, any records that don't have a primary key are inserted
	// then by default new associations will be created and nothing else
	// and for each nested item they can specify patch or put behavior


	// // so we'll insert 'Scoundrels'
	// // inserting Greedo
	// // but "co-opting" Han Solo by including his id, but his organization_id should change since he's nested under the organization array
	// // we'll also co-opt Luke into a new organization "Moisture Farmers" and update one of his posts and delete another by not including it
	// it('update aware insert', async () => {
	// 	const client = await testing_client()

	// 	await client.query(`

	// 	`, [JSON.stringify([{
	// 		name: "Scoundrels",
	// 		people: [{
	// 			first_name: "Greedo",
	// 		}, {
	// 			id: 6,
	// 		}],
	// 	}, {
	// 		name: "Moisture Farmers",
	// 		people: [{
	// 			id: 2,
	// 			//
	// 		}],
	// 	}])])

	// 	await client.end()
	// })
})
