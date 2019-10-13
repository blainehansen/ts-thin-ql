make_api!(

	default_tenant: experiment_db,
	tenants: [],

	no_args: [
		Posts, posts, "/posts", get, 0, r##"select array_agg(title) :: text from post"##;
		PostIds, post_ids, "/post_ids", get, 1, r##"select array_agg(id) :: text from post"##
	],

	args: [
		Post, post, "/post/{post_id}/{msg}", get, 1, r##"select json_build_object('title', post.title, 'msg', $2) :: text from post where id = $1"##, [post_id, i32, INT4; msg, String, TEXT];
		PostExcerpt, post_excerpt, "/post_excerpt/{post_id}/{msg}", get, 1, r##"select json_build_object('excerpt', post.excerpt, 'msg', $2) :: text from post where id = $1"##, [post_id, i32, INT4; msg, String, TEXT]
	],

);
