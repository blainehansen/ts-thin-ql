import { Maybe, Some, None } from '@ts-std/monads'

export function exhaustive(value: never): never {
	throw new Error('exhaustive')
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
