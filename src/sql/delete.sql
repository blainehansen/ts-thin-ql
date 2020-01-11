@import { Delete } from '../ast'
@import where_clause from './where_clause'

@param Delete: Delete

delete from @(Delete.table_name)
@(where_clause({ where_directives: Delete.where_directives }))

