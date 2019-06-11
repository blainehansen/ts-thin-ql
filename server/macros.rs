macro_rules! make_connection {
	( $( $func_name:ident, $route_name:literal, $http_verb:ident, $index:literal, $sql:literal );* ) => {

		extern crate futures;
		use futures::{prelude::*, future, Future, Stream};

		extern crate tokio_postgres;
		use tokio_postgres::{Client, Statement};

		extern crate actix;
		use actix::{prelude::*, fut as actix_future};

		extern crate actix_web;
		use actix_web::{web, HttpResponse};

		use std::default::Default;

		extern crate serde;

		use std::io;
		use super::{generic_json};

		#[derive(Default)]
		pub struct PgConnection {
			pub client: Option<Client>,
			$( $func_name: Option<Statement>, )*
		}

		impl Actor for PgConnection {
			type Context = Context<Self>;
		}

		impl PgConnection {
			pub fn connect() -> Addr<PgConnection> {
				// TODO this isn't safe
				let db_url = "host=localhost user=experiment_user dbname=experiment_db password=asdf";
				let connection_attempt = tokio_postgres::connect(db_url, tokio_postgres::NoTls);

				PgConnection::create(move |context| {
					let actor: PgConnection = Default::default();

					connection_attempt
						.map_err(|e| panic!("couldn't connect to postgres: {}", e))
						.into_actor(&actor)
						.and_then(|(mut client, connection), actor, context| {
							Arbiter::spawn(connection.map_err(|e| panic!("{}", e)));

							context.wait(
								future::join_all(vec![
									$( client.prepare($sql), )*
								])
								.map_err(|e| panic!("couldn't prepare some statements: {}", e))
								.into_actor(actor)
								.and_then(|statements, actor, _context| {
									$( actor.$func_name = Some(statements[$index].clone()); )*
									actix_future::ok(())
								})
							);

							actor.client = Some(client);
							actix_future::ok(())
						})
						.wait(context);

					actor
				})
			}
		}

		pub fn configure(cfg: &mut web::ServiceConfig) {
			$(
				cfg.route($route_name, web::$http_verb().to_async($func_name));
			)*
		}

	};
}



macro_rules! make_route {
	( $type_name:ident, $func_name:ident ) => {
		struct $type_name;

		impl Message for $type_name {
			type Result = Result<String, io::Error>;
		}

		impl Handler<$type_name> for PgConnection {
			type Result = ResponseFuture<String, io::Error>;

			fn handle(&mut self, _: $type_name, _: &mut Self::Context) -> Self::Result {
				Box::new(
					self.client.as_mut().unwrap()
						.query(self.$func_name.as_ref().unwrap(), &[])
						.collect()
						.into_future()
						.map_err(|_| io::Error::new(io::ErrorKind::Other, "postgres"))
						.map(|rows| rows[0].get(0))
				)
			}
		}

		fn $func_name(db: web::Data<Addr<PgConnection>>) -> impl Future<Item=HttpResponse, Error=actix_web::Error> {
			db.send($type_name).from_err().and_then(generic_json)
		}
	};
}


