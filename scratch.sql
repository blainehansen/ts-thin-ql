select
	root.root_field as root_field,
	json_agg(row_to_json("right"))->1 as "right",
	json_agg(row_to_json(b)) as b
from
	root as root
	left join lateral (
		select "right".right_field as right_field
		from
			"right" as "right"

		where (root.right_id = "right".id)
	) as "right" on true

	left join lateral (
		select b.b_field as b_field, row_to_json(c) as c
		from
			b as b
			left join lateral (
				select c.c_field as c_field
				from
					c as c
				where (b.id = c.b_id)
			) as c on true
		where (root.id = b.root_id)

	) as b on true

group by root.id
