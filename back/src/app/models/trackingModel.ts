import mongoose_delete from "mongoose-delete" 
import mongoose from 'mongoose' 


const { Schema } = mongoose 

const TrackingSchema = new Schema({
  name:{
    type: Schema.Types.String,
  },
  description:{
    type: Schema.Types.String,
  },
  target_status:{
    type: Schema.Types.String,
    enum: ['active', 'grading', 'sold', 'dropped', 'inactive'],
  },
  defaults:{
    again: {type: Schema.Types.Boolean},
  },
  status:{
    type: Schema.Types.String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  collection: 'trackings', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

TrackingSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: 'all',
  indexFields: 'all' 
}) 


export const TrackingModel = mongoose.model<any, any>('Tracking', TrackingSchema) 