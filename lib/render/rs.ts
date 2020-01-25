// const RUST_ROUTER_TEMPLATE = `make_api!(

// 	no_args: [
// 		{no_args_items}
// 	],

// 	args: [
// 		{args_items}
// 	],

// );
// `

// async function generateRustRouter(config: ClientConfig, actions: Action[]) {
// 	const client = await getClient(config)

// 	let no_args_index = 0
// 	let args_index = 0

// 	const rendered = actions
// 		.map(action => {
// 			const [name, verb, args, prepare, sql] = action.renderSql()

// 			if (args.length === 0)
// 				return [no_args_index++, name, verb, args, prepare, sql] as [number, string, HttpVerb, Arg[], string, string]
// 			else
// 				return [args_index++, name, verb, args, prepare, sql] as [number, string, HttpVerb, Arg[], string, string]
// 		})


// 	const validations = rendered
// 		.map(
// 			([_index, name, _verb, _args, prepare, _sql]) => client.query(prepare)
// 				.then(_ => None)
// 				.catch(e => Some([name, prepare, e]))
// 		)

// 	const errors = (await Promise.all(validations))
// 		.filter(r => r.is_some())
// 		.map(r => {
// 			const [queryName, sql, { message }] = r.unwrap()
// 			return { message, queryName, sql }
// 		})

// 	await client.end()

// 	if (errors.length > 0) {
// 		process.exitCode = 1

// 		const e = chalk.bold.red
// 		const g = chalk.gray
// 		const v = chalk.bold.green
// 		const s = chalk.bold.cyan

// 		console.error(
// 			e("Some of the sql generated from your tql actions isn't correct according to postgres.\n")
// 			+ e("Here are the ones that failed:\n\n")
// 			+ errors
// 				.map(({ message, queryName, sql }) => g(
// 					`  message: ${v(message)}\n  queryName: ${v(queryName)}\n  sql:\n\t${s(sql)}`
// 				))
// 				.join('\n\n')
// 		)
// 	}

// 	// otherwise we'll get on to the business of generating rust!
// 	// const connectionParams: string[] = []
// 	// const routeParams: string[] = []

// 	const no_args_items: string[] = []
// 	const args_items: string[] = []

// 	for (const [initalIndex, name, httpVerb, args, _prepare, sql] of rendered) {
// 		const typeName = pascalCase(name)
// 		const funcName = snakeCase(name)
// 		const httpVerbText = httpVerb.toLowerCase()

// 		// Posts, posts, "/posts", get, 0, r##"select array_agg(title) :: text from post"##;
// 		// Post, post, "/post/{post_id}/{msg}", get, 1, r##"select json_build_object('title', post.title, 'msg', $2) :: text from post where id = $1"##, [post_id, i32, INT4; msg, String, TEXT];

// 		const haveArgs = args.length !== 0

// 		const [index, argsRouteText, argsText] = haveArgs
// 			? [
// 				no_args_index + initalIndex,
// 				`/${args.map(arg => `{${arg.argName}}`).join('/')}`,
// 				`, [${args.map(arg => [arg.argName, ...getRustTypes(arg.argType, arg.nullable)].join(', ')).join('; ')}]`,
// 			]
// 			: [initalIndex, '', '']

// 		const item = `${typeName}, ${funcName}, "/${funcName}${argsRouteText}", ${httpVerbText}, ${index}, r##"${sql}"##${argsText}`

// 		if (haveArgs) args_items.push(item)
// 		else no_args_items.push(item)
// 	}


// 	return RUST_ROUTER_TEMPLATE
// 		.replace('{args_items}', args_items.join('; '))
// 		.replace('{no_args_items}', no_args_items.join('; '))
// }
