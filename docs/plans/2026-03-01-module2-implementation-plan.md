# CapsulaAI Phase 3 Module 2 - 实施计划

**日期**: 2026-03-01
**模块**: 知识图谱自动维护 (Self-improving Graph Maintenance)
**状态**: 待执行

---

## 任务清单

### 任务 1: 数据库 Schema 更新
**预计时间**: 15-20 分钟
**文件**: `orchestrator/prisma/schema.prisma`

- [ ] 添加 MaintenanceTask 模型
- [ ] 添加 Entity/Relation 更新字段 (status, mergedIntoId)
- [ ] 创建数据库索引
- [ ] 运行 `npx prisma migrate dev`

**验收标准**:
- Prisma schema 无错误
- 迁移成功执行
- 数据库表结构正确

---

### 任务 2: 实体相似度计算服务
**预计时间**: 25-30 分钟
**文件**: 
- `orchestrator/src/services/maintenance/similarity.service.ts`
- `orchestrator/src/services/maintenance/__tests__/similarity.service.test.ts`

- [ ] 实现 Levenshtein 距离计算
- [ ] 实现 Jaro-Winkler 相似度
- [ ] 实现语义相似度 (向量余弦)
- [ ] 实现上下文相似度 (Jaccard)
- [ ] 实现加权综合相似度
- [ ] 编写单元测试

**验收标准**:
- 所有相似度算法正确实现
- 测试覆盖率 > 80%
- 性能测试通过 (1000 实体 < 1s)

---

### 任务 3: 维护任务服务
**预计时间**: 30-35 分钟
**文件**:
- `orchestrator/src/services/maintenance/maintenance.service.ts`
- `orchestrator/src/services/maintenance/maintenance.types.ts`

- [ ] 实现任务创建逻辑
- [ ] 实现任务状态机
- [ ] 实现自动批准逻辑 (confidence >= 0.95)
- [ ] 实现任务执行逻辑
- [ ] 实现任务回滚逻辑

**验收标准**:
- 状态机转换正确
- 自动批准阈值生效
- 任务执行事务安全

---

### 任务 4: 实体合并工作流
**预计时间**: 35-40 分钟
**文件**:
- `orchestrator/src/services/maintenance/merge.service.ts`
- `orchestrator/src/services/maintenance/__tests__/merge.service.test.ts`

- [ ] 实现合并预览
- [ ] 实现关系迁移
- [ ] 实现别名合并
- [ ] 实现标签合并
- [ ] 实现引用更新
- [ ] 实现合并日志

**验收标准**:
- 合并后数据一致性
- 环形合并检测
- 批量合并事务安全

---

### 任务 5: API 路由实现
**预计时间**: 25-30 分钟
**文件**:
- `orchestrator/src/routes/maintenance/maintenance.routes.ts`
- `orchestrator/src/routes/maintenance/maintenance.controller.ts`

- [ ] GET /api/maintenance/entities - 获取实体列表
- [ ] GET /api/maintenance/entities/:id/similar - 获取相似实体
- [ ] POST /api/maintenance/entities/:id/merge - 合并实体
- [ ] GET /api/maintenance/tasks - 获取维护任务
- [ ] POST /api/maintenance/tasks/:id/approve - 批准任务
- [ ] POST /api/maintenance/tasks/:id/reject - 拒绝任务
- [ ] GET /api/maintenance/health - 获取健康报告
- [ ] POST /api/maintenance/scan - 触发扫描

**验收标准**:
- 所有 API 端点可用
- 请求验证正确
- 错误处理完善

---

### 任务 6: 前端页面实现
**预计时间**: 40-45 分钟
**文件**:
- `web/src/pages/MaintenancePage.tsx`
- `web/src/components/maintenance/EntityList.tsx`
- `web/src/components/maintenance/MergeDialog.tsx`
- `web/src/components/maintenance/TaskList.tsx`
- `web/src/components/maintenance/HealthScore.tsx`

- [ ] 实体列表页面
- [ ] 相似实体检测展示
- [ ] 合并预览对话框
- [ ] 维护任务列表
- [ ] 健康度评分展示

**验收标准**:
- UI 响应式
- 交互流畅
- 错误提示友好

---

### 任务 7: 定时任务调度
**预计时间**: 15-20 分钟
**文件**:
- `orchestrator/src/services/scheduler/maintenance.scheduler.ts`

- [ ] 实现每日健康扫描
- [ ] 实现实体相似度检测任务
- [ ] 集成 BullMQ 队列

**验收标准**:
- 定时任务准时触发
- 任务结果正确
- 失败重试机制

---

### 任务 8: 集成测试
**预计时间**: 20-25 分钟
**文件**:
- `orchestrator/src/__tests__/maintenance.integration.test.ts`

- [ ] 端到端合并流程测试
- [ ] 任务审批流程测试
- [ ] 健康报告生成测试

**验收标准**:
- 所有测试通过
- 覆盖率 > 70%

---

## 依赖关系

```
Task 1 (Schema)
    ↓
Task 2 (Similarity) → Task 3 (Maintenance Service)
    ↓                       ↓
Task 4 (Merge) ←──────────┘
    ↓
Task 5 (API Routes)
    ↓
Task 6 (Frontend)
    ↓
Task 7 (Scheduler)
    ↓
Task 8 (Integration Test)
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 相似度计算性能差 | 高 | 使用批量处理 + 缓存 |
| 合并数据不一致 | 高 | 使用数据库事务 |
| 任务队列堆积 | 中 | 限制并发数 + 优先级 |

---

## 提交信息模板

```
feat(module2): <功能描述>

- <详细变更 1>
- <详细变更 2>

Refs: Phase3-Module2
```
