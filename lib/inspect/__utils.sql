create function pg_temp.construct_type(typname name, typtype char) returns jsonb as $$
	select case typtype
		when 'b' then to_jsonb(typname)
		when 'e' then jsonb_build_object('enum_name', typname)
		when 'c' then jsonb_build_object('class_name', typname)
		when 'p' then jsonb_build_object('unknown', true)
	end
$$ language sql stable strict;

create function pg_temp.construct_full_type(
	is_array bool, typname name, typtype char,
	arr_typname name, arr_typtype char
) returns jsonb as $$
	select case is_array
		when false then construct_type(typname :: name, typtype :: char)
		when true then jsonb_build_object(
			'inner_type', construct_type(arr_typname :: name, arr_typtype :: char)
		)
	end
$$ language sql stable;
