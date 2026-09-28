import { Schema, model, type InferSchemaType } from 'mongoose';
import { toJSONPlugin } from '../common/mongoose';

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    plan: { type: String, default: 'standard' },
    branding: {
      logoUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#185FA5' },
    },
    settings: {
      defaultRowsPerPage: { type: Number, default: 100 },
      workingHours: { start: { type: String, default: '09:30' }, end: { type: String, default: '18:30' } },
      workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
      defaultFollowUpHours: { type: Number, default: 24 },
      duplicatePhoneCheck: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
schema.plugin(toJSONPlugin);

export type OrganisationDoc = InferSchemaType<typeof schema>;
export const Organisation = model('Organisation', schema);
