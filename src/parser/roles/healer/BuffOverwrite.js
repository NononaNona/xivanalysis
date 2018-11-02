// TODO: Track buff extenstion (Ex. Celestial Opposition)
// TODO: Track different buffs overwriting each other (Ex. AST/SCH shields)

import _ from 'lodash'

import React from 'react'
import {Accordion, List} from 'semantic-ui-react'
import {i18nMark, Plural} from '@lingui/react'
import {ActionLink} from 'components/ui/DbLink'
import JobIcon from 'components/ui/JobIcon'

import JOBS from 'data/JOBS'

import Module from 'parser/core/Module'

import styles from './BuffOverwrite.css'

// import ACTIONS from 'data/ACTIONS'
// import STATUSES from 'data/STATUSES'

export const BUFF_MODES = Object.freeze({
	OVERRIDE: 0, // Ex. regen
	CONDITIONAL: 1, //Ex. Adloquium
})

export default class BuffOverwrite extends Module {
	static handle = 'buff-overwrite'
	static title = 'Buff Overwrite'
	static i18n_id = i18nMark('healer.buff-overwrite.title')
	static dependencies = [
		'combatants',
		'aoe', // eslint-disable-line xivanalysis/no-unused-dependencies
	]

	_actions = {}
	_buffs = {}
	_buffsByPlayer = {}
	_buffOverwrite = {}

	constructor(...args) {
		super(...args)
	}

	/**
	  * declare a new buff to track
	  * @param {Object} buff - Buff object from data/STATUSES
	  * @param {number} buffMode - Value from BUFF_MODES object
	  * @param {boolean} isStackable - Can the buff be stacked on by multiple players?
	  * @param {number} duration - Duration of buff in milliseconds
	  * @param {number[]} conflicts - Array of buffIDs of buffs that will overwrite this one
	  * @returns {Object} - Object created from this data
	 **/
	addBuff(buff, buffMode, isStackable, duration, conflicts=[]) {
		const buffObj = {
			buff: buff,
			buffMode: buffMode,
			conflicts: Array.isArray(conflicts) ? conflicts : [conflicts],
			isStackable: isStackable,
			duration: duration,
		}

		this._buffs[buff.id] = buffObj
		return buffObj
	}
	/**
	  * Declare a new action to track. Can be done multiple times on the same object to track different states of it (Ex. Aspected Benefic)
	  * @param {Object} action - Object from data/ACTIONS
	  * @param {number} buffID - ID of buff this action gives. Buff must have already been declared with addBuff
	  * @param {boolean} isAoe - Does action apply buff as a aoe ability
	  * @returns {Object} - Object created from this data
	 **/
	addAction(action, buffID, isAoe) {
		const buff = this._buffs[buffID]
		const actionObj = {
			action: action,
			buff: buff,
			isAoe: isAoe,
		}

		this._actions[action.id] = actionObj
		return actionObj
	}

	initiate() {
		this._linkBuffConflicts()
		this._initiateHooks()
	}

	getOverwriteAction(actionID) {
		return this._buffOverwrite[actionID]
	}

	getTimeLost(actionID) {
		return _.sumBy(this.getOverwriteAction(actionID), 'timeLost')
	}

	getTable(actionIDs=null) {
		if (actionIDs === null) {
			actionIDs = Object.keys(this._actions)
		}

		const events = _.compact(
			_.sortby(
				_.flatten(
					actionIDs.map(id => this._buffOverwrite[id])), ['timestamp']))

		if (events.length === 0) {
			return
		}

		const panels = events.map(event => {
			const title = <>{this.parser.formatTimestamp(event.timestamp)} - <ActionLink {...event.action.action} /> overwritten on <Plural value={event.targets.length} one="# target" other="# targets" /> - {this.parser.formatDuration(event.timeLost)} lost </>
			const targetList = <div><List bulleted relaxed>
				{event.targets.map((target, index) => {
					return <List.Item key={index}> <JobIcon job={JOBS[target.type]} className={styles.jobIcon} /> {target.name} </List.Item>
				})}
			</List></div>

			return {
				key: event.timestamp,
				title: {
					content: title,
				},
				content: {
					content: <> {targetList} </>,
				},
			}
		})

		return <Accordion
			exclusive={false}
			panels={panels}
			styled
			fluid
		/>
	}

	_linkBuffConflicts() {
		Object.keys(this._buffs).forEach(buffID => {
			const buff = this._buffs[buffID]
			buff.conflicts = buff.conflicts.map(id => this._buffs[id])
		})
	}

