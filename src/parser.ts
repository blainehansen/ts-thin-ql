// import fs from 'fs'
import * as kreia from 'kreia'
import { LogError } from './utils'

type Token = kreia.Token
type TokenDefinition = kreia.TokenDefinition
type TokenType = kreia.TokenType
type Category = kreia.Category

import {
	Arg,
	Query,
	GetDirective,
	WhereType,
	WhereDirective,
	OrderDirective,
	OrderByNullsPlacement,
	QueryBlock,
	SimpleTable,
	TableChain,
	KeyReference,
	ForeignKeyChain,
	QueryColumn,
} from './astQuery'

const l = kreia.createTokenCategory('Literal')
const categories = {
	Literal: kreia.createTokenCategory('Literal'),
	NumberDirectiveInvoke: kreia.createTokenCategory('NumberDirectiveInvoke'),
	NumberDirectiveArg: kreia.createTokenCategory('NumberDirectiveArg'),
	ExpressionOperator: kreia.createTokenCategory('ExpressionOperator'),
	Fake: kreia.createTokenCategory('ExpressionOperator', l),
}

console.log(categories.Fake)

const keywords = {
	Query: 'query', Func: 'func', Insert: 'insert', Update: 'update',

	BooleanLiteral: { values: ['false', 'true'], categories: categories.Literal },

	OrderByNulls: 'nulls',
	OrderByLastFirst: ['first', 'last'],
	OrderByDescAsc: ['asc', 'desc'],

	ExistenceLiteral: { values: ['null'], categories: categories.Literal },

	NotOperator: 'not', IsOperator: 'is', InOperator: 'in', BetweenOperator: 'between',
	SymmetricOperator: 'symmetric', DistinctOperator: 'distinct', FromOperator: 'from',
}

const [parser, tokenLibrary] = kreia.createParser({
	LineBreak: { match: /\n+/, lineBreaks: true },
	Whitespace: { match: /[ \t]/, ignore: true },

	Comma: ',',
	Colon: ':',
	Float: { match: /[0-9]+\.[0-9]+/, categories: categories.Literal },
	Int: { match: /[0-9]+/, categories: [categories.Literal, categories.NumberDirectiveArg] },
	Period: '.',
	DoubleTilde: '~~', Tilde: '~',
	EqualOperator: { match: '=', categories: categories.ExpressionOperator },
	NeOperator: { match: '!=', categories: categories.ExpressionOperator },
	LtOperator: { match: '<', categories: categories.ExpressionOperator },
	LteOperator: { match: '<=', categories: categories.ExpressionOperator },
	GtOperator: { match: '>', categories: categories.ExpressionOperator },
	GteOperator: { match: '>=', categories: categories.ExpressionOperator },

	LeftParen: '(', RightParen: ')',
	LeftBracket: '[', RightBracket: ']',
	LeftBrace: '{', RightBrace: '}',

	Comment: { match: /^#.*\n+/, lineBreaks: true, ignore: true },

	GetDirectiveInvoke: /\@get/,
	WhereDirectiveInvoke: /\@where/,

	OrderDirectiveInvoke: /\@order/,
	// limit and offset can both only accept an arg or a number
	LimitDirectiveInvoke: { match: /\@limit/, categories: categories.NumberDirectiveInvoke },
	OffsetDirectiveInvoke: { match: /\@offset/, categories: categories.NumberDirectiveInvoke },
	// slice requires two numbers
	// SliceDirectiveInvoke: /\@slice/,
	InnerDirectiveInvoke: /\@inner/,

	Variable: { match: /\$[a-zA-Z_]+/, value: a => a.slice(1), categories: categories.NumberDirectiveArg },

	Identifier: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, keywords },
})

function parseTokenDefinition(t: any): t is TokenDefinition {
	return typeof t === 'object'
		&& typeof t.type === 'string'
		&& (
			t.categories === null
			|| (
				t.categories instanceof Array
				&& typeof t.categories[0] === 'string'
			)
		)
}

type Tok = typeof tokenLibrary
type Categories = typeof categories
type Keywords = typeof keywords


