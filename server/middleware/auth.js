const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Authentication token required'));
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError(401, 'User no longer exists'));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired'));
    }
    return next(new ApiError(401, 'Invalid authentication token'));
  }
};

module.exports = authenticate;
