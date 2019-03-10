function boilString(value) {
	return value
		.replace(/\s+/g, ' ')
		.replace('( ', '(')
		.replace(' )', ')')
		.trim()
}

module.exports = {
	boilString,
}
