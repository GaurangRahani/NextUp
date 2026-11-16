const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide service name'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [100, 'Service name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    duration: {
      type: Number,
      required: [true, 'Please provide service duration in minutes'],
      min: [1, 'Service duration must be greater than zero'],
      validate: {
        validator: Number.isInteger,
        message: 'Duration must be an integer number of minutes',
      },
    },
    price: {
      type: Number,
      required: [true, 'Please provide service price'],
      min: [0, 'Service price cannot be negative'],
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Service must belong to a business'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
