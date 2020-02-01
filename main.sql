-- drop schema public cascade;
-- create schema public;
-- grant all on schema public to experiment_user;
-- grant all on schema public to public;
-- comment on schema public is 'standard public schema';

create role dude login;

create table organization (
	id serial primary key,
	"name" text not null
);
grant select on organization to dude;
grant update ("name") on organization to dude;

create table person (
	id serial primary key,
	first_name text,
	last_name text,
	preferred_weapons text[] not null default '{}',
	organization_id int references organization on delete cascade
);
grant select on person to dude;

create table vehicle (
	id serial primary key,
	"name" text not null,
	person_id int unique not null references person on delete cascade
);
grant select on vehicle to dude;

create table post (
	id serial primary key,
	person_id int not null references person on delete cascade,
	title text not null,
	excerpt text,
	body text
);
grant select on post to dude;


-- select
-- 	relname, aclexplode(relacl)
-- from
-- 	pg_catalog.pg_class as tab
-- 	join pg_catalog.pg_namespace as namespace
-- 		on tab.relnamespace = namespace.oid
-- where
-- 	namespace.nspname = 'public'
-- 	and tab.relkind in ('r', 'v', 'm', 'p')

-- set role dude;

-- select * from organization;
-- select * from person;
-- select * from vehicle;
-- select * from post;

-- insert into person (first_name) values ('Dude');
