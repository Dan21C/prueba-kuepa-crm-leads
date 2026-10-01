import mongoose_delete from "mongoose-delete"
import mongoose, { Types } from 'mongoose'


const { Schema } = mongoose

export const LEAD_STATUSES = ['active', 'grading', 'sold', 'dropped', 'inactive'] as const
export const LEAD_OPEN_STATUSES = ['active', 'grading']
export const LEAD_SOURCES = ['web', 'manual', 'referral', 'event', 'social'] as const

export type LeadStatus = typeof LEAD_STATUSES[number]
export type LeadSource = typeof LEAD_SOURCES[number]

export interface ILeadTracking {
  tracking: Types.ObjectId;
  description?: string;
  interest?: number;
  created_at?: Date;
}

/**
* El lead es el proceso comercial: los datos de la persona viven en Third (type: 'cli')
* y se referencian por `contact`.
*/
export interface ILead {
  _id: Types.ObjectId;
  incremental: number;
  contact: Types.ObjectId;
  adviser?: Types.ObjectId;
  interestProgram: Types.ObjectId;
  campaign?: Types.ObjectId;
  adnetwork?: Types.ObjectId;
  source: LeadSource;
  notes?: string;
  status: LeadStatus;
  trackings: ILeadTracking[];
  created_at: Date;
  updated_at: Date;
}

const LeadSchema = new Schema({
  incremental:{
    //numero unico de 4 digitos
    type: Schema.Types.Number,
    unique: true,
  },
  contact: {type: Schema.Types.ObjectId, ref: 'Third', required: true},
  adviser: {type: Schema.Types.ObjectId, ref: 'Third'},
  interestProgram: {type: Schema.Types.ObjectId, ref: 'Program', required: true},
  campaign: {type: Schema.Types.ObjectId, ref: 'Campaign'},
  adnetwork: {type: Schema.Types.ObjectId, ref: 'Adnetwork'},
  source:{
    type: Schema.Types.String,
    enum: LEAD_SOURCES,
    default: 'manual'
  },
  notes: {type: Schema.Types.String},
  status:{
    type: Schema.Types.String,
    enum: LEAD_STATUSES,
    default: 'active'
  },
  trackings: [
    {
        tracking: {type: Schema.Types.ObjectId, ref: 'Tracking'},
        description: {type: Schema.Types.String},
        interest: {type: Schema.Types.Number},
        created_at: {type: Schema.Types.Date},
    }
  ]
}, {
  collection: 'leads', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

LeadSchema.index({ contact: 1 })
LeadSchema.index({ adviser: 1 })
LeadSchema.index({ status: 1 })

LeadSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: 'all',
  indexFields: 'all'
})


export const LeadModel = mongoose.model<ILead, any>('Lead', LeadSchema)