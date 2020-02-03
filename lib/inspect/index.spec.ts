import 'mocha'
import { expect } from 'chai'

import { Dict } from '@ts-std/types'

import {
	InspectionTable, InspectionColumn, InspectionConstraint,
	InspectionPrimaryKey, InspectionForeignKey, InspectionCheckConstraint, InspectionUniqueConstraint,
	get_table, set_registered_tables, declare_inspection_results,
} from './inspect'
import { PgType } from './inspect_pg_types'

export function _reset_registered_tables() {
	set_registered_tables({})
}

export function _raw_declare_dumb_table_schema(
	tables: string[],
	// referred, pointing, column, unique
	foreign_keys: [string, string, string, boolean][],
) {
	const names_to_tables: Dict<InspectionTable> = {}

	function make_int_column(
		name: string, column_number: number,
		nullable = false, default_value_expression: string | null = null,
	) {
		return {
			name, column_number, nullable, default_value_expression,
			type_name: 'int4' as PgType, type_type: '', type_length: 4,
		}
	}

	for (const [index, table_name] of tables.entries()) {
		names_to_tables[table_name] = {
			name: table_name,
			table_oid: index,
			columns: [
				make_int_column('id', 1)
			],
			constraints: [
				{ type: 'p', constrained_column_numbers: [1] } as InspectionPrimaryKey,
			],
		}
	}

	for (const [index, [referred_name, pointing_name, pointing_column, pointing_unique]] of foreign_keys.entries()) {
		const column_number = index + 10
		const pointing_table = names_to_tables[pointing_name]
		if (!pointing_table) throw new Error(`blaine bad table_name ${pointing_name}`)
		const referred_table = names_to_tables[referred_name]
		if (!referred_table) throw new Error(`blaine bad table_name ${pointing_name}`)

		pointing_table.columns.push(make_int_column(pointing_column, column_number, false, null))
		pointing_table.constraints.push(
			{
				type: 'f', referred_table_oid: referred_table.table_oid,
				referred_column_numbers: [1],
				constrained_column_numbers: [column_number],
			} as InspectionForeignKey
		)

		if (pointing_unique) {
			pointing_table.constraints.push(
				{ type: 'u', constrained_column_numbers: [column_number] } as InspectionUniqueConstraint
			)
		}
	}

	declare_inspection_results(Object.values(names_to_tables))
}


export const basic_inspect_results: InspectionTable[] = [{
	name: 'a_table',
	columns: [{
		name: 'id',
		type_name: 'int4' as PgType,
		type_type: 'b',
		type_length: 4,
		column_number: 1,
		nullable: false,
		default_value_expression: 'next_val()',
	}, {
		name: 'a_field',
		type_name: 'text' as PgType,
		type_type: 'b',
		type_length: -1,
		column_number: 2,
		nullable: true,
		default_value_expression: null,
	}],
	table_oid: 16389,
	constraints: [{
		type: 'p',
		constrained_column_numbers: [1],
	} as InspectionPrimaryKey]
}, {
	name: 'b_table',
	columns: [{
		name: 'id',
		type_name: 'int4' as PgType,
		type_type: 'b',
		type_length: 4,
		column_number: 1,
		nullable: false,
		default_value_expression: 'next_val()',
	}, {
		name: 'b_field',
		type_name: 'text' as PgType,
		type_type: 'b',
		type_length: -1,
		column_number: 2,
		nullable: true,
		default_value_expression: null,
	}],
	table_oid: 16400,
	constraints: [{
		type: 'p',
		constrained_column_numbers: [1],
	} as InspectionPrimaryKey]
}, {
	name: 'through_table',
	columns: [{
		name: 'id',
		type_name: 'int4' as PgType,
		type_type: 'b',
		type_length: 4,
		column_number: 1,
		nullable: false,
		default_value_expression: 'next_val()',
	}, {
		name: 'a_id',
		type_name: 'int4' as PgType,
		type_type: 'b',
		type_length: 4,
		column_number: 2,
		nullable: true,
		default_value_expression: null,
	}, {
		name: 'b_id',
		type_name: 'int4' as PgType,
		type_type: 'b',
		type_length: 4,
		column_number: 3,
		nullable: true,
		default_value_expression: null,
	}, {
		name: 'word',
		type_name: 'text' as PgType,
		type_type: 'b',
		type_length: -1,
		column_number: 4,
		nullable: true,
		default_value_expression: null,
	}],
	table_oid: 16411,
	constraints: [{
		type: 'p',
		constrained_column_numbers: [1],
	} as InspectionPrimaryKey, {
		type: 'f',
		referred_table_oid: 16389,
		constrained_column_numbers: [2],
		referred_column_numbers: [1],
	} as InspectionForeignKey, {
		type: 'f',
		referred_table_oid: 16400,
		constrained_column_numbers: [3],
		referred_column_numbers: [1],
	} as InspectionForeignKey]
}]

describe('overall inspection', () => it('works', () => {
	declare_inspection_results(basic_inspect_results)

	expect(() => get_table('a_table').unwrap()).not.throw()
	expect(() => get_table('through_table').unwrap()).not.throw()
	expect(() => get_table('b_table').unwrap()).not.throw()

	expect(() => get_table('some_table').unwrap()).throw()

	_reset_registered_tables()
}))
