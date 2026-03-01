// routes/review.ts
// Combined routes for:
// 1. Flashcard review system (spaced repetition)
// 2. Maintenance task review (knowledge graph maintenance)

import { Router } from 'express';
import { reviewService } from '../services/review/review.service';
import { maintenanceService } from '../services/maintenance/maintenance.service';
import { prisma } from '../lib/prisma';
import { MaintenanceStatus, MaintenanceType } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Helper to get userId from request (reserved for auth middleware)
// Falls back to 'test-user' if no user ID is provided
const getUserId = (req: any): string => {
  const userId = req.user?.id || req.headers['x-user-id'];
  if (!userId) {
    return 'test-user';
  }
  return userId as string;
};

// ============================================================================
// FLASHCARD REVIEW ROUTES (Spaced Repetition System)
// ============================================================================

// Validation schemas for flashcards
const createCardSchema = z.object({
  front: z.string().min(1, 'Front content is required'),
  back: z.string().min(1, 'Back content is required'),
  cardType: z.enum(['FLASHCARD', 'QA', 'FILL_BLANK', 'CLOZE']).optional(),
  capsuleId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateCardSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

const submitReviewSchema = z.object({
  cardId: z.string(),
  rating: z.number().int().min(0).max(5) as z.ZodType<0 | 1 | 2 | 3 | 4 | 5>,
  responseTime: z.number().int().min(0), // seconds
});

// GET /api/review/cards - List all cards
router.get('/cards', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, tags, search, limit = '50', offset = '0' } = req.query;

    const result = await reviewService.getCards(userId, {
      status: status as string,
      tags: tags ? (tags as string).split(',') : undefined,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: result.cards,
      meta: {
        pagination: {
          total: result.total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      },
    });
  } catch (error) {
    console.error('Error getting cards:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get cards',
      },
    });
  }
});

// POST /api/review/cards - Create a new card
router.post('/cards', async (req, res) => {
  try {
    const userId = getUserId(req);
    const input = createCardSchema.parse(req.body);

    const card = await reviewService.createCard(userId, input as import('../services/review/review.service').CreateCardInput);

    res.status(201).json({
      success: true,
      data: card,
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
    console.error('Error creating card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create card',
      },
    });
  }
});

// GET /api/review/cards/:id - Get a single card
router.get('/cards/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const card = await reviewService.getCard(userId, id);

    if (!card) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error('Error getting card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get card',
      },
    });
  }
});

// PUT /api/review/cards/:id - Update a card
router.put('/cards/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const data = updateCardSchema.parse(req.body);

    const card = await reviewService.updateCard(userId, id, data);

    res.json({
      success: true,
      data: card,
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
    if ((error as Error).message === 'Card not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }
    console.error('Error updating card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update card',
      },
    });
  }
});

// DELETE /api/review/cards/:id - Delete a card
router.delete('/cards/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    await reviewService.deleteCard(userId, id);

    res.json({
      success: true,
      message: 'Card deleted successfully',
    });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }
    console.error('Error deleting card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete card',
      },
    });
  }
});

// POST /api/review/cards/:id/suspend - Suspend a card
router.post('/cards/:id/suspend', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const card = await reviewService.suspendCard(userId, id);

    res.json({
      success: true,
      data: card,
      message: 'Card suspended successfully',
    });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }
    console.error('Error suspending card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to suspend card',
      },
    });
  }
});

// POST /api/review/cards/:id/resume - Resume a suspended card
router.post('/cards/:id/resume', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const card = await reviewService.resumeCard(userId, id);

    res.json({
      success: true,
      data: card,
      message: 'Card resumed successfully',
    });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }
    console.error('Error resuming card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to resume card',
      },
    });
  }
});

// POST /api/review/cards/:id/reset - Reset a card
router.post('/cards/:id/reset', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const card = await reviewService.resetCard(userId, id);

    res.json({
      success: true,
      data: card,
      message: 'Card reset successfully',
    });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }
    console.error('Error resetting card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset card',
      },
    });
  }
});

// GET /api/review/sessions/due - Get due cards for review
router.get('/sessions/due', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = '50', offset = '0' } = req.query;

    const cards = await reviewService.getDueCards(userId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: cards,
    });
  } catch (error) {
    console.error('Error getting due cards:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get due cards',
      },
    });
  }
});

// POST /api/review/sessions - Start a new review session
router.post('/sessions', async (req, res) => {
  try {
    const userId = getUserId(req);

    const result = await reviewService.startSession(userId);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if ((error as Error).message === 'No cards due for review') {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_CARDS_DUE',
          message: 'No cards due for review',
        },
      });
      return;
    }
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start session',
      },
    });
  }
});

// GET /api/review/sessions/:id - Get a session
router.get('/sessions/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const session = await reviewService.getSession(userId, id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get session',
      },
    });
  }
});

// POST /api/review/sessions/:id/review - Submit a review
router.post('/sessions/:id/review', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const input = submitReviewSchema.parse(req.body);

    const result = await reviewService.submitReview(userId, id, input as import('../services/review/review.service').SubmitReviewInput);

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
    if ((error as Error).message === 'Card not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Card not found',
        },
      });
      return;
    }
    if ((error as Error).message === 'Session not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
      return;
    }
    console.error('Error submitting review:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit review',
      },
    });
  }
});

// POST /api/review/sessions/:id/complete - Complete a session
router.post('/sessions/:id/complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const session = await reviewService.completeSession(userId, id);

    res.json({
      success: true,
      data: session,
      message: 'Session completed successfully',
    });
  } catch (error) {
    if ((error as Error).message === 'Session not found') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
      return;
    }
    console.error('Error completing session:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete session',
      },
    });
  }
});

