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
  checkContact: async(params: Partial<Pick<LeadPayload, 'document' | 'email' | 'number'>>) =>{
    return await get({api: `${api}/check-contact`, options: { params }})
  },
}
