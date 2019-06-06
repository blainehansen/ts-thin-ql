import { inspect as utilInspect } from 'util'
// import { Result, Ok, Err } from "@usefultools/monads"

export class LogError extends Error {
	constructor(message: string, ...loggable: any[]) {
		super(message + loggable.map(
			l => '\n\t' + utilInspect(l, { depth: 5, colors: true, compact: false })
		).join() + '\n')
	}
}


enum IntBrand {}
export type Int = number & IntBrand

export function roundToInt(num: number): Int {
	return Math.round(num) as Int
}

// export enum NumberFailure {
// 	NaN, PosInfinity, NegInfinity
// }

// export function toInt(value: string): Result<Int, NumberFailure> {
// 	const res = Number.parseInt(value)
//   return Number.isNaN(res) ? Ok(res as Int) : Err(NumberFailure.NaN)
// }

export function checkIsInt(num: number): num is Int {
	return num % 1 === 0
}


export class DefaultObj<T> {
	private readonly obj: { [key: string]: T } = {}
	constructor(readonly defaultFunc: () => T) {}

	get(key: string): T {
		return this.obj[key] || this.defaultFunc()
	}

	set(key: string, value: T): T {
		return this.obj[key] = value
	}
}
