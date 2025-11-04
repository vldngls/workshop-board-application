import 'dotenv/config'
import mongoose from 'mongoose'

const MaintenanceSettingsSchema = new mongoose.Schema({
  isUnderMaintenance: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'The system is currently under maintenance. Please try again later.' },
  apiKey: { type: String, default: null },
  enabledBy: mongoose.Schema.Types.ObjectId,
  enabledByName: String,
  enabledByEmail: String,
  enabledAt: Date,
  disabledBy: mongoose.Schema.Types.ObjectId,
  disabledByName: String,
  disabledByEmail: String,
  disabledAt: Date
}, { timestamps: true })

const MaintenanceSettings = mongoose.models.MaintenanceSettings || mongoose.model('MaintenanceSettings', MaintenanceSettingsSchema)

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  // Get API key from command line argument or environment variable
  const apiKey = process.argv[2] || process.env.API_KEY
  
  if (!apiKey) {
    console.error('❌ Error: API key is required')
    console.log('Usage: node set-api-key.mjs <api-key>')
    console.log('   Or: API_KEY=<api-key> node set-api-key.mjs')
    process.exit(1)
  }

  try {
    let settings = await MaintenanceSettings.findOne()
    
    if (!settings) {
      settings = new MaintenanceSettings({
        isUnderMaintenance: false,
        maintenanceMessage: 'The system is currently under maintenance. Please try again later.'
      })
    }
    
    settings.apiKey = apiKey
    await settings.save()
    
    console.log('✅ API key set successfully')
  } catch (error) {
    console.error('❌ Error setting API key:', error.message)
    process.exit(1)
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

