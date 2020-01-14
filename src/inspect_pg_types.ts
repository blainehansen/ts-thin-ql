export const BaseTypes = {
	int2: { ts_type: 'number', rs_type: 'i16' },
	int4: { ts_type: 'number', rs_type: 'i32' },
	int8: { ts_type: 'number', rs_type: 'i64' },
	float4: { ts_type: 'number', rs_type: 'f32' },
	float8: { ts_type: 'number', rs_type: 'f64' },
	numeric: { ts_type: 'number', rs_type: 'f64' },
	money: { ts_type: 'number', rs_type: 'f64' },

	bool: { ts_type: 'boolean', rs_type: 'bool' },

	text: { ts_type: 'string', rs_type: 'String' },
	bpchar: { ts_type: 'string', rs_type: 'String' },
	varchar: { ts_type: 'string', rs_type: 'String' },

	// time: { ts_type: '', rs_type: '' },
	// timetz: { ts_type: '', rs_type: '' },
	// timestamp: { ts_type: '', rs_type: '' },
	// timestamptz: { ts_type: '', rs_type: '' },
	// date: { ts_type: '', rs_type: '' },

	// uuid: { ts_type: '', rs_type: '' },

	// interval
}

// function encode_noop<T>(value: T): T { return value }

// export const PgType = {
// 	BOOL: { rust: 'bool', ts: 'boolean', encode: encode_noop  },
// 	TEXT: { rust: 'String', ts: 'string', encode: encodeURIComponent },
// } as const
// export type PgType = keyof typeof PgType




// Rust Type	Postgres Type
// rust: bool, postgres: BOOL
// rust: i8, postgres: "char"
// rust: i16, postgres: SMALLINT, SMALLSERIAL
// rust: i32, postgres: INT, SERIAL
// rust: u32, postgres: OID
// rust: i64, postgres: BIGINT, BIGSERIAL
// rust: f32, postgres: REAL
// rust: f64, postgres: DOUBLE PRECISION
// rust: str/String, postgres: VARCHAR, CHAR(n), TEXT, CITEXT, NAME
// rust: [u8]/Vec<u8>, postgres: BYTEA
// rust: postgres::types::Json and serde_json::Value (optional), postgres: JSON, JSONB
// rust: time::Timespec and chrono::NaiveDateTime (optional), postgres: TIMESTAMP
// rust: time::Timespec, chrono::DateTime<Utc>, chrono::DateTime<Local>, and chrono::DateTime<FixedOffset> (optional), postgres: TIMESTAMP WITH TIME ZONE
// rust: chrono::NaiveDate (optional), postgres: DATE
// rust: chrono::NaiveTime (optional), postgres: TIME
// rust: uuid::Uuid (optional), postgres: UUID
// rust: bit_vec::BitVec (optional), postgres: BIT, VARBIT
// rust: HashMap<String, Option<String>>, postgres: HSTORE
// rust: eui48::MacAddress (optional), postgres: MACADDR
// rust: geo::Point<f64> (optional), postgres: POINT
// rust: geo::Bbox<f64> (optional), postgres: BOX
// rust: geo::LineString<f64> (optional), postgres: PATH



// const BOOL
// BOOL - boolean, 'true'/'false'

// const BYTEA
// BYTEA - variable-length string, binary values escaped

// const CHAR
// CHAR - single character

// const NAME
// NAME - 63-byte type for storing system identifiers

// const INT8
// INT8 - ~18 digit integer, 8-byte storage

// const INT2
// INT2 - -32 thousand to 32 thousand, 2-byte storage

// const INT2_VECTOR
// INT2VECTOR - array of int2, used in system tables

// const INT4
// INT4 - -2 billion to 2 billion integer, 4-byte storage

// const REGPROC
// REGPROC - registered procedure

// const TEXT
// TEXT - variable-length string, no limit specified

// const OID
// OID - object identifier(oid), maximum 4 billion

// const TID
// TID - (block, offset), physical location of tuple

// const XID
// XID - transaction id

// const CID
// CID - command identifier type, sequence in transaction id

// const OID_VECTOR
// OIDVECTOR - array of oids, used in system tables

// const PG_DDL_COMMAND
// PG_DDL_COMMAND - internal type for passing CollectedCommand

// const JSON
// JSON

// const XML
// XML - XML content

// const XML_ARRAY
// XML[]

// const PG_NODE_TREE
// PG_NODE_TREE - string representing an internal node tree

// const JSON_ARRAY
// JSON[]

