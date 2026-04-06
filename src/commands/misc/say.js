const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
} = require("discord.js");

module.exports = {
  name: "say",
  description: "Make the bot send a message in this channel.",
  options: [
    {
      name: "message",
      description: "The message you want the bot to send.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const message = interaction.options.getString("message");
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Send message as bot
      await channel.send(message);

      await interaction.editReply({
        content: "✅ Message sent successfully!",
      });
    } catch (err) {
      console.error("Message send error:", err);
      await interaction.editReply({
        content: "❌ Failed to send message. Check my permissions.",
      });
    }
  },
};
