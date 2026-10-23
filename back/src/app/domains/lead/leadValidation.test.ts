import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLead, validateLead } from '@app/domains/lead/leadValidation'

const valid = {
  first_name: 'Ana María',
  last_name: 'Pérez',
  document_type: 'cc',
  document: '1020304050',
  email: 'ana@correo.com',
  number: '3101234567',
  interestProgram: '64b7f0c2a1b2c3d4e5f60718',
  source: 'web',
}

describe('normalizeLead', () => {
  it('limpia espacios, pasa el correo a minúsculas y deja el celular solo en dígitos', () => {
    const lead = normalizeLead({
      ...valid,
      first_name: '  Ana   María ',
      email: ' ANA@Correo.COM ',
      number: '+57 310 123 4567',
      document: '1.020.304.050',
    })
    assert.equal(lead.first_name, 'Ana María')
    assert.equal(lead.email, 'ana@correo.com')
    assert.equal(lead.number, '3101234567')
    assert.equal(lead.document, '1020304050')
  })

  it('usa manual como origen por defecto', () => {
    assert.equal(normalizeLead({ ...valid, source: undefined }).source, 'manual')
  })
})

describe('validateLead', () => {
  it('acepta un lead válido', () => {
    assert.deepEqual(validateLead(normalizeLead(valid)), {})
  })

  it('marca los campos obligatorios vacíos', () => {
    const errors = validateLead(normalizeLead({}))
    for (const field of ['first_name', 'last_name', 'document_type', 'document', 'email', 'number', 'interestProgram']) {
      assert.equal(errors[field], 'required', field)
    }
  })

  it('rechaza celulares que no son colombianos', () => {
    assert.equal(validateLead(normalizeLead({ ...valid, number: '2101234567' })).number, 'invalid')
    assert.equal(validateLead(normalizeLead({ ...valid, number: '310123456' })).number, 'invalid')
  })

  it('exige documento numérico salvo en pasaporte', () => {
    assert.equal(validateLead(normalizeLead({ ...valid, document: 'AB12345' })).document, 'invalid')
    assert.equal(validateLead(normalizeLead({ ...valid, document_type: 'pp', document: 'AB12345' })).document, undefined)
    assert.equal(validateLead(normalizeLead({ ...valid, document: '1234' })).document, 'invalid')
  })

  it('rechaza correos, origen y programa inválidos', () => {
    const errors = validateLead(normalizeLead({ ...valid, email: 'ana@', source: 'tv', interestProgram: '123' }))
    assert.equal(errors.email, 'invalid')
    assert.equal(errors.source, 'invalid')
    assert.equal(errors.interestProgram, 'invalid')
  })
})

describe('campos opcionales: fecha de nacimiento y nivel educativo', () => {
  it('son opcionales', () => {
    assert.deepEqual(validateLead(normalizeLead({ ...valid, birth_date: '', education_level: '' })), {})
  })

  it('acepta una fecha y un nivel válidos', () => {
    const lead = normalizeLead({ ...valid, birth_date: '1995-06-15', education_level: 'undergraduate' })
    assert.deepEqual(validateLead(lead), {})
    assert.equal(lead.birth_date, '1995-06-15')
  })

  it('rechaza fechas inexistentes, futuras o fuera de rango', () => {
    assert.equal(validateLead(normalizeLead({ ...valid, birth_date: '1995-02-31' })).birth_date, 'invalid')
    assert.equal(validateLead(normalizeLead({ ...valid, birth_date: '15/06/1995' })).birth_date, 'invalid')
    assert.equal(validateLead(normalizeLead({ ...valid, birth_date: '2999-01-01' })).birth_date, 'future')
    assert.equal(validateLead(normalizeLead({ ...valid, birth_date: '1900-01-01' })).birth_date, 'out_of_range')
  })

  it('rechaza un nivel educativo desconocido', () => {
    assert.equal(validateLead(normalizeLead({ ...valid, education_level: 'phd' })).education_level, 'invalid')
  })
})
