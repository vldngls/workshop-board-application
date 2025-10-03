import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(express.json())
app.use(cors({ origin: '*', credentials: false }))
app.use(helmet())

// Simple RBAC stub middleware
type Role = 'administrator' | 'job-controller' | 'technician'
declare global {
  namespace Express {
    interface Request {
      userRole?: Role
    }
  }
}

function requireRole(allowed: Role[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = (req.headers['x-role'] as Role) || 'technician'
    req.userRole = role
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/admin-only', requireRole(['administrator']), (_req, res) => {
  res.json({ secret: 'admin data' })
})

const port = process.env.PORT ? Number(process.env.PORT) : 4000
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`)
})


