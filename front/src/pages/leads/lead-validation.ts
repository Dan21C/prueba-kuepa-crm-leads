import { LeadPayload } from "@/services/leadService"

// Espejo de back/src/app/domains/lead/leadValidation.ts
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MOBILE_REGEX = /^3\d{9}$/
export const DOCUMENT_REGEX = /^\d{5,12}$/
export const PASSPORT_REGEX = /^[a-zA-Z0-9]{5,12}$/
export const NOTES_MAX = 500

export type LeadField = keyof LeadPayload
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
})

export const normalizeDocument = (value: string) => value.replace(/[\s.-]/g, '').toUpperCase()
export const normalizeNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10)

/**
* Valida un campo y devuelve el código de error (required | invalid | too_long) o undefined.
*/
export const validateField = (field: LeadField, lead: LeadPayload): string | undefined => {
  const value = typeof lead[field] === 'string' ? lead[field].trim() : ''

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
    default:
      return undefined
  }
}

export const validateLead = (lead: LeadPayload): FieldErrors => {
  const errors: FieldErrors = {}
  for (const field of Object.keys(lead) as LeadField[]) {
    const error = validateField(field, lead)
    if (error) errors[field] = error
  }
  return errors
}
