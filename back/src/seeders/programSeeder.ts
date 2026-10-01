import { Program } from '@app/models'
import { IConsole } from '@client/client'

export const run = async(_params, console:IConsole) => {
  try{
    
    
    const programs = [
      {
        name: 'Bachillerato Virtual',
        description: 'Termina tu bachillerato en modalidad virtual, a tu ritmo y con título oficial.',
      },
      {
        name: 'Técnico en Asistencia Administrativa',
        description: 'Gestión documental, atención al cliente y procesos administrativos.',
      },
      {
        name: 'Técnico en Sistemas',
        description: 'Soporte técnico, redes y mantenimiento de equipos de cómputo.',
      },
      {
        name: 'Técnico en Contabilidad y Finanzas',
        description: 'Registro contable, nómina y manejo de información financiera.',
      },
      {
        name: 'Inglés',
        description: 'Aprende inglés desde cero hasta nivel intermedio con clases en vivo.',
      },
      {
        name: 'Técnico en Atención a la Primera Infancia',
        description: 'Cuidado, educación y desarrollo integral de niños de 0 a 6 años.',
      },
    ]
    
    for (const program of programs) {
      await Program.updateOne(
        {name: program.name},
        {$set: {...program, status: 'active'}},
        {upsert: true}
      )
    }
  } catch (error) {
    console.log('error', error)
    return false
  }
  return true
}
