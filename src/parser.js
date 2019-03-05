const fs = require('fs')
const kreia = require('kreia')

const {
	Arg,
	Query,
	GetDirective,
	FilterType,
	FilterDirective,
	OrderDirective,
	OrderByNullsPlacement,
	QueryBlock,
	SimpleTable,
	TableChain,
	KeyReference,
	ForeignKeyChain,
	QueryColumn,
} = require('../dist/astClasses')

const Literal = kreia.createTokenCategory('Literal')
const WhereDirectiveInvoke = kreia.createTokenCategory('WhereDirectiveInvoke')
const NumberDirectiveInvoke = kreia.createTokenCategory('NumberDirectiveInvoke')
const NumberDirectiveArg = kreia.createTokenCategory('NumberDirectiveArg')
const ExpressionOperator = kreia.createTokenCategory('ExpressionOperator')
// const expressionOperators = Object.entries(FilterDirective.operatorTexts)

const [parser, tok] = kreia.createParser({
	LineBreak: { match: /\n+/, lineBreaks: true },
	Whitespace: { match: /[ \t]/, ignore: true },

	Comma: ',',
	Colon: ':',
	Float: { match: /[0-9]+\.[0-9]+/, categories: Literal },
	Int: { match: /[0-9]+/, categories: [Literal, NumberDirectiveArg] },
	Period: '.',
	DoubleTilde: '~~', Tilde: '~',
	EqualOperator: { match: '=', categories: ExpressionOperator },
	NeOperator: { match: '!=', categories: ExpressionOperator },
	LtOperator: { match: '<', categories: ExpressionOperator },
	LteOperator: { match: '<=', categories: ExpressionOperator },
	GtOperator: { match: '>', categories: ExpressionOperator },
	GteOperator: { match: '>=', categories: ExpressionOperator },

	LeftParen: '(', RightParen: ')',
	LeftBracket: '[', RightBracket: ']',
	LeftBrace: '{', RightBrace: '}',

	Comment: { match: /^#.*\n+/, lineBreaks: true, ignore: true },

	GetDirectiveInvoke: { match: /\@get/, categories: WhereDirectiveInvoke },
	FilterDirectiveInvoke: { match: /\@filter/, categories: WhereDirectiveInvoke },

	OrderDirectiveInvoke: /\@order/,
	// limit and offset can both only accept an arg or a number
	LimitDirectiveInvoke: { match: /\@limit/, categories: NumberDirectiveInvoke },
	OffsetDirectiveInvoke: { match: /\@offset/, categories: NumberDirectiveInvoke },
	// slice requires two numbers
	SliceDirectiveInvoke: /\@slice/,

	Variable: { match: /\$[a-zA-Z_]+/, value: a => a.slice(1), categories: NumberDirectiveArg },

	Identifier: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, keywords: {
		Query: 'query', Func: 'func', Insert: 'insert', Update: 'update',

		BooleanLiteral: { values: ['false', 'true'], categories: Literal },

		OrderByNulls: 'nulls',
		OrderByLastFirst: ['first', 'last'],
		OrderByDescAsc: ['asc', 'desc'],

		ExistenceLiteral: { values: ['null'], categories: Literal },

		NotOperator: 'not', IsOperator: 'is', InOperator: 'in', BetweenOperator: 'between',
		SymmetricOperator: 'symmetric', DistinctOperator: 'distinct', FromOperator: 'from',
	}},
})


const {
  inspecting, rule, subrule, maybeSubrule,
  consume, maybeConsume, maybe, or, maybeOr,
  many, maybeMany, manySeparated, maybeManySeparated,
  formatError,
  gate, gateSubrule,
} = parser.getPrimitives()

function log(...args) {
	if (!inspecting()) console.log(...args)
}


rule('api', () => {
	// maybeSubrule('manyLineBreak')
	maybeConsume(tok.LineBreak)

	const calls = manySeparated(
		() => subrule('query'),
		// () => subrule('manyLineBreak'),
		() => consume(tok.LineBreak),
	)

	// maybeSubrule('manyLineBreak')
	maybeConsume(tok.LineBreak)

	return calls
})

let argTable = undefined
// TODO
// let inspectionResults = undefined


function checkManyCorrectness(queryMultiple, whereDirectives, limit) {
	const willReturnOne = whereDirectives instanceof GetDirective || limit === 1
	if (queryMultiple === willReturnOne) {
		if (queryMultiple) throw new Error("a block expects to return many but is using a GetDirective or has a limit of 1")
		else throw new Error("a block expects to return one but isn't using a GetDirective or a limit of 1")
		// TODO the unique pointer case isn't handled here
	}
}


