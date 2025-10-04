import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician'] },
  pictureUrl: String,
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  await User.createIndexes()

  const existing = await User.findOne({ email: 'admin@example.com' })
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123', 10)
    await User.create({
      name: 'Administrator',
      email: 'admin@example.com',
      passwordHash,
      role: 'administrator',
    })
    // eslint-disable-next-line no-console
    console.log('Seeded default administrator: admin@example.com / admin123')
  } else {
    // eslint-disable-next-line no-console
    console.log('Admin user already exists, skipping.')
  }

  const jc = await User.findOne({ email: 'jc@example.com' })
  if (!jc) {
    const passwordHash = await bcrypt.hash('jc12345', 10)
    await User.create({
      name: 'Job Controller',
      email: 'jc@example.com',
      passwordHash,
      role: 'job-controller',
    })
    console.log('Seeded job-controller: jc@example.com / jc12345')
  }

  const tech = await User.findOne({ email: 'tech@example.com' })
  if (!tech) {
    const passwordHash = await bcrypt.hash('tech1234', 10)
    await User.create({
      name: 'Technician',
      email: 'tech@example.com',
      passwordHash,
      role: 'technician',
    })
    console.log('Seeded technician: tech@example.com / tech1234')
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


