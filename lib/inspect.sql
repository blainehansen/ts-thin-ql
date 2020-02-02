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

select array_to_json(array(
	select json_build_object(
 		'table_oid', tab.oid :: int,
 		'name', tab.relname,
 		'columns', columns.columns,
 		'constraints', "constraints"."constraints",
 		'grants', grants.grants
 		-- 'policies', policies.policies
 	) as source

	from
		pg_catalog.pg_class as tab
		join pg_catalog.pg_namespace as namespace
			on tab.relnamespace = namespace.oid

		cross join lateral (select array_to_json(array(
			select json_build_object(
				'grantee', roles.rolname,
				'privilege_type', _acl.privilege_type,
				'is_grantable', _acl.is_grantable
			)
			from (
				select
					(aclexplode(tab.relacl)).grantee as grantee,
					(aclexplode(tab.relacl)).privilege_type as privilege_type,
					(aclexplode(tab.relacl)).is_grantable as is_grantable
			) as _acl
			join pg_catalog.pg_roles roles
				on roles.oid = _acl.grantee
			-- where roles.rolname != 'experiment_user'
		)) as grants) as grants

		cross join lateral (select array_to_json(array(
			select json_build_object(
				'name', col.attname,
				'column_number', col.attnum,
				'nullable', not col.attnotnull,
				'grants', grants.grants,
				'default_value_expression', pg_get_expr(def.adbin, tab.oid),
				'type_name', typ.typname,
				'type_length', typ.typlen,
				'type_type', typ.typtype
			)

			from
				pg_catalog.pg_attribute as col
				join pg_catalog.pg_type as typ
					on col.atttypid = typ.oid
				left join pg_catalog.pg_attrdef as def
					on def.adrelid = tab.oid
					and def.adnum = col.attnum

				cross join lateral (select array_to_json(array(
					select json_build_object(
						'grantee', roles.rolname,
						'privilege_type', _acl.privilege_type,
						'is_grantable', _acl.is_grantable
					)
					from (
						select
							(aclexplode(col.attacl)).grantee as grantee,
							(aclexplode(col.attacl)).privilege_type as privilege_type,
							(aclexplode(col.attacl)).is_grantable as is_grantable
					) as _acl
					join pg_catalog.pg_roles roles
						on roles.oid = _acl.grantee
					-- where roles.rolname != 'experiment_user'
				)) as grants) as grants

			where
				col.attrelid = tab.oid
				and not col.attisdropped
				and typ.typname not in ('xid', 'cid', 'oid', 'tid')

		)) as columns) as columns

		-- cross join lateral (select array_to_json(array(
		-- 	select json_build_object(
		-- 		'permissive', pol.polpermissive,
		-- 		'roles', pol.polroles,
		-- 		'command_type', pol.polcmd,
		-- 		'security_barrier_expression', pg_get_expr(pol.polqual, tab.oid),
		-- 		'with_check_expression', pg_get_expr(pol.polwithcheck, tab.oid)
		-- 	)
		-- 	from
		-- 		pg_catalog.pg_policy as pol
		-- 	where
		-- 		tab.relrowsecurity is true
		-- 		and tab.oid = pol.polrelid
		-- )) as policies) as policies

		cross join lateral (select array_to_json(array(
			select json_build_object(
				-- 'name', cons.conname,
				-- contype: c = check constraint, f = foreign key constraint, p = primary key constraint, u = unique constraint, t = constraint trigger, x = exclusion constraint
				'type', cons.contype,
				'constrained_column_numbers', coalesce(cons.conkey, '{}'),
				'referred_column_numbers', coalesce(cons.confkey, '{}'),

				'referred_table_oid', cons.confrelid :: int,

				'check_constraint_expression', pg_get_expr(cons.conbin, cons.conrelid)
			)
			from
				pg_catalog.pg_constraint as cons
			where cons.conrelid = tab.oid
		)) as "constraints") as "constraints"

	where
		namespace.nspname = 'public'
		and tab.relkind in ('r', 'v', 'm', 'p')
))
