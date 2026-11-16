const sendResponse = (res, statusCode, data, message = 'Success') => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

module.exports = sendResponse;
