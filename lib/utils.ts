import * as util from 'util'
import { Maybe, Some, None } from '@ts-std/monads'

export function exhaustive(value: never): never {
	throw new Error('exhaustive')
}
export function impossible(): never {
	throw new Error("something impossible happened")
}
export class LogError extends Error {
	constructor(lines: (string | any)[], depth = null as number | null) {
		const message = log_error_message(lines, depth)
		super(message)
	}
}
export function log_error_message(lines: (string | any)[], depth = null as number | null) {
	return lines.map(line => {
		return typeof line === 'string'
			? line
			: debug(line, depth)
	}).join('\n')
}


export function exec<T>(fn: () => T): T {
	return fn()
}

export type NonEmpty<T> = [T, ...T[]]
export namespace NonEmpty {
	export function from_array<T>(array: T[]): Maybe<NonEmpty<T>> {
		return array.length !== 0 ? Some(array as NonEmpty<T>) : None
	}
}

export type NonLone<T> = [T, T, ...T[]]
export namespace NonLone {
	export function from_array<T>(array: T[]): Maybe<NonLone<T>> {
		return array.length >= 2 ? Some(array as NonLone<T>) : None
	}
}


export function debug(obj: any, depth = null as number | null) {
	return util.inspect(obj, { depth, colors: true })
}


