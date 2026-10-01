import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IScoringInput, scoreLead } from '@app/domains/lead/leadScoring'

const base: IScoringInput = {
  source: 'referral',
  status: 'grading',
  notes: 'Quiere iniciar el próximo mes, trabaja en el día y puede estudiar en la noche.',
  has_document: true,
  has_email: true,
  has_number: true,
  days_since_created: 0,
  previous_leads: 1,
}

describe('scoreLead', () => {
  it('da 100 y prioridad alta a un lead completo, reciente y referido', () => {
    const result = scoreLead(base)
    assert.equal(result.score, 100)
    assert.equal(result.level, 'high')
    assert.equal(result.next_action, 'call_today')
  })

  it('los factores suman el score y nunca superan su máximo', () => {
    const result = scoreLead({ ...base, source: 'social', notes: 'corta', days_since_created: 10, previous_leads: 0, status: 'active' })
    assert.equal(result.score, result.factors.reduce((total, factor) => total + factor.points, 0))
    for (const factor of result.factors) assert.ok(factor.points <= factor.max, factor.key)
  })

  it('baja la prioridad de un lead viejo, manual y sin notas', () => {
    const result = scoreLead({ ...base, source: 'manual', notes: '', has_document: false, days_since_created: 60, previous_leads: 0, status: 'active' })
    assert.equal(result.level, 'low')
    assert.equal(result.next_action, 'nurture')
  })

  it('respeta los estados cerrados', () => {
    assert.equal(scoreLead({ ...base, status: 'sold' }).score, 100)
    const dropped = scoreLead({ ...base, status: 'dropped' })
    assert.ok(dropped.score <= 20)
    assert.equal(dropped.next_action, 'closed')
  })
})
