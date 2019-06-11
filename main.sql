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
