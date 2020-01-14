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
// 		readonly display_name: string,
// 		readonly target_table_name: string,
// 		readonly access_object: TableAccessor,
// 		readonly is_many: boolean,
// 		readonly entities: QueryObject[],
// 		readonly where_directives: GetDirective | WhereDirective[],
// 		readonly order_directives: OrderDirective[],
// 		readonly limit?: DirectiveValue,
// 		readonly offset?: DirectiveValue,
// 		readonly use_left: boolean = true,
// 	) {}
// }


// interface TableAccessor {
// 	make_join_conditions(
// 		previous_display_name: string, previous_table_name: string, target_display_name: string
// 	): Array<[string, string, string]>,

// 	get_target_table_name(): string,
// }

// abstract class BasicTableAccessor implements TableAccessor {
// 	constructor(readonly table_names: string[]) {}
// }


// export class SimpleTable extends BasicTableAccessor {
// 	constructor(table_name: string) {
// 		super([table_name])
// 	}
// }

// export class TableChain extends BasicTableAccessor {
// 	constructor(table_names: string[]) {
// 		if (table_names.length === 0) throw new LogError("can't have empty TableChain: ")
// 		if (table_names.length === 1) throw new LogError("can't have TableChain with only one table: ", table_names)

// 		super(table_names)
// 	}
// }



// export class KeyReference {
// 	constructor(readonly key_names: string[], readonly table_name?: string) {}
// }

// // this is going to be a chain of only foreignKey's, not any column
// // which means it will just be useful to disambiguate normal joins
// // ~~some_key~~some_other~~table_name.key~~key~~destination_table_name
// // for composite keys, must give table_name and use parens
// // ~~some_key~~some_other~~table_name(key, other_key)~~key~~destination_table_name
// export class ForeignKeyChain implements TableAccessor {
// 	constructor(readonly keyReferences: KeyReference[], readonly destinationTableName: string) {
// 		lookupTable(destinationTableName)
// 	}
// }



// // this is for lining up arbitrary columns, no restrictions at all (except for column type)
// // ~local_col=some_col~same_table_col=qualified.other_col~destination_table_name
// // export class ColumnKeyChain implements TableAccessor {
// // 	constructor() {
// // 	}

// // 	makeJoinConditions(previousDisplayName: string, previousTableName: string, entityIsMany: boolean) {
// // 	}
// // }


// export class QueryColumn {
// 	constructor(readonly columnName: string, readonly displayName: string) {}
// }

// export class QueryRawColumn {
// 	constructor(readonly statement: RawSqlStatement, readonly displayName: string) {}
// }
