import * as fs from 'fs'
import * as glob from 'glob'

for (const filename of glob.sync('src/sql/**/*.ts')) {
	const file_source = fs.readFileSync(filename, 'utf-8')

	fs.writeFileSync(filename, file_source.replace(
		`import * as __escape from 'escape-html';`,
		`function __escape(v: string) { return v }`,
	))
}
