const { Router } = require('express');
const { z } = require('zod');
const { connectToMongo } = require('../config/mongo');
const { BugReport } = require('../models/BugReport');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

const updateBugReportSchema = z.object({
  status: z.enum(['open', 'in-progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
});

// Get specific bug report
router.get('/:id', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    const bugReport = await BugReport.findById(req.params.id)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .lean();
    
    if (!bugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }
    
    return res.json({ bugReport });
  } catch (error) {
    console.error('Error fetching bug report:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update bug report
router.put('/:id', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    const parsed = updateBugReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        details: parsed.error.issues 
      });
    }
    
    const updateData: any = { ...parsed.data };
    
    // If status is being changed to resolved, set resolvedAt and resolvedBy
    if (updateData.status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user?.sub;
    }
    
    const bugReport = await BugReport.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .lean();
    
    if (!bugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }
    
    return res.json({ 
      message: 'Bug report updated successfully',
      bugReport 
    });
  } catch (error) {
    console.error('Error updating bug report:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete bug report
router.delete('/:id', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    const bugReport = await BugReport.findByIdAndDelete(req.params.id);
    
    if (!bugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }
    
    return res.json({ message: 'Bug report deleted successfully' });
  } catch (error) {
    console.error('Error deleting bug report:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
