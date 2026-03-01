// routes/review.ts
// Two responsibilities:
// 1. Flashcard Spaced-Repetition Review (ReviewService / SM-2)
// 2. Maintenance Task Review queue (for backward-compat with maintenance pages)

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { reviewService } from '../services/review/review.service';
import { maintenanceService } from '../services/maintenance/maintenance.service';
import { z } from 'zod';

const prisma = new PrismaClient() as any;


// Maintenance status/type enums — sourced from runtime Prisma to avoid import issues
const MaintenanceStatus = {
  PENDING: 'PENDING',
  AUTO_APPROVED: 'AUTO_APPROVED',
  AWAITING_USER_REVIEW: 'AWAITING_USER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  APPLIED: 'APPLIED',
  FAILED: 'FAILED',
  REVERTED: 'REVERTED',
} as const;
type MaintenanceStatusType = typeof MaintenanceStatus[keyof typeof MaintenanceStatus];

const router = Router();

// Helper to get userId from request (reserved for auth middleware)
// Falls back to 'test-user' when no auth header is present (no real auth yet)
const getUserId = (req: any): string => {
  return req.user?.id || (req.headers['x-user-id'] as string) || 'test-user';
};

// ============================================================
// == FLASHCARD REVIEW ROUTES (ReviewService / SM-2)
// ============================================================

/**
 * GET /api/review/stats
 * Get flashcard review statistics for the user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    const stats = await reviewService.getStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting review stats:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get review stats' } });
  }
});

/**
 * GET /api/review/heatmap
 * Get review activity heatmap data
 */
router.get('/heatmap', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { startDate, endDate } = req.query;
    const heatmap = await reviewService.getHeatmap(userId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    res.json({ success: true, data: heatmap });
  } catch (error) {
    console.error('Error getting heatmap:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get heatmap' } });
  }
});

/**
 * GET /api/review/dashboard
 * Get review dashboard data (stats + recent cards + due cards + last session)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = getUserId(req);
    const dashboard = await reviewService.getDashboard(userId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get dashboard' } });
  }
});

/**
 * GET /api/review/cards
 * List review cards with optional filters
 */
router.get('/cards', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, search, limit, offset } = req.query;
    const tags = req.query.tags
      ? Array.isArray(req.query.tags)
        ? (req.query.tags as string[])
        : [req.query.tags as string]
      : undefined;

    const result = await reviewService.getCards(userId, {
      status: status as string | undefined,
      tags,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.cards,
      meta: { pagination: { total: result.total } },
    });
  } catch (error) {
    console.error('Error getting cards:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get cards' } });
  }
});

/**
 * POST /api/review/cards
 * Create a new review card
 */
router.post('/cards', async (req, res) => {
  try {
    const userId = getUserId(req);
    const schema = z.object({
      front: z.string().min(1),
      back: z.string().min(1),
      cardType: z.enum(['FLASHCARD', 'QA', 'FILL_BLANK', 'CLOZE']).optional(),
      capsuleId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });

    const input = schema.parse(req.body);
    const card = await reviewService.createCard(userId, input);
    res.status(201).json({ success: true, data: card });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
    }
    console.error('Error creating card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create card' } });
  }
});

/**
 * GET /api/review/cards/:id
 * Get a single review card
 */
router.get('/cards/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const card = await reviewService.getCard(userId, req.params.id);
    if (!card) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    res.json({ success: true, data: card });
  } catch (error) {
    console.error('Error getting card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get card' } });
  }
});

/**
 * PUT /api/review/cards/:id
 * Update a review card
 */
router.put('/cards/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const schema = z.object({
      front: z.string().min(1).optional(),
      back: z.string().min(1).optional(),
      tags: z.array(z.string()).optional(),
    });
    const data = schema.parse(req.body);
    const card = await reviewService.updateCard(userId, req.params.id, data);
    res.json({ success: true, data: card });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
    }
    if ((error as Error).message === 'Card not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    console.error('Error updating card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update card' } });
  }
});

/**
 * DELETE /api/review/cards/:id
 * Delete a review card
 */
router.delete('/cards/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    await reviewService.deleteCard(userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    console.error('Error deleting card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete card' } });
  }
});

/**
 * POST /api/review/cards/:id/suspend
 * Suspend a card (pause reviews)
 */
router.post('/cards/:id/suspend', async (req, res) => {
  try {
    const userId = getUserId(req);
    const card = await reviewService.suspendCard(userId, req.params.id);
    res.json({ success: true, data: card });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    console.error('Error suspending card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to suspend card' } });
  }
});

/**
 * POST /api/review/cards/:id/resume
 * Resume a suspended card
 */
router.post('/cards/:id/resume', async (req, res) => {
  try {
    const userId = getUserId(req);
    const card = await reviewService.resumeCard(userId, req.params.id);
    res.json({ success: true, data: card });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    console.error('Error resuming card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to resume card' } });
  }
});

/**
 * POST /api/review/cards/:id/reset
 * Reset a card to initial state
 */
