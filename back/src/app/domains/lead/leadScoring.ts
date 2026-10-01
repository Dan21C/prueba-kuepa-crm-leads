// @import_models
import { LeadSource, LeadStatus } from "@app/models/leadModel"

export type ScoringLevel = 'high' | 'medium' | 'low'
export type NextAction = 'call_today' | 'follow_up' | 'nurture' | 'enrolled' | 'closed'

export interface IScoringInput {
  source: LeadSource
  status: LeadStatus
  notes?: string
  has_document: boolean
  has_email: boolean
  has_number: boolean
  days_since_created: number
  previous_leads: number
}

export interface IScoringFactor {
  key: 'source' | 'channels' | 'notes' | 'recency' | 'history' | 'status'
  points: number
  max: number
}

export interface IRuleScoring {
  score: number
  level: ScoringLevel
  factors: IScoringFactor[]
  next_action: NextAction
}

// Conversión histórica esperada por origen: un referido llega con más confianza que un formulario manual
const SOURCE_POINTS: Record<LeadSource, number> = {
  referral: 25,
  event: 20,
  web: 18,
  social: 12,
  manual: 10,
}

export const levelFor = (score: number): ScoringLevel => score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low'

/**
* Score de factibilidad 0–100 explicable por factores. Es determinístico, no depende de servicios
* externos y sirve de respaldo (y de contexto) para el análisis con IA.
*/
export const scoreLead = (input: IScoringInput): IRuleScoring => {
  const notes = (input.notes || '').trim()
  const channels = [input.has_document, input.has_email, input.has_number].filter(Boolean).length
  const days = Math.max(0, input.days_since_created)

  const factors: IScoringFactor[] = [
    { key: 'source', points: SOURCE_POINTS[input.source] ?? SOURCE_POINTS.manual, max: 25 },
    { key: 'channels', points: Math.round((channels / 3) * 20), max: 20 },
    { key: 'notes', points: notes.length >= 40 ? 15 : notes.length > 0 ? 8 : 0, max: 15 },
    { key: 'recency', points: days <= 2 ? 20 : days <= 7 ? 15 : days <= 30 ? 8 : 2, max: 20 },
    { key: 'history', points: input.previous_leads > 0 ? 10 : 0, max: 10 },
    { key: 'status', points: input.status === 'grading' ? 10 : input.status === 'active' ? 5 : 0, max: 10 },
  ]

  let score = factors.reduce((total, factor) => total + factor.points, 0)
  let next_action: NextAction

  if (input.status === 'sold') {
    score = 100
    next_action = 'enrolled'
  } else if (input.status === 'dropped' || input.status === 'inactive') {
    score = Math.min(score, 20)
    next_action = 'closed'
  } else {
    const level = levelFor(score)
    next_action = level === 'high' ? 'call_today' : level === 'medium' ? 'follow_up' : 'nurture'
  }

  return { score, level: levelFor(score), factors, next_action }
}
