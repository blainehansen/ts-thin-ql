@param

-- prepare __insert_query_function (jsonb) as

-- this has to be an ordering of a dag

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
	) returning id
)

select id from new_parent;
