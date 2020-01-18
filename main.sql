drop schema public cascade;
create schema public;
grant all on schema public to experiment_user;
grant all on schema public to public;
comment on schema public is 'standard public schema';

create table organization (
	id serial primary key,
	"name" text not null
);

create table person (
	id serial primary key,
	first_name text,
	last_name text,
	organization_id int references organization
);

create table post (
	id serial primary key,
	person_id int not null references person,
	title text not null
);

create table vehicle (
	id serial primary key,
	"name" text not null,
	person_id int unique not null references person
);


prepare _thing (jsonb) as

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
	select _organization_id, _organization->'name'
	from _organization_rows
),

_insert_person as (
	insert into person (organization_id, id, first_name)
	select _organization_id, _person_id, _person->'first_name'
	from _person_rows
),

_insert_vehicle as (
	insert into vehicle (person_id, id, "name")
	select _person_id, _vehicle_id, _vehicle->'name'
	from _vehicle_rows
	where _vehicle is not null
),

_insert_post as (
	insert into post (person_id, title)
	select _person_id, _post->'title'
	from _post_rows
)

select _organization_id from _organization_rows
;

execute _thing ('[{
	"name": "Empire",
	"people": [{
		"first_name": "Darth",
		"vehicle": { "name": "Star Destroyer" },
		"posts": [{ "title": "Join me" }, { "title": "Luke!" }]
	}, {
		"first_name": "Sheev",
		"posts": []
	}]
}, {
	"name": "Hutts",
	"people": []
}]');

select * from organization;
select * from person;
select * from post;
select * from vehicle;








-- prepare _thing (jsonb) as

-- with

-- _rows as (
-- 	select gen_random_uuid() as _uuid, value as _person, value->'vehicle' as _vehicle
-- 	from jsonb_array_elements($1)
-- ),

-- _1 as (
-- 	insert into person (id, first_name)
-- 	select _uuid, _person->'first_name'
-- 	from _rows
-- ),

-- _2 as (
-- 	insert into vehicle (person_id, "name")
-- 	select _uuid, _vehicle->'name'
-- 	from _rows
-- )

-- select _uuid from _rows
-- ;

-- execute _thing ('[{
-- 	"first_name": "Aunt Baroo",
-- 	"vehicle": { "name": "thing" }
-- }, {
-- 	"first_name": "C3PO",
-- 	"vehicle": { "name": "whatevs" }
-- }]');

-- select * from person;
-- select * from vehicle;






-- insert into organization ("name") values ('Empire'), ('Rebellion'), ('Hutts');

-- insert into person (first_name, last_name, preferred_weapons, organization_id) values
-- ('Darth', 'Vader', ARRAY['red lightsaber'], 1),
-- ('Luke', 'Skywalker', ARRAY['stolen blaster', 'green lightsaber'], 2),
-- ('Leia', 'Organa', ARRAY['blaster'], 2),
-- ('R2', 'D2', ARRAY[] :: text[], 2),
-- ('Admiral', 'Ackbar', ARRAY[] :: text[], 2),
-- ('Han', 'Solo', ARRAY['trusty blaster'], null);


-- insert into post (person_id, title, excerpt, body) values
-- (1, 'Darth Vader 1', 'Darth Vader 1 excerpt', 'Darth Vader 1 body'),
-- (1, 'Darth Vader 2', 'Darth Vader 2 excerpt', 'Darth Vader 2 body'),
-- (1, 'Darth Vader 3', 'Darth Vader 3 excerpt', 'Darth Vader 3 body'),
-- (1, 'Darth Vader 4', 'Darth Vader 4 excerpt', 'Darth Vader 4 body'),
-- (1, 'Darth Vader 5', 'Darth Vader 5 excerpt', 'Darth Vader 5 body'),
-- (2, 'Luke Skywalker 1', 'Luke Skywalker 1 excerpt', 'Luke Skywalker 1 body'),
-- (2, 'Luke Skywalker 2', 'Luke Skywalker 2 excerpt', 'Luke Skywalker 2 body'),
-- (3, 'Leia Organa 1', 'Leia Organa 1 excerpt', 'Leia Organa 1 body'),
-- (5, 'Admiral Ackbar 1', 'Admiral Ackbar 1 excerpt', 'Admiral Ackbar 1 body'),
-- (6, 'Han Solo 1', 'Han Solo 1 excerpt', 'Han Solo 1 body');
