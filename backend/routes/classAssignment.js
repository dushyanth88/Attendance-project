import express from 'express';
import { body, validationResult } from 'express-validator';
import ClassAssignment from '../models/ClassAssignment.js';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import { authenticate, hodAndAbove } from '../middleware/auth.js';

const router = express.Router();

// @desc    Assign faculty as class advisor
// @route   POST /api/class-assignment
// @access  HOD and above
router.post('/', [
  body('facultyId').isMongoId().withMessage('Valid faculty ID is required'),
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1-8'),
  body('section').isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], authenticate, hodAndAbove, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { facultyId, batch, year, semester, section, notes } = req.body;
    const currentUser = req.user;

    // Verify faculty exists and is in the same department
    // First check if facultyId is a Faculty model ID
    let faculty = await Faculty.findById(facultyId);
    let facultyUser = null;
    
    if (faculty) {
      // If found in Faculty model, get the associated User
      facultyUser = await User.findById(faculty.userId);
      if (!facultyUser) {
        return res.status(404).json({
          status: 'error',
          message: 'Faculty user account not found'
        });
      }
    } else {
      // If not found in Faculty model, check if it's a User ID directly
      facultyUser = await User.findById(facultyId);
      if (facultyUser && facultyUser.role === 'faculty') {
        // Find the corresponding Faculty record
        faculty = await Faculty.findOne({ userId: facultyId });
        if (!faculty) {
          return res.status(404).json({
            status: 'error',
            message: 'Faculty profile not found'
          });
        }
      } else {
        return res.status(404).json({
          status: 'error',
          message: 'Faculty member not found'
        });
      }
    }

    if (facultyUser.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only assign faculty from your own department'
      });
    }

    // Check if faculty is active
    if (facultyUser.status !== 'active' || faculty.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot assign inactive faculty as class advisor'
      });
    }

    // Check if there's already an active assignment for this class
    const existingAssignment = await ClassAssignment.getCurrentAdvisor(
      batch, year, semester, section, currentUser._id
    );

    let replacedAdvisor = null;
    if (existingAssignment) {
      replacedAdvisor = {
        name: existingAssignment.facultyId.name,
        email: existingAssignment.facultyId.email
      };
    }

    // Create new assignment (this will automatically deactivate any existing one)
    const assignment = await ClassAssignment.assignAdvisor({
      facultyId: facultyUser._id, // Use the User ID, not the Faculty ID
      batch,
      year,
      semester,
      section,
      departmentId: currentUser._id,
      assignedBy: currentUser._id,
      notes
    });

    // Populate the assignment with faculty details
    await assignment.populate([
      { path: 'facultyId', select: 'name email position' },
      { path: 'assignedBy', select: 'name email' }
    ]);

    res.status(201).json({
      status: 'success',
      message: replacedAdvisor 
        ? `Class advisor assigned successfully. Replaced ${replacedAdvisor.name} for ${year} | Semester ${semester} | Section ${section}`
        : `Class advisor assigned successfully for ${year} | Semester ${semester} | Section ${section}`,
      data: {
        assignment,
        replacedAdvisor,
        classInfo: {
          batch,
          year,
          semester,
          section,
          classDisplay: assignment.classDisplay
        }
      }
    });
  } catch (error) {
    console.error('Error assigning class advisor:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while assigning class advisor'
    });
  }
});

// @desc    Get all active class assignments for a faculty
// @route   GET /api/class-assignment/faculty/:facultyId
// @access  Faculty and above
router.get('/faculty/:facultyId', authenticate, async (req, res) => {
  try {
    const { facultyId } = req.params;
    const currentUser = req.user;

    // Check if user can access this faculty's assignments
    if (currentUser.role === 'faculty' && currentUser._id.toString() !== facultyId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only view your own class assignments'
      });
    }

    const assignments = await ClassAssignment.getActiveAssignments(facultyId);

    res.status(200).json({
      status: 'success',
      data: {
        assignments,
        total: assignments.length,
        faculty: {
          id: facultyId,
          name: assignments[0]?.facultyId?.name || 'Unknown'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching faculty assignments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching faculty assignments'
    });
  }
});

