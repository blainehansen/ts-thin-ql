import { expect } from 'chai'

export function e(value: string) {
	return expect(boil_string(value))
}

export function boil_string(value: string) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\( /g, '(')
		.replace(/ \)/g, ')')
		.replace(/\{ /g, '{')
		.replace(/ \}/g, '}')
		.replace(/\[ /g, '[')
		.replace(/ \]/g, ']')
		.trim()
}
