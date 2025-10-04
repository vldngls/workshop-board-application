import mongoose from 'mongoose'

export async function connectToMongo(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set')
  }
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(mongoUri)
}


