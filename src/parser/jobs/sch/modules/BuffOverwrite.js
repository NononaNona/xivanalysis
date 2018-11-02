import CoreBuffOverwrite, {BUFF_MODES} from 'parser/roles/healer/BuffOverwrite'

import ACTIONS from 'data/ACTIONS'
import STATUSES from 'data/STATUSES'

export default class BuffOverwrite extends CoreBuffOverwrite {
	constructor(...args) {
		super(...args)

		this.addBuff(STATUSES.GALVANIZE, BUFF_MODES.CONDITIONAL, false, 30000)
		this.addAction(ACTIONS.SUCCOR, STATUSES.GALVANIZE.id, true)
		this.addAction(ACTIONS.ADLOQUIUM, STATUSES.GALVANIZE.id, false)
		this.initiate()
	}

	output() {
		return this.getTable()
	}
}
