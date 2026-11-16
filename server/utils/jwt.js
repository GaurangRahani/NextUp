const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'nextup_dev_jwt_secret_key_12345';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'nextup_dev_jwt_secret_key_12345';
  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  verifyToken,
};
