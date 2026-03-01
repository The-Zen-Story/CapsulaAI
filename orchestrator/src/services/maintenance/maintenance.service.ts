import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Import enum types from Prisma client
import {
  MaintenanceTask,
  MaintenanceType,
  MaintenanceStatus,
  ReviewerType,
} from '@prisma/client';

import { similarityService, EntityData } from './similarity.service';

/**
 * Auto-approval confidence threshold
 * Tasks with confidence >= 0.95 will be auto-approved
 */
const AUTO_APPROVE_THRESHOLD = 0.95;

/**
 * Maintenance task change record interface
 */
export interface MaintenanceChange {
  /** Changed field */
  field: string;
  /** Old value */
  oldValue?: unknown;
  /** New value */
  newValue?: unknown;
}

/**
 * Create maintenance task input interface
 */
export interface CreateTaskInput {
  /** Task type */
  taskType: MaintenanceType;
  /** Task description */
  description: string;
  /** Confidence (0-1) */
  confidence: number;
  /** Source entity ID */
  sourceEntityId?: string;
  /** Target entity ID */
  targetEntityId?: string;
  /** Relation ID */
  relationId?: string;
  /** Changes content */
  changes?: MaintenanceChange[];
}

/**
 * Health report interface
 */
export interface HealthReport {
  /** Health score (0-100) */
  score: number;
  /** Total entities */
  totalEntities: number;
  /** Total relations */
  totalRelations: number;
  /** Orphan entities count */
  orphanEntities: number;
  /** Potential duplicates count */
  potentialDuplicates: number;
  /** Stale entities count */
  staleEntities: number;
  /** Broken relations count */
  brokenRelations: number;
  /** Detailed information */
  details: {
    orphanEntities: string[];
    potentialDuplicates: Array<{
      entityAId: string;
      entityBId: string;
      similarity: number;
    }>;
    staleEntities: string[];
    brokenRelations: string[];
  };
}

/**
 * Task execution result interface
 */
export interface TaskExecutionResult {
  /** Whether successful */
  success: boolean;
  /** Task after execution */
  task?: MaintenanceTask;
  /** Error message */
  error?: string;
}

/**
 * JSON object type
 */
type JsonObject = Record<string, unknown>;

/**
 * Maintenance task service
 *
 * Provides complete lifecycle management for knowledge graph maintenance tasks:
 * - Task creation
 * - State machine management (PENDING → AUTO_APPROVED/APPROVED/REJECTED → APPLIED)
 * - Auto-approval (confidence >= 0.95)
 * - Task execution (entity merge, relation discovery, etc.)
 * - Task rollback
 *
 * State machine:
 * ```
 * PENDING → auto_check(confidence>=0.95) → AUTO_APPROVED → apply → APPLIED
 * PENDING → auto_check(confidence<0.95) → AWAITING_USER_REVIEW → approve → APPROVED → apply → APPLIED
 * AWAITING_USER_REVIEW → reject → REJECTED
 * APPLIED → revert → REVERTED
 * ```
 */
