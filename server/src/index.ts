import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToMongo } from './config/mongo.js';
import authRouter from './controllers/auth.js';
import usersRouter from './controllers/users.js';
import jobOrdersRouter from './controllers/jobOrders.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  })
);

// JWT authentication for protected routes
import { verifyToken } from './middleware/auth.js';

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

// Admin-only endpoint using JWT middleware
import { requireRole } from './middleware/auth.js';

app.get('/admin-only', requireRole(['administrator']), (_req, res) => {
  res.json({ secret: 'admin data' });
});

// Start server
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
connectToMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
