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
  
  // Admins (2)
  const admin1 = await User.create({
    name: 'Admin 1',
    email: 'admin1@workshop.com',
    username: 'admin1',
    passwordHash,
    role: 'administrator',
  })
  console.log('✅ Created Admin 1: username: admin1 / password: test123456')

  const admin2 = await User.create({
    name: 'Admin 2',
    email: 'admin2@workshop.com',
    username: 'admin2',
    passwordHash,
    role: 'administrator',
  })
  console.log('✅ Created Admin 2: username: admin2 / password: test123456')

  // Job Controller
  const jobController = await User.create({
    name: 'Job Controller',
    email: 'jobcontroller@workshop.com',
    username: 'jobcontroller',
    passwordHash,
    role: 'job-controller',
  })
  console.log('✅ Created Job Controller: username: jobcontroller / password: test123456')

  // Technicians (5) with break times
  const technicianData = [
    { name: 'Technician 1', email: 'tech1@workshop.com', username: 'technician1', level: 'level-3' },
    { name: 'Technician 2', email: 'tech2@workshop.com', username: 'technician2', level: 'level-2' },
    { name: 'Technician 3', email: 'tech3@workshop.com', username: 'technician3', level: 'level-1' },
    { name: 'Technician 4', email: 'tech4@workshop.com', username: 'technician4', level: 'level-0' },
    { name: 'Technician 5', email: 'tech5@workshop.com', username: 'technician5', level: 'untrained' }
  ]

  const technicians = []
  for (const techData of technicianData) {
    const tech = await User.create({
      name: techData.name,
      email: techData.email,
      username: techData.username,
      passwordHash,
      role: 'technician',
      level: techData.level,
      breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }]
    })
    technicians.push(tech)
    console.log(`✅ Created ${techData.name}: username: ${techData.username} / password: test123456`)
  }

  // Service Advisors (5)
  const serviceAdvisorData = [
    { name: 'Service Advisor 1', email: 'sa1@workshop.com', username: 'serviceadvisor1' },
    { name: 'Service Advisor 2', email: 'sa2@workshop.com', username: 'serviceadvisor2' },
    { name: 'Service Advisor 3', email: 'sa3@workshop.com', username: 'serviceadvisor3' },
    { name: 'Service Advisor 4', email: 'sa4@workshop.com', username: 'serviceadvisor4' },
    { name: 'Service Advisor 5', email: 'sa5@workshop.com', username: 'serviceadvisor5' }
  ]

  const serviceAdvisors = []
  for (const saData of serviceAdvisorData) {
    const sa = await User.create({
      name: saData.name,
      email: saData.email,
      username: saData.username,
      passwordHash,
      role: 'service-advisor',
    })
    serviceAdvisors.push(sa)
    console.log(`✅ Created ${saData.name}: username: ${saData.username} / password: test123456`)
  }

  console.log('\n✅ Enhanced seed data completed successfully!')
  console.log('📊 Summary:')
  console.log(`   - Total users: ${1 + 2 + 1 + technicians.length + serviceAdvisors.length}`)
  console.log('   - 1 superadmin (vldngls)')
  console.log('   - 2 administrators')
  console.log('   - 1 job-controller')
  console.log(`   - ${technicians.length} technicians`)
  console.log(`   - ${serviceAdvisors.length} service-advisors`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

