const SystemLog = require('../models/SystemLog')

async function write(level: 'info'|'warn'|'error'|'audit', message: string, meta: any = {}) {
  try {
    await SystemLog.create({ level, message, ...meta })
  } catch (err) {
    console.error('[LOGGER] Failed to write log:', err)
  }
}

module.exports = {
  info: (message: string, meta?: any) => write('info', message, meta),
  warn: (message: string, meta?: any) => write('warn', message, meta),
  error: (message: string, meta?: any) => write('error', message, meta),
  audit: (message: string, meta?: any) => write('audit', message, meta),
}


