export interface WorkshopSnapshot {
  _id: string
  date: string
  snapshotDate: string
  createdBy: {
    _id: string
    name: string
    email: string
  }
  jobOrders: Array<{
    _id: string
    jobNumber: string
    createdBy: {
      _id: string
      name: string
      email: string
    }
    assignedTechnician: {
      _id: string
      name: string
      email: string
    } | null
    serviceAdvisor: {
      _id: string
      name: string
      email: string
    } | null
    plateNumber: string
    vin: string
    timeRange: {
      start: string
      end: string
    }
    actualEndTime?: string
    jobList: Array<{
      description: string
      status: 'Finished' | 'Unfinished'
    }>
    parts: Array<{
      name: string
      availability: 'Available' | 'Unavailable'
    }>
    status: 'OG' | 'WP' | 'UA' | 'QI' | 'HC' | 'HW' | 'HI' | 'HF' | 'SU' | 'FR' | 'FU' | 'CP'
    date: string
    originalCreatedDate: string
    sourceType: 'appointment' | 'carry-over' | 'direct'
    carriedOver: boolean
    isImportant: boolean
    qiStatus: 'pending' | 'approved' | 'rejected' | null
    holdCustomerRemarks?: string
    subletRemarks?: string
    originalJobId?: string
    carryOverChain?: Array<{
      jobId: string
      date: string
      status: string
    }>
    createdAt: string
    updatedAt: string
  }>
  statistics: {
    totalJobs: number
    onGoing: number
    forRelease: number
    onHold: number
    carriedOver: number
    important: number
    qualityInspection: number
    finishedUnclaimed: number
  }
  carryOverJobs: Array<{
    _id: string
    jobNumber: string
    plateNumber: string
    status: string
    reason: string
  }>
  createdAt: string
  updatedAt: string
}

export interface WorkshopSnapshotSummary {
  _id: string
  date: string
  snapshotDate: string
  createdBy: {
    _id: string
    name: string
    email: string
  }
  statistics: {
    totalJobs: number
    carriedOver: number
  }
  carryOverJobs: Array<{
    _id: string
    jobNumber: string
    plateNumber: string
    status: string
    reason: string
  }>
}
