import { userService } from '@app/domains/user/userService'
import { Adnetwork, Campaign, Permission, Role, Third, Tracking, User } from '@app/models'
import { IConsole } from '@client/client'
import { run as runProgramSeeder } from './programSeeder'
import config from 'config'

export const run = async(_params, console:IConsole) => {
  try{

    // Permisos que el front exige para mostrar el CRM y el módulo de leads en el sidebar
    const permissions = []
    for (const content of ['sidebar:crm', 'sidebar:leads', 'crm:leads']) {
      const permission = await Permission.findOneAndUpdate(
        {app: 'kuepa', content},
        {$set: {app: 'kuepa', content}},
        {upsert: true, new: true, lean: true}
      )
      permissions.push(permission._id)
    }

    const role = await Role.findOneAndUpdate(
      {app: 'kuepa', name: 'Asesor'},
      {$set: {app: 'kuepa', name: 'Asesor', permissions}},
      {upsert: true, new: true, lean: true}
    )

    const users = [
      {
        username: 'useradminket',
        password: 'ket#2025', 
        number: '000000',
        profile:{
          first_name: 'Kuepa', 
          last_name: ''
        },
        homes:[
          {
            app:"kuepa",
            roles: [role._id],
            current: true,
          },
        ]
      },
    ]

    for (const user of users) {
      const exists = await User.findOne({username: user.username}).lean()
      if(exists){
        user['_id'] = exists._id
        const update = await User.updateOne({_id: exists._id}, {$set: user})
        user['merge_homes'] = true
      }
      await userService.upsert(user)

      // Third del usuario: es el asesor que se asigna a los leads que registra
      await Third.updateOne(
        {user: user['_id']},
        {
          $set: {
            first_name: user.profile.first_name,
            last_name: user.profile.last_name,
            number: user.number,
            type: 'emp',
            status: 'active',
          },
        },
        {upsert: true}
      )
    }

    // Catálogo de programas, para que el formulario quede listo con el comando documentado
    if(!await runProgramSeeder(_params, console)) return false
  } catch (error) {
    console.log('error', error)
    return false
  }
  return true
}