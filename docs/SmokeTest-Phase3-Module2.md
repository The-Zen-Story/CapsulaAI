# CapsulaAI Phase 3 - Module 2: 知识图谱自动维护 (Self-improving Graph)

## 冒烟测试 Checklist

### API Tests
- [x] GET /api/maintenance/health - 获取健康报告正常返回
- [x] GET /api/maintenance/tasks - 获取维护任务列表正常返回
- [x] GET /api/maintenance/tasks/:id - 获取单个任务正常返回
- [x] POST /api/maintenance/tasks/:id/approve - 批准任务成功
- [x] POST /api/maintenance/tasks/:id/reject - 拒绝任务成功
- [x] POST /api/maintenance/tasks/:id/apply - 应用任务成功
- [x] POST /api/maintenance/scan - 运行完整扫描成功
- [x] POST /api/maintenance/scan/duplicates - 扫描重复实体成功
- [x] POST /api/maintenance/scan/relations - 发现关系成功
- [x] GET /api/maintenance/stats - 获取维护统计正常返回
- [x] 错误处理 - 返回正确错误码 (404, 400, 500)

### Frontend Tests
- [x] 维护中心页面加载正常 (/maintenance)
- [x] 健康度分数显示正确
- [x] 健康度进度条显示正确
- [x] 统计卡片显示正确 (孤立节点、潜在重复、过时实体、断裂关系)
- [x] 立即扫描按钮可用
- [x] 任务列表页面加载正常
- [x] 任务状态过滤可用
- [x] 任务批准/拒绝按钮可用
- [x] 任务详情弹窗正常

### Integration Tests
- [x] 端到端维护流程: 扫描 → 发现重复 → 审核 → 合并
- [x] 实体相似度计算正确
- [x] 关系发现正确
- [x] 健康度评分计算正确

### 算法测试
- [x] Levenshtein 距离计算
- [x] Jaro-Winkler 相似度计算
- [x] 多维度相似度加权
- [x] 批量相似度计算

### 业务逻辑测试
- [x] 实体合并工作流
- [x] 关系发现工作流
- [x] 过时实体检测
- [x] 孤立节点检测
- [x] 健康度评分算法

## 实现的功能

### 核心功能
1. **实体相似度计算**
   - Levenshtein 编辑距离
   - Jaro-Winkler 相似度
   - 语义相似度 (向量余弦)
   - 上下文相似度 (共现实体)
   - 类型一致性
   - 多维度加权综合

2. **维护任务系统**
   - 任务创建和管理
   - 自动批准 (置信度 >= 0.9)
   - 人工审核流程
   - 任务执行和回滚

3. **实体合并工作流**
   - 合并预览
   - 关系迁移
   - 别名合并
   - 引用更新

4. **关系自动发现**
   - 共现实体检测
   - 置信度计算
   - 自动创建建议

5. **图谱健康度评估**
   - 孤立节点检测
   - 重复实体检测
   - 过时实体检测
   - 健康度评分 (0-100)
   - 问题详情展示

### 技术实现
- 后端: Node.js + Express + TypeScript + Prisma
- 前端: React + TypeScript + TanStack Query
- 算法: 多维度相似度计算
- UI组件: Radix UI + Tailwind CSS

## 已知限制
1. 实体合并的 mergedIntoId 字段需要在 schema 中添加
2. 批量处理大数据集时需要进一步优化内存使用
3. 关系发现目前仅基于共现，语义关系发现需要 AI 集成

## 下一步 (Module 3: 动态可执行洞察)
1. 洞察规则引擎
2. 任务提醒提取 (NLP)
3. 知识空白检测
4. 关联推荐
5. 前端洞察中心界面
