import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient, MaintenanceType, MaintenanceStatus, ReviewerType } from '@prisma/client';

// Mock prisma before importing services
jest.mock('../../lib/prisma', () => ({
  prisma: jest.requireActual('../../test-utils/mockPrisma').prismaMock,
}));

import { maintenanceService, CreateTaskInput } from '../maintenance.service';
import { prisma } from '../../lib/prisma';
import {
  createMockTask,
  createMockEntity,
  createMockTasks,
  createEntityMergeScenario,
  createRelationDiscoveryScenario,
} from '../../test-utils/factories';

const prismaMock = prisma as unknown as PrismaClient;

describe('MaintenanceService E2E Tests', () => {
  const userId = 'user_test';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('完整工作流测试: 创建任务 → 批准 → 执行 → 回滚', () => {
    it('应该完成完整的任务生命周期', async () => {
      // 1. 创建任务
      const taskInput: CreateTaskInput = {
        taskType: MaintenanceType.ENTITY_MERGE,
        description: '测试实体合并任务',
        confidence: 0.85,
        sourceEntityId: 'entity_1',
        targetEntityId: 'entity_2',
      };

      const createdTask = createMockTask({
        id: 'task_full_workflow',
        ...taskInput,
        userId,
        status: MaintenanceStatus.AWAITING_USER_REVIEW,
      });

      (prismaMock.maintenanceTask.create as jest.Mock).mockResolvedValue(createdTask);

      const task = await maintenanceService.createTask(userId, taskInput);
      expect(task.status).toBe(MaintenanceStatus.AWAITING_USER_REVIEW);

      // 2. 批准任务
      const approvedTask = { ...createdTask, status: MaintenanceStatus.APPROVED };
      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(createdTask);
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(approvedTask);

      const approved = await maintenanceService.approveTask(userId, task.id);
      expect(approved.status).toBe(MaintenanceStatus.APPROVED);

      // 3. 执行任务
      const appliedTask = { ...approvedTask, status: MaintenanceStatus.APPLIED };
      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(approvedTask);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback(prismaMock);
      });
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(appliedTask);

      // Mock entity operations
      (prismaMock.entity.findUnique as jest.Mock).mockResolvedValue(createMockEntity({ id: 'entity_1' }));
      (prismaMock.entity.update as jest.Mock).mockResolvedValue(createMockEntity({ id: 'entity_1' }));
      (prismaMock.entity.delete as jest.Mock).mockResolvedValue(createMockEntity({ id: 'entity_2' }));
      (prismaMock.relation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaMock.capsuleEntity.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(MaintenanceStatus.APPLIED);

      // 4. 回滚任务
      const revertedTask = { ...appliedTask, status: MaintenanceStatus.REVERTED };
      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(appliedTask);
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(revertedTask);

      const revertResult = await maintenanceService.revertTask(userId, task.id);
      expect(revertResult.success).toBe(true);
      expect(revertResult.task?.status).toBe(MaintenanceStatus.REVERTED);
    });

    it('应该自动批准高置信度任务', async () => {
      const taskInput: CreateTaskInput = {
        taskType: MaintenanceType.ENTITY_MERGE,
        description: '高置信度自动批准任务',
        confidence: 0.96, // >= 0.95 自动批准
        sourceEntityId: 'entity_1',
        targetEntityId: 'entity_2',
      };

      const autoApprovedTask = createMockTask({
        id: 'task_auto_approved',
        ...taskInput,
        userId,
        status: MaintenanceStatus.AUTO_APPROVED,
        reviewedBy: ReviewerType.SYSTEM,
        reviewedAt: new Date(),
      });

      (prismaMock.maintenanceTask.create as jest.Mock).mockResolvedValue(autoApprovedTask);

      const task = await maintenanceService.createTask(userId, taskInput);
      expect(task.status).toBe(MaintenanceStatus.AUTO_APPROVED);
      expect(task.reviewedBy).toBe(ReviewerType.SYSTEM);
    });
  });

  describe('实体合并端到端测试', () => {
    it('应该成功合并两个实体', async () => {
      const { sourceEntity, targetEntity, task } = createEntityMergeScenario();

      // Mock entity lookups
      (prismaMock.entity.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === sourceEntity.id) return Promise.resolve(sourceEntity);
        if (args.where.id === targetEntity.id) return Promise.resolve(targetEntity);
        return Promise.resolve(null);
      });

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback(prismaMock);
      });

      const appliedTask = { ...task, status: MaintenanceStatus.APPLIED };
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(appliedTask);

      (prismaMock.entity.update as jest.Mock).mockResolvedValue(sourceEntity);
      (prismaMock.entity.delete as jest.Mock).mockResolvedValue(targetEntity);
      (prismaMock.relation.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaMock.capsuleEntity.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(true);
      expect(prismaMock.entity.delete).toHaveBeenCalled();
      expect(prismaMock.relation.updateMany).toHaveBeenCalled();
      expect(prismaMock.capsuleEntity.updateMany).toHaveBeenCalled();
    });

    it('应该处理实体不存在的情况', async () => {
      const task = createMockTask({
        id: 'task_nonexistent',
        taskType: MaintenanceType.ENTITY_MERGE,
        sourceEntityId: 'nonexistent_1',
        targetEntityId: 'nonexistent_2',
        status: MaintenanceStatus.APPROVED,
      });

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);
      (prismaMock.entity.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback(prismaMock);
      });

      const failedTask = { ...task, status: MaintenanceStatus.FAILED };
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(failedTask);

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('实体不存在');
    });
  });

  describe('关系发现端到端测试', () => {
    it('应该成功创建新关系', async () => {
      const { entityA, entityB, task } = createRelationDiscoveryScenario();

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback(prismaMock);
      });

      (prismaMock.relation.findFirst as jest.Mock).mockResolvedValue(null); // 关系不存在
      (prismaMock.relation.create as jest.Mock).mockResolvedValue({
        id: 'relation_new',
        fromEntityId: entityA.id,
        toEntityId: entityB.id,
        relationType: 'RELATED_TO',
        strength: task.confidence,
        createdBy: 'system',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        mentionCount: 1,
      });

      const appliedTask = { ...task, status: MaintenanceStatus.APPLIED };
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(appliedTask);

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(true);
      expect(prismaMock.relation.create).toHaveBeenCalled();
    });

    it('应该处理已存在的关系', async () => {
      const { entityA, entityB, task } = createRelationDiscoveryScenario();

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback(prismaMock);
      });

      // 关系已存在
      (prismaMock.relation.findFirst as jest.Mock).mockResolvedValue({
        id: 'relation_existing',
        fromEntityId: entityA.id,
        toEntityId: entityB.id,
        relationType: 'RELATED_TO',
        strength: 0.9,
        createdBy: 'system',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        mentionCount: 1,
      });

      const failedTask = { ...task, status: MaintenanceStatus.FAILED };
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(failedTask);

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('关系已存在');
    });
  });

  describe('错误恢复测试', () => {
    it('应该在执行失败时记录错误信息', async () => {
      const task = createMockTask({
        id: 'task_error',
        taskType: MaintenanceType.ENTITY_MERGE,
        status: MaintenanceStatus.APPROVED,
      });

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
        throw new Error('数据库连接失败');
      });

      const failedTask = {
        ...task,
        status: MaintenanceStatus.FAILED,
        errorMessage: '数据库连接失败',
      };
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(failedTask);

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('数据库连接失败');
    });

    it('应该处理状态转换错误', async () => {
      const task = createMockTask({
        id: 'task_wrong_state',
        taskType: MaintenanceType.ENTITY_MERGE,
        status: MaintenanceStatus.REJECTED, // 错误的状态
      });

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('无法执行状态为');
    });

    it('应该处理回滚时的快照缺失', async () => {
      const task = createMockTask({
        id: 'task_no_snapshot',
        taskType: MaintenanceType.ENTITY_MERGE,
        status: MaintenanceStatus.APPLIED,
        changes: {}, // 没有快照
      });

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);

      const result = await maintenanceService.revertTask(userId, task.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('找不到任务执行前的状态快照');
    });

    it('应该处理事务回滚', async () => {
      const { sourceEntity, targetEntity, task } = createEntityMergeScenario();

      (prismaMock.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(task);
      (prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
        throw new Error('事务执行失败');
      });

      const failedTask = {
        ...task,
        status: MaintenanceStatus.FAILED,
        errorMessage: '事务执行失败',
      };
      (prismaMock.maintenanceTask.update as jest.Mock).mockResolvedValue(failedTask);

      const result = await maintenanceService.applyTask(userId, task.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('事务执行失败');
    });
  });

  describe('批量操作测试', () => {
    it('应该批量创建任务', async () => {
      const inputs: CreateTaskInput[] = [
        {
          taskType: MaintenanceType.ENTITY_MERGE,
          description: '任务1',
          confidence: 0.9,
        },
        {
          taskType: MaintenanceType.RELATION_DISCOVERY,
          description: '任务2',
          confidence: 0.8,
        },
      ];

      const createdTasks = inputs.map((input, i) =>
        createMockTask({
          id: `task_batch_${i}`,
          ...input,
          userId,
        })
      );

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback(prismaMock);
      });

      (prismaMock.maintenanceTask.create as jest.Mock)
        .mockResolvedValueOnce(createdTasks[0])
        .mockResolvedValueOnce(createdTasks[1]);

      const tasks = await maintenanceService.createTasks(userId, inputs);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].taskType).toBe(MaintenanceType.ENTITY_MERGE);
      expect(tasks[1].taskType).toBe(MaintenanceType.RELATION_DISCOVERY);
    });

    it('应该处理批量创建中的失败', async () => {
      const inputs: CreateTaskInput[] = [
        {
          taskType: MaintenanceType.ENTITY_MERGE,
          description: '任务1',
          confidence: 0.9,
        },
        {
          taskType: MaintenanceType.RELATION_DISCOVERY,
          description: '任务2',
          confidence: 0.8,
        },
      ];

      (prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
        throw new Error('批量创建失败');
      });

      await expect(maintenanceService.createTasks(userId, inputs)).rejects.toThrow('批量创建失败');
    });
  });

  describe('健康报告测试', () => {
    it('应该生成健康报告', async () => {
      (prismaMock.entity.count as jest.Mock).mockResolvedValue(100);
      (prismaMock.relation.count as jest.Mock).mockResolvedValue(50);
      (prismaMock.maintenanceTask.count as jest.Mock).mockResolvedValue(10);

      const report = await maintenanceService.getHealthReport(userId);

      expect(report.totalEntities).toBe(100);
      expect(report.totalRelations).toBe(50);
      expect(report.potentialDuplicates).toBe(10);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });
  });
});
