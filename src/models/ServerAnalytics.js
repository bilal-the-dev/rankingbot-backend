// models/ServerAnalytics.js
const mongoose = require("mongoose");

const serverAnalyticsSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },

    date: {
      type: String, // Format: "YYYY-MM-DD"
      required: true,
      index: true,
    },

    totalMessages: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalXPGained: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalVoiceMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCoinsDistributed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ServerAnalytics", serverAnalyticsSchema);
