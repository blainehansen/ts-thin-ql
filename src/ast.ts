import { NonEmpty } from './utils'

// TODO this will get more advanced as time goes on
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



// export class Query {
// 	constructor(readonly name: string, readonly args: Arg[], readonly block: QueryBlock) {}
// }

// export class GetDirective {
// 	constructor(readonly args: DirectiveValue[], readonly column_names?: string[]) {}
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

export class WhereDirective {
	constructor(readonly left: DirectiveValue, readonly right: DirectiveValue, readonly operator: BooleanOperator) {}
}

// export enum OrderByNullsPlacement { First = 'first', Last = 'last' }

// export class OrderDirective {
// 	// TODO probably should be columnDisplayName: string
// 	constructor(readonly column: string, readonly ascending?: boolean, readonly nulls_placement?: OrderByNullsPlacement) {}
// }

// export class RawSqlStatement {
// 	constructor(readonly sql_text: string) {}
// }





// type QueryObject = QueryBlock | QueryColumn | QueryRawColumn
// export class QueryBlock {
// 	constructor(
// 		readonly displayName: string,
// 		readonly targetTableName: string,
// 		readonly accessObject: TableAccessor,
// 		readonly isMany: boolean,
// 		readonly entities: QueryObject[],
// 		readonly whereDirectives: GetDirective | WhereDirective[],
// 		readonly orderDirectives: OrderDirective[],
// 		readonly limit?: DirectiveValue,
// 		readonly offset?: DirectiveValue,
// 		readonly useLeft: boolean = true,
// 	) {}
// }



export class QueryColumn {
	constructor(readonly columnName: string, readonly displayName: string) {}

	renderSql(targetTableName: string) {
		return `'${this.displayName}', ${targetTableName}.${this.columnName}`
	}
}

export class QueryRawColumn {
	constructor(readonly statement: RawSqlStatement, readonly displayName: string) {}

	renderSql(argsMap: { [argName: string]: Arg }) {
		return `'${this.displayName}', ${this.statement.renderSql(argsMap)}`
	}
}
