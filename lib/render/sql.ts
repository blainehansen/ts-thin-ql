import { LogError, exhaustive, exec } from '../utils'
import {
	HttpVerb, Delete as _Delete, Query as _Query, Arg, ColumnName, QueryColumn, QueryBlock,
	TableAccessor, ForeignKeyChain,
	GetDirective, WhereDirective, DirectiveValue, OrderDirective,
} from '../ast'
import { get_table } from '../inspect'

export function Delete(d: _Delete) {
	return [
		`delete from ${d.table_name}`,
		where_clause(d.where_directives),
	].join('\n')
}

export function where_clause(where_directives: WhereDirective[]) {
	return [
		'where (',
		'\t' + where_directives
			.map(({ left, right, operator }) => `${directive_value(left)} ${operator} ${directive_value(right)}`)
			.join(' and '),
		')',
	].join('\n')
}

export function directive_value(value: DirectiveValue): string {
	if (typeof value === 'string')
		return `'${escape_single(value)}'`
	if (value === null || typeof value !== 'object')
		return '' + value

	if (Array.isArray(value))
		return `(${value.map(directive_value).join(', ')})`
	if ('table_name' in value)
		return `${esc(value.table_name)}.${esc(value.column_name)}`
	if ('arg_name' in value)
		return `$${value.index}`

	exhaustive(value)
}

export function order_directive({ column, ascending, nulls_placement }: OrderDirective) {
	const direction_string = ascending === undefined ? '' : ascending ? ' asc' : ' desc'
	const nulls_string = nulls_placement ? ` nulls ${nulls_placement}` : ''
	return `${column}${direction_string}${nulls_string}`
}



export function Query({ name, args, block }: _Query) {
	const query_string = query_block(block, args)
	return [name, HttpVerb.GET, args, query_string]
}

export function get_directive({ column_names, args }: GetDirective, target_table_name: string) {
	// this actually is the display name
	const final_column_names = column_names || exec(() => {
		const table = get_table(target_table_name).unwrap()
		const column_names = table.primary_key_columns.map(column => column.name)
		if (column_names.length === 0) throw new LogError([`table: ${target_table_name} has no primary key`])
		return column_names
	})

	if (final_column_names.length !== args.length)
		throw new LogError(["GetDirective column names and args didn't line up: ", final_column_names, args])

	const get_directive_text = final_column_names
		.map((column_name, index) => `${target_table_name}.${column_name} = ${directive_value(args[index])}`)
		.join(' and ')
	return paren(get_directive_text)
}


