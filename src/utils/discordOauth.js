const { promisify } = require("util");

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { OAuth } = require("discord-oauth2-utils");
const { getClient } = require("../services/botServices");
const config = require("../config/config");
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;

let discordOauth2UserCache = new Map();

const client = new OAuth({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
  scopes: ["identify", "guilds"],
});
console.log(client);

exports.getAccessTokenFromCode = async (code) => {
  console.log(code);

  const res = await client.requestToken(code);

  console.log(res);

  if (res.error === "invalid_grant") {
    throw new Error("The authorization code is not valid");
  }

  if (!res.access_token) {
    throw new Error("Something went wrong while getting access token");
  }

  return res;
};

exports.getDiscordUserFromToken = async (accessToken) => {
  const user_raw = await client.fetchUser(accessToken);
  console.log(user_raw);

  if (user_raw.code === 401) {
    throw new Error("Could not get user profile (unauthorized)");
  }

  return user_raw;
};

exports.isLoggedIn = async (req) => {
  if (!req.cookies.JWT) {
    throw new Error("You are not logged in! Please log in to get access.");
  }

  const decoded = await promisify(jwt.verify)(
    req.cookies.JWT,
    process.env.JWT_SECRET,
  );

  const currentUser = await User.findOne({ userId: decoded.userId });

  if (!currentUser) {
    throw new Error("The user belonging to this token no longer exists.");
  }

  let oauthCache = discordOauth2UserCache.get(currentUser.userId);

  if (!oauthCache) {
    console.log("Getting Oauth user from API");

    oauthCache = await exports.getDiscordUserFromToken(currentUser.accessToken);

    discordOauth2UserCache.set(currentUser.userId, {
      ...oauthCache,
    });
  }

  const guild = getClient().guilds.cache.get(config.guildId);
  const member = await guild.members.cache.get(currentUser.userId);

  if (
    !member ||
    !member.roles.cache.some((r) =>
      process.env.ACCESS_ROLE_IDS.split(",").includes(r.id),
    )
  )
    throw new Error("You dont have the required role to access the dashboard");

  req.dbUser = currentUser;
  req.discordUser = oauthCache;
};

// Clear caches
setInterval(
  () => {
    discordOauth2UserCache = new Map();
  },
  1000 * 60 * 15,
);