// const SMGR
// SMGR - storage manager

// const INDEX_AM_HANDLER
// INDEX_AM_HANDLER

// const POINT
// POINT - geometric point '(x, y)'

// const LSEG
// LSEG - geometric line segment '(pt1,pt2)'

// const PATH
// PATH - geometric path '(pt1,...)'

// const BOX
// BOX - geometric box '(lower left,upper right)'

// const POLYGON
// POLYGON - geometric polygon '(pt1,...)'

// const LINE
// LINE - geometric line

// const LINE_ARRAY
// LINE[]

// const CIDR
// CIDR - network IP address/netmask, network address

// const CIDR_ARRAY
// CIDR[]

// const FLOAT4
// FLOAT4 - single-precision floating point number, 4-byte storage

// const FLOAT8
// FLOAT8 - double-precision floating point number, 8-byte storage

// const ABSTIME
// ABSTIME - absolute, limited-range date and time (Unix system time)

// const RELTIME
// RELTIME - relative, limited-range time interval (Unix delta time)

// const TINTERVAL
// TINTERVAL - (abstime,abstime), time interval

// const UNKNOWN
// UNKNOWN

// const CIRCLE
// CIRCLE - geometric circle '(center,radius)'

// const CIRCLE_ARRAY
// CIRCLE[]

// const MACADDR8
// MACADDR8 - XX:XX:XX:XX:XX:XX:XX:XX, MAC address

// const MACADDR8_ARRAY
// MACADDR8[]

// const MONEY
// MONEY - monetary amounts, $d,ddd.cc

// const MONEY_ARRAY
// MONEY[]

// const MACADDR
// MACADDR - XX:XX:XX:XX:XX:XX, MAC address

// const INET
// INET - IP address/netmask, host address, netmask optional

// const BOOL_ARRAY
// BOOL[]

// const BYTEA_ARRAY
// BYTEA[]

// const CHAR_ARRAY
// CHAR[]

// const NAME_ARRAY
// NAME[]

// const INT2_ARRAY
// INT2[]

// const INT2_VECTOR_ARRAY
// INT2VECTOR[]

// const INT4_ARRAY
// INT4[]

// const REGPROC_ARRAY
// REGPROC[]

// const TEXT_ARRAY
// TEXT[]

// const TID_ARRAY
// TID[]

// const XID_ARRAY
// XID[]

// const CID_ARRAY
// CID[]

// const OID_VECTOR_ARRAY
// OIDVECTOR[]

// const BPCHAR_ARRAY
// BPCHAR[]

// const VARCHAR_ARRAY
// VARCHAR[]

// const INT8_ARRAY
// INT8[]

// const POINT_ARRAY
// POINT[]

// const LSEG_ARRAY
// LSEG[]

// const PATH_ARRAY
// PATH[]

// const BOX_ARRAY
// BOX[]

// const FLOAT4_ARRAY
// FLOAT4[]

// const FLOAT8_ARRAY
// FLOAT8[]

// const ABSTIME_ARRAY
// ABSTIME[]

// const RELTIME_ARRAY
// RELTIME[]

// const TINTERVAL_ARRAY
// TINTERVAL[]

// const POLYGON_ARRAY
// POLYGON[]

// const OID_ARRAY
// OID[]

// const ACLITEM
// ACLITEM - access control list

// const ACLITEM_ARRAY
// ACLITEM[]

// const MACADDR_ARRAY
// MACADDR[]

// const INET_ARRAY
// INET[]

// const BPCHAR
// BPCHAR - char(length), blank-padded string, fixed storage length

// const VARCHAR
// VARCHAR - varchar(length), non-blank-padded string, variable storage length

// const DATE
// DATE - date

// const TIME
// TIME - time of day

// const TIMESTAMP
// TIMESTAMP - date and time

// const TIMESTAMP_ARRAY
// TIMESTAMP[]

// const DATE_ARRAY
// DATE[]

// const TIME_ARRAY
// TIME[]

// const TIMESTAMPTZ
// TIMESTAMPTZ - date and time with time zone

// const TIMESTAMPTZ_ARRAY
// TIMESTAMPTZ[]

// const INTERVAL
// INTERVAL - @ <number> <units>, time interval

// const INTERVAL_ARRAY
// INTERVAL[]

// const NUMERIC_ARRAY
// NUMERIC[]

// const CSTRING_ARRAY
// CSTRING[]

// const TIMETZ
// TIMETZ - time of day with time zone

// const TIMETZ_ARRAY
// TIMETZ[]

