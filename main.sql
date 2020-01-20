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
	first_name text not null,
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


-- insert into organization ("name") values ('Rebellion');
-- select * from organization;

-- insert into person (first_name, last_name, organization_id)
-- values ('Luke', 'Skywalker', null), ('Leia', 'Organa', 1);
-- select * from person;
