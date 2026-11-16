const mongoose = require('mongoose');

const queueTokenSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guestName: {
      type: String,
      required: [true, 'Guest or customer name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    guestPhone: {
      type: String,
      trim: true,
      default: '',
    },
    tokenNumber: {
      type: Number,
      required: [true, 'Token number is required'],
      min: 1,
    },
    queueDate: {
      type: String,
      required: [true, 'Queue date (YYYY-MM-DD) is required'],
    },
    status: {
      type: String,
      enum: ['waiting', 'called', 'in-service', 'completed', 'cancelled', 'no-show'],
      default: 'waiting',
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    calledAt: {
      type: Date,
      default: null,
    },
    servedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Rule R4 & Decision D4: Sequential unique token per business per calendar day
queueTokenSchema.index(
  { businessId: 1, queueDate: 1, tokenNumber: 1 },
  { unique: true }
);

// Fast lookup index for active queue board
queueTokenSchema.index({ businessId: 1, queueDate: 1, status: 1 });

module.exports = mongoose.model('QueueToken', queueTokenSchema);
