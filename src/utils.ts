// import { Result, Ok, Err } from "@usefultools/monads"

export class LogError extends Error {
	constructor(message: string, ...loggable: any[]) {
		console.log(...loggable)
		super(message)
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




// type M<V> = { [key: string]: V }
// type KeyTo<O extends M<V>, V, NV> = { [key in keyof O]: NV }

// type TrueMap = { [key: string]: true }
// type TrueMapToFalse = KeyTo<{ [key: string]: true }, true, false>

// function mergeThings<A extends M, B extends M>(a: A, b: B): { [key in keyof A]: false } & { [key in keyof B]: false } {
// 	return {
// 		...Object.keys(a).reduce((obj, key) => {
// 			obj[key] = false
// 			return obj
// 		}, {} as { [key in keyof A]: false }),
// 		...Object.keys(b).reduce((obj, key) => {
// 			obj[key] = false
// 			return obj
// 		}, {} as { [key in keyof B]: false }),
// 	}
// }
