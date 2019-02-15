We inspect (can be typed)
We parse (probably will be pure javascript for a while)
That creates an ast
The ast has methods to generate both sql and the api code (eventual)


Start with an api of pure typed functions, then move to a parsed thing

This is explicitly about returning json-formed objects
If you want rows, there will be an api for that, and it will return content-type csv




we can do output type code generation
to handle puts, we can do coalesce to null


allow embeds that hop
`#` is comment


explicitly show multiple versus single

allow aliases

allow variables


we don't allow functions of any kinds. that's for in-sql computed functions
only counts can be returned?


arguments are always inferred, and can be escaped `\$amount`
only to give them arguments do you use `@default`


Since this is all supposed to be compile time, we can do type checking without having to hook into the language.
This also means we can do return type code-generation, so that results are type-checked

```python
# perhaps also have a `filter_one`
query scott($id, $amount = 2000): actor(@get: $id) {
	# possibly pluralize array returns by default?
	movies: movie(@filter: box_office > $amount) [
		# here we have variables
		title, box_office
		# here this would be the default
		writer_name: writer.name
	]
	# this returns an array. this is more explicit

	# this will be an array of bare values
	# this way of writing things is a shorthand
	# it's a very specific thing, it has to be on the same line
	comps: [movie.compensation]
}

# this basically just uses an inner join instead of a left one
query guild_actors: actor(@exists: actor.guild_membership) [
	name
	biography
	hometown {
		name
		population
	}
]


# ambiguous foreign keys
query attributed_dimensions: dimension(@filter: id in [1, 2, 3], @exists: attributes) [
	# we can infer what intermediate tables are used
	attributes: ~ancestor_id~descendent_id~dimension(@filter: type in ['a', 'b', 'c']) [
		name
		type
		dimension_value
	]

	# in the event of foreign keys not being enough
	# so if multiple people might use an "ancestor_id" to point to us, we can say who
	attributes: ~dimension_relationship.ancestor_id~descendent_id~dimension(@filter: type in ['a', 'b', 'c']) [
		...
	]


	# if this were something like an ambiguous view, where the thing to join to were confusing, we could do this
	attributes: .~view_transformed_id~dimension_relationship.ancestor_id~descendent_id~dimension(@filter: type in ['a', 'b', 'c']) [
		...
	]
]


# views and immutable functions can be accessed just like tables

# this will call a sql function
# here's the shorter version
# the top level key will be dudes_func
func dudes: dudes_func(static_arg, $dynamic_arg) [
	name
	associates [
		name
	]
]

# specifying children to update makes sense. it makes it explicit and can improve performance
# eventually, this will detect allowed insert keys, and use that for code-generation safety
insert set_stuff: movie{actors{compensation}} {
	name
	dudes
	actors [
		name
		compensation {
			amount
		}
	]
}

# @extend works will all varieties, and only works on the return value
insert different_set_stuff @extend set_stuff -movie.dudes +compensation.currency

```

```js
movie_table.insert('set_stuff', payload)

// across all cql files, each must have a unique top-level alias
// we'll just always enforce it for the

// this will use a webpack loader
const api = require('@/api.cql')
// or maybe...
const api = require('@/_generated_cq_api.js')

api.queryName(...args)
api.queryName.kwargs(optionsObject)

// this will perform several queries in one transaction,
// returning an object with the name of each query
api.transaction(api)
```
