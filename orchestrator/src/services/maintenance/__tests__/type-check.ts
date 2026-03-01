/**
 * Maintenance Service 类型检查测试
 * 
 * 此文件用于验证 maintenance.service.ts 的类型定义和导出是否正确
 */

import {
  MaintenanceService,
  maintenanceService,
  CreateTaskInput,
  MaintenanceChange,
  HealthReport,
  TaskExecutionResult,
} from '../maintenance.service';

import { MaintenanceType, MaintenanceStatus } from '@prisma/client';

// 验证类可以被实例化
const service = new MaintenanceService();

// 验证默认实例导出
const defaultService = maintenanceService;

// 验证接口类型
const sampleChange: MaintenanceChange = {
  field: 'name',
  oldValue: 'old',
  newValue: 'new',
};

const sampleInput: CreateTaskInput = {
  taskType: MaintenanceType.ENTITY_MERGE,
  description: 'Test task',
  confidence: 0.95,
  sourceEntityId: 'entity-1',
  targetEntityId: 'entity-2',
  changes: [sampleChange],
};

// 验证服务方法签名
async function testMethodSignatures() {
  // 任务创建
  const task = await service.createTask('user-1', sampleInput);
  
  // 任务查询
  const tasks = await service.getTasks('user-1', {
    status: MaintenanceStatus.PENDING,
    limit: 10,
  });
  
  // 任务审批
  const approvedTask = await service.approveTask('user-1', task.id, 'Approved');
  const rejectedTask = await service.rejectTask('user-1', task.id, 'Rejected');
  
  // 任务执行
  const result = await service.applyTask('user-1', task.id);
  
  // 任务回滚
  const revertResult = await service.revertTask('user-1', task.id, 'Reverted');
  
  // 扫描任务
  const duplicates = await service.scanForDuplicates('user-1');
  const relations = await service.discoverRelations('user-1');
  const stale = await service.detectStaleEntities('user-1');
  const orphans = await service.detectOrphanEntities('user-1');
  const tags = await service.optimizeTags('user-1');
  
  // 健康报告
  const health = await service.getHealthReport('user-1');
  
  // 完整扫描
  const scanResult = await service.runFullScan('user-1');
  
  // 自动应用
  const autoResults = await service.autoApplyTasks('user-1');
}

// 验证结果类型
const sampleResult: TaskExecutionResult = {
  success: true,
  error: undefined,
};

const sampleHealth: HealthReport = {
  score: 85,
  totalEntities: 100,
  totalRelations: 200,
  orphanEntities: 5,
  potentialDuplicates: 3,
  staleEntities: 2,
  brokenRelations: 0,
  details: {
    orphanEntities: [],
    potentialDuplicates: [],
    staleEntities: [],
    brokenRelations: [],
  },
};

console.log('Maintenance Service type check passed!');
