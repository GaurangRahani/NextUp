const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
const register = async (req, res) => {
  const { name, email, password, role, businessId } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Please provide name, email, and password');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new ApiError(409, 'User already exists with this email');
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    role: role || 'customer',
    businessId: businessId || null,
  });

  const token = generateToken({ id: user._id, role: user.role });

  sendResponse(
    res,
    201,
    {
      user,
      token,
    },
    'User registered successfully'
  );
};

/**
 * Log in an existing user
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Please provide email and password');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = generateToken({ id: user._id, role: user.role });

  sendResponse(
    res,
    200,
    {
      user,
      token,
    },
    'Login successful'
  );
};

/**
 * Get currently authenticated user profile
 * GET /api/v1/auth/me
 */
const getMe = async (req, res) => {
  sendResponse(res, 200, req.user, 'User profile fetched successfully');
};

module.exports = {
  register,
  login,
  getMe,
};
