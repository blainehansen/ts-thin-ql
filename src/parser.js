const kreia = require('kreia')
const fs = require('fs')

const Literal = kreia.createTokenCategory('Literal')

const [parser, tok] = kreia.createParser({
	LineBreak: { match: /\n+/, lineBreaks: true },
	Whitespace: { match: /[ \t]/, ignore: true },

	Comma: ',',
	Colon: ':',
	Float: { match: /[0-9]+\.[0-9]+/, categories: Literal },
	Int: { match: /[0-9]+/, categories: Literal },
	Period: '.',
	DoubleTilde: '~~', Tilde: '~',
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
  inspecting, rule, subrule, maybeSubrule,
  consume, maybeConsume, maybe, or, maybeOr,
  many, maybeMany, manySeparated, maybeManySeparated,
  formatError,
  gate, gateSubrule,
} = parser.getPrimitives()

const {
	Arg,
	Query,
	GetDirective,
	FilterType,
	FilterDirective,
	OrderDirective,
	QueryBlock,
	SimpleTable,
	TableChain,
	KeyReference,
	ForeignKeyChain,
	QueryColumn,
} = require('../dist/astClasses')

rule('api', () => {
	maybeMany(() => consume(tok.LineBreak))

	const calls = manySeparated(
		() => subrule('query'),
		() => consume(tok.LineBreak),
	)

	maybeMany(() => consume(tok.LineBreak))

	return calls
})


rule('query', () => {
	consume(tok.Query)
	const queryName = consume(tok.Identifier)
	const argsTuple = maybeSubrule('argsTuple')
	consume(tok.Colon)

	const topSelectable = consume(tok.Identifier)

	const queryBlock = subrule('queryBlock', queryName)

	if (inspecting()) return

	new SimpleTable(topSelectable.value)

	// queryName: string, argsTuple: Arg[], queryBlock: QueryBlock
	return new Query(queryName.value, argsTuple || [], queryBlock)
})

rule('argsTuple', () => {
	consume(tok.LeftParen)
	let indexCounter = 0
	const args = manySeparated(
		() => {
			indexCounter++
			return subrule('arg', indexCounter)
		},
		() => consume(tok.Comma),
	)
	consume(tok.RightParen)
	return args
})

rule('arg', (indexCounter) => {
	const varType = consume(tok.Variable, tok.Colon, tok.Identifier)

	const defaultValue = maybe(() => {
		consume(tok.Equal)
		return subrule('primitive')
	})

	if (inspecting()) return

	const [variable, , type] = varType

	// index: Int, argName: string, argType: string, defaultValue?: CqlPrimitive
	return new Arg(indexCounter, variable.value, type.value, defaultValue)
})


rule('queryEntity', () => {
	// either a column or a nested thing
	// both can be renamed
	const entityName = subrule('aliasable')

	const queryBlock = maybeSubrule('queryBlock')

	if (inspecting()) return

	const [displayName, actualName] = entityName
	if (queryBlock) return new NestedQuery(displayName, actualName, queryBlock)
	return new QueryColumn(displayName, actualName)
})


rule('queryBlock', (queryName = undefined) => {
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

	const displayAndAccessor = or(
		{
			// if there's no "from above" queryName, then we could get our own
			gate: () => queryName === undefined,
			func: () => {
				const initialIdentifier = consume(tok.Identifier)
				const tableAccessor = maybe(() => {
					consume(tok.Colon)
					return subrule('tableAccessor')
				})

				if (inspecting()) return

				// [displayName, tableAccessor]
				const initialValue = initialIdentifier.value
				return [initialValue, tableAccessor || new SimpleTable(initialValue)]
			},
		},
		() => [queryName.value, subrule('tableAccessor')],
	)

	const directives = maybe(() => {
		consume(tok.LeftParen)
		const directives = manySeparated(() => {
			//
		}, () => consume(tok.Comma))
		consume(tok.RightParen)
		// TODO put everything in order
		return directives
	})

	const entitiesTuple = or(
		() => doQueryEntities('Brace'),
		() => doQueryEntities('Bracket'),
	)

	if (inspecting()) return

	const [displayName, tableAccessor] = displayAndAccessor
	// TODO do some checking, if they don't have a display name, and the table accessor is not simple table, blow up
	// if (queryName !== undefined && !(tableAccessor instanceof SimpleTable))
	const [entities, isMany] = entitiesTuple
	const [whereDirectives = [], orderDirectives = [], limit = undefined, offset = undefined] = directives || []

	// displayName: string, targetTableName: string, accessObject: TableAccessor, isMany: boolean,
	// whereDirectives: GetDirective | FilterDirective[], orderDirectives: OrderDirective[], entities: QueryObject[],
	// limit?: Int, offset?: Int,
	return new QueryBlock(displayName, tableAccessor.getTargetTableName(), tableAccessor, isMany, whereDirectives, orderDirectives, entities, limit, offset)
})


rule('tableAccessor', () => or(
	() => {
		const tableNameTokens = manySeparated(
			() => consume(tok.Identifier),
			() => consume(tok.Period),
		)

		if (inspecting()) return

		if (tableNameTokens.length === 1) return new SimpleTable(tableNameTokens[0].value)
		else return new TableChain(tableNameTokens.map(t => t.value))
	},
	() => {
		consume(tok.DoubleTilde)

		const keyReferences = manySeparated(
			() => subrule('keyReference'),
			() => consume(tok.DoubleTilde),
		)

		if (inspecting()) return

		const last = keyReferences.pop()
		// impossible because of behavior or manySeparated
		// if (!last) throw new Error("a list of KeyReferences was empty")
		if (last.tableName !== undefined) throw new Error("the last name in a ForeignKeyChain is qualified, should be blank table name: ", last)
		// last.keyName is actually a tableName
		return new ForeignKeyChain(keyReferences, last.keyName)
	}
))

rule('keyReference', () => {
	const initialToken = consume(tok.Identifier)
	const continuationTokens = maybeConsume(tok.Period, tok.Identifier)

	if (inspecting()) return

	const initialValue = initialToken.value
	const [keyName, tableName] = continuationTokens
		? [initialValue, undefined]
		: [continuationTokens[1].value, initialValue]

	return new KeyReference(keyName, tableName)
})


rule('aliasable', () => {
	const displayNameToken = consume(tok.Identifier)

	const maybeActual = maybeConsume(tok.Colon, tok.Identifier)

	if (inspecting()) return

	const displayName = displayNameToken.value
	if (maybeActual) return [displayName, maybeActual[1].value]
	return [displayName, displayName]
})


rule('primitive', () => {
	const literal = consume(tok.Literal)

	if (inspecting()) return

	const literalValue = literal.value
	switch (literal.type) {
		case 'Str': return literalValue
		case 'Int': return parseInt(literalValue)
		case 'Float': return parseFloat(literalValue)
		case 'BooleanLiteral': return literalValue === 'true' ? true : false
		case 'ExistenceLiteral': return null
	}
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
	console.log('sub: ', thing.queryBlock)
}
