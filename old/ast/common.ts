import { getTsType } from '../inspect'

export interface Action {
	renderSql(): [string, HttpVerb, Arg[], string, string],
	renderTs(): [string, HttpVerb, string, string, string[], string],
}

// TODO this will get more advanced as time goes on
export type CqlAtomicPrimitive = string | number | boolean | null
export type CqlPrimitive = CqlAtomicPrimitive | CqlAtomicPrimitive[]

export class Arg {
	constructor(
		readonly index: number,
		readonly argName: string,
		readonly argType: string,
		readonly nullable: boolean,
		readonly defaultValue?: CqlPrimitive,
	) {}

	renderSql() {
		return `$${this.index}`
	}

	renderTs() {
		const defaultPortion = this.defaultValue !== undefined ? ` = ${renderTsPrimitive(this.defaultValue)}` : ''
		return `${this.argName}: ${getTsType(this.argType, this.nullable)}${defaultPortion}`
	}
}

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

export function quote(value: string) {
	return `'${value}'`
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
