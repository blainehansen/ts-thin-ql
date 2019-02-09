-- https://www.postgresql.org/docs/10/catalogs.html
-- https://www.postgresql.org/docs/10/catalog-pg-class.html
-- https://www.postgresql.org/docs/10/catalog-pg-constraint.html
-- https://www.postgresql.org/docs/10/catalog-pg-attribute.html

with unnested as (
	select
		tab.oid as _oid,
		tab.relname as table_name,
		tab.relkind as table_type,
		cons.conname as c_name,
		cons.contype as c_type,
		unnest(cons.conkey) as constrained_column,
		unnest(cons.confkey) as referenced_column
		-- cons_col.atttypid as col_type
		-- cons.conpfeqop as,
		-- cons.conppeqop as,
		-- cons.conffeqop as
	from
		pg_catalog.pg_constraint as cons
		join pg_catalog.pg_class as tab
			on cons.conrelid = tab.oid
)
select
	unnested.*,
	cons_col.attname as constrained_column_name,
	ref_col.attname as referenced_column_name
from
	unnested
	left join pg_catalog.pg_attribute as cons_col
		on cons_col.attrelid = unnested._oid and cons_col.attnum = unnested.constrained_column
	left join pg_catalog.pg_attribute as ref_col
		on ref_col.attrelid = unnested._oid and ref_col.attnum = unnested.referenced_column
