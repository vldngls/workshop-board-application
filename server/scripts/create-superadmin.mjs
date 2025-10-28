import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician', 'service-advisor', 'superadmin'] },
  pictureUrl: String,
  level: { 
    type: String, 
    enum: ['untrained', 'level-0', 'level-1', 'level-2', 'level-3'],
    required: function() { return this.role === 'technician' }
  },
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)

async function createSuperAdmin() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  await User.createIndexes()

  // Check if superadmin already exists
  const existingSuperAdmin = await User.findOne({ username: 'vldngls' })
  if (existingSuperAdmin) {
    console.log('Superadmin user already exists. Updating password...')
    const passwordHash = await bcrypt.hash('Vldngls04182002!@', 10)
    existingSuperAdmin.passwordHash = passwordHash
    existingSuperAdmin.role = 'superadmin'
    await existingSuperAdmin.save()
    console.log('Superadmin password updated successfully!')
  } else {
    // Create superadmin user
    const passwordHash = await bcrypt.hash('Vldngls04182002!@', 10)
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'vldngls@workshop.com',
      username: 'vldngls',
      passwordHash,
      role: 'superadmin',
    })
    console.log('Created Super Admin: username: vldngls / password: Vldngls04182002!@')
  }

  await mongoose.disconnect()
}

createSuperAdmin().catch((err) => {
  console.error(err)
  process.exit(1)
})