	_initiateHooks() {
		const stackableST = []
		const stackableMT = []
		const unstackableST = []
		const unstackableMT = []
		const stackableBuffs = []
		const unstackableBuffs = []

		Object.keys(this._actions).forEach(id => {
			id = parseInt(id)
			const action = this._actions[id]
			const isStackable = action.buff.isStackable
			const isAoe = action.isAoe

			if (isStackable && !isAoe) {
				stackableST.push(id)
				stackableBuffs.push(action.buff.buff.id)
			} else if (isStackable && isAoe) {
				stackableMT.push(id)
				stackableBuffs.push(action.buff.buff.id)
			} else if (!isStackable && !isAoe) {
				unstackableST.push(id)
				unstackableBuffs.push(action.buff.buff.id)
			} else if (!isStackable && isAoe) {
				unstackableMT.push(id)
				unstackableBuffs.push(action.buff.buff.id)
			}
		})

		this.addHook('cast', {by: 'player', abilityId: stackableST},
			this._onSingleTargetCast)
		this.addHook('cast', {abilityId: unstackableST}, this._onSingleTargetCast)

		this.addHook('aoeheal', {by: 'player', abilityId: stackableMT}, this._onMultiTargetCast)
		this.addHook('aoeheal', {abilityId: unstackableMT}, this._onMultiTargetCast)

		this.addHook('removebuff', {by: 'player', abilityId: unstackableBuffs}, this._onRemoveBuff)
		this.addHook('removebuff', {abilityId: stackableBuffs}, this._onRemoveBuff)
	}

	_onSingleTargetCast(event) {
		const action = this._actions[event.ability.guid]
		const caster = this.combatants.getEntity(event.sourceID).info
		const target = this.combatants.getEntity(event.targetID).info
		const timestamp = event.timestamp

		this._manageOverwrite(action, caster, [target], timestamp)
		this._updateBuff(target, caster, action, timestamp)
	}

	_onMultiTargetCast(event) {
		const action = this._actions[event.ability.guid]
		const caster = this.combatants.getEntity(event.sourceID).info
		const targets = _.compact(event.hits.map(hit => this.combatants.getEntity(hit.id))).map(target => target.info)
		const timestamp = event.timestamp

		this._manageOverwrite(action, caster, targets, timestamp)
		targets.forEach(target => this._updateBuff(target, caster, action, timestamp))
	}

	_onRemoveBuff(event) {
		if (this._buffsByPlayer[event.targetID]) {
			this._buffsByPlayer[event.targetID][event.ability.guid] = null
		}
	}

	_manageOverwrite(action, caster, targets, timestamp) {
		const buffID = action.buff.buff.id
		const overwriteTargets = targets.filter(target => this._isOverwrite(target, buffID, timestamp) || this._isConflict(target, action.buff))
		if (overwriteTargets.length !== 0) {
			this._addOverwrite(overwriteTargets, caster, action, timestamp)
		}
	}

	_updateBuff(target, caster, action, timestamp) {
		const targetID = target.id
		const buff = {
			timestamp: timestamp,
			duration: action.buff.duration,
			by: caster,
		}

		this._buffsByPlayer[targetID][action.buff.buff.id] = buff
	}

	_addOverwrite(targets, caster, action, timestamp) {
		const timeLostByPlayer = targets.map(target => this._buffsByPlayer[target.id][action.buff.buff.id].duration - (timestamp - this._buffsByPlayer[target.id][action.buff.buff.id].timestamp))
		const timeLost = _.max(timeLostByPlayer)
		if (timeLost <= 0) {
			return
		}
		const overwriteInstance = {
			action: action,
			targets: targets,
			timestamp: timestamp,
			timeLost: timeLost,
		}

		if (!this._buffOverwrite.hasOwnProperty(action.action.id)) {
			this._buffOverwrite[action.action.id] = []
		}
		this._buffOverwrite[action.action.id].push(overwriteInstance)
	}

	_isOverwrite(target, buffID) {
		const playerID = target.id
		if (!this._buffsByPlayer.hasOwnProperty(playerID)) {
			this._buffsByPlayer[playerID] = {}
		}
		const buffInstance = this._buffsByPlayer[playerID][buffID]
		if (buffInstance === undefined || buffInstance === null) {
			return false
		}

		return true
	}

	_isConflict(target, buff) {
		return buff.conflicts.some(conflict => this._isOverwrite(target, conflict.buff.id))

	}
}