router.post('/cards/:id/reset', async (req, res) => {
  try {
    const userId = getUserId(req);
    const card = await reviewService.resetCard(userId, req.params.id);
    res.json({ success: true, data: card });
  } catch (error) {
    if ((error as Error).message === 'Card not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    console.error('Error resetting card:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset card' } });
  }
});

/**
 * GET /api/review/sessions/due
 * Get cards currently due for review
 */
router.get('/sessions/due', async (req, res) => {
  try {
    const userId = getUserId(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const cards = await reviewService.getDueCards(userId, { limit });
    res.json({ success: true, data: cards });
  } catch (error) {
    console.error('Error getting due cards:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get due cards' } });
  }
});

/**
 * POST /api/review/sessions
 * Start a new review session
 */
router.post('/sessions', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await reviewService.startSession(userId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === 'No cards due for review') {
      return res.status(400).json({ success: false, error: { code: 'NO_DUE_CARDS', message: msg } });
    }
    console.error('Error starting session:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to start session' } });
  }
});

/**
 * GET /api/review/sessions/:id
 * Get a review session by ID
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await reviewService.getSession(userId, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get session' } });
  }
});

/**
 * POST /api/review/sessions/:id/review
 * Submit a card review within a session
 */
router.post('/sessions/:id/review', async (req, res) => {
  try {
    const userId = getUserId(req);
    const schema = z.object({
      cardId: z.string(),
      rating: z.number().int().min(0).max(5) as z.ZodType<0 | 1 | 2 | 3 | 4 | 5>,
      responseTime: z.number().positive(),
    });
    const input = schema.parse(req.body);
    const result = await reviewService.submitReview(userId, req.params.id, input);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
    }
    const msg = (error as Error).message;
    if (msg === 'Card not found' || msg === 'Session not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: msg } });
    }
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit review' } });
  }
});

/**
 * POST /api/review/sessions/:id/complete
 * Complete a review session
 */
router.post('/sessions/:id/complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await reviewService.completeSession(userId, req.params.id);
    res.json({ success: true, data: session });
  } catch (error) {
    if ((error as Error).message === 'Session not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    console.error('Error completing session:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to complete session' } });
  }
});

// ============================================================
// == MAINTENANCE TASK REVIEW QUEUE ROUTES
// ============================================================

const approveReviewSchema = z.object({
  comment: z.string().optional(),
});

const rejectReviewSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

/**
 * GET /api/review/queue
 * Get maintenance review queue
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
      status: status as string,
    };

    if (taskType) {
      where.taskType = taskType as string;
    }

    if (minConfidence || maxConfidence) {
      where.confidence = {};
      if (minConfidence) where.confidence.gte = parseFloat(minConfidence as string);
      if (maxConfidence) where.confidence.lte = parseFloat(maxConfidence as string);
    }

    const [tasks, total] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.maintenanceTask.count({ where }),
    ]);

    res.json({
      success: true,
      data: tasks,
      meta: { pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } },
    });
  } catch (error) {
    console.error('Error getting review queue:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get review queue' } });
  }
});

/**
 * POST /api/review/batch-approve
 * Batch approve maintenance tasks
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
      data: { successful, failed, totalProcessed: ids.length, successCount: successful.length, failureCount: failed.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors } });
    }
    console.error('Error batch approving:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to batch approve review items' } });
  }
});

/**
 * POST /api/review/batch-reject
 * Batch reject maintenance tasks
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
      data: { successful, failed, totalProcessed: ids.length, successCount: successful.length, failureCount: failed.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors } });
    }
    console.error('Error batch rejecting:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to batch reject review items' } });
  }
});

/**
 * POST /api/review/:id/approve
 * Approve a single maintenance task
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { comment } = approveReviewSchema.parse(req.body);
    const task = await maintenanceService.approveTask(userId, id, comment);
    res.json({ success: true, data: task, message: 'Review item approved successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors } });
    }
    if ((error as Error).message === '任务不存在') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review item not found' } });
    }
    if ((error as Error).message.includes('无法批准')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: (error as Error).message } });
    }
    console.error('Error approving review item:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve review item' } });
  }
});

/**
 * POST /api/review/:id/reject
 * Reject a single maintenance task
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { reason } = rejectReviewSchema.parse(req.body);
    const task = await maintenanceService.rejectTask(userId, id, reason);
    res.json({ success: true, data: task, message: 'Review item rejected successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors } });
    }
    if ((error as Error).message === '任务不存在') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review item not found' } });
    }
    if ((error as Error).message.includes('无法拒绝')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: (error as Error).message } });
    }
    console.error('Error rejecting review item:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reject review item' } });
  }
});

/**
 * POST /api/review/:id/apply
 * Apply an approved maintenance task
 */
router.post('/:id/apply', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await maintenanceService.applyTask(userId, req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'APPLY_FAILED', message: result.error || 'Failed to apply review item' } });
    }
    res.json({ success: true, data: result.task, message: 'Review item applied successfully' });
  } catch (error) {
    console.error('Error applying review item:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply review item' } });
  }
});

/**
 * GET /api/review/:id
 * Get single maintenance review item details
 * NOTE: This must come AFTER all named routes to avoid shadowing them
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const task = await prisma.maintenanceTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review item not found' } });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error getting review item:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get review item' } });
  }
});

export default router;