// we do this join condition in addition to our filters
export function query_block(
	{ display_name, target_table_name, is_many, entities, where_directives, order_directives, limit, offset }: QueryBlock,
	args: Arg[], parent_join_condition?: string,
) {
	get_table(target_table_name).unwrap()

	// TODO
	// const current_table = get_table(target_table_name).unwrap()
	// const is_many = inspect.determine_is_many(parent_table, current_table)

	const column_select_strings: string[] = []
	const embed_select_strings: string[] = []
	const join_strings: string[] = []

	for (const entity of entities) {
		if (entity.type === 'QueryColumn') {
			column_select_strings.push(query_column(entity, display_name))
			continue
		}
		// if (entity.type === 'QueryRawColumn') {
		// 	const args_map = args.unique_index_by('arg_name').unwrap()
		// 	column_select_strings.push(query_raw_column(entity, args_map))
		// 	continue
		// }

		const { use_left, display_name: entity_display_name } = entity
		// the embed query gives the whole aggregation the alias of the display_name
		embed_select_strings.push(`'${entity_display_name}', ${entity_display_name}.${entity_display_name}`)

		const join_conditions = make_join_conditions(entity.access_object, display_name, target_table_name, entity_display_name)
		const final_join = join_conditions.pop()
		if (!final_join) throw new LogError(["no final join condition, can't proceed", final_join])
		const [final_cond, , ] = final_join

		const join_type_string = use_left ? 'left' : 'inner'
		const basic_joins = join_conditions.map(([cond, disp, tab]) => `${join_type_string} join ${tab} as ${disp} on ${cond}`)
		Array.prototype.push.apply(join_strings, basic_joins)
		// and now to push the final one
		join_strings.push(`${join_type_string} join lateral (${query_block(entity, args, final_cond)}) as ${entity_display_name} on true` )
	}

	// this moment is where we decide whether to use json_agg or not
	// the embed queries have already handled themselves,
	// so we're simply asking if this current query will return multiple
	const select_string = `json_build_object(${column_select_strings.concat(embed_select_strings).join(', ')})`

	const join_string = join_strings.join('\n\t')

	const parent_join_strings = parent_join_condition ? [parent_join_condition] : []

	const where_prefix = 'where '
	// TODO what happens when something's embedded but has a GetDirective?
	// we probably shouldn't allow that, since it makes no sense
	const where_string = where_directives instanceof GetDirective
		? where_prefix + get_directive(where_directives, display_name)
		: maybe_join_with_prefix(where_prefix, ' and ', parent_join_strings.concat(where_directives.map(w => w.render_sql(display_name))))

	// TODO if !is_many then order and limit and where aren't allowed
	const order_string = maybe_join_with_prefix(' order by ', ', ', order_directives.map(order_directive))
	const final_select_string = (is_many ? `json_agg(${select_string}${order_string}) :: text` : select_string) + ` as ${display_name}`

	const limit_string = limit ? `limit ${directive_value(limit)}` : ''
	const offsetString = offset ? `offset ${directive_value(offset)}` : ''

	return `
		select ${final_select_string}
		from
			${target_table_name} as ${display_name}
			${join_string}
		${where_string}
		${limit_string}
		${offsetString}
	`
}

// TODO need functions to render the different types of query blocks
// (inner, left) X (single, many)

export function make_join_conditions(
	access_object: TableAccessor, previous_display_name: string, previous_table_name: string, target_display_name: string
): [string, string, string][] {
	if (access_object.type === 'ForeignKeyChain')
		return foreign_key_chain_join_conditions(access_object, previous_display_name, previous_table_name, target_display_name)
	// if (access_object.type === 'ColumnKeyChain')
	// 	return column_key_chain_join_conditions(access_object, previous_display_name, previous_table_name, target_display_name)

	const table_names = access_object.type === 'SimpleTable'
		? [access_object.table_name]
		: access_object.table_names

	const join_conditions: [string, string, string][] = []

	let previous_table = get_table(previous_table_name).unwrap()
	const last_index = table_names.length - 1
	for (const [index, join_table_name] of table_names.entries()) {
		const join_table = get_table(join_table_name).unwrap()
		const join_display_name = index === last_index ? target_display_name : join_table_name

		// here we do all the keying logic
		const visible_table = previous_table.visible_tables.get(join_table_name)
		if (visible_table.length === 0) throw new LogError(["can't get to table: ", previous_table_name, join_table_name])
		if (visible_table.length !== 1) throw new LogError(["ambiguous: ", previous_table_name, join_table_name])

		const [{ remote, foreign_key: { referred_columns, pointing_columns, pointing_unique } }] = visible_table
		// check_many_correctness(pointing_unique, remote, entity_is_many)

		const [previous_keys, join_keys] = remote
			? [referred_columns, pointing_columns]
			: [pointing_columns, referred_columns]

		const join_condition = construct_join_key(previous_display_name, previous_keys, join_display_name, join_keys)

		join_conditions.push([join_condition, join_display_name, join_table_name])

		previous_table_name = join_table_name
		previous_table = join_table
		previous_display_name = join_display_name
	}

	return join_conditions
}

