-- https://www.postgresql.org/docs/current/catalogs.html
-- https://www.postgresql.org/docs/current/catalog-pg-class.html
-- https://www.postgresql.org/docs/current/catalog-pg-constraint.html
-- https://www.postgresql.org/docs/current/catalog-pg-attribute.html
-- https://www.postgresql.org/docs/current/catalog-pg-type.html
-- https://www.postgresql.org/docs/current/catalog-pg-policy.html
-- https://www.postgresql.org/docs/current/catalog-pg-proc.html
-- https://www.postgresql.org/docs/current/ddl-priv.html
-- https://www.postgresql.org/docs/current/view-pg-roles.html
-- https://www.postgresql.org/docs/current/ddl-rowsecurity.html

-- https://stackoverflow.com/questions/41930335/how-to-show-postgresql-expression-type

prepare _inspect_tables (target_namespace text, excluded_admin text) as
select array_to_json(array(
	select jsonb_build_object(
 		'table_oid', tab.oid :: int,
 		'name', tab.relname,
 		'type', case tab.relkind
 			when 'r' then 'table' when 'v' then 'view'
 			when 'm' then 'materalized_view' when 'p' then 'partitioned_table'
 		end,
 		'columns', columns.columns,
 		'computed_columns', computed_columns.computed_columns,
 		'constraints', "constraints"."constraints",
 		'grants', grants.grants
 		-- 'policies', policies.policies
 	)

	from
		pg_class as tab
		join pg_namespace as namespace
			on tab.relnamespace = namespace.oid
			and namespace.nspname = target_namespace :: name

		cross join lateral (select array_to_json(array(
			select jsonb_build_object(
				'name', col.attname,
				'column_number', col.attnum,
				'nullable', not col.attnotnull,
				'grants', grants.grants,
				'default_value_expression', pg_get_expr(def.adbin, tab.oid),
				'type', pg_temp.construct_full_type(
					typ.typelem != 0, typ.typname :: name, typ.typtype :: char,
					arr_typ.typname :: name, arr_typ.typtype :: char
				)
			)

			from
				pg_attribute as col
				join pg_type as typ
					on col.atttypid = typ.oid
					and typ.typname not in ('xid', 'cid', 'oid', 'tid')
				left join pg_type as arr_typ
					on nullif(typ.typelem, 0) = arr_typ.oid
				left join pg_attrdef as def
					on def.adrelid = tab.oid
					and def.adnum = col.attnum

				cross join lateral (select array_to_json(array(
					select jsonb_build_object(
						'grantee', roles.rolname,
						'privilege_type', _acl.privilege_type,
						-- 'is_grantable', _acl.is_grantable
					)
					from (
						select
							(aclexplode(col.attacl)).grantee as grantee,
							(aclexplode(col.attacl)).privilege_type as privilege_type,
							-- (aclexplode(col.attacl)).is_grantable as is_grantable
					) as _acl
					join pg_roles roles
						on roles.oid = _acl.grantee
						and roles.rolname != excluded_admin :: name
					where _acl.privilege_type not in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
				)) as grants) as grants

			where
				tab.oid = col.attrelid
				and not col.attisdropped
		)) as columns) as columns

		cross join lateral (select array_to_json(array(
			select
				jsonb_build_object(
					'name', proname,
					'type', pg_temp.construct_full_type(
						typ.typelem != 0, typ.typname :: name, typ.typtype :: char,
						arr_typ.typname :: name, arr_typ.typtype :: char
					)
				)
			from
				pg_type as tabtyp
				join pg_proc
					on cardinality(proargtypes) = 1 and tabtyp.oid = proargtypes[0]
					and provolatile = 'i' and proisstrict = true
				join pg_type as typ
					on prorettype = typ.oid
				left join pg_type as arr_typ
					on nullif(typ.typelem, 0) = arr_typ.oid

			where tab.oid = tabtyp.typrelid
		)) as computed_columns) as computed_columns

		cross join lateral (select array_to_json(array(
			select jsonb_build_object(
				-- contype: c = check constraint, f = foreign key constraint, p = primary key constraint, u = unique constraint, t = constraint trigger, x = exclusion constraint
				'type', cons.contype,
				'constrained_column_numbers', coalesce(cons.conkey, '{}'),
				'referred_column_numbers', coalesce(cons.confkey, '{}'),

				'referred_table_oid', cons.confrelid :: int,

				'check_constraint_expression', pg_get_expr(cons.conbin, cons.conrelid)
			)
			from
				pg_constraint as cons
			where cons.conrelid = tab.oid
		)) as "constraints") as "constraints"

		cross join lateral (select array_to_json(array(
			select jsonb_build_object(
				'grantee', roles.rolname,
				'privilege_type', _acl.privilege_type,
				-- 'is_grantable', _acl.is_grantable
			)
			from (
				select
					(aclexplode(tab.relacl)).grantee as grantee,
					(aclexplode(tab.relacl)).privilege_type as privilege_type,
					-- (aclexplode(tab.relacl)).is_grantable as is_grantable
			) as _acl
			join pg_roles roles
				on roles.oid = _acl.grantee
				and roles.rolname != excluded_admin :: name
			where _acl.privilege_type not in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
		)) as grants) as grants

		-- cross join lateral (select array_to_json(array(
		-- 	select jsonb_build_object(
		-- 		'permissive', pol.polpermissive,
		-- 		'roles', pol.polroles,
		-- 		'command_type', pol.polcmd,
		-- 		'security_barrier_expression', pg_get_expr(pol.polqual, tab.oid),
		-- 		'with_check_expression', pg_get_expr(pol.polwithcheck, tab.oid)
		-- 	)
		-- 	from
		-- 		pg_policy as pol
		-- 	where
		-- 		tab.relrowsecurity is true
		-- 		and tab.oid = pol.polrelid
		-- )) as policies) as policies

	where tab.relkind in ('r', 'v', 'm', 'p')
)) as results

-- execute _inspect_tables('public', 'experiment_user')
