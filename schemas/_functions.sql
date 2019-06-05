create function random_between(low int, high int) returns int as $$
begin
	return floor(random() * (high - low + 1) + low);
end;
$$ language plpgsql strict;

create function random_text() returns text as $$
	select array_to_string(array(select chr((97 + round(random() * 25)) :: integer)
	from generate_series(1, 3)), '');
$$ language sql strict;
