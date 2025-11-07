import mongoose from 'mongoose';

const { Schema } = mongoose;

export const SLIT_PRODUCT_CATALOG = {
  SLIT001: {
    code: 'SLIT001',
    name: 'SLIT Therapy - Product 001',
    price: 6000
  },
  SLIT002: {
    code: 'SLIT002',
    name: 'SLIT Therapy - Product 002',
    price: 10000
  },
  SLIT003: {
    code: 'SLIT003',
    name: 'SLIT Therapy - Product 003',
    price: 7000
  }
};

const statusHistorySchema = new Schema({
  status: {
    type: String,
    required: true
  },
  labStatus: String,
  billingStatus: String,
  remarks: String,
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedByName: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const slitTherapyRequestSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient'
  },
  patientName: {
    type: String,
    required: true
  },
  patientPhone: String,
  patientEmail: String,
  patientCode: String,

  centerId: {
    type: Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  centerName: String,
  centerDetails: {
    name: String,
    code: String,
    address: String,
    location: String,
    phone: String,
    email: String,
    website: String,
    fax: String,
    missCallNumber: String,
    mobileNumber: String
  },

  productCode: {
    type: String,
    enum: Object.keys(SLIT_PRODUCT_CATALOG),
    required: true
  },
  productName: String,
  productPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },

  courierRequired: {
    type: Boolean,
    default: false
  },
  courierFee: {
    type: Number,
    default: 0
  },
  deliveryMethod: {
    type: String,
    enum: ['pickup', 'courier'],
    default: 'pickup'
  },
  courierTrackingNumber: String,

  status: {
    type: String,
    enum: ['Billing_Generated', 'Billing_Paid', 'Lab_Received', 'Ready', 'Delivered', 'Closed', 'Cancelled'],
    default: 'Billing_Generated'
  },
  labStatus: {
    type: String,
    enum: ['pending', 'received', 'preparing', 'ready', 'delivered', 'closed'],
    default: 'pending'
  },

  billing: {
    status: {
      type: String,
      enum: ['generated', 'payment_pending', 'paid', 'partially_paid', 'refunded', 'cancelled'],
      default: 'generated'
    },
    amount: {
      type: Number,
      default: 0
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    items: [{
      name: String,
      code: String,
      quantity: {
        type: Number,
        default: 1
      },
      unitPrice: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    }],
    invoiceNumber: String,
    generatedAt: Date,
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    paidAt: Date,
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    paymentMethod: String,
    transactionId: String,
    paymentNotes: String,
    refundAmount: { type: Number, default: 0 },
    refundMethod: String,
    refundNotes: String,
    refundedAt: Date,
    cancellationReason: String,
    cancelledAt: Date
  },

  notes: String,
  labNotes: String,

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdByName: String,
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedByName: String,

  statusHistory: [statusHistorySchema]
}, {
  timestamps: true
});

slitTherapyRequestSchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

const SlitTherapyRequest = mongoose.model('SlitTherapyRequest', slitTherapyRequestSchema);

export default SlitTherapyRequest;