export function foreign_key_chain_join_conditions(
	{ key_references, destination_table_name }: ForeignKeyChain,
	previous_display_name: string, previous_table_name: string, target_display_name: string,
) {
	const join_conditions: [string, string, string][] = []

	let previous_table = get_table(previous_table_name).unwrap()

	const last_index = key_references.length - 1
	for (const [index, { key_names, table_name }] of key_references.entries()) {

		const visible_tables_map = previous_table.visible_tables_by_key.get(key_names.join(','))
		let visible_table
		if (table_name) {
			visible_table = visible_tables_map[table_name]
			if (!visible_table) throw new LogError(["table_name has no key ", key_names])
		}
		else {
			const visible_tables = Object.values(visible_tables_map)
			if (visible_tables.length !== 1) throw new LogError(["keyName is ambiguous: ", key_names])
			visible_table = visible_tables[0]
		}

		const { remote, foreign_key: { referred_table, referred_columns, pointing_table, pointing_columns, pointing_unique } } = visible_table

		const [previous_keys, join_table, join_keys] = remote
			? [referred_columns, pointing_table, pointing_columns]
			: [pointing_columns, referred_table, referred_columns]
		const join_table_name = join_table.name
		const join_display_name = index === last_index ? target_display_name : join_table_name

		const join_condition = construct_join_key(previous_display_name, previous_keys, join_display_name, join_keys)
		join_conditions.push([join_condition, join_display_name, join_table_name])

		previous_table_name = join_table_name
		previous_table = join_table
		previous_display_name = join_display_name
	}

	if (previous_table_name !== destination_table_name)
		throw new LogError(["you've given an incorrect destination_table_name: ", previous_table_name, destination_table_name])

	return join_conditions
}

// function column_key_chain_join_conditions() {
// 	//
// }

export function construct_join_key(previous_display_name: string, previous_keys: string[], join_display_name: string, join_keys: string[]) {
	if (previous_keys.length !== join_keys.length) throw new LogError(["some foreign keys didn't line up: ", previous_keys, join_keys])

	const join_condition_text = previous_keys
		.map((previous_key, index) => {
			const join_key = join_keys[index]
			if (!join_key) throw new LogError(["some foreign keys didn't line up: ", previous_keys, join_keys])
			return `${previous_display_name}.${previous_key} = ${join_display_name}.${join_key}`
		})
		.join(' and ')

	return paren(join_condition_text)
}


export function query_column({ display_name, column_name }: QueryColumn, target_table_name: string) {
	return `'${display_name || column_name}', ${target_table_name}.${column_name}`
}
// function query_raw_column({ display_name, statement }: QueryRawColumn, args_map: Dict<Arg>) {
// 	return `'${display_name}', ${statement.render_sql(args_map)}`
// }



export function escape_single(value: string) {
	return value.replace(/(')/g, "\\'")
}

export function indent(value: string, level: number) {
	const tabs = '\t'.repeat(level)
	return value.split(/\s*\n/).map(s => tabs + s).join('\n')
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


// // TODO you can make this regex more robust
// // https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
// // https://www.postgresql.org/docs/10/sql-syntax-lexical.html#SQL-SYNTAX-CONSTANTS
// // const global_variable_regex: RegExp = new RegExp('(\\$\\w*)?' + variable_regex.source + '$?', 'g')
// const global_variable_regex = new RegExp(variable_regex.source + '\\b', 'g')

// function raw_sql_statement(s: RawSqlStatement) {
// 	let rendered_sql_text = this.sql_text
// 	let match
// 	while ((match = global_variable_regex.exec(rendered_sql_text)) !== null) {
// 		const argName = match[0].slice(1)
// 		const arg = args_map[argName]
// 		// by continuing rather than throwing an error,
// 		// we allow them to do whatever they want with dollar quoted strings
// 		// if they've written something invalid, they'll get an error later on
// 		if (!arg) continue
// 		rendered_sql_text = rendered_sql_text.replace(new RegExp('\\$' + argName + '\\b'), arg.render_sql())
// 	}

// 	return rendered_sql_text
// }
