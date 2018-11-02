import CoreBuffOverwrite, {BUFF_MODES} from 'parser/roles/healer/BuffOverwrite'

import ACTIONS from 'data/ACTIONS'
import STATUSES from 'data/STATUSES'

export default class BuffOverwrite extends CoreBuffOverwrite {
	constructor(...args) {
		super(...args)

		this.addBuff(STATUSES.REGEN, BUFF_MODES.OVERRIDE, true, 21000)
		this.addBuff(STATUSES.MEDICA_II, BUFF_MODES.OVERRIDE, true, 30000)

		this.addAction(ACTIONS.REGEN, STATUSES.REGEN.id, false)
		this.addAction(ACTIONS.MEDICA_II, STATUSES.MEDICA_II.id, true)

		this.initiate()
	}

	output() {
		console.log(this.getTimeLost(ACTIONS.MEDICA_II.id))
		return this.getTable()
	}
}
