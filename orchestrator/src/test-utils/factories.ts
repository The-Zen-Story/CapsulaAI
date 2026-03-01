// test-utils/factories.ts
/**
 * 测试数据工厂函数
 * 用于创建测试用的实体、任务等数据
 */

import {
  MaintenanceTask,
  MaintenanceType,
  MaintenanceStatus,
  ReviewerType,
  Entity,
  Relation,
  Tag,
  Capsule,
  CapsuleEntity,
  CapsuleTag,
} from '@prisma/client';

// ==================== 维护任务工厂 ====================

export interface CreateTaskOptions {
  id?: string;
  userId?: string;
  taskType?: MaintenanceType;
  description?: string;
  status?: MaintenanceStatus;
  confidence?: number;
  sourceEntityId?: string;
  targetEntityId?: string;
  relationId?: string;
  changes?: Record<string, unknown>;
  reviewedAt?: Date;
  reviewedBy?: ReviewerType;
  reviewComment?: string;
  appliedAt?: Date;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createMockTask(options: CreateTaskOptions = {}): MaintenanceTask {
  const now = new Date();
  return {
    id: options.id || `task_${Math.random().toString(36).substring(2, 11)}`,
    userId: options.userId || 'user_test',
    taskType: options.taskType || MaintenanceType.ENTITY_MERGE,
    description: options.description || '测试任务描述',
    status: options.status || MaintenanceStatus.AWAITING_USER_REVIEW,
    confidence: options.confidence ?? 0.85,
    sourceEntityId: options.sourceEntityId || null,
    targetEntityId: options.targetEntityId || null,
    relationId: options.relationId || null,
    changes: options.changes || {},
    reviewedAt: options.reviewedAt || null,
    reviewedBy: options.reviewedBy || null,
    reviewComment: options.reviewComment || null,
    appliedAt: options.appliedAt || null,
    errorMessage: options.errorMessage || null,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
  };
}

export function createMockTasks(count: number, options: CreateTaskOptions = {}): MaintenanceTask[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({
      ...options,
      id: options.id || `task_${i}_${Math.random().toString(36).substring(2, 7)}`,
    })
  );
}

// ==================== 实体工厂 ====================

export interface CreateEntityOptions {
  id?: string;
  canonicalName?: string;
  normalizedName?: string;
  type?: string;
  description?: string | null;
  aliases?: string[];
  status?: string;
  mentionCount?: number;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  confidenceScore?: number;
  mergedIntoId?: string | null;
}