// @desc    Get current advisor for a specific class
// @route   GET /api/class-assignment/current/:batch/:year/:semester/:section
// @access  HOD and above
router.get('/current/:batch/:year/:semester/:section', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section } = req.params;
    const currentUser = req.user;

    const advisor = await ClassAssignment.getCurrentAdvisor(
      batch, year, parseInt(semester), section, currentUser._id
    );

    if (!advisor) {
      return res.status(404).json({
        status: 'error',
        message: 'No active advisor found for this class'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        advisor: {
          id: advisor.facultyId._id,
          name: advisor.facultyId.name,
          email: advisor.facultyId.email,
          position: advisor.facultyId.position
        },
        assignment: {
          id: advisor._id,
          assignedDate: advisor.assignedDate,
          active: advisor.active,
          classDisplay: advisor.classDisplay
        },
        classInfo: {
          batch: advisor.batch,
          year: advisor.year,
          semester: advisor.semester,
          section: advisor.section
        }
      }
    });
  } catch (error) {
    console.error('Error fetching current advisor:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching current advisor'
    });
  }
});

// @desc    Get all class assignments for department (HOD view)
// @route   GET /api/class-assignment/department
// @access  HOD and above
router.get('/department', authenticate, hodAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;
    const { active = 'true' } = req.query;

    const filter = {
      departmentId: currentUser._id
    };

    if (active === 'true') {
      filter.active = true;
    }

    const assignments = await ClassAssignment.find(filter)
      .populate('facultyId', 'name email position')
      .populate('assignedBy', 'name email')
      .sort({ assignedDate: -1 });

    // Group assignments by class
    const classGroups = {};
    assignments.forEach(assignment => {
      const key = `${assignment.batch}-${assignment.year}-${assignment.semester}-${assignment.section}`;
      if (!classGroups[key]) {
        classGroups[key] = {
          classInfo: {
            batch: assignment.batch,
            year: assignment.year,
            semester: assignment.semester,
            section: assignment.section,
            classDisplay: assignment.classDisplay
          },
          assignments: []
        };
      }
      classGroups[key].assignments.push(assignment);
    });

    res.status(200).json({
      status: 'success',
      data: {
        assignments: Object.values(classGroups),
        total: assignments.length,
        activeCount: assignments.filter(a => a.active).length,
        inactiveCount: assignments.filter(a => !a.active).length
      }
    });
  } catch (error) {
    console.error('Error fetching department assignments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching department assignments'
    });
  }
});

// @desc    Deactivate class assignment
// @route   PUT /api/class-assignment/:id/deactivate
// @access  HOD and above
router.put('/:id/deactivate', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const assignment = await ClassAssignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        status: 'error',
        message: 'Class assignment not found'
      });
    }

    // Check if HOD can manage this assignment
    if (assignment.departmentId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only manage assignments in your own department'
      });
    }

    if (!assignment.active) {
      return res.status(400).json({
        status: 'error',
        message: 'Assignment is already inactive'
      });
    }

    await assignment.deactivate(currentUser._id);

    res.status(200).json({
      status: 'success',
      message: `Class advisor assignment deactivated for ${assignment.classDisplay}`,
      data: {
        assignment,
        deactivatedDate: assignment.deactivatedDate
      }
    });
  } catch (error) {
    console.error('Error deactivating assignment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deactivating assignment'
    });
  }
});

