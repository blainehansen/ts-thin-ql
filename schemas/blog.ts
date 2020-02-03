export default [
  {
    table_oid: 16387,
    name: 'organization',
    columns: [
      {
        name: 'id',
        column_number: 1,
        nullable: false,
        grants: [],
        default_value_expression: "nextval('organization_id_seq'::regclass)",
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'name',
        column_number: 2,
        nullable: false,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      }
    ],
    constraints: [
      {
        type: 'p',
        constrained_column_numbers: [ 1 ],
        referred_column_numbers: [],
        referred_table_oid: 0,
        check_constraint_expression: null
      }
    ],
    grants: []
  },
  {
    table_oid: 16398,
    name: 'person',
    columns: [
      {
        name: 'organization_id',
        column_number: 5,
        nullable: true,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'id',
        column_number: 1,
        nullable: false,
        grants: [],
        default_value_expression: "nextval('person_id_seq'::regclass)",
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'last_name',
        column_number: 3,
        nullable: true,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      },
      {
        name: 'first_name',
        column_number: 2,
        nullable: false,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      },
      {
        name: 'preferred_weapons',
        column_number: 4,
        nullable: false,
        grants: [],
        default_value_expression: "'{}'::text[]",
        is_array: true,
        type_name: 'text',
        type_type: 'b'
      }
    ],
    constraints: [
      {
        type: 'p',
        constrained_column_numbers: [ 1 ],
        referred_column_numbers: [],
        referred_table_oid: 0,
        check_constraint_expression: null
      },
      {
        type: 'f',
        constrained_column_numbers: [ 5 ],
        referred_column_numbers: [ 1 ],
        referred_table_oid: 16387,
        check_constraint_expression: null
      }
    ],
    grants: []
  },
  {
    table_oid: 16415,
    name: 'vehicle',
    columns: [
      {
        name: 'person_id',
        column_number: 3,
        nullable: false,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'id',
        column_number: 1,
        nullable: false,
        grants: [],
        default_value_expression: "nextval('vehicle_id_seq'::regclass)",
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'name',
        column_number: 2,
        nullable: false,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      }
    ],
    constraints: [
      {
        type: 'p',
        constrained_column_numbers: [ 1 ],
        referred_column_numbers: [],
        referred_table_oid: 0,
        check_constraint_expression: null
      },
      {
        type: 'u',
        constrained_column_numbers: [ 3 ],
        referred_column_numbers: [],
        referred_table_oid: 0,
        check_constraint_expression: null
      },
      {
        type: 'f',
        constrained_column_numbers: [ 3 ],
        referred_column_numbers: [ 1 ],
        referred_table_oid: 16398,
        check_constraint_expression: null
      }
    ],
    grants: []
  },
  {
    table_oid: 16433,
    name: 'post',
    columns: [
      {
        name: 'person_id',
        column_number: 2,
        nullable: false,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'id',
        column_number: 1,
        nullable: false,
        grants: [],
        default_value_expression: "nextval('post_id_seq'::regclass)",
        is_array: false,
        type_name: 'int4',
        type_type: 'b'
      },
      {
        name: 'body',
        column_number: 5,
        nullable: true,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      },
      {
        name: 'excerpt',
        column_number: 4,
        nullable: true,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      },
      {
        name: 'title',
        column_number: 3,
        nullable: false,
        grants: [],
        default_value_expression: null,
        is_array: false,
        type_name: 'text',
        type_type: 'b'
      }
    ],
    constraints: [
      {
        type: 'p',
        constrained_column_numbers: [ 1 ],
        referred_column_numbers: [],
        referred_table_oid: 0,
        check_constraint_expression: null
      },
      {
        type: 'f',
        constrained_column_numbers: [ 2 ],
        referred_column_numbers: [ 1 ],
        referred_table_oid: 16398,
        check_constraint_expression: null
      }
    ],
    grants: []
  }
]
