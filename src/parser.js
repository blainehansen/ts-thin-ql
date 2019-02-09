const kreia = require('kreia')
const fs = require('fs')

const Literal = kreia.createTokenCategory('Literal')

const [parser, tok] = kreia.createParser({
	LineBreak: { match: /\n+/, lineBreaks: true },
	Whitespace: { match: /[ \t]/, ignore: true },

	Comma: ',',
	Colon: ':',
	Num: { match: /[0-9]+(?:\.[0-9]+)/, categories: Literal },
	Period: '.',
	Equal: '=',
	LeftParen: '(', RightParen: ')',
	LeftBracket: '[', RightBracket: ']',
	LeftBrace: '{', RightBrace: '}',

	Comment: { match: /^#.*/, ignore: true },

	Directive: /\@[a-zA-Z_]+/,

	Variable: /\$[a-zA-Z_]+/,

	Identifier: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, keywords: {
		Query: 'query', Func: 'func', Insert: 'insert', Update: 'update',

		BooleanLiteral: { values: ['false', 'true'], categories: Literal },
		ExistenceLiteral: { values: ['null'], categories: Literal },
	}},
})




const {
  inspecting, rule, subrule, maybeSubrule, gateSubrule,
  consume, maybeConsume, maybe, or, maybeOr,
  many, maybeMany, manySeparated, maybeManySeparated,
  formatError,
} = parser.getPrimitives()

rule('api', () => {
	maybeMany(() => consume(tok.LineBreak))

	const calls = manySeparated(
		() => subrule('query'),
		() => consume(tok.LineBreak),
	)

	maybeMany(() => consume(tok.LineBreak))

	return calls
})


// rule('item', () => {
// 	return or(
// 		//
// 	)
// })

rule('query', () => {
	consume(tok.Query)
	const queryName = consume(tok.Identifier)
	const argsTuple = maybeSubrule('argsTuple')
	consume(tok.Colon)

	const topSelectable = consume(tok.Identifier)

	const queryBody = subrule('queryBody')

	if (inspecting()) return

	return new CqlQuery(queryName.value, argsTuple, topSelectable.value, queryBody)
})

rule('argsTuple', () => {
	consume(tok.LeftParen)
	const args = manySeparated(
		() => subrule('arg'),
		() => consume(tok.Comma),
	)
	consume(tok.RightParen)
	if (inspecting()) return

	return new ArgsTuple(args)
})

rule('arg', () => {
	const variable = consume(tok.Variable)

	const defaultToken = maybe(() => {
		consume(tok.Equal)
		return consume(tok.Literal)
	})

	if (inspecting()) return
	return new Arg(variable.value, defaultToken ? defaultToken.value : null)
})


rule('queryEntity', () => {
	// either a field or a nested thing
	// both can be renamed
	const entityName = subrule('aliasable')

	const queryBody = maybeSubrule('queryBody')

	if (inspecting()) return

	const [givenName, actualName] = entityName
	if (queryBody) return new NestedQuery(givenName, actualName, queryBody)
	return new QueryField(givenName, actualName)
})


rule('aliasable', () => {
	const givenNameToken = consume(tok.Identifier)

	const maybeActual = maybeConsume(tok.Colon, tok.Identifier)

	if (inspecting()) return

	const givenName = givenNameToken.value
	if (maybeActual) return [givenName, maybeActual[1].value]
	return [givenName, givenName]
})


rule('queryBody', () => {
	function doQueryEntities(wrapperType) {
		consume(tok[`Left${wrapperType}`])
		consume(tok.LineBreak)
		const queryEntities = manySeparated(
			() => subrule('queryEntity'),
			() => subrule('entitySeparator'),
		)
		consume(tok.LineBreak)
		consume(tok[`Right${wrapperType}`])
		if (inspecting()) return

		const queryMultiple = wrapperType === 'Bracket'

		return [queryEntities, queryMultiple]
	}

	return or(
		() => doQueryEntities('Brace'),
		() => doQueryEntities('Bracket'),
	)
})


rule('entitySeparator', () => {
	or(
		() => consume(tok.Comma),
		() => consume(tok.LineBreak),
	)
})


parser.analyze()

const src = fs.readFileSync('./testSrc.gql', { encoding: 'utf-8' })
// console.log(src)
// parser.lexer.reset(src)
// for (let tok of parser.lexer) console.log(tok)
parser.reset(src)
const api = parser.api()
// console.log(api)

for (const thing of api) {
	console.log('query: ', thing)
	console.log('sub: ', thing.queryBody)
}
