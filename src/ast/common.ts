export interface Action {
	renderSql(): string,
	// renderTs(): string,
	renderTs(): [string, HttpVerb, string, string, string[]],
}

// TODO this will get more advanced as time goes on
export type CqlAtomicPrimitive = string | number | boolean | null
export type CqlPrimitive = CqlAtomicPrimitive | CqlAtomicPrimitive[]

export function renderSqlPrimitive(primitive: CqlPrimitive) {
	return '' + primitive
}

export function renderTsPrimitive(value: CqlPrimitive) {
	// TODO this isn't right
	return '' + value
}

export function tab(repetitions: number) {
	return '\t'.repeat(repetitions)
}

export function esc(value: string) {
	return `"${value}"`
}

export function paren(value: string) {
	return `(${value})`
}

export function maybeJoinWithPrefix(prefix: string, joinString: string, strings: string[]) {
	return strings.length > 0 ? prefix + strings.join(joinString) : ''
}

export const NAMED_EXPORT_FUNCTION_TEMPLATE = `export async function {displayName}({args}) {
	return axios.{httpVerb}(baseUrl + '{hash}', {argsUsage})
}`

// this could instead be derived from the other,
// just remove "export" and "function" and add a tab to each line
export const API_OBJECT_FUNCTION_TEMPLATE = `
	async {displayName}({args}) {
		return axios.{httpVerb}(baseUrl + '{displayName}', {argsUsage})
	}`


export const TYPE_TEMPLATE = `export type {typeName} = {
	{fieldDefinitions}
}`

export enum HttpVerb {
	GET = 'GET',
	POST = 'POST',
	PUT = 'PUT',
	PATCH = 'PATCH',
	DELETE = 'DELETE',
}

export namespace HttpVerb {
	export function needsBody(verb: HttpVerb) {
		// insert, put, patch, upsert, and replace, all have bodies and need typed payloads
		// query, queryfunc, and update, all don't have bodies, so only query parameters
		// func *could* be slightly more complex, if we allow things like setof
		switch (verb) {
			case HttpVerb.POST:
			case HttpVerb.PUT:
			case HttpVerb.PATCH:
				return true
			case HttpVerb.GET:
			case HttpVerb.DELETE:
				return false
		}
	}

	// export function parse(verb: string): HttpVerb {
	// 	return HttpVerb[verb]
	// }
}
