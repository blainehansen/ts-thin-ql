@import { Delete } from '../ast'
@import where_clause from './where_clause'

@param delete: Delete

delete from @(delete.table_name)
@(where_clause(delete.where_directives))

