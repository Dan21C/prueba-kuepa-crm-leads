export const inference = {
  /**
  * Contexto del lead para el modelo. A propósito NO incluye nombre, documento, correo ni celular:
  * a OpenAI solo viaja información comercial que no identifica a la persona.
  */
  lead_scoring: (_params: {
    program: string
    source: string
    status: string
    days_since_created: number
    channels: { document: boolean, email: boolean, number: boolean }
    previous_leads: number
    notes?: string
    rule_score: number
    factors: Array<{ key: string, points: number, max: number }>
  }) => `Datos del lead:
- Programa de interés: ${_params.program}
- Origen: ${_params.source}
- Estado actual: ${_params.status}
- Días desde el registro: ${_params.days_since_created}
- Canales de contacto disponibles: documento=${_params.channels.document}, correo=${_params.channels.email}, celular=${_params.channels.number}
- Leads anteriores del mismo contacto: ${_params.previous_leads}
- Notas del asesor: ${_params.notes ? `"${_params.notes}"` : '(sin notas)'}

Score por reglas: ${_params.rule_score}/100
Factores: ${_params.factors.map((_f) => `${_f.key} ${_f.points}/${_f.max}`).join(', ')}`,
}
