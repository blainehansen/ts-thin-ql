drop schema public cascade;
create schema public;
grant all on schema public to public;
comment on schema public is 'standard public schema';




create type goodness_enum as enum ('good', 'neutral', 'evil');
create type lawfulness_enum as enum ('lawful', 'neutral', 'chaotic');
create type alignment_type as (goodness goodness_enum, lawfulness lawfulness_enum);

create table organization (
	id serial primary key,
	"name" text not null,
	alignment alignment_type
);

create table person (
	id serial primary key,
	first_name text,
	last_name text,
	preferred_weapons text[] not null default '{}',
	organization_id int references organization on delete cascade
);

create function full_name(person person) returns text as $$
	select person.first_name || ' ' || person.last_name
$$ language sql immutable strict;

-- create table vehicle (
-- 	id serial primary key,
-- 	"name" text not null,
-- 	person_id int unique not null references person on delete cascade
-- );

-- create table post (
-- 	id serial primary key,
-- 	person_id int not null references person on delete cascade,
-- 	title text not null,
-- 	excerpt text,
-- 	body text
-- );


-- create view people as
-- select person.*, vehicle."name" as vehicle
-- from person join vehicle on person.id = vehicle.person_id;

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


-- create materialized view posts as
-- select post.id, title, excerpt, body, person.id as author_id, person.first_name || ' ' || person.last_name as author
-- from post join person on post.person_id = person.id;


create type counted_org as (id int, "name" text, count_members bigint);
create function organization_people() returns setof counted_org
as $$
	select organization.id, "name", count(person.id) as count_members
	from organization join person on organization.id = organization_id
	group by organization.id
$$ language sql stable strict;

create function repeat_text(msg text, a int, b bool) returns text
as $$
	select msg || ' is repeated ' || a :: text || ' times' || case b when true then ' right?' else '' end
$$ language sql immutable strict;
