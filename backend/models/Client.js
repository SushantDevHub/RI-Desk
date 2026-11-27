import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true, // e.g. "CLI-1001"
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    website: {
      type: String,
      default: '',
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true,
    },
    cityState: {
      type: String,
      default: '',
      trim: true,
    },
    monthlyRental: {
      type: Number,
      default: 0,
    },
    services: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },
    servicesFeatures: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: String,
      default: 'Admin User',
    },
    ticketCount: {
      type: Number,
      default: 0,
    },
    tickets: {
      type: Array,
      default: [],
    },
    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  {
    timestamps: false,
    strict: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
export default Client;
