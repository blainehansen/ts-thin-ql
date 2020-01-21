import { NonEmpty } from './utils'

export type CqlAtomicPrimitive = string | number | boolean | null
export type CqlPrimitive = CqlAtomicPrimitive | CqlAtomicPrimitive[]

export class Arg {
	constructor(
		readonly index: number,
		readonly arg_name: string,
		readonly arg_type: string,
		readonly nullable: boolean,
		readonly default_value?: CqlPrimitive,
	) {}
}

export class ColumnName {
	constructor(readonly table_name: string, readonly column_name: string) {}
}

export type DirectiveValue = ColumnName | Arg | CqlPrimitive


export class Delete {
	readonly type: 'Delete' = 'Delete'
	constructor(readonly name: string, readonly table_name: string, readonly args: Arg[], readonly where_directives: NonEmpty<WhereDirective>) {}
}

export type ActionManifest = {
	Delete: Delete,
	// Query: Query,
}

export type Action = ActionManifest[keyof ActionManifest]

// export enum HttpVerb {
// 	GET = 'GET',
// 	POST = 'POST',
// 	PUT = 'PUT',
// 	PATCH = 'PATCH',
// 	DELETE = 'DELETE',
// }

// export namespace HttpVerb {
// 	export function needsBody(verb: HttpVerb) {
// 		// insert, put, patch, upsert, and replace, all have bodies and need typed payloads
// 		// query, queryfunc, and update, all don't have bodies, so only query parameters
// 		// func *could* be slightly more complex, if we allow things like setof
// 		switch (verb) {
// 			case HttpVerb.POST:
// 			case HttpVerb.PUT:
// 			case HttpVerb.PATCH:
// 				return true
// 			case HttpVerb.GET:
// 			case HttpVerb.DELETE:
// 				return false
// 		}
// 	}
// }


export enum BooleanOperator {
	Eq = '=',
	Lt = '<',
	Lte = '<=',
	Gt = '>',
	Gte = '>=',
	Ne = '!=',
	In = 'in',
	Nin = 'not in',
	Is = 'is',
	Nis = 'is not',
	Bet = 'between',
	Nbet = 'not between',
	Symbet = 'between symmetric',
	Nsymbet = 'not between symmetric',
	Dist = 'is distinct from',
	Ndist = 'is not distinct from',
}

export class GetDirective {
	constructor(readonly args: DirectiveValue[], readonly column_names?: string[]) {}
}

export class WhereDirective {
	constructor(readonly left: DirectiveValue, readonly right: DirectiveValue, readonly operator: BooleanOperator) {}
}

export enum OrderByNullsPlacement { First = 'first', Last = 'last' }

export class OrderDirective {
	// TODO probably should be column_display_name: string
	constructor(readonly column: string, readonly ascending?: boolean, readonly nulls_placement?: OrderByNullsPlacement) {}
}



export class Query {
	readonly type: 'Query' = 'Query'
	constructor(readonly name: string, readonly args: Arg[], readonly block: QueryBlock) {}
}


// type TableAccessor =
// 	| BasicTableAccessor
// 	| SimpleTable
// 	| TableChain
// 	// | ColumnKeyChain

type QueryObject = QueryBlock | QueryColumn | QueryRawColumn
export class QueryBlock {
	constructor(
		readonly display_name: string,
		readonly target_table_name: string,
		// readonly access_object: TableAccessor,
		readonly is_many: boolean,
		readonly entities: QueryObject[],
		readonly where_directives: GetDirective | WhereDirective[],
		readonly order_directives: OrderDirective[],
		readonly limit?: DirectiveValue,
		readonly offset?: DirectiveValue,
		readonly use_left: boolean = true,
	) {}
}

export class QueryColumn {
	constructor(readonly column_name: string, readonly display_name: string) {}
}

export class QueryRawColumn {
	constructor(readonly statement: RawSqlStatement, readonly display_name: string) {}
}

export class RawSqlStatement {
	constructor(readonly sql_text: string) {}
}



// export enum MutationLevel { ASSOCIATION_ONLY, PUT, PATCH }
// readonly mutation_level: MutationLevel = MutationLevel.ASSOCIATION_ONLY,
// 		readonly exact: boolean = false,
