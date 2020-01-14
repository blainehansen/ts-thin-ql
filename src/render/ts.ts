import ts = require('typescript')
import { Delete as _Delete, WhereDirective } from '../ast'


export function Delete(d: _Delete) {
	return ts.createFunctionDeclaration(
		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
		undefined, ts.createIdentifier(d.name),
		// generics
		[ts.createTypeParameterDeclaration(
				ts.createIdentifier('DUDE'),
				ts.createTypeReferenceNode(ts.createIdentifier('thing'), undefined),
				undefined,
			)],
		[
			ts.createParameter(
				undefined, undefined, undefined,
				ts.createIdentifier('a'), undefined,
				ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword), undefined,
			),
		],
		ts.createTypeReferenceNode(ts.createIdentifier('stuff'), undefined),
		ts.createBlock([
			ts.createReturn(
				ts.createAsExpression(
					ts.createIdentifier('b'),
					ts.createTypeReferenceNode(ts.createIdentifier('R'), [
						ts.createTypeReferenceNode(ts.createIdentifier('thing'), undefined),
					]),
				),
			),
		], true),
	)
}

