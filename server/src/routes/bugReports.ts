const { Router } = require('express');
const { z } = require('zod');
const { connectToMongo } = require('../config/mongo');
const { BugReport } = require('../models/BugReport');
const { User } = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

const createBugReportSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
  imageData: z.string().optional(),
  imageMimeType: z.string().optional(),
  currentPage: z.string().min(1, 'Current page is required'),
  userAgent: z.string().min(1, 'User agent is required'),
});

const updateBugReportSchema = z.object({
  status: z.enum(['open', 'in-progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
});

// Create bug report
router.post('/', verifyToken, async (req, res) => {
  try {
    await connectToMongo();
    
    const parsed = createBugReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        details: parsed.error.issues 
      });
    }
    
    const { subject, description, imageData, imageMimeType, currentPage, userAgent } = parsed.data;
    
    const bugReport = new BugReport({
      subject,
      description,
      imageData,
      imageMimeType,
      submittedBy: req.user.userId,
      submittedByEmail: req.user.email,
      submittedByName: req.user.name,
      submittedByRole: req.user.role,
      currentPage,
      userAgent,
    });
    
    await bugReport.save();
    
    return res.json({ 
      message: 'Bug report submitted successfully',
      bugReport: {
        _id: bugReport._id,
        subject: bugReport.subject,
        status: bugReport.status,
        createdAt: bugReport.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating bug report:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all bug reports (superadmin only)
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    const { status, priority, page = 1, limit = 20 } = req.query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const [bugReports, total] = await Promise.all([
      BugReport.find(filter)
        .populate('submittedBy', 'name email role')
        .populate('assignedTo', 'name email')
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .lean(),
      BugReport.countDocuments(filter)
    ]);
    
    return res.json({
      bugReports,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
