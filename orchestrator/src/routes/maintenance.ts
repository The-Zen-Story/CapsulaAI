// routes/maintenance.ts

import { Router } from 'express';
import { maintenanceService } from '../services/maintenance/maintenance.service';
import { mergeService } from '../services/maintenance/merge.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// Helper to get userId from request (reserved for auth middleware)
const getUserId = (req: any): string => {
  const userId = req.user?.id || req.headers['x-user-id'] || 'test-user';
  return userId as string;
};

// Validation schemas
const createTaskSchema = z.object({
  taskType: z.enum(['ENTITY_MERGE', 'RELATION_DISCOVERY', 'TAG_OPTIMIZATION', 'STALE_DETECTION', 'ORPHAN_CLEANUP']),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceEntityId: z.string().optional(),
  targetEntityId: z.string().optional(),
  relationId: z.string().optional(),
  changes: z.array(z.object({
    field: z.string().min(1),
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
  })).optional(),
});

const approveTaskSchema = z.object({
  comment: z.string().optional(),
});

const revertTaskSchema = z.object({
  comment: z.string().optional(),
});

// Pagination schema with limits
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Status filter schema
const statusFilterSchema = z.enum(['PENDING', 'AWAITING_USER_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERTED']).optional();

// Task type filter schema
const taskTypeFilterSchema = z.enum(['ENTITY_MERGE', 'RELATION_DISCOVERY', 'TAG_OPTIMIZATION', 'STALE_DETECTION', 'ORPHAN_CLEANUP']).optional();

// GET /api/maintenance/health - Get health report
router.get('/health', async (req, res) => {
  try {
    const userId = getUserId(req);
    const report = await maintenanceService.getHealthReport(userId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error getting health report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get health report',
      },
    });
  }
});

// GET /api/maintenance/tasks - Get maintenance tasks
router.get('/tasks', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    // Validate pagination parameters
    const pagination = paginationSchema.safeParse({
      limit: req.query.limit,
      offset: req.query.offset,
    });
    
    if (!pagination.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination parameters',
          details: pagination.error.errors,
        },
      });
    }
    
    const { status, taskType } = req.query;

    const result = await maintenanceService.getTasks(userId, {
      status: statusFilterSchema.safeParse(status).data,
      taskType: taskTypeFilterSchema.safeParse(taskType).data,
      limit: pagination.data.limit,
      offset: pagination.data.offset,
    });

    res.json({
      success: true,
      data: result.tasks,
      meta: {
        pagination: {
          total: result.total,
          limit: pagination.data.limit,
          offset: pagination.data.offset,
        },
      },
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get tasks',
      },
    });
  }
});

// POST /api/maintenance/tasks - Create maintenance task
router.post('/tasks', async (req, res) => {
  try {
    const userId = getUserId(req);
    const parsed = createTaskSchema.parse(req.body);
    
    // Convert to correct type
    const input: import('../services/maintenance/maintenance.service').CreateTaskInput = {
      taskType: parsed.taskType as import('../services/maintenance/maintenance.service').CreateTaskInput['taskType'],
      description: parsed.description,
      confidence: parsed.confidence,
      sourceEntityId: parsed.sourceEntityId,
      targetEntityId: parsed.targetEntityId,
      relationId: parsed.relationId,
      changes: parsed.changes as import('../services/maintenance/maintenance.service').MaintenanceChange[] | undefined,
    };

    const task = await maintenanceService.createTask(userId, input);

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task',
      },
    });
  }
});

// GET /api/maintenance/tasks/:id - Get a single task
router.get('/tasks/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const task = await maintenanceService.getTask(userId, id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get task',
      },
    });
  }
});

// POST /api/maintenance/tasks/:id/approve - Approve a task
router.post('/tasks/:id/approve', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { comment } = approveTaskSchema.parse(req.body);

    const task = await maintenanceService.approveTask(userId, id, comment);

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
      return;
    }
    if ((error as Error).message === '任务不存在') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
      return;
    }
    console.error('Error approving task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to approve task',
      },
    });
  }
});

// POST /api/maintenance/tasks/:id/reject - Reject a task
router.post('/tasks/:id/reject', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { comment } = approveTaskSchema.parse(req.body);

    const task = await maintenanceService.rejectTask(userId, id, comment);

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
      return;
    }
    if ((error as Error).message === '任务不存在') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
      return;
    }
    console.error('Error rejecting task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reject task',
      },
    });
  }
});

