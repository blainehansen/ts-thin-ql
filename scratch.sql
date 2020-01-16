-- takeaways:
-- if a nested thing is a "many", then @inner won't work
-- you instead have to add a where clause to the parent of the nested thing that compares the nested thing to an empty array

-- https://dba.stackexchange.com/questions/213592/how-to-apply-order-by-and-limit-in-combination-with-an-aggregate-function
-- https://dba.stackexchange.com/questions/173831/convert-right-side-of-join-of-many-to-many-into-array/173879#173879


-- two scenarios for @inner:
-- nested thing is singular, then you can just use an inner join
-- nested thing is plural, then you can still use

-- the rest of the time, just use cross

explain select array_to_json(array(
	select
		json_build_object(
			'id', people.id, 'first_name', people.first_name, 'last_name', people.last_name, 'posts', posts.posts
		) as people
	from person as people
	cross join lateral (

		select array_to_json(array(
			select
				json_build_object(
					'id', posts.id, 'title', posts.title, 'excerpt', posts.excerpt
				) as posts
			from
				post as posts
			where (people.id = posts.person_id)
		)) as posts

	) as posts

	-- where json_array_length(posts.posts) != 0
	limit 2
)) :: text as people


select json_agg(json_build_object(
	'id', people.id, 'first_name', people.first_name, 'last_name', people.last_name, 'posts', posts.posts
)) :: text as people
from
	(select * from person limit 2) as people
	left join lateral (
		select json_agg(json_build_object('id', posts.id, 'title', posts.title, 'excerpt', posts.excerpt)) :: text as posts
		from
			(select * from post limit 1) as posts
		where (people.id = posts.person_id)
	) as posts on true




prepare thing as
select json_agg(json_build_object('id', through_table.id, 'word', through_table.word) order by through_table.id) as through_table
from
	through_table as through_table

with element as (
	select * from jsonb_array_elements(
		'[{"child_name": 1, "nested": {"b": "b"}}, {"child_name": 2, "nested": {"b": "b"}}, {"child_name": 3, "nested": {"b": "b"}}]'
	) as record(child_name int)
)
select *
from json_to_record(element);



select pg_typeof((select (through_table.a_id + through_table.b_id) :: smallint from through_table limit 1));




-- jsonb_populate_recordset(
-- 	'[{"child_name": "a", "parent_id": 1}, {"child_name": "a", "parent_id": 1}, {"child_name": "a", "parent_id": 1}]'::jsonb
-- )


prepare __cq_query_a_results (text) as

select json_build_object('a_value', a_results.a_field, 'through_table', through_table.through_table) as a_results
from
	a_table as a_results
	left join lateral (
		select json_agg(json_build_object('id', through_table.id, 'word', through_table.word, 'b_record', b_record.b_record)) as through_table
		from
			through_table as through_table
			left join lateral (
				select json_build_object('id', b_record.id, 'b_value', b_record.b_field) as b_record
				from
					b_table as b_record

				where (through_table.b_id = b_record.id) and (b_record.b_field = $1)

			) as b_record on true

		where (a_results.id = through_table.a_id)
		order by id asc
		limit 3

	) as through_table on true

where a_results.id = 1
;






































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
-- with
-- insert_table_name as (insert into table_name returning id)

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



select insert_new_parent('{ "parent_name": "dude", "level": 1, "child": { "child_name": "child" } }');
select insert_new_parent('{ "parent_name": "other", "level": 1 }');

insert into parent (parent_name, level) values ('guy', 1);
select patch_parent_with_child('{ "id": 1, "parent_name": "dude" }');
select patch_parent_with_child('{ "id": 1, "parent_name": null }');
select patch_parent_with_child('{ "id": 1 }');




create function put_parent(payload jsonb) returns void
as $$
	update parent set parent_name = incoming.parent_name
	from jsonb_populate_record(null::parent, payload) incoming
	where parent.id = incoming.id;
$$ language sql;

create function patch_parent(payload jsonb) returns void
as $$
	update parent
		set
			parent_name = case when payload ? 'parent_name' then incoming.parent_name else parent.parent_name end
	from jsonb_populate_record(null::parent, payload) incoming
	where parent.id = incoming.id;
$$ language sql;
