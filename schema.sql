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



insert into a_table (a_field)
select a_field
from (select generate_series(1, 8) as nums, random_text() as a_field) vals;

insert into b_table (b_field)
select b_field
from (select generate_series(1, 8) as nums, random_text() as b_field) vals;

insert into through_table (a_id, b_id, word)
select a_id, b_id, word
from (select generate_series(1, 20) as nums, random_between(1, 8) as a_id, random_between(1, 8) as b_id, random_text() as word) vals
on conflict do nothing;
