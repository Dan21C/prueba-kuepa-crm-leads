import mongoose_delete from "mongoose-delete"
import mongoose, { Types } from 'mongoose'


const { Schema } = mongoose

export const LEAD_STATUSES = ['active', 'grading', 'sold', 'dropped', 'inactive'] as const
export const LEAD_OPEN_STATUSES = ['active', 'grading']
export const LEAD_SOURCES = ['web', 'manual', 'referral', 'event', 'social'] as const

export type LeadStatus = typeof LEAD_STATUSES[number]
export type LeadSource = typeof LEAD_SOURCES[number]

export interface ILeadScoring {
  score: number;
  level: 'high' | 'medium' | 'low';
  engine: 'rules' | 'openai';
  model?: string;
  rule_score: number;
  factors: Array<{ key: string, points: number, max: number }>;
  summary?: string;
  strengths?: string[];
  risks?: string[];
  next_action?: string;
  next_action_key: string;
  evaluated_at: Date;
}

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
  scoring?: ILeadScoring;
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
  scoring: {
    score: {type: Schema.Types.Number, min: 0, max: 100},
    level: {type: Schema.Types.String, enum: ['high', 'medium', 'low']},
    engine: {type: Schema.Types.String, enum: ['rules', 'openai']},
    model: {type: Schema.Types.String},
    rule_score: {type: Schema.Types.Number},
    factors: [
      {
        _id: false,
        key: {type: Schema.Types.String},
        points: {type: Schema.Types.Number},
        max: {type: Schema.Types.Number},
      }
    ],
    summary: {type: Schema.Types.String},
    strengths: [{type: Schema.Types.String}],
    risks: [{type: Schema.Types.String}],
    next_action: {type: Schema.Types.String},
    next_action_key: {type: Schema.Types.String},
    evaluated_at: {type: Schema.Types.Date},
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