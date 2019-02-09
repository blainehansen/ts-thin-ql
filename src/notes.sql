-- we have a single join (this points to that, or that points to this but has a unique constraint)
-- we have a multiple join (that points to this)



-- query thing: a_table [
-- 	a_field
-- 	through_table.b_table [
-- 		b_field
-- 	]
-- 	-- only one
-- 	normal_table {
-- 		normal_field
-- 	}
-- 	normal_many [
-- 		normal_many_field
-- 		normal_many_nested [
-- 			nested_field
-- 		]
-- 	]
-- ]
select a_field, json_agg(b_table), row_to_json(normal_table), json_agg(normal_many)
from
	a_table
	left join through_table on through_table.a_id = a_table.id
	left join lateral (
		select b_field
		from b_table
		where through_table.b_id = b_table.id
	) as b_table on true

	left join lateral (
		select normal_field
		from
			normal_table
	) as normal_table on a_table.normal_id = normal_table.id

	left join lateral (
		select normal_many_field, json_agg(normal_many_nested)
		from
			normal_many
			left join normal_many_nested on normal_many.id = normal_many_nested.normal_many_id

	) as normal_many on a_table.id = normal_many.a_id

group by a_table.id





-- query thing: a_table [
-- 	a_field
-- 	through_table.b_table [
-- 		b_field
-- 	]
-- ]
-- this works
select a_table.a_field, json_agg(row_to_json(b_table)) as b_table
from
	a_table
	left join lateral (
		select b_table.b_field
		from
			through_table
			left join b_table on through_table.b_id = b_table.id
		where
			a_table.id = through_table.a_id
			and through_table.b_id = b_table.id
	) as b_table on true
group by a_table.id;


select first_level.*, json_agg(row_to_json(second_level)) as second_level
from
	first_level as first_level
	left join lateral (
		-- the entire select from region is the responsibility of the block
		select second_level.*, json_agg(row_to_json(third_level)) as third_level
		from
			second_level as second_level

		-- the parent provides (or at least has information about),
		-- the join condition
		where first_level.id = second_level.first_level_id
		-- here is where filter arguments go
		group by second_level.id
	) as second_level on true

group by first_level.id



select first_level.*, json_agg(row_to_json(second_level)) as second_level
from
	first_level as first_level
	left join lateral (
		select second_level.*, json_agg(row_to_json(third_level)) as third_level
		from
			second_level as second_level
			left join lateral (
				select third_level.*
				from third_level as third_level
				where second_level.id = third_level.second_level_id
			) as third_level on true

		where first_level.id = second_level.first_level_id
		group by second_level.id
	) as second_level on true

group by first_level.id
