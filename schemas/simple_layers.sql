create table first_level (
	id serial primary key,
	word text not null
);

create table second_level (
	id serial primary key,
	word text not null,
	first_level_id int not null references first_level
);

create table third_level (
	id serial primary key,
	word text not null,
	second_level_id int not null references second_level
);


insert into first_level (word)
select word
from (select generate_series(1, 8) as nums, random_text() as word) vals;

insert into second_level (word, first_level_id)
select word, first_level_id
from (select generate_series(1, 20) as nums, random_text() as word, random_between(1, 8) as first_level_id) vals;

insert into third_level (word, second_level_id)
select word, second_level_id
from (select generate_series(1, 80) as nums, random_text() as word, random_between(1, 20) as second_level_id) vals;