const tok: {
	[key in keyof Tok]: TokenType
} & {
	[key in keyof Categories]: Category
} & {
	[key in keyof Keywords]: TokenDefinition
} = {
	...tokenLibrary,
	...categories,
	...Object.keys(keywords).reduce((obj, key) => {
		const tokenLibraryMap = tokenLibrary as any as { [tokenName: string]: any }
		const tokenDef = tokenLibraryMap[key]
		if (!parseTokenDefinition(tokenDef)) throw new LogError("bad token definition?", key, tokenDef)
		obj[key as any as keyof Keywords] = tokenDef
		return obj
	}, {} as { [key in keyof Keywords]: TokenDefinition }),
}

const {
  inspecting, rule, subrule, maybeSubrule,
  consume, maybeConsume, maybe, or, maybeOr,
  many, maybeMany, manySeparated, maybeManySeparated,
  gate, gateSubrule,
} = parser.getPrimitives()

function log(...args: any[]) {
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

type ArgTable = { [argName: string]: Arg }
let argTable: ArgTable | undefined = undefined
function getFromArgTable(argName: string): Arg {
	if (!argTable) throw new Error("tried to access an undefined argTable")
	const arg = argTable[argName]
	if (!arg) throw new Error(`tried to access a non-existent arg: ${argName}`)
	return arg
}

// TODO
// let inspectionResults = undefined


// function checkManyCorrectness(queryMultiple, whereDirectives, limit) {
// 	const willReturnOne = whereDirectives instanceof GetDirective || limit === 1
// 	if (queryMultiple === willReturnOne) {
// 		if (queryMultiple) throw new Error("a block expects to return many but is using a GetDirective or has a limit of 1")
// 		else throw new Error("a block expects to return one but isn't using a GetDirective or a limit of 1")
// 		// TODO the unique pointer case isn't handled here
// 	}
// }



rule('query', () => {
	const nameTokens = consume(tok.Query, tok.Identifier)

	const argsTuple = (maybeSubrule('argsTuple') || []) as Arg[]
	if (!inspecting()) argTable = argsTuple.reduce((obj, arg) => {
		if (obj[arg.argName]) throw new LogError("duplicate declaration of argument: ", arg)
		obj[arg.argName] = arg
		return obj
	}, {} as ArgTable)

	const tableTokens = consume(tok.Colon, tok.Identifier)
	const directives = maybeSubrule('directives') || []

	const entities = subrule('nestedEntities')

	if (inspecting()) return
	argTable = undefined

	const [, { value: displayName }] = nameTokens
	const [, { value: targetTableName }] = tableTokens
	const accessObject = new SimpleTable(targetTableName)

	const [queryEntities, isMany] = entities
	const [whereDirectives = [], orderDirectives = [], limit = undefined, offset = undefined, useLeft = undefined] = directives
	// checkManyCorrectness(isMany, whereDirectives, limit)

	// displayName: string, targetTableName: string, accessObject: TableAccessor, isMany: boolean, entities: QueryObject[],
	// whereDirectives: GetDirective | WhereDirective[], orderDirectives: OrderDirective[], limit?: DirectiveValue, offset?: DirectiveValue,
	const queryBlock = new QueryBlock(
		displayName, targetTableName, accessObject, isMany, queryEntities,
		whereDirectives, orderDirectives, limit, offset, useLeft,
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
	// if table accessor is exists and is complex but nested entities doesn't exist, error
	if (tableAccessor && !(tableAccessor instanceof SimpleTable) && !entities) throw new Error()

	const displayName = initialIdentifierToken.value
	const targetTableName = (tableAccessor && tableAccessor.getTargetTableName()) || displayName

	// if entities exists, return a QueryBlock
	if (entities) {
		const [queryEntities, isMany] = entities
		const [whereDirectives = [], orderDirectives = [], limit = undefined, offset = undefined, useLeft = undefined] = directives || []
		// checkManyCorrectness(isMany, whereDirectives, limit)

		return new QueryBlock(
			displayName, targetTableName, tableAccessor || new SimpleTable(displayName), isMany, queryEntities,
			whereDirectives, orderDirectives, limit, offset, useLeft,
		)
	}

	// columnName: string, displayName: string
	return new QueryColumn(targetTableName, displayName)
})


rule('nestedEntities', () => {
	function doQueryEntities(wrapperType: 'Bracket' | 'Brace') {
		const { LeftBracket, RightBracket, LeftBrace, RightBrace } = tok
		const [left, right] = wrapperType === 'Bracket'
			? [LeftBracket, RightBracket]
			: [LeftBrace, RightBrace]

		consume(left)
		consume(tok.LineBreak)
		const queryEntities = manySeparated(
			() => subrule('queryEntity'),
			() => subrule('entitySeparator'),
		)
		consume(tok.LineBreak)
		consume(right)

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

rule('arg', (indexCounter: number) => {
	const varType = consume(tok.Variable, tok.Colon, tok.Identifier)

	const defaultValue = maybe(() => {
		consume(tok.EqualOperator)
		return subrule('literal')
	})

	if (inspecting()) return

	const [variable, , type] = varType

	// index: Int, argName: string, argType: string, defaultValue?: CqlPrimitive
	return new Arg(indexCounter, variable.value, type.value, defaultValue)
})


type NumOrArg = number | Arg
class LimitContainer { constructor(readonly limit: NumOrArg) {} }
class OffsetContainer { constructor(readonly offset: NumOrArg) {} }
// TODO something cool would be compound expressions
// class SliceContainer {
// 	readonly limit: NumOrArg
// 	readonly offset: NumOrArg
// 	constructor(start: NumOrArg, end: NumOrArg) {
// 		if (typeof start === 'number' && typeof end === 'number') {
// 			this.offset = start
// 			this.limit = end - start
// 		}
// 		this.limit
// 	}
// }
class InnerContainer { constructor() {} }

function resolveNumberDirectiveArg(token: Token): NumOrArg {
	return token.type === 'Int'
		? parseInt(token.value)
		: getFromArgTable(token.value)
}

function stripToken(token: Token) {
	if (inspecting()) return
	return token.value
}

function argOrIdent() {
	return or(() => subrule('argUsage'), () => stripToken(consume(tok.Identifier)))
}

rule('argUsage', () => {
	const variableToken = consume(tok.Variable)
	if (inspecting()) return
	return getFromArgTable(variableToken.value)
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
	let useLeft = undefined
	for (const directive of directives) {
		if (directive instanceof GetDirective) throw new Error("GetDirectives are only allowed to be by themselves")

		else if (directive instanceof LimitContainer) {
			if (limit !== undefined) throw new Error("can't have more than one limit directive")
			limit = directive.limit
			continue
		}
		else if (directive instanceof OffsetContainer) {
			if (offset !== undefined) throw new Error("can't have more than one offset directive")
			offset = directive.offset
			continue
		}
		// else if (directive instanceof SliceContainer) {
		// 	if (offset !== undefined || limit !== undefined) throw new Error("can't have a slice directive with either an offset or a limit")
		// 	limit = directive.limit
		// 	offset = directive.offset
		// 	continue
		// }
		else if (directive instanceof InnerContainer) {
			if (useLeft !== undefined) throw new Error("can't have more than one inner directive")
			useLeft = false
		}

		else if (directive instanceof WhereDirective) {
			whereDirectives.push(directive)
			continue
		}
		else if (directive instanceof OrderDirective) {
			orderDirectives.push(directive)
			continue
		}

		throw new Error("")
	}

	return [whereDirectives, orderDirectives, limit, offset, useLeft]
})

rule('directive', () => or(
	{ lookahead: 1, func: () => {
		consume(tok.GetDirectiveInvoke, tok.Colon)

		const columnToken = maybeConsume(tok.Identifier, tok.EqualOperator)
		const arg = or(() => subrule('argUsage'), () => subrule('literal'))

		if (inspecting()) return

		const getColumnName = columnToken !== undefined
			? columnToken[0].value
			: 'id'
			// TODO need inspection results!!!

		// TODO does this instead need to be a column?
		return new GetDirective(getColumnName, arg)
	}},
	{ lookahead: 1, func: () => {
		consume(tok.WhereDirectiveInvoke, tok.Colon)

		// arg or identifier
		const left = argOrIdent()
		// operator
		const operator = or(
			() => {
				const operatorToken = consume(tok.ExpressionOperator)
				if (inspecting()) return
				switch (operatorToken.type) {
					case 'EqualOperator': return WhereType.Eq
					case 'NeOperator': return WhereType.Ne
					case 'LtOperator': return WhereType.Lt
					case 'LteOperator': return WhereType.Lte
					case 'GtOperator': return WhereType.Gt
					case 'GteOperator': return WhereType.Gte
					default: throw new Error()
				}
			},
			() => {
				consume(tok.IsOperator)
				const notToken = maybeConsume(tok.NotOperator)
				// maybeConsume(tok.DistinctOperator, tok.FromOperator)
				if (inspecting()) return
				return notToken ? WhereType.Nis : WhereType.Is
			},
			() => {
				const notToken = maybeConsume(tok.NotOperator)
				return or(
					() => {
						consume(tok.InOperator)
						return notToken ? WhereType.Nin : WhereType.In
					},
					() => {
						consume(tok.BetweenOperator)
						return maybeConsume(tok.SymmetricOperator)
							? notToken ? WhereType.Nsymbet : WhereType.Symbet
							: notToken ? WhereType.Nbet : WhereType.Bet
					}
				)
			}
		)
		// arg or identifier
		const right = argOrIdent()

		if (inspecting()) return
		// readonly column: Column, readonly arg: DirectiveValue, readonly filterType: WhereType
		// TODO this isn't really correct, you need to think the fact that they may put these out of order
		// and you should probably loosen these requirements to strings
		return new WhereDirective(left, right, operator)
	}},
	{ lookahead: 1, func: () => {
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
	}},
	{ lookahead: 1, func: () => {
		const tokens = consume(tok.NumberDirectiveInvoke, tok.Colon, tok.NumberDirectiveArg)
		if (inspecting()) return

		const [directiveToken, , numberToken] = tokens
		const numberArg = resolveNumberDirectiveArg(numberToken)
		switch (directiveToken.type) {
			case 'LimitDirectiveInvoke': return new LimitContainer(numberArg)
			case 'OffsetDirectiveInvoke': return new OffsetContainer(numberArg)
			default: throw new Error()
		}
	}},
	// { lookahead: 1, func: () => {
	// 	const tokens = consume(tok.SliceDirectiveInvoke, tok.Colon, tok.LeftParen, tok.NumberDirectiveArg, tok.Comma, tok.NumberDirectiveArg, tok.RightParen)
	// 	if (inspecting()) return

	// 	const [, , , startToken, , endToken, ] = tokens

	// 	const start = resolveNumberDirectiveArg(startToken)
	// 	const end = resolveNumberDirectiveArg(endToken)

	// 	if (typeof start === 'number' && typeof end === 'number' && end <= start) throw new Error("can't slice with a start that's larger than the end")

	// 	return new SliceContainer(start, end)
	// }},
	{ lookahead: 1, func: () => {
		consume(tok.InnerDirectiveInvoke)
		return new InnerContainer()
	}}
))


rule('tableAccessor', () => or(
	{ lookahead: 1, func: () => {
		const tableNameTokens = manySeparated(
			() => consume(tok.Identifier),
			() => consume(tok.Period),
		)

		if (inspecting()) return

		const tableNames = tableNameTokens.map(t => t.value)
		if (tableNameTokens.length === 1) return new SimpleTable(tableNames[0])
		else return new TableChain(tableNames)
	}},
	{ lookahead: 1, func: () => {
		consume(tok.DoubleTilde)

		const keyReferences = manySeparated(
			() => subrule('keyReference'),
			() => consume(tok.DoubleTilde),
		)

		if (inspecting()) return

		const last = keyReferences.pop()
		// impossible because of behavior or manySeparated
		// if (!last) throw new Error("a list of KeyReferences was empty")
		if (last.tableName !== undefined) throw new LogError("the last name in a ForeignKeyChain is qualified, should be blank table name: ", last)
		// last.keyName is actually a tableName
		return new ForeignKeyChain(keyReferences, last.keyName)
	}}
))

rule('keyReference', () => {
	const initialToken = consume(tok.Identifier)
	const continuationTokens = maybeConsume(tok.Period, tok.Identifier)

	if (inspecting()) return

	const initialValue = initialToken.value
	const [keyName, tableName] = continuationTokens === undefined
		? [initialValue, undefined]
		: [continuationTokens[1].value, initialValue]

	return new KeyReference(keyName, tableName)
})


rule('literal', () => {
	const literal = consume(tok.Literal)

	if (inspecting()) return
	console.log(literal)

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

export function parseSource(source: string) {
	parser.reset(source)
	const api = parser.getTopLevel('api') as () => Query[]
	return api()
}


// const querySource = `query a_results($arg: string): a_table(@get: id = 1) {
// 	a_value: a_field
// 	through_table(@order: id asc, @limit: 3) [
// 		id, word
// 		b_record: b_table(@where: b_value in $arg) {
// 			id, b_value: b_field
// 		}
// 	]
// }`

// parser.reset(querySource)
// const queries = parser.api()