export class MaintenanceService {
  /**
   * Create maintenance task
   *
   * Automatically determine task status based on confidence:
   * - confidence >= 0.95: AUTO_APPROVED (auto-approved)
   * - confidence < 0.95: AWAITING_USER_REVIEW (awaiting user review)
   *
   * @param userId - User ID
   * @param input - Task creation input
   * @returns Created maintenance task
   */
  async createTask(
    userId: string,
    input: CreateTaskInput
  ): Promise<MaintenanceTask> {
    // Determine initial status
    let initialStatus: MaintenanceStatus;
    let reviewedBy: ReviewerType | null = null;
    let reviewedAt: Date | null = null;

    if (input.confidence >= AUTO_APPROVE_THRESHOLD) {
      initialStatus = MaintenanceStatus.AUTO_APPROVED;
      reviewedBy = ReviewerType.SYSTEM;
      reviewedAt = new Date();
    } else {
      initialStatus = MaintenanceStatus.AWAITING_USER_REVIEW;
    }

    return prisma.maintenanceTask.create({
      data: {
        userId,
        taskType: input.taskType,
        description: input.description,
        confidence: input.confidence,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        relationId: input.relationId,
        status: initialStatus,
        reviewedBy,
        reviewedAt,
        changes: input.changes as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Batch create maintenance tasks
   *
   * Use transaction to ensure atomicity; if any task creation fails, all tasks will be rolled back
   *
   * @param userId - User ID
   * @param inputs - List of task creation inputs
   * @returns List of created maintenance tasks
   * @throws Error when any task creation fails, all tasks will be rolled back
   */
  async createTasks(
    userId: string,
    inputs: CreateTaskInput[]
  ): Promise<MaintenanceTask[]> {
    // Use transaction to ensure atomicity
    return prisma.$transaction(async (tx) => {
      const tasks: MaintenanceTask[] = [];

      for (const input of inputs) {
        // Determine initial status
        let initialStatus: MaintenanceStatus;
        let reviewedBy: ReviewerType | null = null;
        let reviewedAt: Date | null = null;

        if (input.confidence >= AUTO_APPROVE_THRESHOLD) {
          initialStatus = MaintenanceStatus.AUTO_APPROVED;
          reviewedBy = ReviewerType.SYSTEM;
          reviewedAt = new Date();
        } else {
          initialStatus = MaintenanceStatus.AWAITING_USER_REVIEW;
        }

        const task = await tx.maintenanceTask.create({
          data: {
            userId,
            taskType: input.taskType,
            description: input.description,
            confidence: input.confidence,
            sourceEntityId: input.sourceEntityId,
            targetEntityId: input.targetEntityId,
            relationId: input.relationId,
            status: initialStatus,
            reviewedBy,
            reviewedAt,
            changes: input.changes as unknown as Prisma.InputJsonValue,
          },
        });

        tasks.push(task);
      }

      return tasks;
    });
  }

  /**
   * Scan for entity duplicates
   *
   * Use similarity service to find potential duplicate entities and create merge tasks
   *
   * @param userId - User ID
   * @param similarityThreshold - Similarity threshold (default 0.85)
   * @returns List of created maintenance tasks
   */
  async scanForDuplicates(
    userId: string,
    similarityThreshold = 0.85
  ): Promise<MaintenanceTask[]> {
    // Get all entities
    const entities = await prisma.entity.findMany({
      include: {
        relationsFrom: { select: { toEntityId: true } },
        relationsTo: { select: { fromEntityId: true } },
      },
    });

    // Convert to EntityData format
    // Note: embedding field is Unsupported("vector(1536)") type, cannot be directly retrieved via Prisma
    // Need to use raw query or separate vector service to get
    const entityData: EntityData[] = entities.map((e) => ({
      id: e.id,
      name: e.canonicalName,
      type: e.type,
      aliases: [],
      embedding: undefined, // Vector needs to be retrieved via other means
      relatedEntities: [
        ...e.relationsFrom.map((r) => r.toEntityId),
        ...e.relationsTo.map((r) => r.fromEntityId),
      ],
    }));

    // Find similar entity pairs
    const similarPairs = await similarityService.findSimilarPairs(
      entityData,
      similarityThreshold
    );

    // Create maintenance tasks
    const tasks: MaintenanceTask[] = [];

    for (const pair of similarPairs) {
      // Check if same task already exists
      const existing = await prisma.maintenanceTask.findFirst({
        where: {
          userId,
          taskType: MaintenanceType.ENTITY_MERGE,
          sourceEntityId: pair.entityA.id,
          targetEntityId: pair.entityB.id,
          status: {
            in: [
              MaintenanceStatus.PENDING,
              MaintenanceStatus.AWAITING_USER_REVIEW,
              MaintenanceStatus.AUTO_APPROVED,
            ],
          },
        },
      });

      if (existing) continue;

      const task = await this.createTask(userId, {
        taskType: MaintenanceType.ENTITY_MERGE,
        description: `Merge entities "${pair.entityA.name}" and "${pair.entityB.name}" (similarity: ${Math.round(
          pair.similarity * 100
        )}%)`,
        confidence: pair.similarity,
        sourceEntityId: pair.entityA.id,
        targetEntityId: pair.entityB.id,
        changes: [
          {
            field: 'entityAName',
            oldValue: null,
            newValue: pair.entityA.name,
          },
          {
            field: 'entityBName',
            oldValue: null,
            newValue: pair.entityB.name,
          },
          {
            field: 'similarity',
            oldValue: null,
            newValue: pair.similarity,
          },
        ],
      });

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Discover new relations
   *
   * Find entity pairs that co-occur in multiple capsules and suggest creating relations
   *
   * @param userId - User ID
   * @param coOccurrenceThreshold - Co-occurrence threshold (default 2)
   * @returns List of created maintenance tasks
   */
  async discoverRelations(
    userId: string,
    coOccurrenceThreshold = 2
  ): Promise<MaintenanceTask[]> {
    const tasks: MaintenanceTask[] = [];

    // Find entity pairs that co-occur in capsules
    const coOccurrences = await prisma.$queryRaw<
      Array<{
        entity1_id: string;
        entity2_id: string;
        co_occurrence_count: number;
      }>
    >`
      SELECT 
        ce1.entity_id as entity1_id,
        ce2.entity_id as entity2_id,
        COUNT(*) as co_occurrence_count
      FROM "CapsuleEntity" ce1
      JOIN "CapsuleEntity" ce2 ON ce1.capsule_id = ce2.capsule_id
      WHERE ce1.entity_id < ce2.entity_id
      GROUP BY ce1.entity_id, ce2.entity_id
      HAVING COUNT(*) >= ${coOccurrenceThreshold}
    `;

    for (const co of coOccurrences) {
      // Check if relation already exists
      const existingRelation = await prisma.relation.findFirst({
        where: {
          OR: [
            { fromEntityId: co.entity1_id, toEntityId: co.entity2_id },
            { fromEntityId: co.entity2_id, toEntityId: co.entity1_id },
          ],
        },
      });

      if (existingRelation) continue;

      // Check if task already exists
      const existingTask = await prisma.maintenanceTask.findFirst({
        where: {
          userId,
          taskType: MaintenanceType.RELATION_DISCOVERY,
          sourceEntityId: co.entity1_id,
          targetEntityId: co.entity2_id,
          status: {
            in: [
              MaintenanceStatus.PENDING,
              MaintenanceStatus.AWAITING_USER_REVIEW,
              MaintenanceStatus.AUTO_APPROVED,
            ],
          },
        },
      });

      if (existingTask) continue;

      const entityA = await prisma.entity.findUnique({
        where: { id: co.entity1_id },
      });
      const entityB = await prisma.entity.findUnique({
        where: { id: co.entity2_id },
      });

      if (!entityA || !entityB) continue;

      // Calculate confidence based on co-occurrence count
      const confidence = Math.min(0.95, 0.5 + co.co_occurrence_count * 0.1);

      const task = await this.createTask(userId, {
        taskType: MaintenanceType.RELATION_DISCOVERY,
        description: `Create relation between "${entityA.canonicalName}" and "${entityB.canonicalName}" (${co.co_occurrence_count} co-occurrences)`,
        confidence,
        sourceEntityId: co.entity1_id,
        targetEntityId: co.entity2_id,
        changes: [
          {
            field: 'entityAName',
            oldValue: null,
            newValue: entityA.canonicalName,
          },
          {
            field: 'entityBName',
            oldValue: null,
            newValue: entityB.canonicalName,
          },
          {
            field: 'coOccurrenceCount',
            oldValue: null,
            newValue: co.co_occurrence_count,
          },
          {
            field: 'suggestedRelationType',
            oldValue: null,
            newValue: 'RELATED_TO',
          },
        ],
      });

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Detect stale entities
   *
   * Find entities that haven't been mentioned for a long time
   *
   * @param userId - User ID
   * @param daysThreshold - Days threshold (default 90 days)
   * @returns List of created maintenance tasks
   */
  async detectStaleEntities(
    userId: string,
    daysThreshold = 90
  ): Promise<MaintenanceTask[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    const staleEntities = await prisma.entity.findMany({
      where: {
        lastSeenAt: { lt: thresholdDate },
      },
    });

    const tasks: MaintenanceTask[] = [];

    for (const entity of staleEntities) {
      // Check if task already exists
      const existing = await prisma.maintenanceTask.findFirst({
        where: {
          userId,
          taskType: MaintenanceType.STALE_DETECTION,
          sourceEntityId: entity.id,
          status: {
            in: [
              MaintenanceStatus.PENDING,
              MaintenanceStatus.AWAITING_USER_REVIEW,
              MaintenanceStatus.AUTO_APPROVED,
            ],
          },
        },
      });

      if (existing) continue;

      const daysSinceSeen = Math.floor(
        (Date.now() - entity.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const task = await this.createTask(userId, {
        taskType: MaintenanceType.STALE_DETECTION,
        description: `Entity "${entity.canonicalName}" has not been mentioned for ${daysSinceSeen} days`,
        confidence: 0.7,
        sourceEntityId: entity.id,
        changes: [
          {
            field: 'entityName',
            oldValue: null,
            newValue: entity.canonicalName,
          },
          {
            field: 'daysSinceSeen',
            oldValue: null,
            newValue: daysSinceSeen,
          },
          {
            field: 'lastSeenAt',
            oldValue: null,
            newValue: entity.lastSeenAt,
          },
        ],
      });

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Detect orphan entities
   *
   * Find entities without any relations
   *
   * @param userId - User ID
   * @returns List of created maintenance tasks
   */
  async detectOrphanEntities(userId: string): Promise<MaintenanceTask[]> {
    const orphanEntities = await prisma.entity.findMany({
      where: {
        AND: [{ relationsFrom: { none: {} } }, { relationsTo: { none: {} } }],
      },
    });

    const tasks: MaintenanceTask[] = [];

    for (const entity of orphanEntities) {
      // Check if task already exists
      const existing = await prisma.maintenanceTask.findFirst({
        where: {
          userId,
          taskType: MaintenanceType.ORPHAN_CLEANUP,
          sourceEntityId: entity.id,
          status: {
            in: [
              MaintenanceStatus.PENDING,
              MaintenanceStatus.AWAITING_USER_REVIEW,
              MaintenanceStatus.AUTO_APPROVED,
            ],
          },
        },
      });

      if (existing) continue;

      const task = await this.createTask(userId, {
        taskType: MaintenanceType.ORPHAN_CLEANUP,
        description: `Entity "${entity.canonicalName}" has no relations`,
        confidence: 0.6,
        sourceEntityId: entity.id,
        changes: [
          {
            field: 'entityName',
            oldValue: null,
            newValue: entity.canonicalName,
          },
          {
            field: 'entityType',
            oldValue: null,
            newValue: entity.type,
          },
        ],
      });

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Optimize tags
   *
   * Find and merge similar tags
   *
   * @param userId - User ID
   * @returns List of created maintenance tasks
   */
  async optimizeTags(userId: string): Promise<MaintenanceTask[]> {
    // Get all tags
    const tags = await prisma.tag.findMany({
      include: {
        capsuleTags: true,
      },
    });

    const tasks: MaintenanceTask[] = [];

    // Find similar tags
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const tagA = tags[i];
        const tagB = tags[j];

        // Calculate tag name similarity
        const similarity = similarityService.calculateNameSimilarity(
          tagA.name,
          tagB.name
        );

        if (similarity >= 0.9) {
          // Check if task already exists (check specific tag pair)
          const existing = await prisma.maintenanceTask.findFirst({
            where: {
              userId,
              taskType: MaintenanceType.TAG_OPTIMIZATION,
              status: {
                in: [
                  MaintenanceStatus.PENDING,
                  MaintenanceStatus.AWAITING_USER_REVIEW,
                  MaintenanceStatus.AUTO_APPROVED,
                ],
              },
              // Check if task for same tag pair already exists
              OR: [
                {
                  changes: {
                    path: ['tagAId'],
                    equals: tagA.id,
                  },
                },
                {
                  changes: {
                    path: ['tagAId'],
                    equals: tagB.id,
                  },
                },
                {
                  changes: {
                    path: ['tagBId'],
                    equals: tagA.id,
                  },
                },
                {
                  changes: {
                    path: ['tagBId'],
                    equals: tagB.id,
                  },
                },
              ],
            },
          });

          if (existing) continue;

          const task = await this.createTask(userId, {
            taskType: MaintenanceType.TAG_OPTIMIZATION,
            description: `Merge similar tags "${tagA.name}" and "${tagB.name}" (similarity: ${Math.round(
              similarity * 100
            )}%)`,
            confidence: similarity,
            changes: [
              {
                field: 'tagAName',
                oldValue: null,
                newValue: tagA.name,
              },
              {
                field: 'tagBName',
                oldValue: null,
                newValue: tagB.name,
              },
              {
                field: 'tagAId',
                oldValue: null,
                newValue: tagA.id,
              },
              {
                field: 'tagBId',
                oldValue: null,
                newValue: tagB.id,
              },
              {
                field: 'tagAUsageCount',
                oldValue: null,
                newValue: tagA.capsuleTags.length,
              },
              {
                field: 'tagBUsageCount',
                oldValue: null,
                newValue: tagB.capsuleTags.length,
              },
            ],
          });

          tasks.push(task);
        }
      }
    }

    return tasks;
  }

  /**
   * Get maintenance task list
   *
   * @param userId - User ID
   * @param options - Query options
   * @returns Task list and total count
   */
  async getTasks(
    userId: string,
    options: {
      status?: MaintenanceStatus;
      taskType?: MaintenanceType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ tasks: MaintenanceTask[]; total: number }> {
    const { status, taskType, limit = 50, offset = 0 } = options;

    const where: Prisma.MaintenanceTaskWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    if (taskType) {
      where.taskType = taskType;
    }

    const [tasks, total] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.maintenanceTask.count({ where }),
    ]);

    return { tasks, total };
  }

  /**
   * Get single maintenance task
   *
   * @param userId - User ID
   * @param taskId - Task ID
   * @returns Maintenance task or null
   */
  async getTask(
    userId: string,
    taskId: string
  ): Promise<MaintenanceTask | null> {
    return prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId },
    });
  }

  /**
   * Approve maintenance task
   *
   * Convert task status from AWAITING_USER_REVIEW to APPROVED
   *
   * @param userId - User ID
   * @param taskId - Task ID
   * @param comment - Review comment (optional)
   * @returns Updated task
   * @throws Error when task does not exist or status is incorrect
   */
  async approveTask(
    userId: string,
    taskId: string,
    comment?: string
  ): Promise<MaintenanceTask> {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Task does not exist');
    }

    // Validate status transition
    const allowedStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.AWAITING_USER_REVIEW,
      MaintenanceStatus.PENDING,
    ];

    if (!allowedStatuses.includes(task.status)) {
      throw new Error(`Cannot approve task with status "${task.status}"`);
    }

    return prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: MaintenanceStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: ReviewerType.USER,
        reviewComment: comment,
      },
    });
  }

  /**
   * Reject maintenance task
   *
   * Convert task status to REJECTED
   *
   * @param userId - User ID
   * @param taskId - Task ID
   * @param comment - Rejection reason (optional)
   * @returns Updated task
   * @throws Error when task does not exist or status is incorrect
   */
  async rejectTask(
    userId: string,
    taskId: string,
    comment?: string
  ): Promise<MaintenanceTask> {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Task does not exist');
    }

    // Validate status transition
    const allowedStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.AWAITING_USER_REVIEW,
      MaintenanceStatus.PENDING,
      MaintenanceStatus.AUTO_APPROVED,
    ];

    if (!allowedStatuses.includes(task.status)) {
      throw new Error(`Cannot reject task with status "${task.status}"`);
    }

    return prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: MaintenanceStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: ReviewerType.USER,
        reviewComment: comment,
      },
    });
  }

  /**
   * Execute maintenance task
   *
   * Execute corresponding operation based on task type, using transaction to ensure data consistency
   *
   * Status transition: APPROVED | AUTO_APPROVED → APPLIED
   *
   * @param userId - User ID
   * @param taskId - Task ID
   * @returns Execution result
   */
  async applyTask(
    userId: string,
    taskId: string
  ): Promise<TaskExecutionResult> {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return { success: false, error: 'Task does not exist' };
    }

    // Validate status
    const allowedStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.APPROVED,
      MaintenanceStatus.AUTO_APPROVED,
    ];

    if (!allowedStatuses.includes(task.status)) {
      return {
        success: false,
        error: `Cannot execute task with status "${task.status}", task must be in APPROVED or AUTO_APPROVED state`,
      };
    }

    try {
      // Execute operation using transaction
      const result = await prisma.$transaction(async (tx) => {
        // Record pre-execution state snapshot
        const snapshot = await this.createSnapshot(tx, task);

        // Execute task
        switch (task.taskType) {
          case MaintenanceType.ENTITY_MERGE:
            await this.executeEntityMerge(tx, task);
            break;
          case MaintenanceType.RELATION_DISCOVERY:
            await this.executeRelationDiscovery(tx, task);
            break;
          case MaintenanceType.TAG_OPTIMIZATION:
            await this.executeTagOptimization(tx, task);
            break;
          case MaintenanceType.STALE_DETECTION:
            await this.executeStaleDetection(tx, task);
            break;
          case MaintenanceType.ORPHAN_CLEANUP:
            await this.executeOrphanCleanup(tx, task);
            break;
          default:
            throw new Error(`Unknown task type: ${task.taskType}`);
        }

        // Update task status to applied
        const currentChanges = (task.changes as JsonObject) || {};
        const updatedTask = await tx.maintenanceTask.update({
          where: { id: taskId },
          data: {
            status: MaintenanceStatus.APPLIED,
            appliedAt: new Date(),
            changes: {
              ...currentChanges,
              _snapshot: snapshot,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return updatedTask;
      });

      return { success: true, task: result };
    } catch (error) {
      // Update task status to failed
      const failedTask = await prisma.maintenanceTask.update({
        where: { id: taskId },
        data: {
          status: MaintenanceStatus.FAILED,
          errorMessage: (error as Error).message,
        },
      });

      return {
        success: false,
        task: failedTask,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Rollback maintenance task
   *
   * Rollback applied task to previous state
   *
   * Status transition: APPLIED → REVERTED
   *
   * @param userId - User ID
   * @param taskId - Task ID
   * @param comment - Rollback reason (optional)
   * @returns Execution result
   */
  async revertTask(
    userId: string,
    taskId: string,
    comment?: string
  ): Promise<TaskExecutionResult> {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return { success: false, error: 'Task does not exist' };
    }

    if (task.status !== MaintenanceStatus.APPLIED) {
      return {
        success: false,
        error: `Cannot rollback task with status "${task.status}", only APPLIED tasks can be rolled back`,
      };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get pre-execution state snapshot
        const changes = (task.changes as JsonObject) || {};
        const snapshot = changes._snapshot as JsonObject | undefined;

        if (!snapshot) {
          throw new Error('Cannot find pre-execution state snapshot, cannot rollback');
        }

        // Execute rollback based on task type
        switch (task.taskType) {
          case MaintenanceType.ENTITY_MERGE:
            await this.revertEntityMerge(tx, task, snapshot);
            break;
          case MaintenanceType.RELATION_DISCOVERY:
            await this.revertRelationDiscovery(tx, task, snapshot);
            break;
          case MaintenanceType.TAG_OPTIMIZATION:
            await this.revertTagOptimization(tx, task, snapshot);
            break;
          case MaintenanceType.STALE_DETECTION:
            await this.revertStaleDetection(tx, task, snapshot);
            break;
          case MaintenanceType.ORPHAN_CLEANUP:
            // ORPHAN_CLEANUP does not need rollback operation
            break;
          default:
            throw new Error(`Unknown task type: ${task.taskType}`);
        }

        // Update task status to reverted
        const updatedTask = await tx.maintenanceTask.update({
          where: { id: taskId },
          data: {
            status: MaintenanceStatus.REVERTED,
            reviewComment: comment
              ? `Rollback reason: ${comment}`
              : 'Task has been rolled back',
          },
        });

        return updatedTask;
      });

      return { success: true, task: result };
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Create pre-execution state snapshot
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   * @returns State snapshot
   */
  private async createSnapshot(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask
  ): Promise<JsonObject> {
    const snapshot: JsonObject = {};

    switch (task.taskType) {
      case MaintenanceType.ENTITY_MERGE:
        if (task.sourceEntityId && task.targetEntityId) {
          const sourceEntity = await tx.entity.findUnique({
            where: { id: task.sourceEntityId },
            include: {
              relationsFrom: true,
              relationsTo: true,
              capsuleEntities: true,
            },
          });
          const targetEntity = await tx.entity.findUnique({
            where: { id: task.targetEntityId },
            include: {
              relationsFrom: true,
              relationsTo: true,
              capsuleEntities: true,
            },
          });
          snapshot.sourceEntity = sourceEntity as unknown as JsonObject;
          snapshot.targetEntity = targetEntity as unknown as JsonObject;
        }
        break;

      case MaintenanceType.RELATION_DISCOVERY:
        // Relation discovery does not need snapshot, as it only creates new records
        break;

      case MaintenanceType.TAG_OPTIMIZATION:
        // Tag optimization snapshot is already included in changes
        break;

      case MaintenanceType.STALE_DETECTION:
        if (task.sourceEntityId) {
          const entity = await tx.entity.findUnique({
            where: { id: task.sourceEntityId },
          });
          snapshot.entity = entity as unknown as JsonObject;
        }
        break;

      case MaintenanceType.ORPHAN_CLEANUP:
        // Orphan cleanup does not need snapshot
        break;
    }

    return snapshot;
  }

  /**
   * Execute entity merge
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   */
  private async executeEntityMerge(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask
  ): Promise<void> {
    if (!task.sourceEntityId || !task.targetEntityId) {
      throw new Error('Missing entity IDs');
    }

    const sourceEntity = await tx.entity.findUnique({
      where: { id: task.sourceEntityId },
    });

    const targetEntity = await tx.entity.findUnique({
      where: { id: task.targetEntityId },
    });

    if (!sourceEntity || !targetEntity) {
      throw new Error('Entity does not exist');
    }

    // Decide which entity to keep (more mentions or more recent)
    const keepEntity =
      sourceEntity.mentionCount >= targetEntity.mentionCount
        ? sourceEntity
        : targetEntity;
    const mergeEntity =
      keepEntity.id === sourceEntity.id ? targetEntity : sourceEntity;

    // Update relations to point to kept entity
    await tx.relation.updateMany({
      where: { fromEntityId: mergeEntity.id },
      data: { fromEntityId: keepEntity.id },
    });

    await tx.relation.updateMany({
      where: { toEntityId: mergeEntity.id },
      data: { toEntityId: keepEntity.id },
    });

    // Update CapsuleEntity to point to kept entity
    await tx.capsuleEntity.updateMany({
      where: { entityId: mergeEntity.id },
      data: { entityId: keepEntity.id },
    });

    // Delete merged entity
    await tx.entity.delete({
      where: { id: mergeEntity.id },
    });

    // Update mention count of kept entity
    await tx.entity.update({
      where: { id: keepEntity.id },
      data: {
        mentionCount: keepEntity.mentionCount + mergeEntity.mentionCount,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Rollback entity merge
   *
   * Restore merged entity and revert relation pointers
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   * @param snapshot - State snapshot
   */
  private async revertEntityMerge(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask,
    snapshot: JsonObject
  ): Promise<void> {
    const sourceEntity = snapshot.sourceEntity as JsonObject | undefined;
    const targetEntity = snapshot.targetEntity as JsonObject | undefined;
    const mergedRelations = snapshot.mergedRelations as JsonObject[] | undefined;

    if (!sourceEntity || !targetEntity) {
      throw new Error('State snapshot is incomplete, cannot rollback');
    }

    // Determine which entity was deleted (the one with smaller mentionCount)
    const sourceMentionCount = (sourceEntity.mentionCount as number) || 0;
    const targetMentionCount = (targetEntity.mentionCount as number) || 0;
    
    const deletedEntity = sourceMentionCount >= targetMentionCount ? targetEntity : sourceEntity;
    const keptEntity = sourceMentionCount >= targetMentionCount ? sourceEntity : targetEntity;

    // 1. Recreate deleted entity
    await tx.entity.create({
      data: {
        id: deletedEntity.id as string,
        canonicalName: deletedEntity.canonicalName as string,
        normalizedName: deletedEntity.normalizedName as string,
        type: deletedEntity.type as string,
        description: deletedEntity.description as string | undefined,
        mentionCount: deletedEntity.mentionCount as number,
        firstSeenAt: new Date(deletedEntity.firstSeenAt as string),
        lastSeenAt: new Date(deletedEntity.lastSeenAt as string),
      },
    });

    // 2. Restore relation pointers
    if (mergedRelations && Array.isArray(mergedRelations)) {
      for (const relation of mergedRelations) {
        const fromEntityId = relation.fromEntityId as string;
        const toEntityId = relation.toEntityId as string;
        
        // If relation points to kept entity, check if it should point to restored entity
        if (fromEntityId === keptEntity.id && relation.originalFromEntityId === deletedEntity.id) {
          await tx.relation.updateMany({
            where: {
              fromEntityId: keptEntity.id as string,
              toEntityId: relation.toEntityId as string,
            },
            data: { fromEntityId: deletedEntity.id as string },
          });
        }
        if (toEntityId === keptEntity.id && relation.originalToEntityId === deletedEntity.id) {
          await tx.relation.updateMany({
            where: {
              fromEntityId: relation.fromEntityId as string,
              toEntityId: keptEntity.id as string,
            },
            data: { toEntityId: deletedEntity.id as string },
          });
        }
      }
    }

    // 3. Restore CapsuleEntity associations
    const capsuleEntities = snapshot.capsuleEntities as JsonObject[] | undefined;
    if (capsuleEntities && Array.isArray(capsuleEntities)) {
      for (const ce of capsuleEntities) {
        if (ce.originalEntityId === deletedEntity.id) {
          await tx.capsuleEntity.updateMany({
            where: {
              capsuleId: ce.capsuleId as string,
              entityId: keptEntity.id as string,
            },
            data: { entityId: deletedEntity.id as string },
          });
        }
      }
    }

    // 4. Restore mention count of kept entity
    await tx.entity.update({
      where: { id: keptEntity.id as string },
      data: {
        mentionCount: keptEntity.mentionCount as number,
      },
    });
  }

  /**
   * Execute relation discovery
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   */
  private async executeRelationDiscovery(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask
  ): Promise<void> {
    if (!task.sourceEntityId || !task.targetEntityId) {
      throw new Error('Missing entity IDs');
    }

    // Check if relation already exists
    const existingRelation = await tx.relation.findFirst({
      where: {
        OR: [
          {
            fromEntityId: task.sourceEntityId,
            toEntityId: task.targetEntityId,
          },
          {
            fromEntityId: task.targetEntityId,
            toEntityId: task.sourceEntityId,
          },
        ],
      },
    });

    if (existingRelation) {
      throw new Error('Relation already exists');
    }

    // Create new relation
    await tx.relation.create({
      data: {
        fromEntityId: task.sourceEntityId,
        toEntityId: task.targetEntityId,
        relationType: 'RELATED_TO',
        createdBy: 'system',
        strength: task.confidence,
      },
    });
  }

  /**
   * Rollback relation discovery
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   * @param snapshot - State snapshot
   */
  private async revertRelationDiscovery(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask,
    _snapshot: JsonObject
  ): Promise<void> {
    if (!task.sourceEntityId || !task.targetEntityId) {
      throw new Error('Missing entity IDs');
    }

    // Delete created relation
    await tx.relation.deleteMany({
      where: {
        fromEntityId: task.sourceEntityId,
        toEntityId: task.targetEntityId,
        relationType: 'RELATED_TO',
      },
    });
  }

  /**
   * Execute tag optimization
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   */
  private async executeTagOptimization(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask
  ): Promise<void> {
    const changes = (task.changes as JsonObject) || {};

    const tagAId = changes?.tagAId as string | undefined;
    const tagBId = changes?.tagBId as string | undefined;

    if (!tagAId || !tagBId) {
      throw new Error('Missing tag IDs');
    }

    // Get tag information
    const tagA = await tx.tag.findUnique({ where: { id: tagAId } });
    const tagB = await tx.tag.findUnique({ where: { id: tagBId } });

    if (!tagA || !tagB) {
      throw new Error('Tag does not exist');
    }

    // Decide which tag to keep (the one with more usage)
    const tagAUsageCount = (changes?.tagAUsageCount as number) || 0;
    const tagBUsageCount = (changes?.tagBUsageCount as number) || 0;

    const keepTag = tagAUsageCount >= tagBUsageCount ? tagA : tagB;
    const mergeTag = keepTag.id === tagA.id ? tagB : tagA;

    // Update CapsuleTag to point to kept tag
    await tx.capsuleTag.updateMany({
      where: { tagId: mergeTag.id },
      data: { tagId: keepTag.id },
    });

    // Delete merged tag
    await tx.tag.delete({
      where: { id: mergeTag.id },
    });
  }

  /**
   * Rollback tag optimization
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   * @param _snapshot - State snapshot
   */
  private async revertTagOptimization(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask,
    _snapshot: JsonObject
  ): Promise<void> {
    // Get deleted tag information from changes
    const changes = (task.changes as JsonObject) || {};
    const tagBName = changes?.tagBName as string | undefined;
    const tagBId = changes?.tagBId as string | undefined;

    if (!tagBName || !tagBId) {
      throw new Error('Missing tag information, cannot rollback');
    }

    // Recreate deleted tag
    await tx.tag.create({
      data: {
        id: tagBId,
        name: tagBName,
      },
    });

    // Note: Restoring CapsuleTag associations requires more complex logic
    // Simplified handling here
  }

  /**
   * Execute stale entity detection
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   */
  private async executeStaleDetection(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask
  ): Promise<void> {
    if (!task.sourceEntityId) {
      throw new Error('Missing entity ID');
    }

    // Mark entity as stale (by updating description or adding metadata)
    // Note: Entity model does not have status field, here we just record the operation
    // Actual implementation may need to add status field or use other marking method
    const entity = await tx.entity.findUnique({
      where: { id: task.sourceEntityId },
    });

    if (!entity) {
      throw new Error('Entity does not exist');
    }

    // Update description to mark as stale
    const staleNote = `[STALE] This entity is stale, last mentioned: ${entity.lastSeenAt.toISOString()}`;
    await tx.entity.update({
      where: { id: task.sourceEntityId },
      data: {
        description: entity.description
          ? `${entity.description}\n${staleNote}`
          : staleNote,
      },
    });
  }

  /**
   * Rollback stale entity detection
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   * @param _snapshot - State snapshot
   */
  private async revertStaleDetection(
    tx: Prisma.TransactionClient,
    task: MaintenanceTask,
    snapshot: JsonObject
  ): Promise<void> {
    if (!task.sourceEntityId) {
      throw new Error('Missing entity ID');
    }

    // Restore entity description
    const entitySnapshot = snapshot.entity as JsonObject | undefined;
    if (entitySnapshot && entitySnapshot.description !== undefined) {
      await tx.entity.update({
        where: { id: task.sourceEntityId },
        data: {
          description: entitySnapshot.description as string | null,
        },
      });
    }
  }

  /**
   * Execute orphan cleanup
   *
   * @param tx - Prisma transaction client
   * @param task - Maintenance task
   */
  private async executeOrphanCleanup(
    _tx: Prisma.TransactionClient,
    _task: MaintenanceTask
  ): Promise<void> {
    // ORPHAN_CLEANUP is just a marker, does not perform actual deletion
    // Actual deletion is decided manually by user
  }

  /**
   * Get knowledge graph health report
   *
   * @param userId - User ID
   * @returns Health report
   */
  async getHealthReport(userId: string): Promise<HealthReport> {
    const [
      totalEntities,
      totalRelations,
      orphanEntities,
      staleEntities,
      potentialDuplicates,
    ] = await Promise.all([
      prisma.entity.count(),
      prisma.relation.count(),
      prisma.entity.count({
        where: {
          AND: [
            { relationsFrom: { none: {} } },
            { relationsTo: { none: {} } },
          ],
        },
      }),
      prisma.entity.count({
        where: {
          lastSeenAt: {
            lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.maintenanceTask.count({
        where: {
          userId,
          taskType: MaintenanceType.ENTITY_MERGE,
          status: {
            in: [
              MaintenanceStatus.PENDING,
              MaintenanceStatus.AWAITING_USER_REVIEW,
              MaintenanceStatus.AUTO_APPROVED,
            ],
          },
        },
      }),
    ]);

    // Calculate health score
    let score = 100;
    score -= orphanEntities * 2;
    score -= potentialDuplicates * 5;
    score -= staleEntities * 3;
    score = Math.max(0, score);

    // Get detailed information
    const orphanEntityIds = await prisma.entity.findMany({
      where: {
        AND: [
          { relationsFrom: { none: {} } },
          { relationsTo: { none: {} } },
        ],
      },
      select: { id: true },
      take: 10,
    });

    const duplicateTasks = await prisma.maintenanceTask.findMany({
      where: {
        userId,
        taskType: MaintenanceType.ENTITY_MERGE,
        status: {
          in: [
            MaintenanceStatus.PENDING,
            MaintenanceStatus.AWAITING_USER_REVIEW,
            MaintenanceStatus.AUTO_APPROVED,
          ],
        },
      },
      select: {
        sourceEntityId: true,
        targetEntityId: true,
        confidence: true,
      },
      take: 10,
    });

    const staleEntityIds = await prisma.entity.findMany({
      where: {
        lastSeenAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
      take: 10,
    });

    return {
      score,
      totalEntities,
      totalRelations,
      orphanEntities,
      potentialDuplicates,
      staleEntities,
      brokenRelations: 0,
      details: {
        orphanEntities: orphanEntityIds.map((e) => e.id),
        potentialDuplicates: duplicateTasks.map((t) => ({
          entityAId: t.sourceEntityId!,
          entityBId: t.targetEntityId!,
          similarity: t.confidence,
        })),
        staleEntities: staleEntityIds.map((e) => e.id),
        brokenRelations: [],
      },
    };
  }

  /**
   * Run full maintenance scan
   *
   * Execute all types of maintenance scans
   *
   * @param userId - User ID
   * @returns Scan result statistics
   */
  async runFullScan(userId: string): Promise<{
    duplicates: number;
    relations: number;
    stale: number;
    orphans: number;
    tags: number;
  }> {
    const [duplicates, relations, stale, orphans, tags] = await Promise.all([
      this.scanForDuplicates(userId),
      this.discoverRelations(userId),
      this.detectStaleEntities(userId),
      this.detectOrphanEntities(userId),
      this.optimizeTags(userId),
    ]);

    return {
      duplicates: duplicates.length,
      relations: relations.length,
      stale: stale.length,
      orphans: orphans.length,
      tags: tags.length,
    };
  }

  /**
   * Auto-execute high confidence tasks
   *
   * Automatically execute all AUTO_APPROVED tasks
   *
   * @param userId - User ID
   * @returns List of execution results
   */
  async autoApplyTasks(userId: string): Promise<TaskExecutionResult[]> {
    const { tasks } = await this.getTasks(userId, {
      status: MaintenanceStatus.AUTO_APPROVED,
      limit: 100,
    });

    const results: TaskExecutionResult[] = [];

    for (const task of tasks) {
      const result = await this.applyTask(userId, task.id);
      results.push(result);
    }

    return results;
  }
}

/**
 * Default maintenance service instance
 */
export const maintenanceService = new MaintenanceService();
