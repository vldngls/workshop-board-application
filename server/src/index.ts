import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToMongo } from './config/mongo.js';
import authRouter from './controllers/auth.js';
import usersRouter from './controllers/users.js';

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

// Require an API key for all non-public routes
const apiKey = process.env.API_KEY;
app.use((req, res, next) => {
  // Public routes
  if (
    req.path === '/' ||
    req.path === '/health' ||
    req.path.startsWith('/auth')
  ) {
    return next();
  }

  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });

  const key =
    (req.headers['x-api-key'] as string) ||
    (req.headers['authorization']?.toString().replace('Bearer ', '') ?? '');

  if (key !== apiKey) return res.status(401).json({ error: 'Unauthorized' });

  next();
});

// Simple RBAC stub middleware
type Role = 'administrator' | 'job-controller' | 'technician';
declare global {
  namespace Express {
    interface Request {
      userRole?: Role;
    }
  }
}

function requireRole(allowed: Role[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = (req.headers['x-role'] as Role) || 'technician';
    req.userRole = role;
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Public endpoints
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'workshop-board-api' });
});

// Routes
app.use('/auth', authRouter); // login/register without API key
app.use('/users', usersRouter); // protected by API key

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
