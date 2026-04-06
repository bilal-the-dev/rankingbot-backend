// utils/rankCard.js
const { createCanvas, loadImage, registerFont } = require("@napi-rs/canvas");
const { AttachmentBuilder } = require("discord.js");

// Register font
try {
  registerFont("./fonts/Inter-Bold.ttf", { family: "Inter" });
} catch (e) {
  console.log("Font not found, using default");
}

async function generateRankCard(member, userData, theme = "default") {
  const canvas = createCanvas(934, 282);
  const ctx = canvas.getContext("2d");

  // ==================== THEME CONFIG ====================
  let bgColor,
    overlayStart,
    overlayEnd,
    accentColor,
    levelColor,
    textColor,
    secondaryTextColor,
    barBgColor,
    glowColor;

  switch (theme) {
    case "dark":
      bgColor = "#0a0a0a";
      overlayStart = "rgba(100, 100, 255, 0.06)";
      overlayEnd = "rgba(255, 100, 150, 0.04)";
      accentColor = "#6366f1"; // Indigo
      levelColor = "#a5b4fc";
      textColor = "#e2e8f0";
      secondaryTextColor = "#94a3b8";
      barBgColor = "#1f2937";
      glowColor = "#818cf8";
      break;

    case "light":
      bgColor = "#f8fafc";
      overlayStart = "rgba(59, 130, 246, 0.12)";
      overlayEnd = "rgba(16, 185, 129, 0.08)";
      accentColor = "#3b82f6"; // Blue
      levelColor = "#1e40af";
      textColor = "#1e2937";
      secondaryTextColor = "#475569";
      barBgColor = "#e2e8f0";
      glowColor = "#60a5fa";
      break;

    case "neon":
      bgColor = "#0a0a1f";
      overlayStart = "rgba(0, 255, 200, 0.12)";
      overlayEnd = "rgba(255, 0, 255, 0.08)";
      accentColor = "#00ffff";
      levelColor = "#39ff14";
      textColor = "#ffffff";
      secondaryTextColor = "#a0f0ff";
      barBgColor = "#1a1a2e";
      glowColor = "#ff00ff";
      break;

    case "minimal":
      bgColor = "#111827";
      overlayStart = "rgba(255,255,255,0.03)";
      overlayEnd = "rgba(255,255,255,0.01)";
      accentColor = "#64748b";
      levelColor = "#cbd5e1";
      textColor = "#f1f5f9";
      secondaryTextColor = "#94a3b8";
      barBgColor = "#1e2937";
      glowColor = "#64748b";
      break;

    case "cyberpunk":
      bgColor = "#0c001a";
      overlayStart = "rgba(255, 20, 147, 0.15)";
      overlayEnd = "rgba(0, 255, 255, 0.10)";
      accentColor = "#ff00aa";
      levelColor = "#00ffff";
      textColor = "#ffffff";
      secondaryTextColor = "#ff99cc";
      barBgColor = "#1a0033";
      glowColor = "#ff00ff";
      break;

    case "ocean":
      bgColor = "#0f172a";
      overlayStart = "rgba(56, 189, 248, 0.12)";
      overlayEnd = "rgba(16, 185, 129, 0.08)";
      accentColor = "#22d3ee";
      levelColor = "#67e8f9";
      textColor = "#e0f2fe";
      secondaryTextColor = "#bae6fd";
      barBgColor = "#1e2937";
      glowColor = "#06b6d4";
      break;

    case "sunset":
      bgColor = "#1a0f0f";
      overlayStart = "rgba(249, 115, 22, 0.15)";
      overlayEnd = "rgba(236, 72, 153, 0.10)";
      accentColor = "#f97316";
      levelColor = "#fb923c";
      textColor = "#fed7aa";
      secondaryTextColor = "#fda4af";
      barBgColor = "#2c1f1f";
      glowColor = "#fb7185";
      break;

    case "default": // fallback / original style
    default:
      bgColor = "#0f0f1a";
      overlayStart = "rgba(0, 255, 150, 0.08)";
      overlayEnd = "rgba(0, 100, 255, 0.06)";
      accentColor = "#00ffaa";
      levelColor = "#00ffaa";
      textColor = "#ffffff";
      secondaryTextColor = "#94a3b8";
      barBgColor = "#1f2937";
      glowColor = "#00ff88";
      break;
  }

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 934, 282);

  // Subtle gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 934, 282);
  grad.addColorStop(0, overlayStart);
  grad.addColorStop(1, overlayEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 934, 282);

  // Avatar
  const avatarURL = member.displayAvatarURL({ extension: "png", size: 512 });
  const avatar = await loadImage(avatarURL);

  // Avatar frame with theme-specific glow
  ctx.save();
  ctx.beginPath();
  ctx.arc(140, 141, 78, 0, Math.PI * 2);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = theme === "neon" || theme === "cyberpunk" ? 35 : 25;
  ctx.fillStyle = theme === "light" ? "#e2e8f0" : "#111827";
  ctx.fill();
  ctx.restore();

  // Draw avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(140, 141, 70, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatar, 70, 71, 140, 140);
  ctx.restore();

  // Username
  ctx.fillStyle = textColor;
  ctx.font = 'bold 42px "Inter", sans-serif';
  ctx.fillText(member.displayName || member.user.username, 280, 110);

  // Level
  ctx.fillStyle = levelColor;
  ctx.font = 'bold 28px "Inter", sans-serif';
  ctx.fillText(`LEVEL ${userData.level}`, 280, 150);

  // XP Progress Bar Background
  ctx.fillStyle = barBgColor;
  ctx.beginPath();
  ctx.roundRect(280, 180, 580, 28, 14);
  ctx.fill();

  // Calculate progress (your existing logic - kept as-is)
  const currentLevelXP = userData.xp || 0;
  const nextLevelXP = Math.floor(0.1 * Math.sqrt(currentLevelXP)) + 1;
  const xpNeededForNext =
    Math.pow(nextLevelXP / 0.1, 2) - currentLevelXP || 100;
  const progress = Math.min(
    1,
    currentLevelXP / (currentLevelXP + xpNeededForNext),
  );

  // Progress Bar Fill - theme-aware gradient
  const barGrad = ctx.createLinearGradient(280, 180, 280 + 580 * progress, 180);
  barGrad.addColorStop(0, levelColor);
  barGrad.addColorStop(1, accentColor);
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  ctx.roundRect(280, 180, 580 * progress, 28, 14);
  ctx.fill();

  // XP Text
  ctx.fillStyle = secondaryTextColor;
  ctx.font = 'bold 22px "Inter", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(
    `${currentLevelXP.toLocaleString()} / ${(currentLevelXP + xpNeededForNext).toLocaleString()} XP`,
    840,
    205,
  );

  // Rank Position
  ctx.textAlign = "left";
  ctx.fillStyle = secondaryTextColor;
  ctx.font = '22px "Inter", sans-serif';
  ctx.fillText(`RANK #•••`, 280, 245);

  // Top accent line
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 934, 6);

  return canvas.toBuffer("image/png");
}

module.exports = { generateRankCard };
