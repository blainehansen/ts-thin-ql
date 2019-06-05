create extension citext;
create domain email as citext
	check ( value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$' );

create table person (
	id serial primary key,
	first_name text,
	last_name text,
	email email not null unique,
	email_verified boolean not null default false,
	hashed_password text not null
);

-- create type entry_type as enum (
-- 	'question', 'answer', 'comment'
-- );

-- create table site_entry (
-- 	id serial primary key,
-- 	body text not null,
-- 	entry_type entry_type not null
-- 	person_id int not null references person
-- );

create table question (
	id serial primary key,
	title text not null,
	body text not null,
	person_id int not null references person
);
create table question_comment (
	id serial primary key,
	body text not null,
	person_id int not null references person,
	question_id int not null references question
);

create table answer (
	id serial primary key,
	body text not null,
	person_id int not null references person,
	question_id int not null references question
);
create table answer_comment (
	id serial primary key,
	body text not null,
	person_id int not null references person,
	answer_id int not null references question
);


create table tag (
	id serial primary key,
	name_text text not null,
	description text,
	is_category boolean not null default false
);

create table question_tag (
	tag_id int not null references tag,
	question_id int not null references question,
	primary key (tag_id, question_id)
);


create table question_vote (
	question_id int not null references question,
	person_id int not null references person,
	primary key (question_id, person_id),
	is_upvote boolean not null
);

create table answer_vote (
	answer_id int not null references answer,
	person_id int not null references person,
	primary key (answer_id, person_id),
	is_upvote boolean not null
);

create table question_star (
	question_id int not null references question,
	person_id int not null references person,
	primary key (question_id, person_id)
);

create function person_reputation(person person) returns int as $$
	select
		(a.num + b.num + c.num + d.num) :: int
	from
		(select 5 * count(*) as num from question_vote where person_id = person.id and is_upvote is true) as a
		join (select -1 * count(*) as num from question_vote where person_id = person.id and is_upvote is false) as b on true
		join (select 20 * count(*) as num from answer_vote where person_id = person.id and is_upvote is true) as c on true
		join (select -1 * count(*) as num from answer_vote where person_id = person.id and is_upvote is false) as d on true;
$$ language sql stable;
