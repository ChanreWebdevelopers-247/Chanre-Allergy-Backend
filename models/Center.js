import mongoose from 'mongoose';

const centerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  address: {
    type: String
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  phone: {
    type: String
  },
  code: {
    type: String,
    unique: true,
    required: true
  },
  centerAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Fee management fields
  fees: {
    registrationFee: {
      type: Number,
      default: 150
    },
    consultationFee: {
      type: Number,
      default: 850
    },
    serviceFee: {
      type: Number,
      default: 150
    }
  },
  // Discount settings - maps discount reasons to percentages
  discountSettings: {
    staff: {
      type: Number,
      default: 10
    },
    senior: {
      type: Number,
      default: 20
    },
    student: {
      type: Number,
      default: 15
    },
    employee: {
      type: Number,
      default: 10
    },
    insurance: {
      type: Number,
      default: 0
    },
    referral: {
      type: Number,
      default: 5
    },
    promotion: {
      type: Number,
      default: 10
    },
    charity: {
      type: Number,
      default: 100
    }
  },
  // Center contact information
  website: {
    type: String,
    default: 'www.chanreallergy.com'
  },
  labWebsite: {
    type: String,
    default: 'www.chanrelabresults.com'
  },
  fax: {
    type: String,
    default: '080-42516600'
  },
  missCallNumber: {
    type: String,
    default: '080-42516666'
  },
  mobileNumber: {
    type: String,
    default: '9686197153'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Center = mongoose.model('Center', centerSchema);
export default Center;