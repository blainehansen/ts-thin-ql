create table first_level (
	id serial primary key,
	word text not null
);

create table second_level (
	id serial primary key,
	word text not null,
	first_level_id int not null references first_level(id)
);
create index fk_idx_second_first on second_level (first_level_id);

create table third_level (
	id serial primary key,
	word text not null,
	second_level_id int not null references second_level(id)
);
create index fk_idx_third_second on third_level (second_level_id);


create function random_text() returns text as $$
	select array_to_string(array(select chr((97 + round(random() * 25)) :: integer)
	from generate_series(1, 3)), '');
$$ language sql strict;

create function random_between(low int, high int) returns int as $$
begin
	return floor(random() * (high - low + 1) + low);
end;
$$ language plpgsql strict;


insert into first_level (word)
select word
from (select generate_series(1, 8) as nums, random_text() as word) vals;

insert into second_level (word, first_level_id)
select word, first_level_id
from (select generate_series(1, 20) as nums, random_text() as word, random_between(1, 8) as first_level_id) vals;

insert into third_level (word, second_level_id)
select word, second_level_id
from (select generate_series(1, 80) as nums, random_text() as word, random_between(1, 20) as second_level_id) vals;


select json_agg(row_to_json(total)) from (
	select first_level.*, json_agg(row_to_json(second_level)) as second_level
	from
		first_level
		left join (
			select second_level.*, json_agg(row_to_json(third_level)) as third_level
			from
				second_level
				left join third_level on second_level.id = third_level.second_level_id
			group by second_level.id
		)
		second_level on first_level.id = second_level.first_level_id
	group by first_level.id
) total;

-- every level will have an "existence join path"
-- it will basically be a route from that level downwards to something that has to exist
-- if such a path exists, the route will be converted to an inner join rather than left
-- and if the join already exists, the join conditions for that table will be added to that join




explain select first_level.*, json_agg(row_to_json(second_level)) as second_level
from
	first_level
	left join lateral
		(select second_level.* from second_level where first_level.id = second_level.first_level_id) as second_level on true
group by first_level.id;




explain select first_level.*, json_agg(row_to_json(second_level)) as second_level
from
	first_level
	left join second_level on first_level.id = second_level.first_level_id
group by first_level.id;


-- explain select json_agg(row_to_json(total)) from (
-- 	select first_level.*, json_agg(row_to_json(second_level)) as second_level
-- 	from
-- 		first_level
-- 		left join lateral
-- 			(select second_level.* from second_level where first_level.id = second_level.first_level_id) as second_level on true
-- 	group by first_level.id
-- ) total;
