const health = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Discord Bot Backend is running perfectly!",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

module.exports = health;
