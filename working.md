So the top level api of this thing:

- create `tql` file(s)
- some `generate` method is called with the path of that file
- it first gets the database inspection information (either by retrieving a cached version of it or doing it again)
- then we parse, resolve, and render the queries
- then we prepare them against the database, to let the database do basically all the validation work
- we use the original query *names* and all the type information we need to generate a typescript file representing our api (this will be delivered by a webpack loader)
- we use the prepared statements, and the query names, to generate a rust router that does whatever basic auth is required, chooses which prepared statement to use, and validates the incoming raw json with serde (maybe we actually let the database do more work??), before shipping it off to the database, and proxying the string that comes back to the user again

the big question is how to resolve the inspection information with the parsed file
no matter what, at *some* layer we have to combine those two

there are a few options

- the parser is stupid, and just parses strings and feeds that information into smart ast classes, which do the work of resolving that information from inspection results (I'm leaning towards this, since the parser has a harder time safely passing around information, and is already a pretty crowded mess)

- the parser is smart, and itself looks things up from the inspection results before passing it down to ast classes that are dumber, but contain more heavily verified information

- some third option, in which both the parser and ast are dumb, and some third base of code takes the final dumb ast and "fixes" it with inspection results (I don't like this, it's just more work and spreads the logic out all over the place. and it would likely be slow, since we'd have to walk this thing).


So it seems I'm going for this: the top level function performs the database inspection, then declares the inspection results in a place where the ast classes can get to it. the ast classes do all the work of transforming raw strings



The other question is *when* the ast classes do the resolution. It seems that for a lot of things, the only time that makes any sense is when you render, because then you have *all* the information you need.










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
