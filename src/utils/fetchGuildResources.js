const { getClient } = require("../services/botServices"); // Adjust path according to your structure

/**
 * Fetches guild resources (channels, roles, users) with query param support
 * This function is reusable across multiple API endpoints.
 *
 * @param {Object} req - Express request object (to read query params)
 * @returns {Promise<Object>} { channels, roles, users }
 */
const fetchGuildResources = async (req = null) => {
  const client = getClient();
  if (!client) {
    throw new Error("Discord client is not initialized");
  }

  const guildId = require("../config/config").guildId; // or process.env.GUILD_ID
  if (!guildId) {
    throw new Error("GUILD_ID is not configured");
  }

  const guild = await client.guilds.fetch(guildId);
  if (!guild) {
    throw new Error(`Guild with ID ${guildId} not found`);
  }

  const result = {};

  // --- Channels (only text channels) ---
  const includeChannels =
    !req || req.query.channels === "true" || req.query.channels === "1";
  if (includeChannels) {
    // Ensure cache is up-to-date
    await guild.channels.fetch();

    result.channels = guild.channels.cache
      .filter(
        (channel) =>
          channel.type === 0 || // GUILD_TEXT
          channel.type === 5, // GUILD_NEWS (announcement)
      )
      .map((channel) => ({
        id: channel.id,
        name: `#${channel.name}`,
        type: channel.type,
        position: channel.position || 0,
      }))
      .sort((a, b) => a.position - b.position);
  }

  // --- Roles ---
  const includeRoles =
    !req || req.query.roles === "true" || req.query.roles === "1";
  if (includeRoles) {
    await guild.roles.fetch();

    result.roles = guild.roles.cache
      .filter((role) => !role.managed && role.name !== "@everyone") // optional: filter bot roles / @everyone
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
      }))
      .sort((a, b) => b.position - a.position); // higher roles first
  }

  // --- Users / Members ---
  const includeUsers =
    !req || req.query.users === "true" || req.query.users === "1";
  if (includeUsers) {
    // Fetch all members (this can be heavy on large servers)
    await guild.members.fetch({ withPresences: false });

    result.users = guild.members.cache
      .filter((member) => !member.user.bot) // optional: exclude bots
      .map((member) => ({
        id: member.id,
        username: member.user.username,
        globalName: member.user.globalName || member.user.username,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL({ size: 128 }),
        tag: `${member.user.username}#${member.user.discriminator}`, // legacy if needed
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return result;
};

module.exports = { fetchGuildResources };