// POST /api/maintenance/tasks/:id/apply - Apply an approved task
router.post('/tasks/:id/apply', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await maintenanceService.applyTask(userId, id);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'APPLY_FAILED',
          message: result.error || 'Failed to apply task',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result.task,
    });
  } catch (error) {
    console.error('Error applying task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to apply task',
      },
    });
  }
});

// POST /api/maintenance/tasks/:id/revert - Revert an applied task
router.post('/tasks/:id/revert', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { comment } = revertTaskSchema.parse(req.body);

    const result = await maintenanceService.revertTask(userId, id, comment);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'REVERT_FAILED',
          message: result.error || 'Failed to revert task',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result.task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Error reverting task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revert task',
      },
    });
  }
});

// POST /api/maintenance/scan - Run full maintenance scan
router.post('/scan', async (req, res) => {
  try {
    const userId = getUserId(req);

    const result = await maintenanceService.runFullScan(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error running scan:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to run scan',
      },
    });
  }
});

// POST /api/maintenance/scan/duplicates - Scan for duplicates only
router.post('/scan/duplicates', async (req, res) => {
  try {
    const userId = getUserId(req);

    const tasks = await maintenanceService.scanForDuplicates(userId);

    res.json({
      success: true,
      data: { count: tasks.length, tasks },
    });
  } catch (error) {
    console.error('Error scanning duplicates:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to scan duplicates',
      },
    });
  }
});

// POST /api/maintenance/scan/relations - Discover relations only
router.post('/scan/relations', async (req, res) => {
  try {
    const userId = getUserId(req);

    const tasks = await maintenanceService.discoverRelations(userId);

    res.json({
      success: true,
      data: { count: tasks.length, tasks },
    });
  } catch (error) {
    console.error('Error discovering relations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to discover relations',
      },
    });
  }
});

// POST /api/maintenance/scan/orphans - Scan for orphan entities
router.post('/scan/orphans', async (req, res) => {
  try {
    const userId = getUserId(req);

    // Get all entities without any capsule relations
    const orphanEntities = await prisma.entity.findMany({
      where: {
        capsuleEntities: {
          none: {},
        },
      },
      take: 100,
    });

    // Create maintenance tasks for orphaned entities
    const tasks = await Promise.all(
      orphanEntities.map(async (entity) => {
        return prisma.maintenanceTask.create({
          data: {
            userId,
            taskType: 'ORPHAN_CLEANUP',
            description: `Orphan entity: ${entity.canonicalName}`,
            confidence: 0.8,
            sourceEntityId: entity.id,
            status: 'PENDING',
          },
        });
      })
    );

    res.json({
      success: true,
      data: { count: tasks.length, tasks },
    });
  } catch (error) {
    console.error('Error scanning orphans:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to scan orphans',
      },
    });
  }
});

// GET /api/maintenance/stats - Get maintenance statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);

    const { tasks } = await maintenanceService.getTasks(userId, { limit: 1000 });
    
    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'AWAITING_USER_REVIEW').length;
    const approvedTasks = tasks.filter(t => t.status === 'APPROVED' || t.status === 'AUTO_APPROVED').length;
    const appliedTasks = tasks.filter(t => t.status === 'APPLIED').length;
    const rejectedTasks = tasks.filter(t => t.status === 'REJECTED').length;

    res.json({
      success: true,
      data: {
        totalTasks,
        pendingTasks,
        approvedTasks,
        appliedTasks,
        rejectedTasks,
      },
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get stats',
      },
    });
  }
});

// POST /api/maintenance/merge/preview - Preview entity merge
router.post('/merge/preview', async (req, res) => {
  try {
    const { sourceEntityId, targetEntityId } = z.object({
      sourceEntityId: z.string(),
      targetEntityId: z.string(),
    }).parse(req.body);

    const preview = await mergeService.previewMerge(sourceEntityId, targetEntityId);

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Error previewing merge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to preview merge',
      },
    });
  }
});

// POST /api/maintenance/merge/execute - Execute entity merge
router.post('/merge/execute', async (req, res) => {
  try {
    const { taskId, sourceEntityId, targetEntityId } = z.object({
      taskId: z.string(),
      sourceEntityId: z.string(),
      targetEntityId: z.string(),
    }).parse(req.body);

    const result = await mergeService.executeMerge(taskId, sourceEntityId, targetEntityId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MERGE_FAILED',
          message: result.error || 'Failed to execute merge',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Error executing merge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to execute merge',
      },
    });
  }
});

export default router;
