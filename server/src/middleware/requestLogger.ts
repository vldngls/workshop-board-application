const logger = require('../utils/logger.ts')

function requestLogger(req: any, res: any, next: any) {
  const start = Date.now()
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress
  res.on('finish', async () => {
    const durationMs = Date.now() - start
    const meta = {
      userId: req.user?.sub,
      userEmail: undefined,
      userRole: req.user?.role,
      ip,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    }
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info']('HTTP Request', meta)
  })
  next()
}

module.exports = { requestLogger }