// GET /api/review/stats - Get review statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);

    const stats = await reviewService.getStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting review stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get review stats',
      },
    });
  }
});

// GET /api/review/heatmap - Get review heatmap data
router.get('/heatmap', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { startDate, endDate } = req.query;

    const heatmap = await reviewService.getHeatmap(userId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: heatmap,
    });
  } catch (error) {
    console.error('Error getting heatmap:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get heatmap',
      },
    });
  }
});

// GET /api/review/dashboard - Get dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const userId = getUserId(req);

    const dashboard = await reviewService.getDashboard(userId);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get dashboard',
      },
    });
  }
});

// ============================================================================
// MAINTENANCE TASK REVIEW ROUTES (Knowledge Graph Maintenance)
// ============================================================================

// Validation schemas
const approveReviewSchema = z.object({
  comment: z.string().optional(),
});

const rejectReviewSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

/**
 * GET /api/review/queue
 * Get review queue
 * 
 * Query params:
 * - status: Status filter (PENDING, AWAITING_USER_REVIEW, AUTO_APPROVED)
 * - taskType: Task type filter
 * - limit: Items per page (default 20)
 * - offset: Offset (default 0)
 */
router.get('/queue', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { 
      status = 'AWAITING_USER_REVIEW',
      taskType,
      limit = '20',
      offset = '0',
      minConfidence,
      maxConfidence,
    } = req.query;

    const where: any = { 
      userId,
      status: status as MaintenanceStatus,
    };

    if (taskType) {
      where.taskType = taskType as MaintenanceType;
    }

    if (minConfidence || maxConfidence) {
      where.confidence = {};
      if (minConfidence) where.confidence.gte = parseFloat(minConfidence as string);
      if (maxConfidence) where.confidence.lte = parseFloat(maxConfidence as string);
    }

    const [tasks, total] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where,
        orderBy: [
          { confidence: 'desc' },
          { createdAt: 'desc' },
        ],
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.maintenanceTask.count({ where }),
    ]);

    res.json({
      success: true,
      data: tasks,
      meta: {
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      },
    });
  } catch (error) {
    console.error('Error getting review queue:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get review queue',
      },
    });
  }
});

/**
 * POST /api/review/batch-approve
 * Batch approve review items
 * 
 * Body:
 * - ids: Array of task IDs
 * - comment: Optional review comment
 */
router.post('/batch-approve', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { ids, comment } = z.object({
      ids: z.array(z.string()).min(1).max(100, 'Cannot process more than 100 items at once'),
      comment: z.string().optional(),
    }).parse(req.body);

    const results = await Promise.allSettled(
      ids.map(id => maintenanceService.approveTask(userId, id, comment))
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r, index) => ({ id: ids[index], reason: r.reason?.message }));

    res.json({
      success: true,
      data: {
        successful,
        failed,
        totalProcessed: ids.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
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

    console.error('Error batch approving review items:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to batch approve review items',
      },
    });
  }
});

/**
 * POST /api/review/batch-reject
 * Batch reject review items
 * 
 * Body:
 * - ids: Array of task IDs
 * - reason: Rejection reason (required)
 */
router.post('/batch-reject', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { ids, reason } = z.object({
      ids: z.array(z.string()).min(1).max(100, 'Cannot process more than 100 items at once'),
      reason: z.string().min(1),
    }).parse(req.body);

    const results = await Promise.allSettled(
      ids.map(id => maintenanceService.rejectTask(userId, id, reason))
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r, index) => ({ id: ids[index], reason: r.reason?.message }));

    res.json({
      success: true,
      data: {
        successful,
        failed,
        totalProcessed: ids.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
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

    console.error('Error batch rejecting review items:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to batch reject review items',
      },
    });
  }
});

/**
 * GET /api/review/:id
 * Get single review item details
 * NOTE: This must be AFTER all named routes to avoid shadowing
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const task = await prisma.maintenanceTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Review item not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Error getting review item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get review item',
      },
    });
  }
});

/**
 * POST /api/review/:id/approve
 * Approve review item
 * 
 * Body:
 * - comment: Optional review comment
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { comment } = approveReviewSchema.parse(req.body);

    const task = await maintenanceService.approveTask(userId, id, comment);

    res.json({
      success: true,
      data: task,
      message: 'Review item approved successfully',
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
          message: 'Review item not found',
        },
      });
      return;
    }

    if ((error as Error).message.includes('无法批准')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: (error as Error).message,
        },
      });
      return;
    }

    console.error('Error approving review item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to approve review item',
      },
    });
  }
});

/**
 * POST /api/review/:id/reject
 * Reject review item
 * 
 * Body:
 * - reason: Rejection reason (required)
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { reason } = rejectReviewSchema.parse(req.body);

    const task = await maintenanceService.rejectTask(userId, id, reason);

    res.json({
      success: true,
      data: task,
      message: 'Review item rejected successfully',
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
          message: 'Review item not found',
        },
      });
      return;
    }

    if ((error as Error).message.includes('无法拒绝')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: (error as Error).message,
        },
      });
      return;
    }

    console.error('Error rejecting review item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reject review item',
      },
    });
  }
});

/**
 * POST /api/review/:id/apply
 * Execute review item (executed after approval)
 */
router.post('/:id/apply', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await maintenanceService.applyTask(userId, id);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'APPLY_FAILED',
          message: result.error || 'Failed to apply review item',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result.task,
      message: 'Review item applied successfully',
    });
  } catch (error) {
    console.error('Error applying review item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to apply review item',
      },
    });
  }
});

export default router;
