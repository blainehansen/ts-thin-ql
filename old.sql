create function random_between(low int, high int) returns int as $$
begin
	return floor(random() * (high - low + 1) + low);
end;
$$ language plpgsql strict;

create function random_text() returns text as $$
	select array_to_string(array(select chr((97 + round(random() * 25)) :: integer)
	from generate_series(1, 3)), '');
$$ language sql strict;


create table parent (
	id serial primary key,
	parent_name text,
	level smallint not null
);

create table child (
	id serial primary key,
	child_name text,
	parent_id int not null references parent
);


create function insert_new_parent(payload jsonb) returns int
as $$
	with
	new_parent as (
		insert into parent (parent_name, level) (
			select parent_name, level from jsonb_populate_record(null::parent, payload)
		) returning id
	),
	new_child as (
		insert into child (child_name, parent_id) (
			select child_thing.child_name, new_parent.id from
			jsonb_populate_record(null::child, payload->'child') as child_thing
			join new_parent on true
			inner join (select payload ? 'child' as has_child) as has_child on true
			where has_child.has_child is true
		)
	)
	select id from new_parent;
$$ language sql;


select insert_new_parent('{ "parent_name" : "dude", "level": 1, "child": { "child_name": "child" } }');
select insert_new_parent('{ "parent_name" : "other", "level": 1 }');

-- insert into parent (parent_name, level) values ('guy', 1);
-- select patch_parent_with_child('{ "id": 1, "parent_name": "dude" }');
-- select patch_parent_with_child('{ "id": 1, "parent_name": null }');
-- select patch_parent_with_child('{ "id": 1 }');




-- create function put_parent(payload jsonb) returns void
-- as $$
-- 	update parent set parent_name = incoming.parent_name
-- 	from jsonb_populate_record(null::parent, payload) incoming
-- 	where parent.id = incoming.id;
-- $$ language sql;

-- create function patch_parent(payload jsonb) returns void
-- as $$
-- 	update parent
-- 		set
-- 			parent_name = case when payload ? 'parent_name' then incoming.parent_name else parent.parent_name end
-- 	from jsonb_populate_record(null::parent, payload) incoming
-- 	where parent.id = incoming.id;
-- $$ language sql;