export function createMockEntity(options: CreateEntityOptions = {}): Entity {
  const now = new Date();
  const name = options.canonicalName || `Entity ${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: options.id || `entity_${Math.random().toString(36).substring(2, 11)}`,
    canonicalName: name,
    normalizedName: options.normalizedName || name.toLowerCase().replace(/\s+/g, '_'),
    type: options.type || 'PERSON',
    description: options.description ?? null,
    aliases: options.aliases || [],
    status: options.status || 'ACTIVE',
    mentionCount: options.mentionCount ?? 1,
    firstSeenAt: options.firstSeenAt || now,
    lastSeenAt: options.lastSeenAt || now,
    confidenceScore: options.confidenceScore ?? 1.0,
    mergedIntoId: options.mergedIntoId ?? null,
  };
}

export function createMockEntities(count: number, options: CreateEntityOptions = {}): Entity[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEntity({
      ...options,
      id: options.id || `entity_${i}`,
      canonicalName: options.canonicalName || `Entity ${i}`,
    })
  );
}

// ==================== 关系工厂 ====================

export interface CreateRelationOptions {
  id?: string;
  fromEntityId?: string;
  toEntityId?: string;
  relationType?: string;
  strength?: number;
  createdBy?: string;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  mentionCount?: number;
}

export function createMockRelation(options: CreateRelationOptions = {}): Relation {
  const now = new Date();
  return {
    id: options.id || `relation_${Math.random().toString(36).substring(2, 11)}`,
    fromEntityId: options.fromEntityId || 'entity_1',
    toEntityId: options.toEntityId || 'entity_2',
    relationType: options.relationType || 'RELATED_TO',
    strength: options.strength ?? 1.0,
    createdBy: options.createdBy || 'system',
    firstSeenAt: options.firstSeenAt || now,
    lastSeenAt: options.lastSeenAt || now,
    mentionCount: options.mentionCount ?? 1,
  };
}

// ==================== 标签工厂 ====================

export interface CreateTagOptions {
  id?: string;
  name?: string;
}

export function createMockTag(options: CreateTagOptions = {}): Tag {
  return {
    id: options.id || `tag_${Math.random().toString(36).substring(2, 11)}`,
    name: options.name || `Tag ${Math.random().toString(36).substring(2, 7)}`,
  };
}

// ==================== 胶囊工厂 ====================

export interface CreateCapsuleOptions {
  id?: string;
  userId?: string;
  content?: string;
  source?: string | null;
  sourceUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createMockCapsule(options: CreateCapsuleOptions = {}): Capsule {
  const now = new Date();
  return {
    id: options.id || `capsule_${Math.random().toString(36).substring(2, 11)}`,
    userId: options.userId || 'user_test',
    content: options.content || 'Test capsule content',
    source: options.source ?? null,
    sourceUrl: options.sourceUrl ?? null,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
  };
}

// ==================== CapsuleEntity 工厂 ====================

export interface CreateCapsuleEntityOptions {
  id?: string;
  capsuleId?: string;
  entityId?: string;
  role?: string | null;
  confidenceScore?: number;
  createdAt?: Date;
}

export function createMockCapsuleEntity(options: CreateCapsuleEntityOptions = {}): CapsuleEntity {
  return {
    id: options.id || `ce_${Math.random().toString(36).substring(2, 11)}`,
    capsuleId: options.capsuleId || 'capsule_1',
    entityId: options.entityId || 'entity_1',
    role: options.role ?? null,
    confidenceScore: options.confidenceScore ?? 1.0,
    createdAt: options.createdAt || new Date(),
  };
}

// ==================== CapsuleTag 工厂 ====================

export interface CreateCapsuleTagOptions {
  id?: string;
  capsuleId?: string;
  tagId?: string;
}

export function createMockCapsuleTag(options: CreateCapsuleTagOptions = {}): CapsuleTag {
  return {
    id: options.id || `ct_${Math.random().toString(36).substring(2, 11)}`,
    capsuleId: options.capsuleId || 'capsule_1',
    tagId: options.tagId || 'tag_1',
  };
}

// ==================== 测试场景数据 ====================

/**
 * 创建完整的实体合并测试场景
 */
export function createEntityMergeScenario() {
  const sourceEntity = createMockEntity({
    id: 'entity_source',
    canonicalName: 'John Doe',
    mentionCount: 5,
    aliases: ['John', 'JD'],
  });

  const targetEntity = createMockEntity({
    id: 'entity_target',
    canonicalName: 'John D.',
    mentionCount: 3,
    aliases: ['Johnny'],
  });

  const task = createMockTask({
    id: 'task_merge_1',
    taskType: MaintenanceType.ENTITY_MERGE,
    sourceEntityId: sourceEntity.id,
    targetEntityId: targetEntity.id,
    status: MaintenanceStatus.APPROVED,
    confidence: 0.92,
    description: `合并实体 "${sourceEntity.canonicalName}" 和 "${targetEntity.canonicalName}"`,
  });

  return { sourceEntity, targetEntity, task };
}

/**
 * 创建关系发现测试场景
 */
export function createRelationDiscoveryScenario() {
  const entityA = createMockEntity({
    id: 'entity_a',
    canonicalName: 'React',
  });

  const entityB = createMockEntity({
    id: 'entity_b',
    canonicalName: 'JavaScript',
  });

  const task = createMockTask({
    id: 'task_relation_1',
    taskType: MaintenanceType.RELATION_DISCOVERY,
    sourceEntityId: entityA.id,
    targetEntityId: entityB.id,
    status: MaintenanceStatus.AUTO_APPROVED,
    confidence: 0.88,
    description: `在 "${entityA.canonicalName}" 和 "${entityB.canonicalName}" 之间创建关系`,
  });

  return { entityA, entityB, task };
}

/**
 * 创建过时实体检测测试场景
 */
export function createStaleDetectionScenario() {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 100);

  const entity = createMockEntity({
    id: 'entity_stale',
    canonicalName: 'Old Technology',
    lastSeenAt: staleDate,
  });

  const task = createMockTask({
    id: 'task_stale_1',
    taskType: MaintenanceType.STALE_DETECTION,
    sourceEntityId: entity.id,
    status: MaintenanceStatus.AWAITING_USER_REVIEW,
    confidence: 0.7,
    description: `实体 "${entity.canonicalName}" 已 100 天未被提及`,
  });

  return { entity, task };
}

/**
 * 创建孤立实体清理测试场景
 */
export function createOrphanCleanupScenario() {
  const entity = createMockEntity({
    id: 'entity_orphan',
    canonicalName: 'Isolated Entity',
  });

  const task = createMockTask({
    id: 'task_orphan_1',
    taskType: MaintenanceType.ORPHAN_CLEANUP,
    sourceEntityId: entity.id,
    status: MaintenanceStatus.AWAITING_USER_REVIEW,
    confidence: 0.6,
    description: `实体 "${entity.canonicalName}" 没有任何关系`,
  });

  return { entity, task };
}
