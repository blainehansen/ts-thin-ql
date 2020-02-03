prepare _inspect_types (target_namespace text) as
select array_to_json(array(
	select jsonb_build_object(
		'name', typname,
		'definition', case typtype

			when 'e' then (select array_to_json(array(
				select to_jsonb(enumlabel)
				from pg_enum
				where typ.oid = enumtypid
			)))

			when 'c' then (select array_to_json(array(
				select jsonb_build_object(
					'name', col.attname,
					'type', construct_full_type(
						_typ.typelem != 0, _typ.typname :: name, _typ.typtype :: char,
						arr_typ.typname :: name, arr_typ.typtype :: char
					)
				)

				from
					pg_class as tab
					pg_attribute as col
						on tab.oid = col.attrelid
						and not col.attisdropped
					join pg_type as _typ
						on col.atttypid = _typ.oid
						and _typ.typname not in ('xid', 'cid', 'oid', 'tid')
					left join pg_type as arr_typ
						on nullif(_typ.typelem, 0) = arr_typ.oid
				where
					typ.typrelid = tab.oid and tab.relkind = 'c'
			)))
		end
	)
	from
		pg_type typ
		join pg_namespace as namespace
			on typ.typnamespace = namespace.oid

	where
		-- typ.typtype in ('e', 'c', 'd')
		typ.typtype in ('e', 'c')
		and namespace.nspname = target_namespace
		and not exists (
			select from
				pg_class as tab
				join pg_namespace as namespace
					on tab.relnamespace = namespace.oid
			where typ.typrelid = tab.oid and relkind != 'c'
		)
)) as results

-- execute _inspect_types('public')
