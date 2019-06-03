prepare __cq_query_a_results (text) as

select
	json_build_object(
		'a_value', a_results.a_field,
		'through_table', through_table.through_table
	) as a_results
from
	a_table as a_results

	left join lateral (
		select
			json_agg(json_build_object(
			'id', through_table.id,
			'word', through_table.word,
			'b_record', b_record.b_record
		) order by id asc) as through_table

		from
			through_table as through_table
			inner join lateral (
				select
					json_build_object(
						'id', b_record.id,
						'b_value', b_record.b_field
					) as b_record
				from
					b_table as b_record
				where (through_table.b_id = b_record.id) and (b_record.b_field = $1)
			) as b_record on true

		where (a_results.id = through_table.a_id)
		limit 3

	) as through_table on true

limit 1
-- where a_results.id = 1
;

-- bzm
-- cmw
-- lew
-- xwq
-- uqc
-- yeg
-- qkp
-- wbx
execute __cq_query_a_results ('lew');
