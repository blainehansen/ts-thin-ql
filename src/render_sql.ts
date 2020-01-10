import { Action } from '../ast'
import { delete as _delete } from './delete'

export default function(action: Action) {
	switch (action.type) {
	case 'Delete':
		return _delete({ d: action })
	}
}
