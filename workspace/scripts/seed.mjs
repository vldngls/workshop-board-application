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
  breakTimes: [{
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    description: { type: String, default: 'Break' }
  }]
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  await User.createIndexes()

  // Clear ALL existing data
  await User.deleteMany({})
  console.log('Cleared all existing users')

  const passwordHash = await bcrypt.hash('test123456', 10)
  const superAdminPasswordHash = await bcrypt.hash('Vldngls04182002!@', 10)
  
  // Super Admin (vldngls)
  const superAdmin = await User.create({
    name: 'Super Admin',
    email: 'vldngls@workshop.com',
    username: 'vldngls',
    passwordHash: superAdminPasswordHash,
    role: 'superadmin',
  })
  console.log('✅ Created Super Admin: username: vldngls / password: Vldngls04182002!@')
  
  // Admin
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@workshop.com',
    username: 'admin',
    passwordHash,
    role: 'administrator',
  })
  console.log('✅ Created Admin: username: admin / password: test123456')

  // Job Controller
  const jobController = await User.create({
    name: 'Job Controller',
    email: 'jobcontroller@workshop.com',
    username: 'jobcontroller',
    passwordHash,
    role: 'job-controller',
  })
  console.log('✅ Created Job Controller: username: jobcontroller / password: test123456')

  // Technician 1
  const technician = await User.create({
    name: 'Technician 1',
    email: 'tech1@workshop.com',
    username: 'technician1',
    passwordHash,
    role: 'technician',
    level: 'level-3',
    breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }]
  })
  console.log('✅ Created Technician 1: username: technician1 / password: test123456')

  // Service Advisor 1
  const serviceAdvisor = await User.create({
    name: 'Service Advisor 1',
    email: 'sa1@workshop.com',
    username: 'serviceadvisor1',
    passwordHash,
    role: 'service-advisor',
  })
  console.log('✅ Created Service Advisor 1: username: serviceadvisor1 / password: test123456')

  console.log('\n✅ Basic seed data completed successfully!')
  console.log('📊 Summary:')
  console.log('   - Total users: 5 (1 superadmin, 1 admin, 1 job-controller, 1 technician, 1 service-advisor)')

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
