-- select
-- 	root.root_field as root_field,
-- 	json_agg(row_to_json("right"))->1 as "right",
-- 	json_agg(row_to_json(b)) as b
-- from
-- 	root as root
-- 	left join lateral (
-- 		select "right".right_field as right_field
-- 		from
-- 			"right" as "right"

-- 		where (root.right_id = "right".id)
-- 	) as "right" on true

-- 	left join lateral (
-- 		select b.b_field as b_field, row_to_json(c) as c
-- 		from
-- 			b as b
-- 			left join lateral (
-- 				select c.c_field as c_field
-- 				from
-- 					c as c
-- 				where (b.id = c.b_id)
-- 			) as c on true
-- 		where (root.id = b.root_id)

-- 	) as b on true

-- group by root.id



prepare thing as
select json_agg(json_build_object('id', through_table.id, 'word', through_table.word) order by through_table.id) as through_table
from
	through_table as through_table

limit 3


-- prepare __cq_query_a_results (text) as

-- select json_build_object('a_value', a_results.a_field, 'through_table', through_table.through_table) as a_results
-- from
-- 	a_table as a_results
-- 	left join lateral (
-- 		select json_agg(json_build_object('id', through_table.id, 'word', through_table.word, 'b_record', b_record.b_record)) as through_table
-- 		from
-- 			through_table as through_table
-- 			left join lateral (
-- 				select json_build_object('id', b_record.id, 'b_value', b_record.b_field) as b_record
-- 				from
-- 					b_table as b_record

-- 				where (through_table.b_id = b_record.id) and (b_record.b_field = $1)

-- 			) as b_record on true

-- 		where (a_results.id = through_table.a_id)
-- 		order by id asc
-- 		limit 3

-- 	) as through_table on true

-- where a_results.id = 1
-- ;
