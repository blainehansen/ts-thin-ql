import { NonEmpty, NonLone } from './utils'

export type CqlAtomicPrimitive = string | number | boolean | null
export type CqlPrimitive = CqlAtomicPrimitive | CqlAtomicPrimitive[]

export enum HttpVerb {
	get = 'get',
	post = 'post',
	put = 'put',
	patch = 'patch',
	delete = 'delete',
}

export class Arg {
	constructor(
		readonly index: number,
		readonly arg_name: string,
		readonly arg_type: string,
		readonly nullable: boolean,
		readonly default_value: CqlPrimitive | undefined,
	) {}
}

export class ColumnName {
	constructor(readonly column_name: string) {}
}

export type DirectiveValue = ColumnName | Arg | CqlPrimitive


export class Delete {
	readonly type: 'Delete' = 'Delete'
	constructor(readonly name: string, readonly table_name: string, readonly args: Arg[], readonly where_directives: NonEmpty<WhereDirective>) {}
}

export type ActionManifest = {
	Delete: Delete,
	Query: Query,
}

export type Action = ActionManifest[keyof ActionManifest]

// thinking about it now, it probably makes more sense
// to simply automatically generate bindings for all non-queryable
// functions that are executable by the current role
export namespace Action {
	export function http_verb(action: Action): HttpVerb {
		switch (action.type) {
			case 'Query': return HttpVerb.get
			case 'Delete': return HttpVerb.delete
			// case 'ImmutableFunction': return HttpVerb.get
			// case 'StableFunction': return HttpVerb.get
			// case 'VolatileFunction': return HttpVerb.post
			// case 'Function': return HttpVerb.post
			// case 'Insert': return HttpVerb.post
			// case 'Put': return HttpVerb.put
			// case 'Patch': return HttpVerb.patch
			// case 'InsertDeep': return HttpVerb.post
			// case 'PutDeep': return HttpVerb.post
			// case 'PatchDeep': return HttpVerb.post
			// case 'Update': return HttpVerb.patch
		}
	}
}


export enum BooleanOperator {
	Eq = '=', Ne = '!=',
	Lt = '<', Lte = '<=',
	Gt = '>', Gte = '>=',
	In = 'in', Nin = 'not in',
	Is = 'is', Nis = 'is not',
	Bet = 'between', Nbet = 'not between',
	Symbet = 'between symmetric', Nsymbet = 'not between symmetric',
	Dist = 'is distinct from', Ndist = 'is not distinct from',
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

export type QueryObject = QueryBlock | QueryColumn | QueryRawColumn

export class QueryBlock {
	readonly type: 'QueryBlock' = 'QueryBlock'
	constructor(
		readonly display_name: string,
		readonly target_table_name: string,
		readonly access_object: TableAccessor,
		readonly is_many: boolean,
		readonly entities: QueryObject[],
		readonly where_directives: GetDirective | WhereDirective[],
		readonly order_directives: OrderDirective[],
		readonly limit: DirectiveValue | undefined,
		readonly offset: DirectiveValue | undefined,
		readonly use_left: boolean,
	) {}
}

export class QueryColumn {
	readonly type: 'QueryColumn' = 'QueryColumn'
	constructor(readonly column_name: string, readonly display_name?: string) {}
}

export class QueryRawColumn {
	readonly type: 'QueryRawColumn' = 'QueryRawColumn'
	constructor(readonly display_name: string, readonly sql_text: string) {}
}

export type TableAccessor =
	| SimpleTable
	| TableChain
	| ForeignKeyChain
	// | ColumnKeyChain


// export type TableAccessor =
// 	| TableChain
// 	| ForeignKeyChain
// 	| ColumnKeyChain

// export class TableChain {
// 	readonly type: 'TableChain' = 'TableChain'
// 	constructor(readonly table_names: NonEmpty<string>) {}
// }

export class SimpleTable {
	readonly type: 'SimpleTable' = 'SimpleTable'
	constructor(readonly table_name: string) {}
}

export class TableChain {
	readonly type: 'TableChain' = 'TableChain'
	constructor(readonly table_names: NonLone<string>) {}
}


// this is going to be a chain of only foreign_key's, not any column
// which means it will just be useful to disambiguate normal joins
// ~~some_key~~some_other~~table_name.key~~key->destination_table_name
// for composite keys, must give table_name and use parens
// ~~some_key~~some_other~~table_name(key, other_key)~~key->destination_table_name
export class ForeignKeyChain {
	readonly type: 'ForeignKeyChain' = 'ForeignKeyChain'
	constructor(readonly key_references: NonEmpty<KeyReference>, readonly destination_table_name: string) {}
}
export class KeyReference {
	constructor(readonly key_names: string[], readonly table_name?: string) {}
}

// // this is for lining up arbitrary columns, no restrictions at all (except for column type)
// // ~local_col=some_col~same_table_col=qualified.other_col->destination_table_name
// export class ColumnKeyChain {
// 	readonly type: 'ColumnKeyChain' = 'ColumnKeyChain'
// 	constructor() {}
// }

// export class KeyEquality {
// 	constructor(readonly left: KeyReference, readonly right: KeyReference) {}
// }



// export enum MutationLevel { ASSOCIATION_ONLY, PUT, PATCH, PUT_FORCE, PATCH_FORCE }
// readonly mutation_level: MutationLevel = MutationLevel.ASSOCIATION_ONLY,

export class Insert {
	readonly type: 'Insert' = 'Insert'
	readonly args = [] as []
	constructor(readonly name: string, readonly block: InsertBlock) {}
}

export class InsertBlock {
	constructor(
		readonly given_name: string, readonly target_table_name: string,
		readonly is_many: boolean, readonly blocks: InsertBlock[],
	) {}
}
