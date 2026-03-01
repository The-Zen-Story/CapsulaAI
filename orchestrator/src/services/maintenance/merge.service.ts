import { PrismaClient, Prisma, Entity, Relation, CapsuleEntity, MaintenanceTask, MaintenanceType, MaintenanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * JSON object type
 */
type JsonObject = Record<string, unknown>;

/**
 * Entity type with relations
 */
type EntityWithRelations = Entity & {
  relationsFrom: Relation[];
  relationsTo: Relation[];
  capsuleEntities: CapsuleEntity[];
};

/**
 * Merge preview result interface
 */
export interface MergePreview {
  /** Entity to keep */
  keepEntity: EntityWithRelations;
  /** Entity to merge */
  mergeEntity: EntityWithRelations;
  /** Relation migration preview */
  relationMigration: {
    /** Relations to be migrated */
    relationsToMigrate: Array<{
      id: string;
      type: string;
      fromEntityId: string;
      toEntityId: string;
      direction: 'incoming' | 'outgoing';
    }>;
    /** Duplicate relations to be skipped */
    duplicateRelations: Array<{
      id: string;
      type: string;
      reason: string;
    }>;
  };
  /** Alias merge preview */
  aliasMerge: {
    /** Current aliases of keep entity */
    keepEntityAliases: string[];
    /** Current aliases of merge entity */
    mergeEntityAliases: string[];
    /** Merged alias list */
    mergedAliases: string[];
    /** New aliases */
    newAliases: string[];
  };
  /** Tag merge preview */
  tagMerge: {
    /** Tags of keep entity */
    keepEntityTags: string[];
    /** Tags of merge entity */
    mergeEntityTags: string[];
    /** Merged tag list */
    mergedTags: string[];
    /** New tags */
    newTags: string[];
  };
  /** Reference update preview */
  referenceUpdates: {
    /** Capsule entity associations to be updated */
    capsuleEntityUpdates: number;
    /** Embedding records to be updated */
    embeddingUpdates: number;
  };
  /** Post-merge statistics */
  postMergeStats: {
    /** Merged mention count */
    mergedMentionCount: number;
    /** Merged relation count */
    mergedRelationCount: number;
  };
}

/**
 * Merge operation result interface
 */
export interface MergeResult {
  /** Whether successful */
  success: boolean;
  /** Kept entity ID */
  keptEntityId?: string;
  /** Deleted entity ID */
  deletedEntityId?: string;
  /** Migrated relations count */
  migratedRelationsCount?: number;
  /** Skipped duplicate relations count */
  skippedRelationsCount?: number;
  /** Updated capsule entity associations count */
  updatedCapsuleEntitiesCount?: number;
  /** Merged aliases count */
  mergedAliasesCount?: number;
  /** Merged tags count */
  mergedTagsCount?: number;
  /** Error message */
  error?: string;
}

/**
 * Merge log entry interface
 */
export interface MergeLogEntry {
  /** Log ID */
  id: string;
  /** Task ID */
  taskId?: string;
  /** User ID */
  userId?: string;
  /** Operation type */
  operation: 'PREVIEW' | 'MERGE' | 'ROLLBACK';
  /** Keep entity ID */
  keepEntityId: string;
  /** Merge entity ID */
  mergeEntityId: string;
  /** State snapshot */
  snapshot?: JsonObject;
  /** Operation details */
  details: JsonObject;
  /** Whether operation succeeded */
  success?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Operation time */
  createdAt: Date;
}

/**
 * Relation migration configuration interface
 */
export interface RelationMigrationConfig {
  /** Whether to skip existing relations */
  skipExistingRelations: boolean;
  /** Relation strength threshold */
  minStrengthThreshold: number;
}

/**
 * Entity merge service
 *
 * Provides complete workflow for knowledge graph entity merging:
 * - Merge preview: Show merge effect before actual merge
 * - Relation migration: Migrate relations from merged entity to kept entity
 * - Alias merge: Merge alias lists of two entities
 * - Tag merge: Merge tags of two entities
 * - Reference update: Update all records referencing the merged entity
 * - Merge log: Record detailed information of merge operations
 *
 * @example
 * ```typescript
 * // Preview merge
 * const preview = await mergeService.previewMerge('entity-a-id', 'entity-b-id');
 * console.log(preview.aliasMerge.mergedAliases);
 *
 * // Execute merge
 * const result = await mergeService.executeMerge('task-id', 'entity-a-id', 'entity-b-id');
 * if (result.success) {
 *   console.log(`Merge completed, kept entity: ${result.keptEntityId}`);
 * }
 *
 * // Rollback merge
 * await mergeService.rollbackMerge('task-id');
 * ```
 */
export class MergeService {
  /**
   * Default relation migration configuration
   */
  private readonly defaultMigrationConfig: RelationMigrationConfig = {
    skipExistingRelations: true,
    minStrengthThreshold: 0.0,
  };

  /**
   * Generate merge preview
   *
   * Show merge effect before actual merge, including relation migration, alias merge, tag merge, etc.
   *
   * @param sourceEntityId - Source entity ID
   * @param targetEntityId - Target entity ID
   * @param config - Relation migration configuration (optional)
   * @returns Merge preview result
   * @throws Error when entity does not exist
   */
  async previewMerge(
    sourceEntityId: string,
    targetEntityId: string,
    config: Partial<RelationMigrationConfig> = {}
  ): Promise<MergePreview> {
    const migrationConfig = { ...this.defaultMigrationConfig, ...config };

    // Get two entities and their associated data
    const [sourceEntity, targetEntity] = await Promise.all([
      this.getEntityWithRelations(sourceEntityId),
      this.getEntityWithRelations(targetEntityId),
    ]);

    if (!sourceEntity) {
      throw new Error(`Source entity does not exist: ${sourceEntityId}`);
    }
    if (!targetEntity) {
      throw new Error(`Target entity does not exist: ${targetEntityId}`);
    }

    // Decide which entity to keep (more mentions or more recent)
    const { keepEntity, mergeEntity } = this.determineKeepEntity(
      sourceEntity,
      targetEntity
    );

    // Analyze relation migration
    const relationMigration = await this.analyzeRelationMigration(
      keepEntity,
      mergeEntity,
      migrationConfig
    );

    // Analyze alias merge
    const aliasMerge = this.analyzeAliasMerge(keepEntity, mergeEntity);

    // Analyze tag merge
    const tagMerge = await this.analyzeTagMerge(keepEntity, mergeEntity);

    // Analyze reference updates
    const referenceUpdates = await this.analyzeReferenceUpdates(mergeEntity);

    // Calculate post-merge statistics
    const postMergeStats = {
      mergedMentionCount: keepEntity.mentionCount + mergeEntity.mentionCount,
      mergedRelationCount:
        keepEntity.relationsFrom.length +
        keepEntity.relationsTo.length +
        relationMigration.relationsToMigrate.length,
    };

    return {
      keepEntity,
      mergeEntity,
      relationMigration,
      aliasMerge,
      tagMerge,
      referenceUpdates,
      postMergeStats,
    };
  }

  /**
   * Execute entity merge
   *
   * Use transaction to ensure data consistency, support rollback operations
   *
   * @param taskId - Maintenance task ID
   * @param sourceEntityId - Source entity ID
   * @param targetEntityId - Target entity ID
   * @param config - Relation migration configuration (optional)
   * @returns Merge result
   */
  async executeMerge(
    taskId: string,
    sourceEntityId: string,
    targetEntityId: string,
    config: Partial<RelationMigrationConfig> = {}
  ): Promise<MergeResult> {
    const migrationConfig = { ...this.defaultMigrationConfig, ...config };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Get entity information
        const sourceEntity = await this.getEntityWithRelations(sourceEntityId);
        const targetEntity = await this.getEntityWithRelations(targetEntityId);

        if (!sourceEntity || !targetEntity) {
          throw new Error('Entity does not exist');
        }

        // Check if attempting to merge same entity
        if (sourceEntity.id === targetEntity.id) {
          throw new Error('Cannot merge entity into itself');
        }

        // Check for circular merge
        const hasCycle = await this.checkMergeCycle(tx, sourceEntityId, targetEntityId);
        if (hasCycle) {
          throw new Error('Circular merge detected: target entity is already a merge target of source entity');
        }

        // Check if entity has already been merged
        if (sourceEntity.status === 'MERGED' || targetEntity.status === 'MERGED') {
          throw new Error('Cannot merge entities marked as MERGED');
        }

        // Decide which entity to keep
        const { keepEntity, mergeEntity } = this.determineKeepEntity(
          sourceEntity,
          targetEntity
        );

        // 2. Create state snapshot for rollback
        const snapshot = await this.createMergeSnapshot(tx, keepEntity, mergeEntity);

        // 3. Migrate relations
        const migrationResult = await this.migrateRelations(
          tx,
          keepEntity,
          mergeEntity,
          migrationConfig
        );

        // 4. Merge aliases
        const mergedAliases = await this.mergeAliases(tx, keepEntity, mergeEntity);

        // 5. Merge tags
        const mergedTags = await this.mergeTags(tx, keepEntity, mergeEntity);

        // 6. Update references
        const referenceUpdateResult = await this.updateReferences(
          tx,
          keepEntity,
          mergeEntity
        );

        // 7. Update statistics of kept entity
        await tx.entity.update({
          where: { id: keepEntity.id },
          data: {
            mentionCount: keepEntity.mentionCount + mergeEntity.mentionCount,
            lastSeenAt: new Date(),
            description: this.mergeDescriptions(
              keepEntity.description,
              mergeEntity.description
            ),
          },
        });

        // 8. Mark merged entity as MERGED status (instead of deleting)
        await tx.entity.update({
          where: { id: mergeEntity.id },
          data: {
            status: 'MERGED',
            mergedIntoId: keepEntity.id,
            // Keep mentionCount and other data for possible rollback
          },
        });

        // 9. Update maintenance task status
        await tx.maintenanceTask.update({
          where: { id: taskId },
          data: {
            status: MaintenanceStatus.APPLIED,
            appliedAt: new Date(),
            changes: {
              _mergeSnapshot: snapshot,
              _mergeResult: {
                keepEntityId: keepEntity.id,
                mergeEntityId: mergeEntity.id,
                migratedRelationsCount: migrationResult.migratedCount,
                skippedRelationsCount: migrationResult.skippedCount,
                mergedAliasesCount: mergedAliases.length,
                mergedTagsCount: mergedTags.length,
                updatedCapsuleEntitiesCount: referenceUpdateResult.capsuleEntityCount,
              },
            } as unknown as Prisma.InputJsonValue,
          },
        });

        // 10. Record merge log
        await this.logMergeOperation(tx, {
          taskId,
          operation: 'MERGE',
          keepEntityId: keepEntity.id,
          mergeEntityId: mergeEntity.id,
          details: {
            migratedRelations: migrationResult.migratedRelations,
            skippedRelations: migrationResult.skippedRelations,
            mergedAliases,
            mergedTags,
            referenceUpdates: referenceUpdateResult,
          },
        });

        return {
          success: true,
          keptEntityId: keepEntity.id,
          deletedEntityId: mergeEntity.id,
          migratedRelationsCount: migrationResult.migratedCount,
          skippedRelationsCount: migrationResult.skippedCount,
          updatedCapsuleEntitiesCount: referenceUpdateResult.capsuleEntityCount,
          mergedAliasesCount: mergedAliases.length,
          mergedTagsCount: mergedTags.length,
        };
      });

      return result;
    } catch (error) {
      // Record error log
      await this.logMergeOperation(prisma, {
        taskId,
        operation: 'MERGE',
        keepEntityId: sourceEntityId,
        mergeEntityId: targetEntityId,
        details: {
          error: (error as Error).message,
          stack: (error as Error).stack,
        },
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Rollback entity merge
   *
   * Restore merged entity based on state snapshot in maintenance task
   *
   * @param taskId - Maintenance task ID
   * @returns Whether rollback succeeded
   * @throws Error when task does not exist or has no snapshot
   */
  async rollbackMerge(taskId: string): Promise<boolean> {
    const task = await prisma.maintenanceTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task does not exist: ${taskId}`);
    }

    if (task.status !== MaintenanceStatus.APPLIED) {
      throw new Error(`Task status is not APPLIED, cannot rollback: ${task.status}`);
    }

    const changes = (task.changes as JsonObject) || {};
    const snapshot = changes._mergeSnapshot as JsonObject | undefined;

    if (!snapshot) {
      throw new Error('Cannot find merge snapshot, cannot rollback');
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Restore merged entity status (from MERGED to ACTIVE)
        const mergeEntitySnapshot = snapshot.mergeEntity as JsonObject;
        await tx.entity.update({
          where: { id: mergeEntitySnapshot.id as string },
          data: {
            status: 'ACTIVE',
            mergedIntoId: null,
            // Restore original field values
            canonicalName: mergeEntitySnapshot.canonicalName as string,
            normalizedName: mergeEntitySnapshot.normalizedName as string,
            type: mergeEntitySnapshot.type as string,
            description: mergeEntitySnapshot.description as string | undefined,
            aliases: (mergeEntitySnapshot.aliases as string[]) || [],
            mentionCount: mergeEntitySnapshot.mentionCount as number,
            firstSeenAt: new Date(mergeEntitySnapshot.firstSeenAt as string),
            lastSeenAt: new Date(mergeEntitySnapshot.lastSeenAt as string),
            confidenceScore: (mergeEntitySnapshot.confidenceScore as number) ?? 1.0,
          },
        });

        // 2. Restore relations
        const relationsSnapshot = snapshot.relations as JsonObject[];
        if (relationsSnapshot && Array.isArray(relationsSnapshot)) {
          for (const relation of relationsSnapshot) {
            // Check if relation already exists
            const existing = await tx.relation.findFirst({
              where: {
                fromEntityId: relation.fromEntityId as string,
                toEntityId: relation.toEntityId as string,
                relationType: relation.relationType as string,
              },
            });

            if (!existing) {
              await tx.relation.create({
                data: {
                  id: relation.id as string,
                  fromEntityId: relation.fromEntityId as string,
                  toEntityId: relation.toEntityId as string,
                  relationType: relation.relationType as string,
                  strength: (relation.strength as number) ?? 1.0,
                  createdBy: (relation.createdBy as string) ?? 'system',
                  firstSeenAt: new Date(relation.firstSeenAt as string),
                  lastSeenAt: new Date(relation.lastSeenAt as string),
                  mentionCount: (relation.mentionCount as number) ?? 1,
                },
              });
            }
          }
        }

        // 3. Restore CapsuleEntity associations
        const capsuleEntitiesSnapshot = snapshot.capsuleEntities as JsonObject[];
        if (capsuleEntitiesSnapshot && Array.isArray(capsuleEntitiesSnapshot)) {
          for (const ce of capsuleEntitiesSnapshot) {
            // Check if already exists
            const existing = await tx.capsuleEntity.findFirst({
              where: {
                capsuleId: ce.capsuleId as string,
                entityId: ce.entityId as string,
              },
            });

            if (!existing) {
              await tx.capsuleEntity.create({
                data: {
                  id: ce.id as string,
                  capsuleId: ce.capsuleId as string,
                  entityId: ce.entityId as string,
                  role: ce.role as string | undefined,
                  confidenceScore: (ce.confidenceScore as number) ?? 1.0,
                  createdAt: new Date(ce.createdAt as string),
                },
              });
            }
          }
        }

        // 4. Restore original state of kept entity
        const keepEntitySnapshot = snapshot.keepEntity as JsonObject;
        await tx.entity.update({
          where: { id: keepEntitySnapshot.id as string },
          data: {
            mentionCount: keepEntitySnapshot.mentionCount as number,
            description: keepEntitySnapshot.description as string | undefined,
            aliases: (keepEntitySnapshot.aliases as string[]) || [],
            lastSeenAt: new Date(keepEntitySnapshot.lastSeenAt as string),
          },
        });

        // 5. Update task status to rolled back
        await tx.maintenanceTask.update({
          where: { id: taskId },
          data: {
            status: MaintenanceStatus.REVERTED,
            reviewComment: 'Task has been rolled back',
          },
        });

        // 6. Record rollback log
        await this.logMergeOperation(tx, {
          taskId,
          operation: 'ROLLBACK',
          keepEntityId: keepEntitySnapshot.id as string,
          mergeEntityId: mergeEntitySnapshot.id as string,
          details: {
            restoredRelationsCount: relationsSnapshot?.length ?? 0,
            restoredCapsuleEntitiesCount: capsuleEntitiesSnapshot?.length ?? 0,
          },
        });
      });

      return true;
    } catch (error) {
      console.error('Rollback merge failed:', error);
      throw error;
    }
  }

  /**
   * Get merge logs
   *
   * @param options - Query options
   * @returns Merge log list
   */
  async getMergeLogs(options: {
    taskId?: string;
    entityId?: string;
    operation?: 'PREVIEW' | 'MERGE' | 'ROLLBACK';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: MergeLogEntry[]; total: number }> {
    const { taskId, entityId, operation, limit = 50, offset = 0 } = options;

    // Query logs from MergeLog table
    const where: Prisma.MergeLogWhereInput = {};

    if (taskId) {
      where.taskId = taskId;
    }

    if (entityId) {
      where.OR = [
        { keepEntityId: entityId },
        { mergeEntityId: entityId },
      ];
    }

    if (operation) {
      where.operation = operation;
    }

    const [logs, total] = await Promise.all([
      prisma.mergeLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.mergeLog.count({ where }),
    ]);

    const formattedLogs: MergeLogEntry[] = logs.map((log) => ({
      id: log.id,
      taskId: log.taskId || undefined,
      operation: log.operation,
      keepEntityId: log.keepEntityId,
      mergeEntityId: log.mergeEntityId,
      snapshot: log.snapshot as JsonObject,
      details: log.details as JsonObject,
      success: log.success,
      errorMessage: log.errorMessage || undefined,
      createdAt: log.createdAt,
    }));

    return { logs: formattedLogs, total };
  }

  /**
   * Batch execute merges
   *
   * @param taskIds - List of maintenance task IDs
   * @returns Execution result for each task
   */
  async batchMerge(taskIds: string[]): Promise<MergeResult[]> {
    const results: MergeResult[] = [];

    for (const taskId of taskIds) {
      const task = await prisma.maintenanceTask.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        results.push({
          success: false,
          error: `Task does not exist: ${taskId}`,
        });
        continue;
      }

      if (
        task.status !== MaintenanceStatus.APPROVED &&
        task.status !== MaintenanceStatus.AUTO_APPROVED
      ) {
        results.push({
          success: false,
          error: `Task status is incorrect: ${task.status}`,
        });
        continue;
      }

      if (!task.sourceEntityId || !task.targetEntityId) {
        results.push({
          success: false,
          error: 'Task missing entity IDs',
        });
        continue;
      }

      const result = await this.executeMerge(
        taskId,
        task.sourceEntityId,
        task.targetEntityId
      );
      results.push(result);
    }

    return results;
  }

  // ==================== Private methods ====================

  /**
   * Get entity and its relations
   *
   * @param entityId - Entity ID
   * @returns Entity and its relations
   */
  private async getEntityWithRelations(
    entityId: string
  ): Promise<EntityWithRelations> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      include: {
        relationsFrom: true,
        relationsTo: true,
        capsuleEntities: true,
      },
    });

    if (!entity) {
      throw new Error(`Entity does not exist: ${entityId}`);
    }

    return entity as EntityWithRelations;
  }

  /**
   * Decide which entity to keep
   *
   * Strategy: Keep entity with more mentions, more recently mentioned, or smaller ID
   *
   * @param entityA - Entity A
   * @param entityB - Entity B
   * @returns Keep entity and merge entity
   */
  private determineKeepEntity(
    entityA: EntityWithRelations,
    entityB: EntityWithRelations
  ): { keepEntity: EntityWithRelations; mergeEntity: EntityWithRelations } {
    // Prioritize entity with more mentions
    if (entityA.mentionCount !== entityB.mentionCount) {
      return entityA.mentionCount > entityB.mentionCount
        ? { keepEntity: entityA, mergeEntity: entityB }
        : { keepEntity: entityB, mergeEntity: entityA };
    }

    // Secondly prioritize entity more recently mentioned
    if (entityA.lastSeenAt.getTime() !== entityB.lastSeenAt.getTime()) {
      return entityA.lastSeenAt > entityB.lastSeenAt
        ? { keepEntity: entityA, mergeEntity: entityB }
        : { keepEntity: entityB, mergeEntity: entityA };
    }

    // Finally keep entity with smaller ID (deterministic selection)
    return entityA.id < entityB.id
      ? { keepEntity: entityA, mergeEntity: entityB }
      : { keepEntity: entityB, mergeEntity: entityA };
  }

  /**
   * Analyze relation migration
   *
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @param config - Migration configuration
   * @returns Relation migration analysis result
   */
  private async analyzeRelationMigration(
    keepEntity: EntityWithRelations,
    mergeEntity: EntityWithRelations,
    config: RelationMigrationConfig
  ): Promise<MergePreview['relationMigration']> {
    const relationsToMigrate: MergePreview['relationMigration']['relationsToMigrate'] = [];
    const duplicateRelations: MergePreview['relationMigration']['duplicateRelations'] = [];

    // Collect all relations of merged entity
    const mergeRelations = [
      ...mergeEntity.relationsFrom.map((r) => ({ ...r, direction: 'outgoing' as const })),
      ...mergeEntity.relationsTo.map((r) => ({ ...r, direction: 'incoming' as const })),
    ];

    // Collect all relations of kept entity for deduplication check
    const keepRelationKeys = new Set(
      [
        ...keepEntity.relationsFrom.map(
          (r) => `${r.fromEntityId}-${r.toEntityId}-${r.relationType}`
        ),
        ...keepEntity.relationsTo.map(
          (r) => `${r.fromEntityId}-${r.toEntityId}-${r.relationType}`
        ),
      ].map((key) => key.replace(keepEntity.id, mergeEntity.id))
    );

    for (const relation of mergeRelations) {
      // Check relation strength
      if (relation.strength < config.minStrengthThreshold) {
        duplicateRelations.push({
          id: relation.id,
          type: relation.relationType,
          reason: 'Relation strength below threshold',
        });
        continue;
      }

      // Check if self-referencing relation
      const otherEntityId =
        relation.direction === 'outgoing' ? relation.toEntityId : relation.fromEntityId;
      if (otherEntityId === keepEntity.id) {
        duplicateRelations.push({
          id: relation.id,
          type: relation.relationType,
          reason: 'Forms self-referencing relation with kept entity',
        });
        continue;
      }

      // Check if would cause duplicate relation
      if (config.skipExistingRelations) {
        const newKey =
          relation.direction === 'outgoing'
            ? `${keepEntity.id}-${relation.toEntityId}-${relation.relationType}`
            : `${relation.fromEntityId}-${keepEntity.id}-${relation.relationType}`;

        const existingKey = newKey.replace(keepEntity.id, mergeEntity.id);
        if (keepRelationKeys.has(existingKey)) {
          duplicateRelations.push({
            id: relation.id,
            type: relation.relationType,
            reason: 'Duplicates existing relation of kept entity',
          });
          continue;
        }
      }

      relationsToMigrate.push({
        id: relation.id,
        type: relation.relationType,
        fromEntityId: relation.fromEntityId,
        toEntityId: relation.toEntityId,
        direction: relation.direction,
      });
    }

    return { relationsToMigrate, duplicateRelations };
  }

  /**
   * Analyze alias merge
   *
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @returns Alias merge analysis result
   */
  private analyzeAliasMerge(
    keepEntity: Entity,
    mergeEntity: Entity
  ): MergePreview['aliasMerge'] {
    // Extract possible aliases from canonicalName and description
    const keepEntityAliases = this.extractAliases(keepEntity);
    const mergeEntityAliases = this.extractAliases(mergeEntity);

    // Merge aliases (deduplicate, preserve case)
    const mergedAliases: string[] = [];
    const seen = new Set<string>();
    for (const alias of [...keepEntityAliases, ...mergeEntityAliases]) {
      const lowerAlias = alias.toLowerCase();
      if (!seen.has(lowerAlias)) {
        seen.add(lowerAlias);
        mergedAliases.push(alias);
      }
    }

    // Find new aliases
    const newAliases = mergeEntityAliases.filter(
      (alias) => !keepEntityAliases.some((a) => a.toLowerCase() === alias.toLowerCase())
    );

    return {
      keepEntityAliases,
      mergeEntityAliases,
      mergedAliases,
      newAliases,
    };
  }

  /**
   * Analyze tag merge
   *
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @returns Tag merge analysis result
   */
  private async analyzeTagMerge(
    keepEntity: Entity,
    mergeEntity: Entity
  ): Promise<MergePreview['tagMerge']> {
    // Get entity tags
    const [keepEntityTags, mergeEntityTags] = await Promise.all([
      this.getEntityTags(keepEntity.id),
      this.getEntityTags(mergeEntity.id),
    ]);

    // Merge tags (deduplicate)
    const mergedTags: string[] = [];
    const seen = new Set<string>();
    for (const tag of [...keepEntityTags, ...mergeEntityTags]) {
      const lowerTag = tag.toLowerCase();
      if (!seen.has(lowerTag)) {
        seen.add(lowerTag);
        mergedTags.push(tag);
      }
    }

    // Find new tags
    const newTags = mergeEntityTags.filter((tag) => !keepEntityTags.includes(tag));

    return {
      keepEntityTags,
      mergeEntityTags,
      mergedTags,
      newTags,
    };
  }

  /**
   * Get tags associated with entity
   *
   * @param entityId - Entity ID
   * @returns List of tag names
   */
  private async getEntityTags(entityId: string): Promise<string[]> {
    const capsuleEntities = await prisma.capsuleEntity.findMany({
      where: { entityId },
      select: { capsuleId: true },
    });

    const capsuleIds = capsuleEntities.map((ce) => ce.capsuleId);

    if (capsuleIds.length === 0) {
      return [];
    }

    const capsuleTags = await prisma.capsuleTag.findMany({
      where: { capsuleId: { in: capsuleIds } },
      include: { tag: true },
    });

    const tagNames: string[] = [];
    const seen = new Set<string>();
    for (const ct of capsuleTags) {
      if (!seen.has(ct.tag.name)) {
        seen.add(ct.tag.name);
        tagNames.push(ct.tag.name);
      }
    }
    return tagNames;
  }

  /**
   * Check for circular merge
   *
   * Prevent circular merges like A -> B -> A
   *
   * @param tx - Prisma transaction client
   * @param sourceId - Source entity ID
   * @param targetId - Target entity ID
   * @returns Whether circular merge exists
   */
  private async checkMergeCycle(
    tx: Prisma.TransactionClient,
    sourceId: string,
    targetId: string
  ): Promise<boolean> {
    // Check if targetId is already a merge target of sourceId
    // i.e., check if targetId has already been merged into sourceId's chain
    let currentId: string | null = targetId;
    const visited = new Set<string>();

    while (currentId) {
      // Prevent infinite loop
      if (visited.has(currentId)) {
        return true; // Found cycle
      }
      visited.add(currentId);

      // If current entity is source entity, would form circular merge
      if (currentId === sourceId) {
        return true;
      }

      const entity = await tx.entity.findUnique({
        where: { id: currentId },
        select: { mergedIntoId: true },
      });

      currentId = entity?.mergedIntoId ?? null;
    }

    return false;
  }

  /**
   * Analyze reference updates
   *
   * @param mergeEntity - Entity to merge
   * @returns Reference update analysis result
   */
  private async analyzeReferenceUpdates(
    mergeEntity: EntityWithRelations
  ): Promise<MergePreview['referenceUpdates']> {
    const capsuleEntityCount = mergeEntity.capsuleEntities.length;

    // Check embedding records
    const embeddingCount = await prisma.embedding.count({
      where: { objectId: mergeEntity.id, objectType: 'ENTITY' },
    });

    return {
      capsuleEntityUpdates: capsuleEntityCount,
      embeddingUpdates: embeddingCount,
    };
  }

  /**
   * Create merge state snapshot
   *
   * @param tx - Prisma transaction client
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @returns State snapshot
   */
  private async createMergeSnapshot(
    tx: Prisma.TransactionClient,
    keepEntity: Entity,
    mergeEntity: EntityWithRelations
  ): Promise<JsonObject> {
    return {
      keepEntity: {
        id: keepEntity.id,
        canonicalName: keepEntity.canonicalName,
        normalizedName: keepEntity.normalizedName,
        type: keepEntity.type,
        description: keepEntity.description,
        aliases: keepEntity.aliases,
        status: keepEntity.status,
        mentionCount: keepEntity.mentionCount,
        firstSeenAt: keepEntity.firstSeenAt,
        lastSeenAt: keepEntity.lastSeenAt,
        confidenceScore: keepEntity.confidenceScore,
      },
      mergeEntity: {
        id: mergeEntity.id,
        canonicalName: mergeEntity.canonicalName,
        normalizedName: mergeEntity.normalizedName,
        type: mergeEntity.type,
        description: mergeEntity.description,
        aliases: mergeEntity.aliases,
        status: mergeEntity.status,
        mentionCount: mergeEntity.mentionCount,
        firstSeenAt: mergeEntity.firstSeenAt,
        lastSeenAt: mergeEntity.lastSeenAt,
        confidenceScore: mergeEntity.confidenceScore,
      },
      relations: [
        ...mergeEntity.relationsFrom.map((r) => ({
          id: r.id,
          fromEntityId: r.fromEntityId,
          toEntityId: r.toEntityId,
          relationType: r.relationType,
          strength: r.strength,
          createdBy: r.createdBy,
          firstSeenAt: r.firstSeenAt,
          lastSeenAt: r.lastSeenAt,
          mentionCount: r.mentionCount,
        })),
        ...mergeEntity.relationsTo.map((r) => ({
          id: r.id,
          fromEntityId: r.fromEntityId,
          toEntityId: r.toEntityId,
          relationType: r.relationType,
          strength: r.strength,
          createdBy: r.createdBy,
          firstSeenAt: r.firstSeenAt,
          lastSeenAt: r.lastSeenAt,
          mentionCount: r.mentionCount,
        })),
      ],
      capsuleEntities: mergeEntity.capsuleEntities.map((ce) => ({
        id: ce.id,
        capsuleId: ce.capsuleId,
        entityId: ce.entityId,
        role: ce.role,
        confidenceScore: ce.confidenceScore,
        createdAt: ce.createdAt,
      })),
    };
  }

  /**
   * Migrate relations
   *
   * @param tx - Prisma transaction client
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @param config - Migration configuration
   * @returns Migration result
   */
  private async migrateRelations(
    tx: Prisma.TransactionClient,
    keepEntity: EntityWithRelations,
    mergeEntity: EntityWithRelations,
    config: RelationMigrationConfig
  ): Promise<{
    migratedCount: number;
    skippedCount: number;
    migratedRelations: string[];
    skippedRelations: string[];
  }> {
    const migratedRelations: string[] = [];
    const skippedRelations: string[] = [];

    // Get preview analysis result
    const preview = await this.analyzeRelationMigration(keepEntity, mergeEntity, config);

    // Migrate outgoing relations
    for (const relation of mergeEntity.relationsFrom) {
      const previewItem = preview.relationsToMigrate.find((r) => r.id === relation.id);
      if (!previewItem) {
        skippedRelations.push(relation.id);
        continue;
      }

      // Check if would cause self-reference
      if (relation.toEntityId === keepEntity.id) {
        skippedRelations.push(relation.id);
        continue;
      }

      // Check if same relation already exists
      const existing = await tx.relation.findFirst({
        where: {
          fromEntityId: keepEntity.id,
          toEntityId: relation.toEntityId,
          relationType: relation.relationType,
        },
      });

      if (existing) {
        // Update strength of existing relation
        await tx.relation.update({
          where: { id: existing.id },
          data: {
            strength: Math.max(existing.strength, relation.strength),
            mentionCount: existing.mentionCount + relation.mentionCount,
            lastSeenAt: new Date(),
          },
        });
        // Delete old relation
        await tx.relation.delete({ where: { id: relation.id } });
      } else {
        // Update relation pointer
        await tx.relation.update({
          where: { id: relation.id },
          data: { fromEntityId: keepEntity.id },
        });
      }

      migratedRelations.push(relation.id);
    }

    // Migrate incoming relations
    for (const relation of mergeEntity.relationsTo) {
      const previewItem = preview.relationsToMigrate.find((r) => r.id === relation.id);
      if (!previewItem) {
        skippedRelations.push(relation.id);
        continue;
      }

      // Check if would cause self-reference
      if (relation.fromEntityId === keepEntity.id) {
        skippedRelations.push(relation.id);
        continue;
      }

      // Check if same relation already exists
      const existing = await tx.relation.findFirst({
        where: {
          fromEntityId: relation.fromEntityId,
          toEntityId: keepEntity.id,
          relationType: relation.relationType,
        },
      });

      if (existing) {
        // Update strength of existing relation
        await tx.relation.update({
          where: { id: existing.id },
          data: {
            strength: Math.max(existing.strength, relation.strength),
            mentionCount: existing.mentionCount + relation.mentionCount,
            lastSeenAt: new Date(),
          },
        });
        // Delete old relation
        await tx.relation.delete({ where: { id: relation.id } });
      } else {
        // Update relation pointer
        await tx.relation.update({
          where: { id: relation.id },
          data: { toEntityId: keepEntity.id },
        });
      }

      migratedRelations.push(relation.id);
    }

    return {
      migratedCount: migratedRelations.length,
      skippedCount: skippedRelations.length,
      migratedRelations,
      skippedRelations,
    };
  }

  /**
   * Merge aliases
   *
   * @param tx - Prisma transaction client
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @returns Merged alias list
   */
  private async mergeAliases(
    tx: Prisma.TransactionClient,
    keepEntity: Entity,
    mergeEntity: Entity
  ): Promise<string[]> {
    // Extract all aliases from both entities
    const keepAliases = this.extractAliases(keepEntity);
    const mergeAliases = this.extractAliases(mergeEntity);

    // Merge and deduplicate (preserve case)
    const mergedAliases = new Set<string>([...keepAliases, ...mergeAliases]);

    // Find new aliases
    const newAliases = mergeAliases.filter(
      (alias) => !keepAliases.some((a) => a.toLowerCase() === alias.toLowerCase())
    );

    // Update alias list of kept entity
    if (mergedAliases.size > 0) {
      await tx.entity.update({
        where: { id: keepEntity.id },
        data: {
          aliases: Array.from(mergedAliases),
        },
      });
    }

    // Also update description to include merged alias information (backward compatibility)
    if (newAliases.length > 0) {
      const aliasNote = `Also known as: ${newAliases.join(', ')}`;
      const newDescription = keepEntity.description
        ? `${keepEntity.description}\n${aliasNote}`
        : aliasNote;

      await tx.entity.update({
        where: { id: keepEntity.id },
        data: { description: newDescription },
      });
    }

    return Array.from(mergedAliases);
  }

  /**
   * Extract aliases from entity
   *
   * Prioritize using aliases field from database, if not present extract from description
   *
   * @param entity - Entity
   * @returns List of aliases
   */
  private extractAliases(entity: Entity): string[] {
    const aliases = new Set<string>();

    // Add canonical name
    aliases.add(entity.canonicalName);

    // Prioritize using aliases field from database
    if (entity.aliases && Array.isArray(entity.aliases)) {
      entity.aliases.forEach((alias) => aliases.add(alias));
    }

    // Extract aliases from description (backward compatibility)
    if (entity.description) {
      const akaMatch = entity.description.match(/also known as["']?([^\n]+)/i);
      if (akaMatch) {
        const akaList = akaMatch[1]
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        akaList.forEach((alias) => aliases.add(alias));
      }
    }

    return Array.from(aliases);
  }

  /**
   * Merge tags
   *
   * @param tx - Prisma transaction client
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @returns Merged tag list
   */
  private async mergeTags(
    tx: Prisma.TransactionClient,
    keepEntity: Entity,
    mergeEntity: Entity
  ): Promise<string[]> {
    // Get capsule associations of merged entity
    const mergeCapsuleEntities = await tx.capsuleEntity.findMany({
      where: { entityId: mergeEntity.id },
      select: { capsuleId: true },
    });

    const mergeCapsuleIds = mergeCapsuleEntities.map((ce) => ce.capsuleId);

    if (mergeCapsuleIds.length === 0) {
      return [];
    }

    // Get tags of these capsules
    const capsuleTags = await tx.capsuleTag.findMany({
      where: { capsuleId: { in: mergeCapsuleIds } },
      include: { tag: true },
    });

    // Get capsule IDs already associated with kept entity
    const keepCapsuleEntities = await tx.capsuleEntity.findMany({
      where: { entityId: keepEntity.id },
      select: { capsuleId: true },
    });

    const keepCapsuleIds = new Set(keepCapsuleEntities.map((ce) => ce.capsuleId));

    // Find capsules needing tags (those not associated with kept entity)
    const capsulesNeedingTags = mergeCapsuleIds.filter(
      (id) => !keepCapsuleIds.has(id)
    );

    // Collect tag names
    const tagNames: string[] = [];
    const seen = new Set<string>();
    for (const ct of capsuleTags) {
      if (!seen.has(ct.tag.name)) {
        seen.add(ct.tag.name);
        tagNames.push(ct.tag.name);
      }
    }

    // Add tags to these capsules
    for (const capsuleId of capsulesNeedingTags) {
      for (const tagName of tagNames) {
        // Find or create tag
        let tag = await tx.tag.findUnique({
          where: { name: tagName },
        });

        if (!tag) {
          tag = await tx.tag.create({
            data: { name: tagName },
          });
        }

        // Check if association already exists
        const existing = await tx.capsuleTag.findFirst({
          where: {
            capsuleId,
            tagId: tag.id,
          },
        });

        if (!existing) {
          await tx.capsuleTag.create({
            data: {
              capsuleId,
              tagId: tag.id,
            },
          });
        }
      }
    }

    return tagNames;
  }

  /**
   * Update references
   *
   * @param tx - Prisma transaction client
   * @param keepEntity - Entity to keep
   * @param mergeEntity - Entity to merge
   * @returns Update result
   */
  private async updateReferences(
    tx: Prisma.TransactionClient,
    keepEntity: Entity,
    mergeEntity: Entity
  ): Promise<{ capsuleEntityCount: number; embeddingCount: number }> {
    // Update CapsuleEntity associations
    const capsuleEntityResult = await tx.capsuleEntity.updateMany({
      where: { entityId: mergeEntity.id },
      data: { entityId: keepEntity.id },
    });

    // Update Embedding records
    const embeddingResult = await tx.embedding.updateMany({
      where: { objectId: mergeEntity.id, objectType: 'ENTITY' },
      data: { objectId: keepEntity.id },
    });

    return {
      capsuleEntityCount: capsuleEntityResult.count,
      embeddingCount: embeddingResult.count,
    };
  }

  /**
   * Merge descriptions
   *
   * @param descA - Description A
   * @param descB - Description B
   * @returns Merged description
   */
  private mergeDescriptions(descA: string | null, descB: string | null): string | undefined {
    if (!descA && !descB) {
      return undefined;
    }
    if (!descA) {
      return descB || undefined;
    }
    if (!descB) {
      return descA;
    }

    // If descriptions are the same, return one of them
    if (descA === descB) {
      return descA;
    }

    // Merge descriptions (separated by newline)
    return `${descA}\n\n(Merged from another entity: ${descB})`;
  }

  /**
   * Record merge operation log
   *
   * @param tx - Prisma transaction client
   * @param entry - Log entry
   */
  private async logMergeOperation(
    tx: Prisma.TransactionClient,
    entry: Omit<MergeLogEntry, 'id' | 'createdAt'>
  ): Promise<void> {
    // Persist log to MergeLog table
    await tx.mergeLog.create({
      data: {
        operation: entry.operation as 'PREVIEW' | 'MERGE' | 'ROLLBACK',
        keepEntityId: entry.keepEntityId,
        mergeEntityId: entry.mergeEntityId,
        taskId: entry.taskId,
        userId: entry.userId,
        snapshot: (entry.snapshot || {}) as unknown as Prisma.InputJsonValue,
        details: (entry.details || {}) as unknown as Prisma.InputJsonValue,
        success: entry.success ?? true,
        errorMessage: entry.errorMessage,
      },
    });

    // Also output to console for debugging
    console.log('[MergeLog]', {
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Default entity merge service instance
 */
export const mergeService = new MergeService();
