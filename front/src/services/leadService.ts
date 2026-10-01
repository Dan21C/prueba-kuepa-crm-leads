import { get, post } from "../util/http"
const api = '/lead'

export type LeadSource = 'web' | 'manual' | 'referral' | 'event' | 'social'
export type LeadStatus = 'active' | 'grading' | 'sold' | 'dropped' | 'inactive'
export type DocumentType = 'cc' | 'ti' | 'pp' | 'nt'

export interface LeadPayload {
  first_name: string
  last_name: string
  document_type: DocumentType | ''
  document: string
  email: string
  number: string
  interestProgram: string
  source: LeadSource
  notes: string
}

export type ScoringLevel = 'high' | 'medium' | 'low'
export type ScoringFactorKey = 'source' | 'channels' | 'notes' | 'recency' | 'history' | 'status'

export interface LeadScoring {
  score: number
  level: ScoringLevel
  engine: 'rules' | 'openai'
  model?: string
  rule_score: number
  factors: Array<{ key: ScoringFactorKey, points: number, max: number }>
  summary?: string
  strengths?: string[]
  risks?: string[]
  next_action?: string
  next_action_key: 'call_today' | 'follow_up' | 'nurture' | 'enrolled' | 'closed'
  evaluated_at: string
}

export interface Lead {
  _id: string
  incremental: number
  full_name?: string
  contact?: {
    _id: string
    first_name: string
    last_name: string
    document_type?: DocumentType
    document?: string
    email?: string
    number?: string
  }
  interestProgram?: { _id: string, name: string }
  source: LeadSource
  status: LeadStatus
  notes?: string
  scoring?: LeadScoring
  created_at: string
}

export interface CheckContactResponse {
  exists: boolean
  contact?: { _id: string, first_name: string, last_name: string }
  matches?: Array<'document' | 'email' | 'number'>
  lead?: Pick<Lead, '_id' | 'incremental' | 'status' | 'interestProgram' | 'created_at'> | null
}

export const leadService = {
  api,
  get: async({_id}:{_id:string}) =>{
    return await get({api: `${api}/get/${_id}`})
  },
  list: async() =>{
    return await get({api: `${api}`})
  },
  create: async(data: LeadPayload) =>{
    return await post({api: `${api}/create`, options: { data: {...data} }})
  },
  update: async(_id: string, data: LeadPayload & { status: LeadStatus }) =>{
    return await post({api: `${api}/update/${_id}`, options: { data: {...data} }})
  },
  score: async(_id: string) =>{
    return await post({api: `${api}/score/${_id}`})
  },
  remove: async(_id: string) =>{
    return await post({api: `${api}/delete/${_id}`})
  },
  checkContact: async(params: Partial<Pick<LeadPayload, 'document' | 'email' | 'number'>>) =>{
    return await get({api: `${api}/check-contact`, options: { params }})
  },
}
