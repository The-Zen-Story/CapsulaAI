import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PrismaClient, MaintenanceType, MaintenanceStatus, ReviewerType } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';

// Mock prisma before importing routes
jest.mock('../../lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import maintenanceRouter from '../maintenance';
import { prisma } from '../../lib/prisma';
import {
  createMockTask,
  createMockEntity,
  createMockTasks,
} from '../../test-utils/factories';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // 添加模拟的用户认证中间件
  app.use((req, res, next) => {
    req.user = { id: 'user_test' };
    next();
  });
  
  app.use('/api/maintenance', maintenanceRouter);
  return app;
};

describe('Maintenance API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    mockReset(prismaMock);
  });

  describe('健康检查 API 测试', () => {
    it('GET /api/maintenance/health - 应该返回健康报告', async () => {
      prismaMock.entity.count.mockResolvedValue(100);
      prismaMock.relation.count.mockResolvedValue(50);
      prismaMock.maintenanceTask.count.mockResolvedValue(10);

      const response = await request(app)
        .get('/api/maintenance/health')
        .set('x-user-id', 'user_test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('totalEntities');
      expect(response.body.data).toHaveProperty('totalRelations');
    });

    it('GET /api/maintenance/health - 应该处理未授权请求', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/maintenance', maintenanceRouter);

      const response = await request(appWithoutAuth)
        .get('/api/maintenance/health');

      expect(response.status).toBe(500);
    });
  });

  describe('维护任务 API 测试', () => {
    describe('GET /api/maintenance/tasks', () => {
      it('应该返回任务列表', async () => {
        const tasks = createMockTasks(3, { userId: 'user_test' });
        
        prismaMock.maintenanceTask.findMany.mockResolvedValue(tasks);
        prismaMock.maintenanceTask.count.mockResolvedValue(3);

        const response = await request(app)
          .get('/api/maintenance/tasks')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.meta.pagination.total).toBe(3);
      });

      it('应该支持状态筛选', async () => {
        const pendingTasks = createMockTasks(2, {
          userId: 'user_test',
          status: MaintenanceStatus.AWAITING_USER_REVIEW,
        });

        prismaMock.maintenanceTask.findMany.mockResolvedValue(pendingTasks);
        prismaMock.maintenanceTask.count.mockResolvedValue(2);

        const response = await request(app)
          .get('/api/maintenance/tasks?status=AWAITING_USER_REVIEW')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });

      it('应该支持类型筛选', async () => {
        const mergeTasks = createMockTasks(2, {
          userId: 'user_test',
          taskType: MaintenanceType.ENTITY_MERGE,
        });

        prismaMock.maintenanceTask.findMany.mockResolvedValue(mergeTasks);
        prismaMock.maintenanceTask.count.mockResolvedValue(2);

        const response = await request(app)
          .get('/api/maintenance/tasks?taskType=ENTITY_MERGE')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.data[0].taskType).toBe('ENTITY_MERGE');
      });

      it('应该支持分页', async () => {
        const tasks = createMockTasks(10, { userId: 'user_test' });

        prismaMock.maintenanceTask.findMany.mockResolvedValue(tasks.slice(0, 5));
        prismaMock.maintenanceTask.count.mockResolvedValue(10);

        const response = await request(app)
          .get('/api/maintenance/tasks?limit=5&offset=0')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(10);
        expect(response.body.meta.pagination.limit).toBe(5);
        expect(response.body.meta.pagination.offset).toBe(0);
      });

      it('应该处理无效的分页参数', async () => {
        const response = await request(app)
          .get('/api/maintenance/tasks?limit=invalid&offset=-1')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('GET /api/maintenance/tasks/:id', () => {
      it('应该返回单个任务详情', async () => {
        const task = createMockTask({ id: 'task_1', userId: 'user_test' });

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);

        const response = await request(app)
          .get('/api/maintenance/tasks/task_1')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('task_1');
      });

      it('应该处理不存在的任务', async () => {
        prismaMock.maintenanceTask.findFirst.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/maintenance/tasks/nonexistent')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('POST /api/maintenance/tasks', () => {
      it('应该创建新任务', async () => {
        const newTask = createMockTask({
          id: 'new_task',
          userId: 'user_test',
          taskType: MaintenanceType.ENTITY_MERGE,
          description: '新任务',
          confidence: 0.9,
        });

        prismaMock.maintenanceTask.create.mockResolvedValue(newTask);

        const response = await request(app)
          .post('/api/maintenance/tasks')
          .set('x-user-id', 'user_test')
          .send({
            taskType: 'ENTITY_MERGE',
            description: '新任务',
            confidence: 0.9,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.description).toBe('新任务');
      });

      it('应该验证必填字段', async () => {
        const response = await request(app)
          .post('/api/maintenance/tasks')
          .set('x-user-id', 'user_test')
          .send({
            // 缺少必填字段
            description: '不完整任务',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('应该验证置信度范围', async () => {
        const response = await request(app)
          .post('/api/maintenance/tasks')
          .set('x-user-id', 'user_test')
          .send({
            taskType: 'ENTITY_MERGE',
            description: '任务',
            confidence: 1.5, // 超出范围
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('应该验证任务类型', async () => {
        const response = await request(app)
          .post('/api/maintenance/tasks')
          .set('x-user-id', 'user_test')
          .send({
            taskType: 'INVALID_TYPE',
            description: '任务',
            confidence: 0.9,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/maintenance/tasks/:id/apply', () => {
      it('应该执行任务', async () => {
        const task = createMockTask({
          id: 'task_apply',
          userId: 'user_test',
          status: MaintenanceStatus.APPROVED,
          taskType: MaintenanceType.RELATION_DISCOVERY,
          sourceEntityId: 'entity_1',
          targetEntityId: 'entity_2',
        });

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return callback(prismaMock);
        });
        prismaMock.relation.findFirst.mockResolvedValue(null);
        prismaMock.relation.create.mockResolvedValue({
          id: 'relation_new',
          fromEntityId: 'entity_1',
          toEntityId: 'entity_2',
          relationType: 'RELATED_TO',
          strength: 0.9,
          createdBy: 'system',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          mentionCount: 1,
        });

        const appliedTask = { ...task, status: MaintenanceStatus.APPLIED };
        prismaMock.maintenanceTask.update.mockResolvedValue(appliedTask);

        const response = await request(app)
          .post('/api/maintenance/tasks/task_apply/apply')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('应该处理执行失败', async () => {
        const task = createMockTask({
          id: 'task_fail',
          userId: 'user_test',
          status: MaintenanceStatus.APPROVED,
          taskType: MaintenanceType.ENTITY_MERGE,
        });

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);
        prismaMock.$transaction.mockImplementation(async () => {
          throw new Error('执行失败');
        });

        const failedTask = { ...task, status: MaintenanceStatus.FAILED };
        prismaMock.maintenanceTask.update.mockResolvedValue(failedTask);

        const response = await request(app)
          .post('/api/maintenance/tasks/task_fail/apply')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/maintenance/tasks/:id/revert', () => {
      it('应该回滚已应用的任务', async () => {
        const task = createMockTask({
          id: 'task_revert',
          userId: 'user_test',
          status: MaintenanceStatus.APPLIED,
          taskType: MaintenanceType.RELATION_DISCOVERY,
          changes: {
            _snapshot: {
              entity: { id: 'entity_1' },
            },
          },
        });

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return callback(prismaMock);
        });

        const revertedTask = { ...task, status: MaintenanceStatus.REVERTED };
        prismaMock.maintenanceTask.update.mockResolvedValue(revertedTask);
        prismaMock.relation.deleteMany.mockResolvedValue({ count: 1 });

        const response = await request(app)
          .post('/api/maintenance/tasks/task_revert/revert')
          .set('x-user-id', 'user_test')
          .send({ comment: '测试回滚' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/maintenance/scan', () => {
      it('应该运行完整扫描', async () => {
        prismaMock.entity.findMany.mockResolvedValue([]);
        prismaMock.$queryRaw.mockResolvedValue([]);

        const response = await request(app)
          .post('/api/maintenance/scan')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('duplicates');
        expect(response.body.data).toHaveProperty('relations');
        expect(response.body.data).toHaveProperty('stale');
        expect(response.body.data).toHaveProperty('orphans');
      });
    });

    describe('GET /api/maintenance/stats', () => {
      it('应该返回统计信息', async () => {
        const tasks = createMockTasks(10, { userId: 'user_test' });

        prismaMock.maintenanceTask.findMany.mockResolvedValue(tasks);

        const response = await request(app)
          .get('/api/maintenance/stats')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalTasks');
        expect(response.body.data).toHaveProperty('pendingTasks');
        expect(response.body.data).toHaveProperty('approvedTasks');
        expect(response.body.data).toHaveProperty('appliedTasks');
        expect(response.body.data).toHaveProperty('rejectedTasks');
      });
    });
  });

  describe('审查 API 测试', () => {
    describe('POST /api/maintenance/tasks/:id/approve', () => {
      it('应该批准待审核任务', async () => {
        const task = createMockTask({
          id: 'task_approve',
          userId: 'user_test',
          status: MaintenanceStatus.AWAITING_USER_REVIEW,
        });

        const approvedTask = { ...task, status: MaintenanceStatus.APPROVED };

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);
        prismaMock.maintenanceTask.update.mockResolvedValue(approvedTask);

        const response = await request(app)
          .post('/api/maintenance/tasks/task_approve/approve')
          .set('x-user-id', 'user_test')
          .send({ comment: '批准此任务' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('APPROVED');
      });

      it('应该处理不存在的任务', async () => {
        prismaMock.maintenanceTask.findFirst.mockResolvedValue(null);

        const response = await request(app)
          .post('/api/maintenance/tasks/nonexistent/approve')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('POST /api/maintenance/tasks/:id/reject', () => {
      it('应该拒绝待审核任务', async () => {
        const task = createMockTask({
          id: 'task_reject',
          userId: 'user_test',
          status: MaintenanceStatus.AWAITING_USER_REVIEW,
        });

        const rejectedTask = { ...task, status: MaintenanceStatus.REJECTED };

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);
        prismaMock.maintenanceTask.update.mockResolvedValue(rejectedTask);

        const response = await request(app)
          .post('/api/maintenance/tasks/task_reject/reject')
          .set('x-user-id', 'user_test')
          .send({ comment: '拒绝此任务' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('REJECTED');
      });

      it('应该能够拒绝自动批准的任务', async () => {
        const task = createMockTask({
          id: 'task_reject_auto',
          userId: 'user_test',
          status: MaintenanceStatus.AUTO_APPROVED,
        });

        const rejectedTask = { ...task, status: MaintenanceStatus.REJECTED };

        prismaMock.maintenanceTask.findFirst.mockResolvedValue(task);
        prismaMock.maintenanceTask.update.mockResolvedValue(rejectedTask);

        const response = await request(app)
          .post('/api/maintenance/tasks/task_reject_auto/reject')
          .set('x-user-id', 'user_test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('合并 API 测试', () => {
    describe('POST /api/maintenance/merge/preview', () => {
      it('应该返回合并预览', async () => {
        const entity1 = createMockEntity({ id: 'entity_1', canonicalName: 'Entity A' });
        const entity2 = createMockEntity({ id: 'entity_2', canonicalName: 'Entity B' });

        prismaMock.entity.findUnique.mockImplementation((args: any) => {
          if (args.where.id === 'entity_1') return Promise.resolve(entity1);
          if (args.where.id === 'entity_2') return Promise.resolve(entity2);
          return Promise.resolve(null);
        });

        const response = await request(app)
          .post('/api/maintenance/merge/preview')
          .set('x-user-id', 'user_test')
          .send({
            sourceEntityId: 'entity_1',
            targetEntityId: 'entity_2',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('应该处理不存在的实体', async () => {
        prismaMock.entity.findUnique.mockResolvedValue(null);

        const response = await request(app)
          .post('/api/maintenance/merge/preview')
          .set('x-user-id', 'user_test')
          .send({
            sourceEntityId: 'nonexistent_1',
            targetEntityId: 'nonexistent_2',
          });

        expect(response.status).toBe(500);
      });
    });
  });
});
