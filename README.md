This project is one of many on a long and painful quest to close soundness gaps in the software ecosystems I work in, and make all the tools I use completely typesafe. [Read about the journey in this blog post.](https://blainehansen.me/post/my-path-to-magma/)

This project is dormant for now as I build the [Magma proof checker](https://github.com/blainehansen/magma), but I might return to it and use Magma to take it to the next level.

Feel free to check out the rough unfinished documentation below.

---

# thin-ql - making crud api's disappear

`thin-ql` is a simple query language to make talking with your postgres database simple and type-checked. The goal is to remove most, if not all, basic crud logic from api servers, and instead split it into the database and the client.

It does this by going through these steps:

- Inspecting your database to see what tables/columns are available, and what keys connect them.
- Parsing your `tql` file, comparing it against the database schema, and generating a type-safe api object you can use in the client to execute database actions.
- Cryptographically hashing all those operations, and giving that whitelist to a tiny server written in blazing fast asynchronous Rust to handle jwt auth and all upfront checks.

With this strategy, `thin-ql` can give you an api that's type-safe and checked for correctness at build-time, and only exposes the smallest possible amount of database surface to the public. That philosophy makes it very different from other libraries that aim to provide a complete api over the entire database. This makes it perfectly suited for anyone that isn't exposing a public api, but wants to build a project quickly and not deal with a largely redundant api service.

In `tql`, you can do:

- arbitrariliy nested queries
- inserts with associations
- puts
- patches
- deletes
- sql function calls
- transactions to lump together several things in order

Here's a query that shows most of the basics.

```gql
# api.tql
                                                                            # full text search
query search_actors($search_name: string): actors(@limit: 10, @filter: name +fts $search_name) [
  # commas separate things on the same line,
  # but never things on different lines
  name, age

  # you can nest things as far as you please
  # (just don't crash your database)
  roles(@limit: 4, @order: release_date desc) [
    name, box_office

    # you can give a selection a different name
    top_theaters_shown: theaters(@limit: 3, @order: num_screens desc) [
      name
    ]

  ]

  # anything that's expected to only return one record
  # (so if the record is found by following a unique foreign key)
  # should use object braces {} instead of array brackets []
  director: directors {
    name
  }

  # you can hop across multiple tables by chaining them
  # as long as there's an unambiguous foreign key beween each
  hometown: actor_to_hometown.cities {
    name, population
  }

  # you can even chain across ambiguous foreign keys
  # by using ~ and specifying the keys themselves
                                             # end with the destination table
  favorite_costars: ~roles.star_id~costar_id~actors(@limit: 3, @filter: search_actors.id != favorite_costars.id) [
    name, age
  ]
]
```


### Gotchas

When performing filters on blocks, be sure to use the *underlying table's column names*, not your renamed versions of them.

```gql
# this query will fail to compile, saying that "some_table.display_name" doesn't exist
query thing: some_table(@where: display_name = 'stuff') [
  display_name: column_name
]

# instead use the underlying name
query thing: some_table(@where: column_name = 'stuff') [
  display_name: column_name
]
```

## Roadmap

- [ ] Version 0.1.0, with all basic functionality ready to go.
- [ ] Multiple auth schemes.
- [ ] Multi-tenant database switching.
- [ ] Spread operator, to include fields from a related table in the current one.
- [ ] Cluster operator, to put fields in separate objects when that makes sense.
- [ ] More natively supported postgres operators.
- [ ] Webpack plugin.
- [ ] Extension with increase/decrease.
- [ ] Filter objects.
- [ ] If blocks.
- [ ] Performance hints.
- [ ] Making the plugin system amenable to other sql dialects.
- [ ] Websockets, with listen/notify.
- [ ] Syntax highlighting.


<!-- The steps are simple:

Run this command to inspect your database. This will output a file representing the whole schema so the language can use it. We do this in a separate step just because it can be slow and database schemas don't change very often. If you want to incorporate it into your build, just include this command somehow.

```bash
thin-ql inspect 'postgres://user:password@localhost:5432/database'
```


Then just get the tiny rust server sitting in front of your database, get authentication set up, and you're done!

Why use a proxy server and cached queries? Mostly for the seurity of a query white-list and not exposing your datbase publicly, but it also gives us the hange to do basic validation and prevent obviously wrong queires from burdening the database.

This library basically gives you a simple version of rpc with your databse, and doesn't make you write redundant resolvers. With this, most api layers can just dissolve ito a little more client logic and database stored procedures. And the handful of api routes you can do choose keep because they do something legitimately useful that can't be elegantly done in sql can shine and get the attention they deserve.

One of the motivating principles behind this project is that more business logic should go into the database, to give it a truly centralized home that's as close to the data as possible. With a few helpers to make testing that logic more ergonomic, we can make our stacks a lot more efficient and a ton simpler.

This language is worth translating sql to, because it's essentially a pared down version of sql that thinks in terms of json. That means it's more concise and easier to wrap your head around while you're building a client.

Anytime you create micro services, to have to develop contracts between them, and do everything you can to enforce and check them. This project comes from a realization that those contracts need not introduce unnecessary layers. Layers of abstraction should only be introduced when they're cognitively helpful. If they are almost one-to-one translations from one language or domain to another, then they're just cruft that's getting in the way. Now you can lean on views, materialized views, and functions to serve as abstractions when they're needed, rather than introduce another language and set of mental dependencies that has to be awkwardly mapped to sql, which is already a tailor-made abstraction for dealing with data. So use it!


With thin-ql, you can get associated rows by just nesting, get rows associated by multiple tables by chaining table names with a dot, and do arbitrary equality joins by chaining with the tilde.

Views and stable functions that returns a set of something row-like can be queried in the exact same way as a table.

To set up jwt authentication, pass either a string that will be interpreted as an hmac secret key, or a jwks file object. If you have multiple auth schemes, you can specify a claim that will be used to determine which scheme to use, with a default. Any extra claims will be mae settings in the local session. You can specify a claim name that will be used to determine which database to access.
-->
