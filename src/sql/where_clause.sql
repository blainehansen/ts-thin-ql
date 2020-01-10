@import { WhereDirective } from '../ast'
@param where_directives: WhereDirective

select
where (
	@for (const [index, where_directive] of where_directives.entries())
		@(where_directive.name) @(where_directive.where_type) @(where_directive.arg)
		@if (index !== where_directives.length - 1) and @endif
	@endfor
)
