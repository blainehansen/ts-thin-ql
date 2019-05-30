export function boilString(value: string) {
	return value
		.replace(/\s+/g, ' ')
		.replace('( ', '(')
		.replace(' )', ')')
		.trim()
}
