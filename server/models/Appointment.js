const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique safeguard for double-booking excluding cancelled (Decision D3)
appointmentSchema.index(
  { staffId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' } } }
);

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
