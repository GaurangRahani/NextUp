const mongoose = require('mongoose');

const dailyCounterSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
    },
    date: {
      type: String,
      required: [true, 'Date string (YYYY-MM-DD) is required'],
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Rule R4 & Decision D4: Unique counter per business per calendar day
dailyCounterSchema.index({ businessId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyCounter', dailyCounterSchema);
