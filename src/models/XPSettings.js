const mongoose = require("mongoose");

const xpSettingsSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    xpPerMessage: { type: Number, default: 15, min: 1 },
    xpPerVoiceMinute: { type: Number, default: 10, min: 1 },
    messageCooldownSeconds: { type: Number, default: 60, min: 5 },
    blacklistedRoleIds: [{ type: String }],
    channelOverrides: [
      {
        channelId: { type: String, required: true },
        enabled: { type: Boolean, default: true },
      },
    ],
    levelingEnabled: { type: Boolean, default: true },
    rankCardChannelId: { type: String, default: null }, // Channel where rank cards will be sent
    rankCardTheme: {
      type: String,
      default: "default",
      enum: [
        "default",
        "dark",
        "light",
        "neon",
        "minimal",
        "cyberpunk",
        "ocean",
        "sunset",
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("XPSettings", xpSettingsSchema);