rule('query', () => {
	const nameTokens = consume(tok.Query, tok.Identifier)

	const argsTuple = maybeSubrule('argsTuple') || []
	if (!inspecting()) argTable = argsTuple.reduce((obj, arg) => {
		if (obj[arg.argName]) throw new LogError("duplicate declaration of argument: ", queryName, arg)
		obj[arg.argName] = arg
	}, {})

	const tableTokens = consume(tok.Colon, tok.Identifier)
	const directives = maybeSubrule('directives') || []

	const entities = subrule('nestedEntities')
	argTable = undefined

	if (inspecting()) return

	const [, { value: displayName }] = nameTokens
	const [, { value: targetTableName }] = tableTokens
	const accessObject = new SimpleTable(targetTableName)

	const [queryEntities, isMany] = entities
	const [whereDirectives = [], orderDirectives = [], limit = undefined, offset = undefined] = directives
	checkManyCorrectness(isMany, whereDirectives, limit)

	// displayName: string, targetTableName: string, accessObject: TableAccessor, isMany: boolean, entities: QueryObject[],
	// whereDirectives: GetDirective | FilterDirective[], orderDirectives: OrderDirective[], limit?: DirectiveValue, offset?: DirectiveValue,
	const queryBlock = new QueryBlock(
		displayName, targetTableName, accessObject, isMany, queryEntities,
		whereDirectives, orderDirectives, limit, offset,
	)

	// queryName: string, argsTuple: Arg[], queryBlock: QueryBlock
	return new Query(displayName, argsTuple, queryBlock)
})


rule('queryEntity', () => {
	const initialIdentifierToken = consume(tok.Identifier)

	const tableAccessor = maybe(() => {
		consume(tok.Colon)
		return subrule('tableAccessor')
	})

	const directives = maybeSubrule('directives')
	const entities = maybeSubrule('nestedEntities')

	if (inspecting()) return

	// if directives exists but nested entities doesn't, error
	if (directives && !entities) throw new Error()
	// if table accessor is complex but nested entities doesn't exist, error
	if (!(tableAccessor instanceof SimpleTable) && entities) throw new Error()

	const displayName = initialIdentifierToken.value
	const targetTableName = (tableAccessor && tableAccessor.getTargetTableName()) || displayName

	// if entities exists, return a QueryBlock
	if (entities) {
		const [queryEntities, isMany] = entities
		const [whereDirectives = [], orderDirectives = [], limit = undefined, offset = undefined] = directives || []
		checkManyCorrectness(isMany, whereDirectives, limit)

		return new QueryBlock(
			displayName, targetTableName, tableAccessor, isMany, queryEntities,
			whereDirectives, orderDirectives, limit, offset,
		)
	}

	// columnName: string, displayName: string
	return new QueryColumn(targetTableName, displayName)
})


rule('nestedEntities', () => {
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
		consume(tok.EqualOperator)
		return subrule('primitive')
	})

	if (inspecting()) return

	const [variable, , type] = varType

	// index: Int, argName: string, argType: string, defaultValue?: CqlPrimitive
	return new Arg(indexCounter, variable.value, type.value, defaultValue)
})


class LimitContainer { constructor(limit) { this.limit = limit } }
class OffsetContainer { constructor(offset) { this.offset = offset } }
class SliceContainer { constructor(limit, offset) { this.limit; this.offset = offset } }

function resolveNumberDirectiveArg(token) {
	return token.type === 'Int'
		? [true, parseInt(token.value)]
		: [false, argTable[token.value]]
}

function stripToken(token) {
	if (inspecting()) return
	return token.value
}

function argOrIdent() {
	return or(() => subrule('argUsage'), () => stripToken(consume(tok.Identifier)))
}

rule('argUsage', () => {
	const variableToken = consume(tok.Variable)
	if (inspecting()) return
	const existingArg = argTable[variableToken.value]
	if (!existingArg) throw new Error(`non-existent arg: ${variableToken.value}`)
	return existingArg
})

rule('directives', () => {
	consume(tok.LeftParen)
	const directives = manySeparated(() => subrule('directive'), () => consume(tok.Comma))
	consume(tok.RightParen)

	if (inspecting()) return

	if (directives.length === 1 && directives[0] instanceof GetDirective) return [directives[0], undefined, undefined, undefined]

	const whereDirectives = []
	const orderDirectives = []
	let limit = undefined
	let offset = undefined
	for (const directive of directives) {
		if (directive instanceof GetDirective) throw new Error("GetDirectives are only allowed to be by themselves")

		else if (directive instanceof LimitContainer) {
			if (limit !== undefined) throw new Error("can't have more than one limit directive")
			limit = directive.limit
		}
		else if (directive instanceof OffsetContainer) {
			if (offset !== undefined) throw new Error("can't have more than one offset directive")
			offset = directive.offset
		}
		else if (directive instanceof SliceContainer) {
			if (offset !== undefined || limit !== undefined) throw new Error("can't have a slice directive with either an offset or a limit")
			limit = directive.limit
			offset = directive.offset
		}

		else if (directive instanceof FilterDirective) whereDirectives.push(directive)
		else if (directive instanceof OrderDirective) orderDirectives.push(directive)

		throw new Error("")
	}

	return [whereDirectives, orderDirectives, limit, offset]
})

