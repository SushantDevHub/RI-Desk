import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true, // "TKT-1001", "TKT-1012", etc.
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved'],
      default: 'open',
      index: true,
    },
    userType: {
      type: String,
      default: 'client',
    },
    client: {
      type: String,
      default: '',
      trim: true,
    },
    customer: {
      type: String,
      default: '',
      trim: true,
    },
    clientMobile: {
      type: String,
      default: '',
      trim: true,
    },
    customerMobile: {
      type: String,
      default: '',
      trim: true,
    },
    clientEmail: {
      type: String,
      default: '',
      trim: true,
    },
    customerEmail: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: String,
      default: 'Client',
    },
    createdById: {
      type: Number,
      default: null,
    },
    assignedTo: {
      type: String,
      default: null,
    },
    assignedToId: {
      type: Number,
      default: null,
      index: true,
    },
    assignedEmployeeId: {
      type: Number,
      default: null,
    },
    operator: {
      type: String,
      default: null,
    },
    providerName: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    screenshot: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      default: 'self_service_portal',
    },
    isUnassigned: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    resolvedAt: {
      type: String,
      default: null,
    },
    resolution: {
      type: String,
      default: null,
    },
    resolutionTime: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
    },
    resolvedById: {
      type: Number,
      default: null,
    },
    logs: {
      type: Array,
      default: [],
    },
    activityLog: {
      type: Array,
      default: [],
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

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
export default Ticket;
