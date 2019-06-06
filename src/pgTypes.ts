export enum PgTypeDeterminant {
	INT, FLOAT, TEXT, BOOL, ENUM
}

export type PgInt = { type: PgTypeDeterminant.INT, size: 2 | 4 | 8, isSerial: boolean }
export type PgFloat = { type: PgTypeDeterminant.FLOAT, size: 4 | 8 }
export type PgText = { type: PgTypeDeterminant.TEXT, maxSize?: number }
export type PgBool = { type: PgTypeDeterminant.BOOL,}
export type PgEnum = { type: PgTypeDeterminant.ENUM, name: string, values: string[] }

export type PgType = PgInt | PgFloat | PgText | PgBool | PgEnum
export namespace PgType {
	export function getTsType(type: PgType): string {
		switch (type.type) {
			case PgTypeDeterminant.INT: case PgTypeDeterminant.FLOAT:
				return 'number'
			case PgTypeDeterminant.TEXT:
				return 'string'
			case PgTypeDeterminant.BOOL:
				return 'boolean'
			case PgTypeDeterminant.ENUM:
				return type.name
		}
	}
}
