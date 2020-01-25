import { exhaustive, exec } from '../utils'
import { HttpVerb, Delete as _Delete, WhereDirective, DirectiveValue, OrderDirective } from '../ast'

export function Delete(d: _Delete) {
	return [
		`delete from ${d.table_name}`,
		where_clause(d.where_directives),
	].join('\n')
}

function where_clause(where_directives: WhereDirective[]) {
	return [
		'where (',
		'\t' + where_directives
			.map(({ left, right, operator }) => `${directive_value(left)} ${operator} ${directive_value(right)}`)
			.join(' and '),
		')',
	].join('\n')
}

function directive_value(value: DirectiveValue): string {
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

function order_directive({ column, ascending, nulls_placement }: OrderDirective) {
	const direction_string = ascending === undefined ? '' : ascending ? ' asc' : ' desc'
	const nulls_string = nulls_placement ? ` nulls ${nulls_placement}` : ''
	return `${column}${direction_string}${nulls_string}`
}



export function Query({ query_name, args_tuple, query_block }: _Query) {
	const query_string = render_query_block(query_block, args_tuple)
	return [query_name, HttpVerb.GET, args_tuple, query_string]
}

function render_get_directive({ column_names, args }: GetDirective, target_table_name: string) {
	// this actually is the display name
	const final_column_names = column_names || exec(() => {
		const table = lookup_table(target_table_name)
		const column_names = table.primary_key_columns.map(column => column.column_name)
		if (column_names.length === 0) throw new LogError(`table: ${target_table_name} has no primary key`)
		return column_names
	})

	if (final_column_names.length !== args.length)
		throw new LogError("GetDirective column names and args didn't line up: ", final_column_names, args)

	const get_directive_text = final_column_names
		.map((column_name, index) => `${target_table_name}.${column_name} = ${render_sql_directive_value(args[index])}`)
		.join(' and ')
	return paren(get_directive_text)
}


export function make_args_map(args: Arg[]) {
	return args.reduce(
		(map, a) => { map[a.argName] = a; return map },
		{} as { [argName: string]: Arg },
	)
}


// we do this join condition in addition to our filters
function query_block(query_block: QueryBlock, args: Arg[], parent_join_condition?: string) {
	const { display_name, target_table_name, is_many, entities, where_directives, order_directives, limit, offset } = this
	// const table = lookup_table(target_table_name)
	lookup_table(target_table_name)

	// TODO
	// const current_table = lookup_table(target_table_name)
	// const is_many = inspect.determine_is_many(parent_table, current_table)

	const column_select_strings: string[] = []
	const embed_select_strings: string[] = []
	const join_strings: string[] = []

	for (const entity of entities) {
		if (entity.type === 'QueryColumn') {
			column_select_strings.push(query_column(entity, display_name))
			continue
		}
		if (entity.type === 'QueryRawColumn') {
			const args_map = make_args_map(args)
			column_select_strings.push(query_raw_column(entity, args_map))
			continue
		}

		const { use_left, display_name: entity_display_name } = entity
		// the embed query gives the whole aggregation the alias of the display_name
		embed_select_strings.push(`'${entity_display_name}', ${entity_display_name}.${entity_display_name}`)

		const join_conditions = entity.access_object.make_join_conditions(display_name, target_table_name, entity_display_name)
		const final_join = join_conditions.pop()
		if (!final_join) throw new LogError("no final join condition, can't proceed", final_join)
		const [final_cond, , ] = final_join

		const join_type_string = use_left ? 'left' : 'inner'
		const basic_joins = join_conditions.map(([cond, disp, tab]) => `${join_type_string} join ${tab} as ${disp} on ${cond}`)
		Array.prototype.push.apply(join_strings, basic_joins)
		// and now to push the final one
		join_strings.push(`${join_type_string} join lateral (${entity.renderSql(args, final_cond)}) as ${entity_display_name} on true` )
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
		? where_prefix + where_directives.renderSql(display_name)
		: maybe_join_with_prefix(where_prefix, ' and ', parent_join_strings.concat(where_directives.map(w => w.renderSql(display_name))))

	// TODO if !is_many then order and limit and where aren't allowed
	const order_string = maybe_join_with_prefix(' order by ', ', ', order_directives.map(o => o.renderSql()))
	const final_select_string = (is_many ? `json_agg(${select_string}${order_string}) :: text` : select_string) + ` as ${display_name}`

	const limit_string = limit ? `limit ${render_sql_directive_value(limit)}` : ''
	const offsetString = offset ? `offset ${render_sql_directive_value(offset)}` : ''

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

function make_join_conditions(
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

	let previous_table = lookup_table(previous_table_name)
	const last_index = table_names.length - 1
	for (const [index, join_table_name] of table_names.entries()) {
		const join_table = lookup_table(join_table_name)
		const join_display_name = index === last_index ? target_display_name : join_table_name

		// here we do all the keying logic
		const visible_table = previous_table.visible_tables[join_table_name]
		if (!visible_table) throw new LogError(["can't get to table: ", previous_table_name, join_table_name])
		// if (visible_table.length !== 1) throw new LogError("ambiguous: ", table_name, entity_table_name)

		const { remote, foreign_key: { referred_columns, pointing_columns, pointing_unique } } = visible_table
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

function foreign_key_chain_join_conditions(
	{ key_references, destination_table_name }: ForeignKeyChain,
	previous_display_name: string, previous_table_name: string, target_display_name: string,
) {
	const join_conditions: [string, string, string][] = []

	let previous_table = Registry.lookup_table(previous_table_name).unwrap()

	const last_index = key_references.length - 1
	for (const [index, { key_names, table_name }] of key_references.entries()) {

		const visible_tables_map = previous_table.visible_tables_by_key[key_names.join(',')] || {}
		let visible_table
		if (table_name) {
			visible_table = visible_tables_map[table_name]
			if (!visible_table) throw new LogError("table_name has no key ", key_names)
		}
		else {
			const visible_tables = Object.values(visible_tables_map)
			if (visible_tables.length !== 1) throw new LogError("keyName is ambiguous: ", key_names)
			visible_table = visible_tables[0]
		}

		const { remote, foreign_key: { referred_table, referred_columns, pointing_table, pointing_columns, pointing_unique } } = visible_table

		const [previous_keys, join_table, join_keys] = remote
			? [referred_columns, pointing_table, pointing_columns]
			: [pointing_columns, referred_table, referred_columns]
		const join_table_name = join_table.table_name
		const join_display_name = index === last_index ? target_display_name : join_table_name

		const join_condition = construct_join_key(previous_display_name, previous_keys, join_display_name, join_keys)
		join_conditions.push([join_condition, join_display_name, join_table_name])

		previous_table_name = join_table_name
		previous_table = join_table
		previous_display_name = join_display_name
	}

	if (previous_table_name !== destination_table_name)
		throw new LogError("you've given an incorrect destination_table_name: ", previous_table_name, destination_table_name)

	return join_conditions
}

// function column_key_chain_join_conditions() {
// 	//
// }

function construct_join_key(previous_display_name: string, previous_keys: string[], join_display_name: string, join_keys: string[]) {
	if (previous_keys.length !== join_keys.length) throw new LogError("some foreign keys didn't line up: ", previous_keys, join_keys)

	const join_condition_text = previous_keys
		.map((previous_key, index) => {
			const join_key = join_keys[index]
			if (!join_key) throw new LogError("some foreign keys didn't line up: ", previous_keys, join_keys)
			return `${previous_display_name}.${previous_key} = ${join_display_name}.${join_key}`
		})
		.join(' and ')

	return paren(join_condition_text)
}


function query_column(q: QueryColumn, target_table_name: string) {
	return `'${this.display_name}', ${target_table_name}.${this.column_name}`
}
// function query_raw_column(q: QueryRawColumn, args_map: { [argName: string]: Arg }) {
// 	return `'${this.display_name}', ${this.statement.renderSql(args_map)}`
// }



function escape_single(value: string) {
	return value.replace(/(')/g, "\\'")
}

function indent(value: string, level: number) {
	const tabs = '\t'.repeat(level)
	return value.split(/\s*\n/).map(s => tabs + s).join('\n')
}

function quote(value: string) {
	return `'${value}'`
}

function esc(value: string) {
	return `"${value}"`
}

function paren(value: string) {
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
// 		rendered_sql_text = rendered_sql_text.replace(new RegExp('\\$' + argName + '\\b'), arg.renderSql())
// 	}

// 	return rendered_sql_text
// }
