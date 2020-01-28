-- https://www.postgresql.org/docs/12/catalogs.html
-- https://www.postgresql.org/docs/12/catalog-pg-class.html
-- https://www.postgresql.org/docs/12/catalog-pg-constraint.html
-- https://www.postgresql.org/docs/12/catalog-pg-attribute.html
-- https://www.postgresql.org/docs/12/catalog-pg-type.html
-- https://www.postgresql.org/docs/12/catalog-pg-policy.html
-- https://www.postgresql.org/docs/12/view-pg-roles.html
-- https://www.postgresql.org/docs/12/ddl-rowsecurity.html

-- https://stackoverflow.com/questions/41930335/how-to-show-postgresql-expression-type

-- to get enums
-- select t.typname as enum_name, e.enumlabel as enum_value from pg_type t join pg_enum e on t.oid = e.enumtypid
-- select t.typname as enum_name, array_agg(e.enumlabel) as enum_values from pg_type t join pg_enum e on t.oid = e.enumtypid group by enum_name

-- to get functions
-- select
-- 	proname, proowner, prolang, prokind, proisstrict, proretset, provolatile, prorettype, proargtypes
-- from
-- 	pg_catalog.pg_proc fn
-- 	join pg_catalog.pg_namespace as namespace
-- 		on fn.pronamespace = namespace.oid
-- 	join pg_catalog.pg_authid as own
-- 		on fn.proowner = own.oid
-- where
-- 	namespace.nspname = 'public'
-- 	and own.rolname = 'experiment_user'

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
				-- 'has_default_value', col.atthasdef,
				'default_value_expression', pg_get_expr(def.adbin, tab.oid),
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
				-- contype: c = check constraint, f = foreign key constraint, p = primary key constraint, u = unique constraint, t = constraint trigger, x = exclusion constraint
				'type', cons.contype,
				'constrained_column_numbers', coalesce(cons.conkey, '{}'),
				'referred_column_numbers', coalesce(cons.confkey, '{}'),

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
