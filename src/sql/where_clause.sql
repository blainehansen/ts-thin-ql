@import { WhereDirective } from '../ast'
@param where_directives: WhereDirective[]

where (
	@for ([index, where_directive] of where_directives.entries())
		@(where_directive.left) @(where_directive.operator) @(where_directive.right)
		@if (index !== where_directives.length - 1) and @endif
	@endfor
)
