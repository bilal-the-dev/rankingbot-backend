const apiResponse = (success, message, data = null) => {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};
module.exports = { apiResponse };
