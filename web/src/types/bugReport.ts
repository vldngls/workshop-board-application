export interface BugReport {
  _id: string
  subject: string
  description: string
  imageData?: string
  imageMimeType?: string
  submittedBy: string
  submittedByEmail: string
  submittedByName: string
  submittedByRole: string
  currentPage: string
  userAgent: string
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: string
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
  createdAt: string
  updatedAt: string
}

export interface CreateBugReportRequest {
  subject: string
  description: string
  imageData?: string
  imageMimeType?: string
  currentPage: string
  userAgent: string
}

export interface UpdateBugReportRequest {
  status?: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: string
  resolution?: string
}
