-- https://www.postgresql.org/docs/10/catalogs.html
-- https://www.postgresql.org/docs/10/catalog-pg-class.html
-- https://www.postgresql.org/docs/10/catalog-pg-constraint.html
-- https://www.postgresql.org/docs/10/catalog-pg-attribute.html
-- https://www.postgresql.org/docs/10/catalog-pg-type.html
-- https://www.postgresql.org/docs/10/catalog-pg-policy.html
-- https://www.postgresql.org/docs/10/view-pg-roles.html
-- https://www.postgresql.org/docs/10/ddl-rowsecurity.html

-- https://stackoverflow.com/questions/41930335/how-to-show-postgresql-expression-type

select
	jsonb_agg(json_build_object(
 		'table_oid', tab.oid :: int,
 		'name', tab.relname,
 		'access_control_items', coalesce(tab.relacl, '{}'),
 		-- select (aclexplode(relacl)).grantor, (aclexplode(relacl)).grantee, (aclexplode(relacl)).privilege_type, (aclexplode(relacl)).is_grantable from pg_class tab where relacl is not null and tab.oid = 16487;

 		-- so for these embedded things,
 		-- the displayName of the thing is simply used twice
 		-- the actual name is only used inside in the from
 		'columns', columns.columns,
 		'constraints', "constraints"."constraints",
 		'policies', policies.policies
 	)) as source

from
	pg_catalog.pg_class as tab
	join pg_catalog.pg_namespace as namespace
		on tab.relnamespace = namespace.oid

	left join lateral (
		select
			json_agg(json_build_object(
				'permissive', pol.polpermissive,
				'roles', pol.polroles,
				'command_type', pol.polcmd,
				'security_barrier_expression', pg_get_expr(pol.polqual, tab.oid),
				'with_check_expression', pg_get_expr(pol.polwithcheck, tab.oid)
			)) as policies

		from
			pg_catalog.pg_policy as pol
		where
			tab.relrowsecurity is true
			and tab.oid = pol.polrelid
	) as policies on true

	join lateral (
		select
			json_agg(json_build_object(
				'name', col.attname,
				'column_number', col.attnum,
				'nullable', not col.attnotnull,
				'access_control_items', coalesce(col.attacl, '{}'),
				'has_default_value', col.atthasdef,
				'default_value', pg_get_expr(def.adbin, tab.oid),
				'type_name', typ.typname,
				'type_length', typ.typlen,
				'type_type', typ.typtype
			)) as columns

		from
			pg_catalog.pg_attribute as col
			join pg_catalog.pg_type as typ
				on col.atttypid = typ.oid
			left join pg_catalog.pg_attrdef as def
				on def.adrelid = tab.oid
				and def.adnum = col.attnum
		where
			col.attrelid = tab.oid
			and not col.attisdropped
			and typ.typname not in ('xid', 'cid', 'oid', 'tid')

	) as columns on true

	join lateral (
		select
			json_agg(json_build_object(
				-- 'name', cons.conname,
				'type', cons.contype,
				'pointing_column_numbers', coalesce(cons.conkey, '{}'),
				'referred_column_numbers', coalesce(cons.confkey, '{}'),

				-- 'constrained_table_oid', cons.conrelid,
				'referred_table_oid', cons.confrelid :: int,

				'check_constraint_expression', pg_get_expr(cons.conbin, cons.conrelid)
			)) as "constraints"


		from
			pg_catalog.pg_constraint as cons

		where cons.conrelid = tab.oid

	) "constraints" on true

where
	namespace.nspname = 'public'
	and tab.relkind in ('r', 'v', 'm', 'p')

	-- left join pg_catalog.pg_attrdef as def
	-- 	on def.adrelid = tab.oid
	-- 	and def.adnum = col.attnum


-- select
-- 	tab.relname as table_name,

-- 	col.attrelid as table_oid,
-- 	col.attname as column_name,
-- 	-- col.attnum as column_number
-- 	col.attnotnull as not_null,
-- 	col.atthasdef as has_default_value,
-- 	pg_get_expr(def.adbin, tab.oid) as default_value,

-- 	-- col.attacl as access_control_items

-- 	typ.typname as type_name,
-- 	typ.typlen as type_length,
-- 	typ.typtype as type_type,

-- 	'{"name": "stuff"}'::jsonb as some_json

-- 	-- typ.typrelid as composite_type_table_oid,
-- 	-- typ.typarray as array_inner_type_oid,
-- 	-- typ.typelem as composite_type_type_oid,
-- 	left join pg_catalog.pg_attrdef as def
-- 		on def.adrelid = tab.oid
-- 		and def.adnum = col.attnum
-- from
-- 	pg_catalog.pg_attribute as col
-- 	join pg_catalog.pg_class as tab
-- 		on col.attrelid = tab.oid
-- 	join pg_catalog.pg_type as typ
-- 		on col.atttypid = typ.oid
-- 	left join pg_catalog.pg_attrdef as def
-- 		on def.adrelid = tab.oid
-- 		and def.adnum = col.attnum

-- where
-- 	col.attisdropped is not true
-- 	and tab.relnamespace = 2200
-- 	and tab.relkind in ('r', 'v', 'm', 'p')
-- 	and typ.typname not in ('xid', 'cid', 'oid', 'tid')


-- -- contype: c = check constraint, f = foreign key constraint, p = primary key constraint, u = unique constraint, t = constraint trigger, x = exclusion constraint


-- with unnested as (
-- 	select
-- 		tab.oid as table_oid
-- 		tab.relname as table_name,

-- 		col.attname as column_name,

-- 		cons.conname as c_name,
-- 		cons.contype as c_type,
-- 		-- unnest(cons.conkey) as constrained_column,
-- 		unnest(cons.confkey) as referenced_column
-- 		cons_col.atttypid as col_type

-- 		typname

-- 		typlen
-- 		typtype
-- 		-- 	typtype is b for a base type, c for a composite type (e.g., a table's row type), d for a domain, e for an enum type, p for a pseudo-type, or r for a range type. See also typrelid and typbasetype.

-- 	from
-- 		pg_catalog.pg_class as tab
-- 		join pg_catalog.pg_attribute as col
-- 			on tab.oid = col.attrelid
-- 		join pg_catalog.pg_type as typ
-- 			on col.atttypid = typ.oid
-- 		left join pg_catalog.pg_constraint as cons
-- 			on tab.oid = cons.conrelid

-- 	where tab.relkind in ('r', 'v', 'm', 'p')
-- )
-- select
-- 	unnested.*,
-- 	cons_col.attname as constrained_column_name,
-- 	ref_col.attname as referenced_column_name
-- from
-- 	unnested
-- 	-- left join pg_catalog.pg_attribute as cons_col
-- 	-- 	on cons_col.attrelid = unnested.table_oid
-- 	-- 	and cons_col.attnum = unnested.constrained_column
-- 	left join pg_catalog.pg_attribute as ref_col
-- 		on ref_col.attrelid = unnested.table_oid
-- 		and ref_col.attnum = unnested.referenced_column