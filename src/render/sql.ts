import { Delete as _Delete, WhereDirective, DirectiveValue } from '../ast'

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

function directive_value(value: DirectiveValue) {
	if (typeof value === 'string')
		return `'${escape_single(value)}'`
	if (value === null || typeof value !== 'object')
		return value

	if ('table_name' in value)
		return `${esc(value.table_name)}.${esc(value.column_name)}`
	if ('arg_name' in value)
		return `$${value.index}`
}


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
