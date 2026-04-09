const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // invite code is unique per guild
    uses: { type: Number, default: 0 },
    inviterId: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Invite", inviteSchema);