rule('directive', () => or(
	() => {
		consume(tok.GetDirectiveInvoke, tok.Colon)

		const columnToken = maybeConsume(tok.Identifier, tok.EqualOperator)
		const arg = argOrIdent()

		if (inspecting()) return

		// TODO does this instead need to be a column?
		return new GetDirective(columnToken.value, arg)
	},
	() => {
		consume(tok.FilterDirectiveInvoke, tok.Colon)

		// arg or identifier
		const left = argOrIdent()
		// operator
		const operator = or(
			() => {
				const operatorToken = consume(tok.ExpressionOperator)
				if (inspecting()) return
				switch (operatorToken.type) {
					case 'EqualOperator': return FilterType.Eq
					case 'NeOperator': return FilterType.Ne
					case 'LtOperator': return FilterType.Lt
					case 'LteOperator': return FilterType.Lte
					case 'GtOperator': return FilterType.Gt
					case 'GteOperator': return FilterType.Gte
					default: throw new Error()
				}
			},
			() => {
				consume(tok.IsOperator)
				const notToken = maybeConsume(tok.NotOperator)
				// maybeConsume(tok.DistinctOperator, tok.FromOperator)
				if (inspecting()) return
				return notToken ? FilterType.Nis : FilterType.Is
			},
			() => {
				const notToken = maybeConsume(tok.NotOperator)
				return or(
					() => {
						consume(tok.InOperator)
						return notToken ? FilterType.Nin : FilterType.In
					},
					() => {
						consume(tok.BetweenOperator)
						return maybeConsume(tok.SymmetricOperator)
							? notToken ? FilterType.Nsymbet : FilterType.Symbet
							: notToken ? FilterType.Nbet : FilterType.Bet
					}
				)
			}
		)
		// arg or identifier
		const right = argOrIdent()

		if (inspecting()) return
		// readonly column: Column, readonly arg: DirectiveValue, readonly filterType: FilterType
		// TODO this isn't really correct, you need to think the fact that they may put these out of order
		// and you should probably loosen these requirements to strings
		return new FilterDirective(left, right, operator)
	},
	() => {
		// for now, we'll only allow an identifier
		consume(tok.OrderDirectiveInvoke, tok.Colon)

		const sortColumnToken = consume(tok.Identifier)

		const ascDescToken = maybeConsume(tok.OrderByDescAsc)
		const nullsTokens = maybeConsume(tok.OrderByNulls, tok.OrderByLastFirst)

		if (inspecting()) return

		// readonly column: QueryColumn, readonly ascending?: boolean, readonly nullsPlacement?: OrderByNullsPlacement
		const [, lastFirstToken] = nullsTokens || [undefined, undefined]
		// TODO this column business needs to be figured out
		return new OrderDirective(
			sortColumnToken.value,
			ascDescToken ? ascDescToken.value === 'asc' : undefined,
			lastFirstToken
				? lastFirstToken.value === 'first' ? OrderByNullsPlacement.First : OrderByNullsPlacement.Last
				: undefined,
		)
	},
	() => {
		const tokens = consume(tok.NumberDirectiveInvoke, tok.Colon, tok.NumberDirectiveArg)
		if (inspecting()) return

		const [directiveToken, , numberToken] = tokens
		const [, numberArg] = resolveNumberDirectiveArg(numberToken)
		switch (directiveToken.type) {
			case 'LimitDirectiveInvoke': return new LimitContainer(numberArg)
			case 'OffsetDirectiveInvoke': return new OffsetContainer(numberArg)
			default: throw new Error()
		}
	},
	() => {
		const tokens = consume(tok.SliceDirectiveInvoke, tok.Colon, tok.LeftParen, tok.NumberDirectiveArg, tok.Comma, tok.NumberDirectiveArg, tok.RightParen)
		if (inspecting()) return

		const [, , , startToken, , endToken, ] = tokens

		const [startIsNumber, start] = resolveNumberDirectiveArg(startToken)
		const [endIsNumber, end] = resolveNumberDirectiveArg(endToken)

		if (start === undefined) throw new Error()
		if (end === undefined) throw new Error()
		if (startIsNumber && endIsNumber && end <= start) throw new Error()

		return new SliceContainer(start, end - start)
	},
))


rule('tableAccessor', () => or(
	() => {
		const tableNameTokens = manySeparated(
			() => consume(tok.Identifier),
			() => consume(tok.Period),
		)

		if (inspecting()) return

		const tableNames = tableNameTokens.map(t => t.value)
		if (tableNameTokens.length === 1) return new SimpleTable(tableNames[0])
		else return new TableChain(tableNames)
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

rule('entitySeparator', () => or(
	() => consume(tok.Comma),
	() => consume(tok.LineBreak),
))


parser.analyze()

// const src = fs.readFileSync('./src/testSrc.gql', { encoding: 'utf-8' })
// console.log(src)
// parser.lexer.reset(src)
// for (let tok of parser.lexer) console.log(tok)
// parser.reset(src)
// const api = parser.api()

// for (const query of api) {
// 	console.log('query:', query)
// 	// console.log('rendered:', query.render())
// }


module.exports = {
	parseSource(source) {
		parser.reset(source)
		return parser.api()
	}
}