// @desc    Get available classes for assignment
// @route   GET /api/class-assignment/available-classes
// @access  HOD and above
router.get('/available-classes', authenticate, hodAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;

    // Generate available class combinations
    const currentYear = new Date().getFullYear();
    const batchRanges = [];
    for (let i = 0; i < 10; i++) {
      const startYear = currentYear + i;
      const endYear = startYear + 4;
      batchRanges.push(`${startYear}-${endYear}`);
    }

    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    const sections = ['A', 'B', 'C'];
    const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

    // Get all possible combinations
    const allClasses = [];
    batchRanges.forEach(batch => {
      years.forEach(year => {
        semesters.forEach(semester => {
          sections.forEach(section => {
            allClasses.push({
              batch,
              year,
              semester,
              section,
              classDisplay: `${year} | Semester ${semester} | Section ${section}`,
              classKey: `${batch}-${year}-${semester}-${section}`
            });
          });
        });
      });
    });

    // Get current assignments to show which are taken
    const currentAssignments = await ClassAssignment.find({
      departmentId: currentUser._id,
      active: true
    }).populate('facultyId', 'name email');

    const assignedClasses = new Set();
    const assignmentMap = {};
    currentAssignments.forEach(assignment => {
      const key = assignment.classKey;
      assignedClasses.add(key);
      assignmentMap[key] = {
        faculty: {
          id: assignment.facultyId._id,
          name: assignment.facultyId.name,
          email: assignment.facultyId.email
        },
        assignedDate: assignment.assignedDate
      };
    });

    // Separate available and assigned classes
    const availableClasses = allClasses.filter(cls => !assignedClasses.has(cls.classKey));
    const assignedClassesList = allClasses.filter(cls => assignedClasses.has(cls.classKey));

    res.status(200).json({
      status: 'success',
      data: {
        availableClasses: availableClasses.slice(0, 200), // Limit for performance
        assignedClasses: assignedClassesList.map(cls => ({
          ...cls,
          currentAdvisor: assignmentMap[cls.classKey]
        })),
        totalAvailable: availableClasses.length,
        totalAssigned: assignedClassesList.length,
        batchRanges,
        years,
        sections,
        semesters
      }
    });
  } catch (error) {
    console.error('Error fetching available classes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching available classes'
    });
  }
});

// @desc    Get class assignment details by ID
// @route   GET /api/class-assignment/:id
// @access  Faculty and above
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const assignment = await ClassAssignment.findById(id)
      .populate('facultyId', 'name email')
      .populate('assignedBy', 'name email');

    if (!assignment) {
      return res.status(404).json({
        status: 'error',
        message: 'Class assignment not found'
      });
    }

    // Check if faculty has access to this assignment
    if (assignment.facultyId._id.toString() !== currentUser._id.toString() && 
        !['hod', 'admin', 'principal'].includes(currentUser.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this class assignment'
      });
    }

    res.json({
      status: 'success',
      data: {
        id: assignment._id,
        batch: assignment.batch,
        year: assignment.year,
        semester: assignment.semester,
        section: assignment.section,
        departmentId: assignment.departmentId,
        facultyId: assignment.facultyId,
        assignedBy: assignment.assignedBy,
        assignedDate: assignment.assignedDate,
        active: assignment.active,
        notes: assignment.notes
      }
    });

  } catch (error) {
    console.error('Error fetching class assignment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching class assignment'
    });
  }
});

// @desc    Remove class assignment completely
// @route   DELETE /api/class-assignment/:id
// @access  HOD and above
router.delete('/:id', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    console.log('🗑️ ClassAssignment removal request:', {
      assignmentId: id,
      userId: currentUser._id,
      userRole: currentUser.role,
      department: currentUser.department
    });

    const assignment = await ClassAssignment.findById(id);
    if (!assignment) {
      console.log('❌ ClassAssignment not found:', id);
      return res.status(404).json({
        status: 'error',
        message: 'Class assignment not found'
      });
    }

    console.log('✅ Found ClassAssignment:', {
      id: assignment._id,
      facultyId: assignment.facultyId,
      departmentId: assignment.departmentId,
      classDisplay: assignment.classDisplay
    });

    // Check if HOD can manage this assignment
    if (assignment.departmentId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only manage assignments in your own department'
      });
    }

    // Use the completeRemoval method to clean up both models
    console.log('🔄 Starting completeRemoval for assignment:', assignment._id);
    await assignment.completeRemoval();
    console.log('✅ CompleteRemoval completed successfully');

    res.status(200).json({
      status: 'success',
      message: `Class assignment completely removed from all models for ${assignment.classDisplay}`,
      data: {
        removedAssignment: {
          id: assignment._id,
          batch: assignment.batch,
          year: assignment.year,
          semester: assignment.semester,
          section: assignment.section,
          classDisplay: assignment.classDisplay
        }
      }
    });
  } catch (error) {
    console.error('Error removing class assignment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while removing class assignment'
    });
  }
});

export default router;
