// @import_dependencies

// @import_services

// @import_models
import { Lead, Campaign, Third, Adnetwork, Tracking, Message, Interaction, Program } from "@app/models"
import { LEAD_OPEN_STATUSES, LEAD_STATUSES } from "@app/models/leadModel"

// @import_utilities
import { responseUtility } from "@core/utilities/responseUtility"
import { normalizeLead, validateLead, ILeadCreateParams, LeadFieldErrors, OBJECT_ID_REGEX } from "@app/domains/lead/leadValidation"
import { scoreLead, levelFor } from "@app/domains/lead/leadScoring"
import { openaiUtility } from "@core/utilities/openaiUtility"
import { system } from "@app/resources/prompts/system"
import { inference } from "@app/resources/prompts/inference"
import moment from "moment";

// @import_types

const LEAD_POPULATE = [
  { path: 'contact', select: 'first_name last_name document_type document number email', options: { lean: true } },
  { path: 'interestProgram', select: 'name', options: { lean: true } },
]


class LeadService {
  
  
  constructor () {}
  
  public async upsert (_params) {
    try{ 
      if(_params.user){
        const third = await Third.findOne({user: _params.user}).lean()
        if(!third) return responseUtility.error('third.not_found', null, { code: 404 });
        _params.adviser = third._id
      }
      
      if(_params.third){
        const third = await Third.findOne({_id: _params.third}).lean()
        if(!third) return responseUtility.error('third.not_found', null, { code: 404 });
        _params.adviser = third._id
      }
      
      let last_tracking = _params?.trackings?.[_params?.trackings?.length - 1]
      if(last_tracking?.new){
        const tracking = await Tracking.findOne({_id: last_tracking.tracking}).lean()
        if(tracking?.target_status){
          _params.status = tracking.target_status
        }
        if(!last_tracking.has_next_date && _params.status !== 'sold'){
          _params.status = 'dropped'
        }
      }
      
      if(_params._id){
        const exists = await Lead.findOne({_id: _params._id}).lean()
        if(!exists) return responseUtility.error('lead.not_found');
        
        const lead = await Lead.findOneAndUpdate({_id: _params._id}, {$set: _params}, {new:true, lean:true})
        
        
        return responseUtility.success({
          object: lead
        })
      } else {
        const create = await Lead.create(_params)
        const lead = create.toObject()
        
        
        return responseUtility.success({
          object: lead
        })
      }
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }
  
  /**
  * Registra un lead desde el formulario del CRM.
  * La persona se guarda (o reutiliza) en Third y el lead la referencia como `contact`.
  */
  public async create (_params) {
    try{
      const data = normalizeLead(_params)
      const fields = validateLead(data)
      if(Object.keys(fields).length){
        return responseUtility.error('lead.invalid_params', null, { fields })
      }

      const program = await Program.findOne({_id: data.interestProgram, status: 'active'}).lean()
      if(!program){
        return responseUtility.error('program.not_found', null, { fields: { interestProgram: 'not_found' } })
      }

      let contact = await this.findContact(data)
      if(contact){
        const open_lead = await Lead.findOne({contact: contact._id, status: {$in: LEAD_OPEN_STATUSES}})
        .populate(LEAD_POPULATE)
        .lean()
        if(open_lead){
          return responseUtility.error('lead.already_exists', null, { object: open_lead })
        }

        // Solo completa los datos que el contacto no tenía, nunca sobrescribe
        const missing = {}
        for (const _k of ['first_name', 'last_name', 'document_type', 'document', 'email', 'number']) {
          if(!contact[_k] && data[_k]) missing[_k] = data[_k]
        }
        if(Object.keys(missing).length){
          contact = await Third.findOneAndUpdate({_id: contact._id}, {$set: missing}, {new: true, lean: true})
        }
      } else {
        const created = await Third.create({
          first_name: data.first_name,
          last_name: data.last_name,
          document_type: data.document_type,
          document: data.document,
          email: data.email,
          number: data.number,
          type: 'cli',
          status: 'active',
          location:{
            type: 'Point',
            coordinates: [0, 0]
          },
        })
        contact = created.toObject()
      }

      // El usuario seeder no tiene Third asociado: en ese caso el lead queda sin asesor
      const adviser = _params.user ? await Third.findOne({user: _params.user}).select('_id').lean() : null

      const created = await Lead.create({
        incremental: await this.nextIncremental(),
        contact: contact._id,
        adviser: adviser?._id,
        interestProgram: program._id,
        source: data.source,
        notes: data.notes || undefined,
        status: 'active',
      })

      const lead = await Lead.findOne({_id: created._id})
      .populate(LEAD_POPULATE)
      .lean()

      return responseUtility.success({
        code: 201,
        object: lead
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }

  /**
  * Indica si ya existe un contacto (y un lead abierto) con el documento, correo o celular dados.
  */
  public async checkContact (_params) {
    try{
      const data = normalizeLead(_params)
      const contact = await this.findContact(data)
      if(!contact){
        return responseUtility.success({ exists: false })
      }

      const lead = await Lead.findOne({contact: contact._id, status: {$in: LEAD_OPEN_STATUSES}})
      .select('incremental status interestProgram created_at')
      .populate({ path: 'interestProgram', select: 'name', options: { lean: true } })
      .lean()

      return responseUtility.success({
        exists: true,
        contact: {
          _id: contact._id,
          first_name: contact.first_name,
          last_name: contact.last_name,
        },
        matches: ['document', 'email', 'number'].filter(_k => data[_k] && contact[_k] === data[_k]),
        lead: lead || null,
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }

  /**
  * Edita el lead y los datos de su contacto (Third).
  * Los datos personales se actualizan en el Third porque pertenecen a la persona, no al lead.
  */
  public async update (_params) {
    try{
      if(!OBJECT_ID_REGEX.test(`${_params._id || ''}`)) return responseUtility.error('lead.not_found', null, { code: 404 })
      const lead = await Lead.findOne({_id: _params._id}).lean()
      if(!lead) return responseUtility.error('lead.not_found', null, { code: 404 })

      const data = normalizeLead(_params)
      const status = `${_params.status || lead.status}`
      const fields: LeadFieldErrors & { status?: string } = validateLead(data)
      if(!LEAD_STATUSES.includes(status as any)) fields.status = 'invalid'
      if(Object.keys(fields).length){
        return responseUtility.error('lead.invalid_params', null, { fields })
      }

      const program = await Program.findOne({_id: data.interestProgram}).lean()
      if(!program){
        return responseUtility.error('program.not_found', null, { fields: { interestProgram: 'not_found' } })
      }

      // Los nuevos datos de contacto no pueden pertenecer a otra persona ya registrada
      const conflict = await this.findContact(data, lead.contact)
      if(conflict){
        const conflict_fields = {}
        for (const _k of ['document', 'email', 'number']) {
          if(conflict[_k] && conflict[_k] === data[_k]) conflict_fields[_k] = 'already_exists'
        }
        return responseUtility.error('third.already_exists', null, { fields: conflict_fields })
      }

      // Reabrir un lead no puede dejar dos leads abiertos para el mismo contacto
      if(LEAD_OPEN_STATUSES.includes(status) && !LEAD_OPEN_STATUSES.includes(lead.status)){
        const open_lead = await Lead.findOne({contact: lead.contact, _id: {$ne: lead._id}, status: {$in: LEAD_OPEN_STATUSES}}).lean()
        if(open_lead){
          return responseUtility.error('lead.already_exists', null, { fields: { status: 'already_exists' }, object: open_lead })
        }
      }

      await Third.updateOne({_id: lead.contact}, {$set: {
        first_name: data.first_name,
        last_name: data.last_name,
        document_type: data.document_type,
        document: data.document,
        email: data.email,
        number: data.number,
      }})

      const updated = await Lead.findOneAndUpdate({_id: lead._id}, {$set: {
        interestProgram: program._id,
        source: data.source,
        notes: data.notes,
        status,
      }}, {new: true})
      .populate(LEAD_POPULATE)
      .lean()

      return responseUtility.success({
        object: updated
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }

  /**
  * Borrado lógico (mongoose-delete): el lead deja de aparecer pero se conserva el historial.
  * El contacto (Third) no se borra porque puede tener otros leads o interacciones.
  */
  public async delete (_params:{_id:string}) {
    try{
      if(!OBJECT_ID_REGEX.test(`${_params._id || ''}`)) return responseUtility.error('lead.not_found', null, { code: 404 })
      const lead = await Lead.findOne({_id: _params._id}).select('_id').lean()
      if(!lead) return responseUtility.error('lead.not_found', null, { code: 404 })

      await Lead.delete({_id: lead._id})

      return responseUtility.success({
        deleted: true
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }

  /**
  * Calcula la factibilidad de que el lead se matricule y la guarda en `lead.scoring`.
  * Siempre calcula el score por reglas; si hay OPENAI_API_KEY lo enriquece con un análisis del modelo.
  */
  public async score (_params:{_id:string}) {
    try{
      if(!OBJECT_ID_REGEX.test(`${_params._id || ''}`)) return responseUtility.error('lead.not_found', null, { code: 404 })
      const lead = await Lead.findOne({_id: _params._id})
      .populate(LEAD_POPULATE)
      .lean()
      if(!lead) return responseUtility.error('lead.not_found', null, { code: 404 })

      const previous_leads = await Lead.countDocuments({contact: lead.contact?._id, _id: {$ne: lead._id}})
      const days_since_created = moment().diff(moment(lead.created_at), 'days')
      const channels = {
        document: !!lead.contact?.document,
        email: !!lead.contact?.email,
        number: !!lead.contact?.number,
      }

      const rules = scoreLead({
        source: lead.source,
        status: lead.status,
        notes: lead.notes,
        has_document: channels.document,
        has_email: channels.email,
        has_number: channels.number,
        days_since_created,
        previous_leads,
      })

      const scoring: any = {
        score: rules.score,
        level: rules.level,
        engine: 'rules',
        rule_score: rules.score,
        factors: rules.factors,
        next_action_key: rules.next_action,
        evaluated_at: new Date(),
      }

      const ai = await openaiUtility.chatJSON<{score:number, summary:string, strengths:string[], risks:string[], next_action:string}>({
        system: system.lead_scoring,
        user: inference.lead_scoring({
          program: lead.interestProgram?.name || 'sin programa',
          source: lead.source,
          status: lead.status,
          days_since_created,
          channels,
          previous_leads,
          notes: lead.notes,
          rule_score: rules.score,
          factors: rules.factors,
        }),
      })

      if(ai && Number.isFinite(Number(ai.score))){
        // El modelo solo puede mover el score ±20 respecto a las reglas, para que sea predecible
        const score = Math.round(Math.min(rules.score + 20, Math.max(rules.score - 20, Number(ai.score))))
        const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : undefined
        const list = (value: unknown) => Array.isArray(value) ? value.map((_v) => text(_v, 160)).filter(Boolean).slice(0, 3) : []
        Object.assign(scoring, {
          score: Math.min(100, Math.max(0, score)),
          level: levelFor(score),
          engine: 'openai',
          model: openaiUtility.model,
          summary: text(ai.summary, 400),
          strengths: list(ai.strengths),
          risks: list(ai.risks),
          next_action: text(ai.next_action, 200),
        })
      }

      await Lead.updateOne({_id: lead._id}, {$set: {scoring}})

      return responseUtility.success({
        object: scoring
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }

  private async findContact (data: Partial<ILeadCreateParams>, exclude?: string) {
    const or = []
    if(data.document) or.push({ document: data.document })
    if(data.email) or.push({ email: data.email })
    if(data.number) or.push({ number: data.number })
    if(!or.length) return null

    const where: any = { type: 'cli', $or: or }
    if(exclude) where._id = { $ne: exclude }
    return await Third.findOne(where).lean()
  }

  private async nextIncremental () {
    const last = await Lead.findOneWithDeleted({ incremental: { $exists: true } })
    .sort({ incremental: -1 })
    .select('incremental')
    .lean()
    return Math.max(1000, (last?.incremental || 999) + 1)
  }

  public async adviserInfo (_params){
    try{
      const third = await Third.findOne({user: _params.user}).lean()
      if(!third) return responseUtility.error('third.not_found',null, {code: 404});
      
      const where_campaigns = {
        status: 'active',
      }
      let select_campaigns = 'name users.$'
      if(_params.campaign){
        where_campaigns['_id'] = _params.campaign
        select_campaigns = 'name users'
      } else {
        where_campaigns['users.third'] = third._id
      }
      
      const campaigns = await Campaign.find(where_campaigns)
      .select(select_campaigns)
      .sort({created_at:1})
      .lean()
      
      const _adnetworks = {}
      campaigns.forEach(_c=>{
        _c.users.forEach(_u=>{
          _u.adnetworks.forEach(_a=>{
            _adnetworks[_a] = _c._id
          })
        })
      })
      
      const [ adnetworks, leads, trackings] = await Promise.all([
        Adnetwork.find({
          status: 'active',
          _id: { $in: Object.keys(_adnetworks) }
        })
        .lean(),
        Lead.find({
          campaign: { $in: campaigns.map((_c:any)=>{return _c._id}) },
          status: {$in:['active', 'grading']},
          contact:  _params.contact
        })
        .lean(),
        Tracking.find({
          status: 'active'
        })
      ])
      
      return responseUtility.success({
        campaigns,
        leads, 
        adnetworks,
        parser: _adnetworks,
        trackings
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }
  
  public async external (_params) {
    try{
      
      const create_interaction = {
        target: 'human',
        number: _params.number,
        last_inbound: moment().toISOString(),
        source: 'machine',
        type: 'form',
        status: 'ended',
        messages:[],
        _ref:{
          lead: null,
          adviser: null,
          contact: null
        }
      }
      
      let third
      if(_params.contact){
        third = await Third.findOne({_id: _params.contact}).lean()
      } else {
        third = await Third.findOne({number: _params.number,  type: 'cli'}).lean()
      }
      if(third){
        if(_params.content){
          const message_created = await Message.create({
            sender: third._id,
            inbound: true,
            content: _params.content,
            number: _params.number,
            type: 'form',
            source: 'web',
          })
          create_interaction.messages.push(message_created._id)
        }
        const lead = _params.not_found ?? await Lead.findOne({ contact: third._id, status: {$in:['active', 'grading']}}).lean()
        if(lead){
          const tracking = await Tracking.findOne({ 'defaults.again': true}).lean()
          await Lead.updateOne({_id: lead._id}, {
            $push: {
              trackings: {
                ...(lead.trackings?.[lead.trackings.length -1] || {}),
                tracking: tracking._id,
                interest: 4,
                created_at: moment().toISOString(),
              }
            }
          })
          
          create_interaction._ref.lead = lead._id
          create_interaction._ref.adviser = third._id
          create_interaction._ref.contact = lead.contact
          
          await Interaction.create(create_interaction)
          
          return responseUtility.success({
            object: lead
          })
        } else {
          const adnetwork = await Adnetwork.findOne({'defaults.organic': true}).lean()
          const campaign = await Campaign.findOne({status: 'active', 'users.adnetworks': adnetwork._id})
          .select('users.$')
          .lean()
          
          return await this.upsert({
            third: campaign.users[0].third, 
            contact: third._id, 
            adnetwork: adnetwork._id, 
            campaign: campaign._id
          })
        }
      } else {
        const create = await Third.create({
          email: _params.email,
          first_name: _params.first_name,
          last_name: _params.last_name,
          number: _params.number,
          status: 'active',
          location:{
            type: 'Point',
            coordinates: [0, 0]
          },
          type: 'cli',
        })
        const third = create.toObject()
        const adnetwork = await Adnetwork.findOne({'defaults.organic': true}).lean()
        const campaign = await Campaign.findOne({status: 'active', 'users.adnetworks': adnetwork._id})
        .select('users.$')
        .lean()

        //TODO: Balance
        if(_params.content){
          const message_created = await Message.create({
            sender: third._id,
            inbound: true,
            content: _params.content,
            number: _params.number,
            type: 'form',
            source: 'web',
          })
          create_interaction.messages.push(message_created._id)
        }
        
        const lead_created = await this.upsert({
          third: campaign.users[0].third, 
          contact: third._id, 
          adnetwork: adnetwork._id, 
          campaign: campaign._id
        })
        
        create_interaction._ref.lead = lead_created.object._id
        create_interaction._ref.adviser = third._id
        create_interaction._ref.contact = lead_created.object.contact
        if(!_params.ignore_interaction){
          await Interaction.create(create_interaction)
        }
        return lead_created
      }
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }
  
  public async list (_params) {
    try{
      const where:any = {}
      
      let third
      
      if(_params.user){
        third = await Third.findOne({user: _params.user}).lean()
        if(third) where.adviser = third._id.toString()
      }
      
      
      let leads = await Lead.find(where)
      .sort({created_at:-1})
      .populate(LEAD_POPULATE)
      .limit(100)
      .lean()
      
      leads = leads.map(_l=>{
        _l.full_name = `${_l.contact?.first_name || ''} ${_l.contact?.last_name || ''}`.trim()
        return _l
      })
      
      return responseUtility.success({
        list:leads
      })
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }
  
  public async test (_params) {
    try{
      
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }
  

  
  public async get (_params:{_id:string}) {
    try{
      const lead = await Lead.findOne({_id: _params._id})
      .populate({
        path: 'contact',
        select: 'first_name last_name incremental document number',
        options: { lean:true }
      })
      .lean()
      
      if(!lead) return responseUtility.error('lead.not_found', null, { code: 404 });
      const interactions = await Interaction.find({'_ref.lead': _params._id})
      .populate({
        path: 'messages',
        select: 'inbound from to content created_at',
        options: { lean:true }
      })
      .sort({created_at:-1})
      .lean()
      return responseUtility.success({
        lead,
        interactions
      })
      
    } catch (error) {
      console.log('error', error)
      return responseUtility.error('server.error', null, { code: 500 })
    }
  }
}



export const leadService = new LeadService()
export { LeadService }