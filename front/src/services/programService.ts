import { get } from "../util/http"
const api = '/program'

export interface Program {
  _id: string
  name: string
  description?: string
}

export const programService = {
  api,
  list: async() =>{
    return await get({api: `${api}`})
  },
}