// const BIT
// BIT - fixed-length bit string

// const BIT_ARRAY
// BIT[]

// const VARBIT
// VARBIT - variable-length bit string

// const VARBIT_ARRAY
// VARBIT[]

// const NUMERIC
// NUMERIC - numeric(precision, decimal), arbitrary precision number

// const REFCURSOR
// REFCURSOR - reference to cursor (portal name)

// const REFCURSOR_ARRAY
// REFCURSOR[]

// const REGPROCEDURE
// REGPROCEDURE - registered procedure (with args)

// const REGOPER
// REGOPER - registered operator

// const REGOPERATOR
// REGOPERATOR - registered operator (with args)

// const REGCLASS
// REGCLASS - registered class

// const REGTYPE
// REGTYPE - registered type

// const REGPROCEDURE_ARRAY
// REGPROCEDURE[]

// const REGOPER_ARRAY
// REGOPER[]

// const REGOPERATOR_ARRAY
// REGOPERATOR[]

// const REGCLASS_ARRAY
// REGCLASS[]

// const REGTYPE_ARRAY
// REGTYPE[]

// const RECORD
// RECORD

// const CSTRING
// CSTRING

// const ANY
// ANY

// const ANYARRAY
// ANYARRAY

// const VOID
// VOID

// const TRIGGER
// TRIGGER

// const LANGUAGE_HANDLER
// LANGUAGE_HANDLER

// const INTERNAL
// INTERNAL

// const OPAQUE
// OPAQUE

// const ANYELEMENT
// ANYELEMENT

// const RECORD_ARRAY
// RECORD[]

// const ANYNONARRAY
// ANYNONARRAY

// const TXID_SNAPSHOT_ARRAY
// TXID_SNAPSHOT[]

// const UUID
// UUID - UUID datatype

// const UUID_ARRAY
// UUID[]

// const TXID_SNAPSHOT
// TXID_SNAPSHOT - txid snapshot

// const FDW_HANDLER
// FDW_HANDLER

// const PG_LSN
// PG_LSN - PostgreSQL LSN datatype

// const PG_LSN_ARRAY
// PG_LSN[]

// const TSM_HANDLER
// TSM_HANDLER

// const PG_NDISTINCT
// PG_NDISTINCT - multivariate ndistinct coefficients

// const PG_DEPENDENCIES
// PG_DEPENDENCIES - multivariate dependencies

// const ANYENUM
// ANYENUM

// const TS_VECTOR
// TSVECTOR - text representation for text search

// const TSQUERY
// TSQUERY - query representation for text search

// const GTS_VECTOR
// GTSVECTOR - GiST index internal text representation for text search

// const TS_VECTOR_ARRAY
// TSVECTOR[]

// const GTS_VECTOR_ARRAY
// GTSVECTOR[]

// const TSQUERY_ARRAY
// TSQUERY[]

// const REGCONFIG
// REGCONFIG - registered text search configuration

// const REGCONFIG_ARRAY
// REGCONFIG[]

// const REGDICTIONARY
// REGDICTIONARY - registered text search dictionary

// const REGDICTIONARY_ARRAY
// REGDICTIONARY[]

// const JSONB
// JSONB - Binary JSON

// const JSONB_ARRAY
// JSONB[]

// const ANY_RANGE
// ANYRANGE

// const EVENT_TRIGGER
// EVENT_TRIGGER

// const INT4_RANGE
// INT4RANGE - range of integers

// const INT4_RANGE_ARRAY
// INT4RANGE[]

// const NUM_RANGE
// NUMRANGE - range of numerics

// const NUM_RANGE_ARRAY
// NUMRANGE[]

// const TS_RANGE
// TSRANGE - range of timestamps without time zone

// const TS_RANGE_ARRAY
// TSRANGE[]

// const TSTZ_RANGE
// TSTZRANGE - range of timestamps with time zone

// const TSTZ_RANGE_ARRAY
// TSTZRANGE[]

// const DATE_RANGE
// DATERANGE - range of dates

// const DATE_RANGE_ARRAY
// DATERANGE[]

// const INT8_RANGE
// INT8RANGE - range of bigints

// const INT8_RANGE_ARRAY
// INT8RANGE[]

// const REGNAMESPACE
// REGNAMESPACE - registered namespace

// const REGNAMESPACE_ARRAY
// REGNAMESPACE[]

// const REGROLE
// REGROLE - registered role

// const REGROLE_ARRAY
// REGROLE[]
