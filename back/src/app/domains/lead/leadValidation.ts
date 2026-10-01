// @import_models
import { LEAD_SOURCES } from "@app/models/leadModel"

export const DOCUMENT_TYPES = ['cc', 'ti', 'pp', 'nt'] as const

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MOBILE_REGEX = /^3\d{9}$/
export const DOCUMENT_REGEX = /^\d{5,12}$/
export const PASSPORT_REGEX = /^[a-zA-Z0-9]{5,12}$/
export const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

export interface ILeadCreateParams {
  first_name: string
  last_name: string
  document_type: string
  document: string
  email: string
  number: string
  interestProgram: string
  source?: string
  notes?: string
}

export type LeadFieldErrors = Partial<Record<keyof ILeadCreateParams, string>>

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/**
* Normaliza los datos del formulario: trim, correo en minúsculas y celular solo dígitos
* (descarta el prefijo +57 si viene incluido).
*/
export const normalizeLead = (_params: any): ILeadCreateParams => {
  let number = clean(_params?.number).replace(/\D/g, '')
  if (number.length === 12 && number.startsWith('57')) number = number.slice(2)

  return {
    first_name: clean(_params?.first_name).replace(/\s+/g, ' '),
    last_name: clean(_params?.last_name).replace(/\s+/g, ' '),
    document_type: clean(_params?.document_type).toLowerCase(),
    document: clean(_params?.document).replace(/[\s.-]/g, '').toUpperCase(),
    email: clean(_params?.email).toLowerCase(),
    number,
    interestProgram: clean(_params?.interestProgram),
    source: clean(_params?.source) || 'manual',
    notes: clean(_params?.notes),
  }
}

/**
* Devuelve un mapa campo → código de error. Vacío si los datos son válidos.
*/
export const validateLead = (lead: ILeadCreateParams): LeadFieldErrors => {
  const errors: LeadFieldErrors = {}

  if (!lead.first_name) errors.first_name = 'required'
  else if (lead.first_name.length > 60) errors.first_name = 'too_long'

  if (!lead.last_name) errors.last_name = 'required'
  else if (lead.last_name.length > 60) errors.last_name = 'too_long'

  if (!lead.document_type) errors.document_type = 'required'
  else if (!DOCUMENT_TYPES.includes(lead.document_type as any)) errors.document_type = 'invalid'

  if (!lead.document) errors.document = 'required'
  else if (lead.document_type === 'pp' ? !PASSPORT_REGEX.test(lead.document) : !DOCUMENT_REGEX.test(lead.document)) {
    errors.document = 'invalid'
  }

  if (!lead.email) errors.email = 'required'
  else if (!EMAIL_REGEX.test(lead.email)) errors.email = 'invalid'

  if (!lead.number) errors.number = 'required'
  else if (!MOBILE_REGEX.test(lead.number)) errors.number = 'invalid'

  if (!lead.interestProgram) errors.interestProgram = 'required'
  else if (!OBJECT_ID_REGEX.test(lead.interestProgram)) errors.interestProgram = 'invalid'

  if (lead.source && !LEAD_SOURCES.includes(lead.source as any)) errors.source = 'invalid'

  if (lead.notes && lead.notes.length > 500) errors.notes = 'too_long'

  return errors
}
