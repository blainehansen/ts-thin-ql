// class Insert {
// 	constructor(readonly displayName: string, readonly manifest: InsertManifest) {}

// 	renderSql() {
// 		const insertString = this.manifest.renderSql(true)
// 		return `prepare __cq_insert_${this.displayName} (jsonb) as\n${insertString}\n;`
// 	}

// 	renderTs() {
// 		// this is just a bunch of code to keep in mind, it might not be correct
// 		const needsBody = HttpVerb.needsBody(httpVerb)

// 		// const bodyTypeName = pascalCase(displayNameBody)
// 		// this would act as a prefix to all association ones

// 		// const bodyPrepend = needsBody ? `data: ${bodyTypeName}, ` : ''

// 		// const args = bodyPrepend + action.argsTuple.map(arg => {
// 		// 	const tsType = postgresToTsTypeMap[arg.argType]
// 		// 	const defaultValue = arg.defaultValue
// 		// 	const defaultAppend = defaultValue !== undefined ? ` = ${renderPrimitive(defaultValue)}` : ''
// 		// 	return `${arg.argName}: ${tsType}${defaultAppend}`
// 		// }).join(', ')

// 		// const innerArgsUsage = action.argsTuple.map(arg => `${arg.argName}: ${arg.argName},`).join(',\n\t\t')
// 		// const bodyUsagePrepend = needsBody ? 'data, ' : ''
// 		// const argsUsage = bodyUsagePrepend + `{ params: { ${innerArgsUsage} } }`
// 	}
// }


// class InsertManifest {
// 	constructor(readonly tableName: string, readonly manifests: InsertManifest[], readonly negatedColumns: string[]) {}

// 	renderSql(isRoot: bool = false) {
// 		// there's another wrinkle here
// 		// if the manifest in question is multiple (so from the parent we're pointing at many)
// 		// then we first need to unnest


// 		// and if the nested thing *we* actually point at!!!
// 		// in that situation we have to create it first!




// 		// if this layer is the root,
// 		// then it should renderSql without the existence join

// 		// if it has nested associations it should return id
// 		// furthermore, we should only bother to return id at all if the root table has a simple autoincrementing id
// 		// (or in other words, if they didn't have to provide all the information themselves)

// 		// if this layer doesn't have any nested items,
// 		// then it shouldn't produce a with block

// 		// if it does have nested items, it should produce a


// 		// essentially, each layer renders as either a single insert statement (when a leaf)
// 		// or first the parent and then all it's children at this level

// 		// to know what columns to not include, we need to understand if the table in question has an autoincrementing id
// 		// and further in the future, understanding what the server user is even capable of seeing
// 		// then we *also* remove anything in the negatedColumns

// 		return `
// 			with
// 		`
// 	}
// }
