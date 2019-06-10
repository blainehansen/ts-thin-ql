extern crate futures;
use futures::{prelude::*, future, Future, Stream};

extern crate tokio_postgres;
use tokio_postgres::{Client, Statement};

// extern crate tokio;
// use tokio::runtime::Runtime;

extern crate actix;
use actix::{prelude::*, fut as actix_future};

extern crate actix_web;
use actix_web::{web, App, HttpResponse, HttpServer, http::StatusCode};


// fn index(info: web::Path<String>, db: web::Data<Addr<PgConnection>>) -> impl Future<Item=impl Responder, Error=actix_web::Error> {
// 	future::ok(format!("Hello {}!", info).with_status(StatusCode::OK))
// }

use std::default::Default;

#[derive(Default)]
struct PgConnection {
	client: Option<Client>,
	one: Option<Statement>,
	two: Option<Statement>,
}

impl Actor for PgConnection {
	type Context = Context<Self>;
}

impl PgConnection {
	pub fn connect(db_url: &str) -> Addr<PgConnection> {
		let connection_attempt = tokio_postgres::connect(db_url, tokio_postgres::NoTls);

		PgConnection::create(move |ctx| {
			let actor: PgConnection = Default::default();

			connection_attempt
				.map_err(|e| panic!("couldn't connect to postgres: {}", e))
				.into_actor(&actor)
				.and_then(|(mut client, connection), actor, ctx| {
					Arbiter::spawn(connection.map_err(|e| panic!("{}", e)));

					ctx.wait(
						future::join_all(vec![
							client.prepare("select word from first_level limit 1 offset 0;"),
							client.prepare("select word from first_level limit 1 offset 1;"),
						])
						.map_err(|e| panic!("couldn't prepare some statements: {}", e))
						.into_actor(actor)
						.and_then(|statements, actor, _ctx| {
							actor.one = Some(statements[0].clone());
							actor.two = Some(statements[1].clone());
							actix_future::ok(())
						})
					);

					actor.client = Some(client);
					actix_future::ok(())
				})
				.wait(ctx);

			actor
		})
	}
}

struct One;

impl Message for One {
	type Result = Result<String, io::Error>;
}

impl Handler<One> for PgConnection {
	type Result = ResponseFuture<String, io::Error>;

	fn handle(&mut self, _: One, _: &mut Self::Context) -> Self::Result {
		Box::new(
			self.client.as_mut().unwrap()
				.query(self.one.as_ref().unwrap(), &[])
				.collect()
				.into_future()
				.map_err(|_| io::Error::new(io::ErrorKind::Other, "postgres"))
				.map(|rows| rows[0].get(0))
		)
	}
}

use std::io;

fn one(db: web::Data<Addr<PgConnection>>) -> impl Future<Item=HttpResponse, Error=actix_web::Error> {
	db.send(One)
		.from_err()
		.and_then(|result| match result {
			Ok(body) => Ok(HttpResponse::Ok().json(body)),
			Err(_) => Ok(HttpResponse::InternalServerError().into()),
		})
}

// fn two(db: web::Data<Addr<PgConnection>>) -> impl Future<Item=String, Error=actix_web::Error> {
// 	db.client
// 		.borrow_mut()
// 		.query(&db.two, &[])
// 		.map_err(|_| actix_web::Error::from(()))
// 		.collect()
// 		.map(|rows| rows[0].get(0))
// }

fn main() -> std::io::Result<()> {
	std::env::set_var("RUST_LOG", "server=info");
	pretty_env_logger::init();

	let server = HttpServer::new(|| {
		let db_url = "host=localhost user=experiment_user dbname=experiment_db password=asdf";
		let db = PgConnection::connect(db_url);

		App::new()
			.data(db)
			// .service(web::resource("/{name}").to_async(index))
			.service(web::resource("/one").to_async(one))
			// .service(web::resource("/two").to_async(two))
	})
		.bind("127.0.0.1:8080")?
		.workers(1)
		.run();

	println!("spawned");

	server
}
