create extension citext;
create domain email as citext
	check ( value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$' );

create table person (
	id serial primary key,
	first_name text,
	last_name text,
	email email not null unique,
	email_verified boolean not null default false,
	hashed_password text not null
);


create table merchant (
	person_id int primary key references person,
	payment_bank_account text,
	seller_name text not null
);
alter table merchant enable row level security;

create role dudes;

grant select on merchant to dudes;
create policy merchant_allow on merchant to dudes
	using (person_id = 1);

create type denomination_type as enum (
	'usd', 'cd', 'euro', 'rupee'
);

create table merchant_item_category (
	id serial primary key,
	merchant_id int not null references merchant,
	unique (id, merchant_id),

	title text not null,
	description text,
	display_order smallint
);

create table merchant_item (
	id serial primary key,
	merchant_id int not null references merchant,
	merchant_item_category_id int references merchant_item_category,
	listed_at timestamptz not null default now(),
	last_updated timestamptz not null default now(),

	foreign key (merchant_item_category_id, merchant_id)
		references merchant_item_category (id, merchant_id),

	title text not null,
	description text
);

create table merchant_item_price (
	id bigserial primary key,
	merchant_item_id int not null references merchant_item,
	unique (id, merchant_item_id),

	denomination denomination_type not null,
	price int not null check (price > 0),

	listed_at timestamptz not null default now(),
	closed_at timestamptz
);

create unique index unique_merchant_item_price
on merchant_item_price (merchant_item_id, denomination, closed_at)
where closed_at is not null;

create type merchant_item_discount_offer_type as enum (
	'percentage', 'currency', 'points', 'bogo'
);

create table merchant_item_discount_offer (
	id serial primary key,
	listed_at timestamptz not null default now(),
	last_updated timestamptz not null default now(),
	valid_until date check (valid_until > listed_at),
	merchant_item_id int not null references merchant_item,
	unique (id, merchant_item_id),

	offer_type merchant_item_discount_offer_type not null,
	amount int not null check (amount < 0),
	denomination denomination_type not null,

	title text not null,
	description text
);

create table customer (
	person_id int primary key references person,
	credit_card_number text
);

create table purchase (
	id bigserial primary key,
	occurred timestamptz not null,
	-- can be null
	customer_id int references customer
);

create table purchase_line_item (
	id bigserial primary key,
	purchase_id int not null references purchase,
	merchant_item_id int not null references merchant_item,
	merchant_item_price_id int not null,

	foreign key (merchant_item_price_id, merchant_item_id)
		references merchant_item_price (id, merchant_item_id),

	unique (id, merchant_item_id)
);

create table purchase_line_item_offer_applied (
	purchase_line_item_id int not null,
	merchant_item_id int not null,
	merchant_item_discount_offer_id int not null,

	primary key (purchase_line_item_id, merchant_item_id, merchant_item_discount_offer_id),

	foreign key (merchant_item_discount_offer_id, merchant_item_id)
		references merchant_item_discount_offer (id, merchant_item_id),

	foreign key (purchase_line_item_id, merchant_item_id)
		references purchase_line_item (id, merchant_item_id)
);
