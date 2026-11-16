const mongoose = require('mongoose');
const {
  validateOperatingHours,
  DEFAULT_OPERATING_HOURS,
} = require('../utils/hoursValidator');

const operatingHourSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
    },
    open: {
      type: String,
      default: '09:00',
    },
    close: {
      type: String,
      default: '18:00',
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide business name'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      street: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      zip: { type: String, default: '', trim: true },
    },
    operatingHours: {
      type: [operatingHourSchema],
      default: DEFAULT_OPERATING_HOURS,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

businessSchema.pre('save', function () {
  if (this.isModified('operatingHours')) {
    validateOperatingHours(this.operatingHours);
  }
});

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;
