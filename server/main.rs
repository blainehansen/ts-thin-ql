extern crate actix_web;
use actix_web::{App, HttpResponse, HttpServer, http, middleware::cors::Cors};

// #[macro_use]
// extern crate derive_error;

#[macro_use]
extern crate serde_derive;

#[macro_use]
mod macros;

mod generated;

fn generic_json<T: Into<actix_web::dev::Body>, E>(arg: Result<T, E>) -> Result<HttpResponse, actix_web::Error> {
	match arg {
		Ok(body) => Ok(HttpResponse::Ok().body(body)),
		Err(_) => Ok(HttpResponse::InternalServerError().into()),
	}
}

// #[derive(Debug, Error)]
// enum ThinQlError {
// 	BadTenant,
// 	// Variant2,
// }


fn main() -> std::io::Result<()> {
	std::env::set_var("RUST_LOG", "server=info");
	pretty_env_logger::init();

	let server = HttpServer::new(|| {
		let dbs = generated::Tenants::create();

		App::new()
			.wrap(
				Cors::new()
					.supports_credentials()
					.allowed_origin("http://localhost:8080")
					.allowed_headers(vec![http::header::AUTHORIZATION, http::header::ACCEPT])
					.allowed_header(http::header::CONTENT_TYPE)
					.max_age(3600)
			)
			.data(dbs)
			.wrap(actix_web::middleware::Logger::default())
			.configure(generated::configure)
	})
		.bind("127.0.0.1:5050")?
		.workers(1)
		.run();

	server
}
