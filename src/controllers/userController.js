const { apiResponse } = require("../utils/response");
const { getClient } = require("../services/botServices");

const getMe = async (req, res) => {
  try {
    // Get userId from query (frontend sends it from localStorage)
    let userId = req.query.userId;

    // Optional fallback if you later add JWT auth
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }

    if (!userId) {
      return res.status(400).json(apiResponse(false, "User ID is required"));
    }

    const client = getClient(); // This should return your discord.js client instance

    if (!client) {
      return res
        .status(500)
        .json(apiResponse(false, "Discord client is not ready"));
    }

    let discordUser;
    try {
      // Force fetch to get fresh data including banner, accent color, etc.
      discordUser = await client.users.fetch(userId, { force: true });
    } catch (fetchError) {
      console.error(`Failed to fetch user ${userId}:`, fetchError.message);
      return res
        .status(404)
        .json(apiResponse(false, "User not found on Discord"));
    }

    // Build avatar URL safely
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(userId) % 5n).toString()}.png`;

    // Build banner URL if exists
    const bannerUrl = discordUser.banner
      ? `https://cdn.discordapp.com/banners/${userId}/${discordUser.banner}.png?size=512`
      : null;

    // Convert accentColor (number) to hex
    const bannerColor = discordUser.hexAccentColor || "#1a1c24";

    const userProfile = {
      id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.globalName || discordUser.username,
      avatar: discordUser.avatar,
      banner: discordUser.banner,
      banner_color: bannerColor,
      accent_color: discordUser.accentColor,
      discriminator: discordUser.discriminator || "0000",
      verified: true, // Most users are verified now
      mfa_enabled: false, // Not available via bot
      premium_type: discordUser.premiumType ?? 0, // 0 = none, 1 = Nitro Classic, 2 = Nitro
      locale: discordUser.locale || "en-US",
      flags: discordUser.flags?.bitfield || 0,

      // Computed URLs for easy frontend use
      avatarUrl: avatarUrl,
      bannerUrl: bannerUrl,

      // You can add more fields if needed
      createdAt: discordUser.createdAt
        ? discordUser.createdAt.toISOString()
        : null,
    };

    return res
      .status(200)
      .json(
        apiResponse(true, "User profile fetched successfully", userProfile),
      );
  } catch (error) {
    console.error("Get Me API Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal server error while fetching profile"));
  }
};

module.exports = { getMe };
