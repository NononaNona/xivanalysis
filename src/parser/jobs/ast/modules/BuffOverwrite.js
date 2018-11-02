import CoreBuffOverwrite, {BUFF_MODES} from 'parser/roles/healer/BuffOverwrite'

import ACTIONS from 'data/ACTIONS'
import STATUSES from 'data/STATUSES'

export default class BuffOverwrite extends CoreBuffOverwrite {
	constructor(...args) {
		super(...args)

		this.addBuff(STATUSES.ASPECTED_BENEFIC, BUFF_MODES.OVERRIDE, false, 18000)
		this.addBuff(STATUSES.NOCTURNAL_FIELD, BUFF_MODES.CONDITIONAL, false, 30000)
		this.addAction(ACTIONS.ASPECTED_BENEFIC, STATUSES.ASPECTED_BENEFIC.id, false)
		this.addBuff(STATUSES.ASPECTED_HELIOS, BUFF_MODES.OVERRIDE, false, 30000)
		this.addAction(ACTIONS.ASPECTED_HELIOS, STATUSES.ASPECTED_HELIOS.id, true)
		this.initiate()
	}

	output() {
		return this.getTable()
	}
}
