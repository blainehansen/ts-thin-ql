const kreia = require('kreia')
const fs = require('fs')

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

	Comment: { match: /^#.*/, ignore: true },

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
		SymmetricOperator: 'symmetric', DistinctOperator: 'distinct' FromOperator: 'from',
	}},
})


const {
  inspecting, rule, subrule, maybeSubrule,
  consume, maybeConsume, maybe, or, maybeOr,
  many, maybeMany, manySeparated, maybeManySeparated,
  formatError,
  gate, gateSubrule,
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

let argTable = undefined

rule('query', () => {
	consume(tok.Query)
	const queryName = consume(tok.Identifier)
	const argsTuple = maybeSubrule('argsTuple') || []
	consume(tok.Colon)

	const topSelectable = consume(tok.Identifier)

	// TODO here replace an argmap that let's
	// lower portions of the parse look up valid args
	argTable = argsTuple.reduce((obj, arg) => {
		if (obj[arg.argName]) throw new LogError("duplicate declaration of argument: ", queryName, arg)
		obj[arg.argName] = arg
	}, {})
	const queryBlock = subrule('queryBlock', queryName)
	argTable = undefined

	if (inspecting()) return

	// queryName: string, argsTuple: Arg[], queryBlock: QueryBlock
	return new Query(queryName.value, argsTuple, queryBlock)
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


class LimitContainer { constructor(limit) { this.limit = limit } }
class OffsetContainer { constructor(offset) { this.offset = offset } }
class SliceContainer { constructor(limit, offset) { this.limit; this.offset = offset } }

function resolveNumberDirectiveArg(token) {
	return token.type === 'Int'
		? [true, parseInt(token.value)]
		: [false, argTable[token.value]]
}

function argOrIdent() {
	return or(() => {
	}, () => consume(tok.Identifier))
}

rule('argUsage', () => {
	const variableToken = consume(tok.Variable)
	if (inspecting()) return
	const existingArg = argTable[variableToken.value]
	if (!existingArg) throw new Error(`non-existent arg: ${variableToken.value}`)
	return existingArg
})

rule('directive', () => or(
	() => {
		consume(tok.GetDirectiveInvoke, tok.Colon)

		maybeConsume(tok.Identifier, tok.EqualOperator)
		argOrIdent()
	}
	() => {
		consume(tok.FilterDirectiveInvoke, tok.Colon)


		// arg or identifier
		const left = argOrIdent()
		// operator
		const operator = or(
			() => consume(tok.ExpressionOperator),
			() => {
				consume(tok.IsOperator)
				maybeConsume(tok.NotOperator)
				maybeConsume(tok.DistinctOperator, tok.FromOperator)
			},
			() => {
				maybeConsume(tok.NotOperator)
				or(
					() => consume(tok.InOperator),
					() => {
						consume(tok.BetweenOperator)
						maybeConsume(tok.SymmetricOperator)
					}
				)
			}
		)
		// arg or identifier
		const right = argOrIdent()

		if (inspecting()) return
		const [directiveToken, ] = directiveTokens
		if (directiveToken.value === 'get') return new GetDirective()
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

rule('directive', () => {
	// WhereDirectiveInvoke
	// OrderDirectiveInvoke
	// NumberDirectiveInvoke
	// SliceDirectiveInvoke

	const directiveTokens = consume(tok.DirectiveInvoke, tok.Colon)
	const directiveExpression = subrule('directiveExpression')

	if (inspecting()) return

	const [{ type: directiveType }, ] = directiveTokens

	switch (directiveType) {
		case 'GetDirectiveInvoke':
			// readonly column: Column, readonly arg: DirectiveValue
			return new GetDirective()

		case 'FilterDirectiveInvoke':
			FilterType
			// readonly column: Column, readonly arg: DirectiveValue, readonly filterType: FilterType
			return new FilterDirective()

		case 'OrderDirectiveInvoke':
			// readonly column: QueryColumn, readonly ascending: boolean
			return new OrderDirective()

		case 'LimitDirectiveInvoke':
			if (directiveExpression.type !== 'number') throw new Error()
			return [true, directiveExpression.value]
		case 'OffsetDirectiveInvoke':
			if (directiveExpression.type !== 'number') throw new Error()
			return [false, directiveExpression.value]
		case 'SliceDirectiveInvoke':
			return [start, end]

		default: throw new Error()
	}
})


rule('directiveExpression', () => or(
	() => {},
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
