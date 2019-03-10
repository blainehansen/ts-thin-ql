import { Int } from './utils'

enum PgIntBrand {}
export type PgInt = { size: 2 | 4 | 8, isSerial: boolean } & PgIntBrand
enum PgFloatBrand {}
export type PgFloat = { size: 4 | 8 } & PgFloatBrand
enum PgTextBrand {}
export type PgText = { maxSize?: Int } & PgTextBrand
enum PgBoolBrand {}
export type PgBool = {} & PgBoolBrand
enum PgEnumBrand {}
export type PgEnum = { name: string, values: string[] } & PgEnumBrand

export type PgType = PgInt | PgFloat | PgText | PgBool | PgEnum
