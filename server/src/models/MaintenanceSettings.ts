const mongoose = require('mongoose')
const { Schema } = mongoose

interface MaintenanceSettingsDoc {
  isUnderMaintenance: boolean
  maintenanceMessage: string
  enabledBy: any // mongoose.Types.ObjectId
  enabledByName: string
  enabledByEmail: string
  enabledAt?: Date
  disabledBy?: any // mongoose.Types.ObjectId
  disabledByName?: string
  disabledByEmail?: string
  disabledAt?: Date
}

const maintenanceSettingsSchema = new Schema({
  isUnderMaintenance: { 
    type: Boolean, 
    required: true,
    default: false
  },
  maintenanceMessage: { 
    type: String, 
    required: true,
    default: 'The system is currently under maintenance. Please try again later.'
  },
  enabledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  enabledByName: { type: String },
  enabledByEmail: { type: String },
  enabledAt: { type: Date },
  disabledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  disabledByName: { type: String },
  disabledByEmail: { type: String },
  disabledAt: { type: Date }
}, { 
  timestamps: true,
  // Ensure only one maintenance settings document exists
  collection: 'maintenancesettings'
})

// Create a compound index to ensure only one document exists
maintenanceSettingsSchema.index({}, { unique: true })

const MaintenanceSettings = mongoose.models.MaintenanceSettings || mongoose.model('MaintenanceSettings', maintenanceSettingsSchema)

module.exports = { MaintenanceSettings }
