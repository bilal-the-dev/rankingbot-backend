const mongoose = require("mongoose");
const { startXPDailyDecay } = require("../../utils/levelingHelpers");
module.exports = (client) => {
  console.log(`${client.user.tag} is online.`);
  connectDB();
  startXPDailyDecay(client);
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1); // Stop app if connection fails
  }
};
