extern crate futures;

extern crate tokio_postgres;

extern crate actix;

extern crate actix_web;
use actix_web::{App, HttpResponse, HttpServer, http, middleware::cors::Cors};

#[macro_use]
mod macros;

mod generated;

// fn generic_json<T: serde::Serialize, E>(arg: Result<T, E>) -> Result<HttpResponse, actix_web::Error> {
fn generic_json<T: Into<actix_web::dev::Body>, E>(arg: Result<T, E>) -> Result<HttpResponse, actix_web::Error> {
	match arg {
		Ok(body) => Ok(HttpResponse::Ok().body(body)),
		Err(_) => Ok(HttpResponse::InternalServerError().into()),
	}
}


fn main() -> std::io::Result<()> {
	std::env::set_var("RUST_LOG", "server=info");
	pretty_env_logger::init();

	let server = HttpServer::new(|| {
		let db = generated::PgConnection::connect();

		App::new()
			.wrap(
				Cors::new()
					.supports_credentials()
					.allowed_origin("http://localhost:8080")
					.allowed_headers(vec![http::header::AUTHORIZATION, http::header::ACCEPT])
					.allowed_header(http::header::CONTENT_TYPE)
					.max_age(3600)
			)
			.data(db)
			.wrap(actix_web::middleware::Logger::default())
			.configure(generated::configure)
	})
		.bind("127.0.0.1:5050")?
		.workers(1)
		.run();

	server
}
