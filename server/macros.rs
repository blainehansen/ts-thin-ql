macro_rules! make_api {
	(
		no_args: [$(
			$message_type_name:ident, $func_name:ident, $route_string:literal,
			$http_verb:ident, $index:literal, $sql:literal
		);*],

		args: [$(
			$arg_message_type_name:ident, $arg_func_name:ident, $arg_route_string:literal,
			$arg_http_verb:ident, $arg_index:literal, $arg_sql:literal,
			[$( $field_name:ident, $field_type:ty, $field_sql_type:ident );+]
		);*],

	) => {




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
							// prepare all the no_args
							$( client.prepare_typed($sql, &[]), )*
							// prepare all the args
							$( client.prepare_typed($arg_sql, &[$( tokio_postgres::types::Type::$field_sql_type ),+]), )*
						])
						.map_err(|e| panic!("couldn't prepare some statements: {}", e))
						.into_actor(actor)
						.and_then(|statements, actor, _context| {
							// get all the no_args
							$( actor.$func_name = Some(statements[$index].clone()); )*
							// get all the args
							$( actor.$arg_func_name = Some(statements[$arg_index].clone()); )*
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

// make all the handling items for no_args
$(
	struct $message_type_name;

	impl Message for $message_type_name {
		type Result = Result<String, io::Error>;
	}

	impl Handler<$message_type_name> for PgConnection {
		type Result = ResponseFuture<String, io::Error>;

		fn handle(&mut self, _: $message_type_name, _: &mut Self::Context) -> Self::Result {
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
		db.send($message_type_name).from_err().and_then(generic_json)
	}
)*

// make all the handling items for args
$(
	#[derive(Deserialize)]
	struct $arg_message_type_name {
		$( $field_name: $field_type, )+
	}

	impl Message for $arg_message_type_name {
		type Result = Result<String, io::Error>;
	}

	impl Handler<$arg_message_type_name> for PgConnection {
		type Result = ResponseFuture<String, io::Error>;

		fn handle(&mut self, msg: $arg_message_type_name, _: &mut Self::Context) -> Self::Result {
			Box::new(
				self.client.as_mut().unwrap()
					.query(self.$arg_func_name.as_ref().unwrap(), &[$( &msg.$field_name ),+])
					.collect()
					.into_future()
					.map_err(|_| io::Error::new(io::ErrorKind::Other, "postgres"))
					.map(|rows| rows[0].get(0))
			)
		}
	}

	fn $arg_func_name(
		args: web::Path<$arg_message_type_name>,
		db: web::Data<Addr<PgConnection>>,
	) -> impl Future<Item=HttpResponse, Error=actix_web::Error> {
		db.send(args.into_inner()).from_err().and_then(generic_json)
	}
)*


pub fn configure(cfg: &mut web::ServiceConfig) {
	// route all the no_args
	$( cfg.route($route_string, web::$http_verb().to_async($func_name)); )*
	// route all the args
	$( cfg.route($arg_route_string, web::$arg_http_verb().to_async($arg_func_name)); )*
}


#[derive(Default)]
pub struct PgConnection {
	pub client: Option<Client>,
	// add the statement names for all the no_args
	$( $func_name: Option<Statement>, )*
	// add the statement names for all the args
	$( $arg_func_name: Option<Statement>, )*
}





	};
}
