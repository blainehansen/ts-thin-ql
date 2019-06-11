make_connection!(
	posts, "/posts", get, 0, r##"
			select json_agg(json_build_object('id', posts.id, 'title', posts.title, 'excerpt', posts.excerpt, 'person', person.person)) :: text as posts
			from
				post as posts
				left join lateral (
			select json_build_object('first_name', person.first_name, 'last_name', person.last_name) as person
			from
				person as person
				
			where (posts.person_id = person.id)
			
			
		) as person on true
			
			limit 3
			
		"##;
	post, "/post", get, 1, r##"
			select json_build_object('title', post.title, 'body', post.body, 'person', person.person) as post
			from
				post as post
				left join lateral (
			select json_build_object('first_name', person.first_name, 'last_name', person.last_name) as person
			from
				person as person
				
			where (post.person_id = person.id)
			
			
		) as person on true
			where (post.id = 1)
			
			
		"##;
	people, "/people", get, 2, r##"
			select json_agg(json_build_object('id', people.id, 'first_name', people.first_name, 'last_name', people.last_name, 'posts', posts.posts)) :: text as people
			from
				person as people
				left join lateral (
			select json_agg(json_build_object('id', posts.id, 'title', posts.title, 'excerpt', posts.excerpt)) :: text as posts
			from
				post as posts
				
			where (people.id = posts.person_id)
			
			
		) as posts on true
			
			
			
		"##
);

make_route!(Posts, posts);
make_route!(Post, post);
make_route!(People, people);