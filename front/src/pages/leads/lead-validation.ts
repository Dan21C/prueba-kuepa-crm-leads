import { LeadPayload } from "@/services/leadService"

// Espejo de back/src/app/domains/lead/leadValidation.ts
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MOBILE_REGEX = /^3\d{9}$/
export const DOCUMENT_REGEX = /^\d{5,12}$/
export const PASSPORT_REGEX = /^[a-zA-Z0-9]{5,12}$/
export const NOTES_MAX = 500
export const MIN_AGE = 14
export const MAX_AGE = 100

export type LeadField = keyof LeadPayload | 'status'
export type FieldErrors = Partial<Record<LeadField, string>>

export const REQUIRED_FIELDS: LeadField[] = [
  'first_name', 'last_name', 'document_type', 'document', 'email', 'number', 'interestProgram'
]

export const emptyLead = (): LeadPayload => ({
  first_name: '',
  last_name: '',
  document_type: 'cc',
  document: '',
  email: '',
  number: '',
  interestProgram: '',
  source: 'manual',
  notes: '',
  birth_date: '',
  education_level: '',
})

/** Fecha de hoy en YYYY-MM-DD (hora local), para limitar el selector de fecha */
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const normalizeDocument = (value: string) => value.replace(/[\s.-]/g, '').toUpperCase()
export const normalizeNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10)

/**
* Valida un campo y devuelve el código de error (required | invalid | too_long) o undefined.
*/
export const validateField = (field: LeadField, lead: LeadPayload): string | undefined => {
  const raw = field === 'status' ? '' : lead[field]
  const value = typeof raw === 'string' ? raw.trim() : ''

  if (REQUIRED_FIELDS.includes(field) && !value) return 'required'

  switch (field) {
    case 'first_name':
    case 'last_name':
      return value.length > 60 ? 'too_long' : undefined
    case 'document': {
      const document = normalizeDocument(value)
      const valid = lead.document_type === 'pp' ? PASSPORT_REGEX.test(document) : DOCUMENT_REGEX.test(document)
      return valid ? undefined : 'invalid'
    }
    case 'email':
      return EMAIL_REGEX.test(value.toLowerCase()) ? undefined : 'invalid'
    case 'number':
      return MOBILE_REGEX.test(normalizeNumber(value)) ? undefined : 'invalid'
    case 'notes':
      return value.length > NOTES_MAX ? 'too_long' : undefined
    case 'birth_date': {
      if (!value) return undefined
      const date = new Date(`${value}T00:00:00`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(date.getTime())) return 'invalid'
      const now = new Date()
      if (date > now) return 'future'
      let age = now.getFullYear() - date.getFullYear()
      if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age--
      return age < MIN_AGE || age > MAX_AGE ? 'out_of_range' : undefined
    }
    default:
      return undefined
  }
}

export const validateLead = (lead: LeadPayload): FieldErrors => {
  const errors: FieldErrors = {}
  for (const field of Object.keys(lead) as Array<keyof LeadPayload>) {
    const error = validateField(field, lead)
    if (error) errors[field] = error
  }
  return errors
}
