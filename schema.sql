create function random_text() returns text as $$
	select array_to_string(array(select chr((97 + round(random() * 25)) :: integer)
	from generate_series(1, 3)), '');
$$ language sql strict;

create function random_between(low int, high int) returns int as $$
begin
	return floor(random() * (high - low + 1) + low);
end;
$$ language plpgsql strict;



create table a_table (
	id serial primary key,
	a_field text
);

create table b_table (
	id serial primary key,
	b_field text
);

create table through_table (
	id serial primary key,
	a_id int references a_table(id),
	b_id int references b_table(id),
	word text
	-- primary key (a_id, b_id)
);



-- insert into a_table (a_field)
-- select a_field
-- from (select generate_series(1, 8) as nums, random_text() as a_field) vals;

-- insert into b_table (b_field)
-- select b_field
-- from (select generate_series(1, 8) as nums, random_text() as b_field) vals;

-- insert into through_table (a_id, b_id, word)
-- select a_id, b_id, word
-- from (select generate_series(1, 20) as nums, random_between(1, 8) as a_id, random_between(1, 8) as b_id, random_text() as word) vals
-- on conflict do nothing;


-- query thing: through_table [
-- 	word
-- 	b_table {
-- 		b_field
-- 	}
-- ]
-- select through_table.word, json_agg(row_to_json(b_table))->0 as b_table
-- from
-- 	through_table
-- 	left join lateral (
-- 		select b_field from b_table where through_table.b_id = b_table.id
-- 	) as b_table on true
-- group by through_table.id;




-- -- not actually complex but serves the goal
-- create view complex_join as
-- select a_table.*, b_table.id as b_id, b_table.b_field
-- from
-- 	a_table
-- 	left join through_table on a_table.id = through_table.a_id
-- 	left join b_table on through_table.b_id = b_table.id
-- ;

-- -- query thing: complex_join [
-- -- 	a_field
-- -- 	@cluster b_table [
-- -- 		b_field
-- -- 	]
-- -- ]
-- select id, a_field, json_agg(json_build_object('b_field', b_field))
-- from complex_join
-- group by 1, 2;


-- -- query thing: a_table [
-- -- 	a_field
-- -- 	through_table.b_table [
-- -- 		b_field
-- -- 	]
-- -- ]
-- select a_table.a_field, json_agg(row_to_json(b_table)) as b_table
-- from
-- 	a_table
-- 	inner join through_table on a_table.id = through_table.a_id
-- 	inner join lateral (
-- 		select b_field
-- 		from
-- 			b_table
-- 		where
-- 			through_table.b_id = b_table.id
-- 	) as b_table on true
-- group by a_table.id;




-- query thing: a_table [
-- 	a_field
-- 	through_table.b_table [
-- 		b_field
-- 	]
-- ]
-- select a_table.a_field, json_agg(row_to_json(b_table)) as b_table
-- from
-- 	a_table
-- 	left join lateral (
-- 		select b_table.b_field
-- 		from
-- 			through_table
-- 			left join b_table on through_table.b_id = b_table.id
-- 		where
-- 			a_table.id = through_table.a_id
-- 			and through_table.b_id = b_table.id
-- 	) as b_table on true
-- group by a_table.id;


-- select a_table.a_field, coalesce(json_agg(row_to_json(b_table)), '[]') as b_table
-- from
-- 	a_table
-- 	left join through_table on a_table.id = through_table.a_id
-- 	left join b_table on through_table.b_id = b_table.id
-- group by a_table.id;

-- query thing: a_table(@exists: b_table) [
-- 	a_field
-- 	b_table: through_table.b_table [
-- 		b_field
-- 	]
-- ]
-- now trying for an exists path
-- explain select a_table.a_field, json_agg(row_to_json(b_table)) as b_table
-- from
-- 	a_table
-- 	inner join through_table on a_table.id = through_table.a_id
-- 	inner join b_table on through_table.b_id = b_table.id
-- group by a_table.id;
