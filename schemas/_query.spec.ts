import 'mocha'
import { expect } from 'chai'

import { boil_string, testing_client, setup_schema_from_files, destroy_schema } from '../src/utils.spec'

describe('query blog.sql', async () => {
	before(async () => await setup_schema_from_files('./schemas/_functions.sql', './schemas/blog.sql'))
	after(async () => await destroy_schema())

	it('simple single object query', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			select json_build_object('title', post.title, 'excerpt', post.excerpt) :: text as post
			from
				post as post
			where (post.id = $1)
		`, [1])

		expect(rows.length).eql(1)
		expect(JSON.parse(rows[0].post)).eql({
			title: "Darth Vader 1",
			excerpt: "Darth Vader 1 excerpt",
		})
		await client.end()
	})

	it('three layer deep single', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			select json_build_object('title', post.title, 'body', post.body, 'author', author.author) :: text as post
			from
				post as post

				left join lateral (
					select json_build_object('first_name', author.first_name, 'last_name', author.last_name, 'org', org.org) as author
					from
						person as author

					left join lateral (
						select json_build_object('name', org.name) as org
						from organization as org
						where (author.organization_id = org.id)
					) as org on true

					where (post.person_id = author.id)
				) as author on true

			where (post.id = $1)
		`, [1])

		expect(rows.length).eql(1)
		expect(JSON.parse(rows[0].post)).eql({
			title: "Darth Vader 1",
			body: "Darth Vader 1 body",
			author: {
				first_name: "Darth",
				last_name: "Vader",
				org: {
					name: "Empire",
				},
			},
		})
		await client.end()
	})

	it('order/limit/offset in many nested with multiple associations', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			select array_to_json(array(
				select json_build_object(
					'first', people.first_name, 'posts', posts.posts,
					'weapons', people.preferred_weapons, 'organization', organization.organization
				) as people

				from
					person as people

					cross join lateral (select array_to_json(array(
						select json_build_object('title', posts.title) as posts
						from post as posts
						where (people.id = posts.person_id)
						order by posts.title desc
						limit 2
					)) as posts) as posts

					left join lateral (
						select json_build_object('name', organization.name) as organization
						from organization
						where (people.organization_id = organization.id)
					) as organization on true

			)) :: text as people
		`)

		expect(rows.length).eql(1)
		expect(JSON.parse(rows[0].people)).eql([{
			first: "Darth",
			posts: [{ title: "Darth Vader 5" }, { title: "Darth Vader 4" }],
			weapons: ['red lightsaber'],
			organization: { name: "Empire" },
		}, {
			first: "Luke",
			posts: [{ title: "Luke Skywalker 2" }, { title: "Luke Skywalker 1" }],
			weapons: ['stolen blaster', 'green lightsaber'],
			organization: { name: "Rebellion" },
		}, {
			first: "Leia",
			posts: [{ title: "Leia Organa 1" }],
			weapons: ['blaster'],
			organization: { name: "Rebellion" },
		}, {
			first: "R2",
			posts: [],
			weapons: [],
			organization: { name: "Rebellion" },
		}, {
			first: "Admiral",
			posts: [{ title: "Admiral Ackbar 1" }],
			weapons: [],
			organization: { name: "Rebellion" },
		}, {
			first: "Han",
			posts: [{ title: "Han Solo 1" }],
			weapons: ['trusty blaster'],
			organization: null,
		}])
		await client.end()
	})

	it('inner or existence required', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			select array_to_json(array(
				select json_build_object(
					'first', people.first_name, 'posts', posts.posts, 'organization', organization.organization
				) as people

				from
					person as people

					cross join lateral (select array_to_json(array(
						select json_build_object('title', posts.title) as posts
						from post as posts
						where (people.id = posts.person_id)
						limit 2
					)) as posts) as posts

					inner join lateral (
						select json_build_object('name', organization.name) as organization
						from organization
						where (people.organization_id = organization.id)
					) as organization on true

				where json_array_length(posts.posts) != 0

			)) :: text as people
		`)

		expect(rows.length).eql(1)
		expect(JSON.parse(rows[0].people)).eql([{
			first: "Darth",
			posts: [{ title: "Darth Vader 1" }, { title: "Darth Vader 2" }],
			organization: { name: "Empire" },
		}, {
			first: "Luke",
			posts: [{ title: "Luke Skywalker 1" }, { title: "Luke Skywalker 2" }],
			organization: { name: "Rebellion" },
		}, {
			first: "Leia",
			posts: [{ title: "Leia Organa 1" }],
			organization: { name: "Rebellion" },
		}, {
			first: "Admiral",
			posts: [{ title: "Admiral Ackbar 1" }],
			organization: { name: "Rebellion" },
		}])
		await client.end()
	})

	it('organization through to post and back to person', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			select array_to_json(array(
				select json_build_object(
					'name', organizations.name, 'posts', posts.posts
				) as organizations

				from
					organization as organizations

					cross join lateral (select array_to_json(array(
						select json_build_object('title', posts.title, 'author', author.author) as posts
						from
							person as person
							inner join post as posts
								on person.id = posts.person_id

							left join lateral (
								select json_build_object('name', author.first_name) as author
								from person as author
								where posts.person_id = author.id
							) as author on true

						where (organizations.id = person.organization_id)
						limit 2
					)) as posts) as posts

			)) :: text as organizations
		`)

		expect(rows.length).eql(1)
		expect(JSON.parse(rows[0].organizations)).eql([{
			name: "Empire",
			posts: [{ title: "Darth Vader 1", author: { name: "Darth" } }, { title: "Darth Vader 2", author: { name: "Darth" } }],
		}, {
			name: "Rebellion",
			posts: [{ title: "Luke Skywalker 1", author: { name: "Luke" } }, { title: "Luke Skywalker 2", author: { name: "Luke" } }],
		}, {
			name: "Hutts",
			posts: [],
		}])
		await client.end()
	})

	it('post through person to organization', async () => {
		const client = await testing_client()
		const { rows } = await client.query(`
			select array_to_json(array(
				select json_build_object('title', posts.title, 'organization', organization.organization)
				from
					post as posts

					left join lateral (
						select json_build_object('name', organization.name) as organization

						from
							person as person
							inner join organization as organization
								on person.organization_id = organization.id
						where (posts.person_id = person.id)

					) as organization on true

				limit 2

			)) :: text as posts
		`)

		expect(rows.length).eql(1)
		expect(JSON.parse(rows[0].posts)).eql([{
			title: "Darth Vader 1",
			organization: { name: "Empire" },
		}, {
			title: "Darth Vader 2",
			organization: { name: "Empire" },
		}])
		await client.end()
	})
})
