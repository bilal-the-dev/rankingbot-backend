const mongoose = require("mongoose");

// ==================== 5. Quest System Schema ====================
const questSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },

    // Basic Quest Info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Quest Configuration
    type: {
      type: String,
      required: true,
      enum: [
        "message_count",
        "voice_time",
        "invites",
        "reactions",
        "image_posts",
        "gif_posts",
        // Add more later: 'event_join', etc.
      ],
    },
    targetAmount: {
      type: Number,
      required: true,
      min: [1, "Target amount must be at least 1"],
    },

    // Rewards
    xpReward: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    coinReward: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Timing & Posting
    endDate: {
      type: Date,
      required: true,
    },
    questBoardChannelId: {
      type: String,
      required: true,
    },
    questMessageId: {
      // ← NEW FIELD
      type: String,
      default: null,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isCompletedForAll: {
      type: Boolean,
      default: false,
    },

    // Participants Tracking
    participants: {
      type: [
        {
          userId: { type: String, required: true },
          acceptedAt: { type: Date, default: Date.now },
          currentProgress: { type: Number, default: 0 },
          completed: { type: Boolean, default: false },
          completedAt: { type: Date },
        },
      ],
      default: [],
    },

    // Metadata
    createdBy: { type: String, required: true }, // Staff userId who created it
  },
  { timestamps: true },
);

// Indexes for fast queries
questSchema.index({ guildId: 1, isActive: 1 });
questSchema.index({ guildId: 1, "participants.userId": 1 });

module.exports = mongoose.model("Quest", questSchema);
