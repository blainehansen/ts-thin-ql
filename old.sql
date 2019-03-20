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


prepare __insert_query_function (jsonb) as
with
new_parent as (
	insert into parent (parent_name, level) (
		select parent_name, level
		from jsonb_populate_record(null::parent, $1)
	) returning id
),
new_child as (
	insert into child (child_name, parent_id) (
		select child_thing.child_name, new_parent.id
		from jsonb_populate_record(null::child, $1->'child') as child_thing
		join new_parent on true
		join (select $1 ? 'child' as has_child) as has_child on true
		where has_child.has_child is true
	)
)
select id from new_parent;




-- insert funcName: table_name(child(some_further), -some_disallowed_column, right(further))
with
insert_table_name as (insert into table_name returning id)

insert_child as (
	with total_children as (
		select elem from jsonb_array_elements($1#>'{"children"}')
	)

	with insert_child as (
		insert into child (parent_id, child_name) (
			select insert_table_name.id, child_object.child_name
			-- since the thing above us is the referred and we're not unique
			-- we have to populate many from an array
			from jsonb_populate_recordset(null::child, $1#>'{"children"}')
			join insert_table_name on true
			join (select ($1 #> '{"children"}') is null as has_children) on true
			where has_children.has_children is true
			-- we have to not only return id, but the index in the original list
			returning
		)
	)
	insert into some_further (child_id)
)


-- use this for expected arrays
-- jsonb_populate_recordset(base anyelement, from_json jsonb)



-- select insert_new_parent('{ "parent_name": "dude", "level": 1, "child": { "child_name": "child" } }');
-- select insert_new_parent('{ "parent_name": "other", "level": 1 }');

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
