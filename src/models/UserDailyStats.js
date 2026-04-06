const mongoose = require("mongoose");

const userDailyStatsSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Store normalized date (midnight UTC)
    date: {
      type: Date,
      required: true,
    },

    messages: {
      type: Number,
      default: 0,
      min: 0,
    },

    voiceMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    xpGained: {
      type: Number,
      default: 0,
      min: 0,
    },

    coinsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// ✅ One record per user per day per guild
userDailyStatsSchema.index(
  { guildId: 1, userId: 1, date: 1 },
  { unique: true },
);

// ✅ Fast queries (last 30 days, charts, etc.)
userDailyStatsSchema.index({ guildId: 1, userId: 1, date: -1 });

module.exports = mongoose.model("UserDailyStats", userDailyStatsSchema);
