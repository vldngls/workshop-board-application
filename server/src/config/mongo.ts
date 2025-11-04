const mongoose = require('mongoose')

let isConnecting = false
let connectionPromise: Promise<void> | null = null

async function connectToMongo(): Promise<void> {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve()
  }

  // If connection is in progress, wait for it
  if (isConnecting && connectionPromise) {
    return connectionPromise
  }

  // Start new connection
  isConnecting = true
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    isConnecting = false
    throw new Error('MONGODB_URI is not set')
  }

  connectionPromise = mongoose.connect(mongoUri)
    .then(() => {
      isConnecting = false
      console.log('✅ MongoDB connected successfully')
    })
    .catch((err) => {
      isConnecting = false
      connectionPromise = null
      console.error('❌ MongoDB connection error:', err)
      throw err
    })

  return connectionPromise
}

// Initialize connection at module load for better connection reuse
if (process.env.MONGODB_URI && process.env.NODE_ENV !== 'production') {
  // Auto-connect in development
  connectToMongo().catch(() => {
    // Silent fail - will connect when needed
  })
}

module.exports = { connectToMongo }


