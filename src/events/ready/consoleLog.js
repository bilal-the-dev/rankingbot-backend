const mongoose = require("mongoose");
const { startXPDailyDecay } = require("../../utils/levelingHelpers");
const Quest = require("../../models/Quest");
module.exports = (client) => {
  console.log(`${client.user.tag} is online.`);
  connectDB();
  startXPDailyDecay(client);

  cron.schedule("*/5 * * * *", async () => {
    console.log("🔄 Running quest expiration check...");

    try {
      const now = new Date();

      // Find all active quests that have passed their endDate
      const expiredQuests = await Quest.find({
        isActive: true,
        endDate: { $lt: now },
      });

      for (const quest of expiredQuests) {
        quest.isActive = false;
        await quest.save();

        console.log(`⏰ Quest ended: ${quest.name} (${quest._id})`);

        // Notify all participants who joined
        for (const participant of quest.participants) {
          try {
            const user = await clientInstance.users.fetch(participant.userId);

            const endedEmbed = new EmbedBuilder()
              .setTitle("⏰ Quest Has Ended")
              .setDescription(
                `The quest **${quest.name}** has reached its deadline.`,
              )
              .addFields(
                {
                  name: "Your Progress",
                  value: `${participant.currentProgress} / ${quest.targetAmount}`,
                  inline: true,
                },
                {
                  name: "Completed?",
                  value: participant.completed ? "✅ Yes" : "❌ No",
                  inline: true,
                },
              )
              .setColor(participant.completed ? 0x00ff00 : 0xffaa00)
              .setTimestamp();

            await user.send({ embeds: [endedEmbed] });
          } catch (dmError) {
            // User has DMs disabled or left server – ignore
          }
        }
      }
    } catch (error) {
      console.error("Quest Expiration Cron Error:", error);
    }
  });
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
