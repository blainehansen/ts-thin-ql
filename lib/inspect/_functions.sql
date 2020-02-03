prepare _inspect_functions (target_namespace text, excluded_admin text) as
select array_to_json(array(
	select jsonb_build_object(
		-- prokind,
		'name', proname, 'lang', prolang, 'is_strict', proisstrict,
		'volatility', case provolatile
			when 'i' then 'immutable' when 's' then 'stable' when 'v' then 'volatile'
		end,
		'return_type', construct_full_type(
			proretset, ret.typname :: name, ret.typtype :: char,
			ret.typname :: name, ret.typtype :: char
		),
		'argument_types', argument_types.argument_types,
		'grants', grants.grants
	)
	from
		pg_proc fn
		join pg_namespace as namespace
			on fn.pronamespace = namespace.oid
			and namespace.nspname = target_namespace :: name
		join pg_authid as own
			on fn.proowner = own.oid
			and own.rolname = excluded_admin :: name
		join pg_type ret
			on fn.prorettype = ret.oid

		cross join lateral (select array_to_json(array(
			select
				construct_full_type(
					typ.typelem != 0, typ.typname :: name, typ.typtype :: char,
					arr_typ.typname :: name, arr_typ.typtype :: char
				)
			from
				unnest(fn.proargtypes) with ordinality as _(arg_type, arg_order)
				join pg_type as typ
					on arg_type = typ.oid
				left join pg_type as arr_typ
					on nullif(typ.typelem, 0) = arr_typ.oid
			order by arg_order
		)) as argument_types) as argument_types

		cross join lateral (select array_to_json(array(
			select jsonb_build_object(
				'grantee', roles.rolname,
				'privilege_type', _acl.privilege_type,
				'is_grantable', _acl.is_grantable
			)
			from (
				select
					(aclexplode(fn.proacl)).grantee as grantee,
					(aclexplode(fn.proacl)).privilege_type as privilege_type,
					(aclexplode(fn.proacl)).is_grantable as is_grantable
			) as _acl
			join pg_roles roles
				on roles.oid = _acl.grantee
				and roles.rolname != excluded_admin
			-- where _acl.privilege_type = 'EXECUTE'
		)) as grants) as grants

)) as results

-- execute _inspect_functions('public', 'experiment_user')
