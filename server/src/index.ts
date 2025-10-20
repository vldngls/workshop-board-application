const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectToMongo } = require('./config/mongo.js');
const authRouter = require('./controllers/auth.js');
const usersRouter = require('./controllers/users.js');
const jobOrdersRouter = require('./controllers/jobOrders.js');
const appointmentsRouter = require('./controllers/appointments.js');

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
app.use(express.json());
// Configure CORS based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigins: any[] = [];

if (isDevelopment) {
  // Development: Allow local network access
  allowedOrigins.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Add common local network IP ranges
    /^http:\/\/192\.168\.\d+\.\d+:3000$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:3000$/
  );
} else {
  // Production: Only allow specific origins
  allowedOrigins.push(process.env.WEB_ORIGIN || 'https://workshop-board-frontend.vercel.app');
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  })
);

// Ensure MongoDB connection on Vercel (production/serverless)
if (!isDevelopment) {
  app.use(async (_req, _res, next) => {
    try {
      await connectToMongo();
      next();
    } catch (err) {
      console.error('Failed to connect to MongoDB (production):', err);
      next(err);
    }
  });
}

// JWT authentication for protected routes
const { verifyToken } = require('./middleware/auth.js');

app.use((req, res, next) => {
  // Public routes that don't need authentication
  if (
    req.path === '/' ||
    req.path === '/health' ||
    req.path.startsWith('/auth')
  ) {
    return next();
  }

  // All other routes require JWT authentication
  return verifyToken(req, res, next);
});

// JWT middleware handles authentication and user context

// Public endpoints
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'workshop-board-api' });
});

// Routes
app.use('/auth', authRouter); // login/register without JWT
app.use('/users', usersRouter); // protected by JWT
app.use('/job-orders', jobOrdersRouter); // protected by JWT
app.use('/appointments', appointmentsRouter); // protected by JWT

// Admin-only endpoint using JWT middleware
const { requireRole } = require('./middleware/auth.js');

app.get('/admin-only', requireRole(['administrator']), (_req, res) => {
  res.json({ secret: 'admin data' });
});

// Start server
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const host = isDevelopment ? (process.env.HOST || '0.0.0.0') : 'localhost'; // Network access only in development

// For Vercel deployment
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  connectToMongo()
    .then(() => {
      app.listen(port, host, () => {
        console.log(`API listening on http://${host}:${port}`);
        console.log(`Local access: http://localhost:${port}`);
        console.log(`Network access: http://[YOUR_IP]:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}
