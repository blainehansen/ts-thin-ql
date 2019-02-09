// import { Result, Ok, Err } from "@usefultools/monads"

export class LogError extends Error {
	constructor(message: string, ...loggable: any[]) {
		console.log(...loggable)
		super(message)
	}
}


export type Int = number & { __int__: void }

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
