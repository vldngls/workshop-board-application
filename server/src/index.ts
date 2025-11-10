const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { connectToMongo } = require('./config/mongo');
const os = require('os');
const authRouter = require('./controllers/auth');
const usersRouter = require('./controllers/users');
const jobOrdersRouter = require('./controllers/jobOrders');
const appointmentsRouter = require('./controllers/appointments');
const bugReportsRouter = require('./routes/bugReports');
const bugReportsIdRouter = require('./routes/bugReportsId');
const maintenanceStatsRouter = require('./routes/maintenanceStats');
const maintenanceSettingsRouter = require('./routes/maintenanceSettings');
const systemLogsRouter = require('./routes/systemLogs');


// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
app.use(express.json({ limit: '10mb' })); // Increase payload limit for image uploads
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

// Ensure MongoDB connection is ready (production/serverless)
// Only check connection state, don't reconnect on every request
if (!isDevelopment) {
  app.use(async (_req, _res, next) => {
    try {
      // Only connect if not already connected (connection reuse)
      if (mongoose.connection.readyState !== 1) {
        await connectToMongo();
      }
      next();
    } catch (err) {
      console.error('Failed to connect to MongoDB (production):', err);
      next(err);
    }
  });
}

// JWT authentication for protected routes
const { verifyToken } = require('./middleware/auth');
const { requestLogger } = require('./middleware/requestLogger');
const { apiKeyValidatorMiddleware } = require('./middleware/apiKeyValidator');

// API Key validation middleware (runs before JWT auth)
// This ensures API key is valid before allowing any protected routes
app.use(apiKeyValidatorMiddleware);

app.use((req, res, next) => {
  // Public routes that don't need authentication
  if (
    req.path === '/' ||
    req.path === '/health' ||
    req.path.startsWith('/auth') ||
    req.path === '/maintenance/settings/public'
  ) {
    // Still log public requests
    return requestLogger(req, res, next);
  }

  // Attach logger and require JWT authentication for all other routes
  requestLogger(req, res, () => {
    return verifyToken(req, res, next);
  });
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
app.use('/bug-reports', bugReportsRouter); // protected by JWT
app.use('/bug-reports', bugReportsIdRouter); // protected by JWT
app.use('/maintenance/stats', maintenanceStatsRouter); // protected by JWT
app.use('/maintenance/settings', maintenanceSettingsRouter); // protected by JWT
app.use('/system-logs', systemLogsRouter); // protected by JWT (superadmin)

// Admin-only endpoint using JWT middleware
const { requireRole } = require('./middleware/auth');

app.get('/admin-only', requireRole(['administrator']), (_req, res) => {
  res.json({ secret: 'admin data' });
});

// Utility to determine local network IP (for logging)
const getLocalAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const details of iface) {
      if (!details) continue;
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return '127.0.0.1';
};

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
        const networkAddress = host === '0.0.0.0' ? getLocalAddress() : host;
        console.log(`API listening on http://${host}:${port}`);
        console.log(`Local access: http://localhost:${port}`);
        console.log(`Network access: http://${networkAddress}:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}
