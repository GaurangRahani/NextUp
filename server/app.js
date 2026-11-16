require('express-async-errors');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const healthRoute = require('./routes/health.route');
const authRoute = require('./routes/auth.route');

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use('/api/v1/health', healthRoute);
app.use('/api/v1/auth', authRoute);

// 404
app.use(notFound);

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
