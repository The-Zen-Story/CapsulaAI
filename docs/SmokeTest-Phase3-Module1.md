# CapsulaAI Phase 3 - Module 1: 间隔重复系统 (Spaced Repetition)

## 冒烟测试 Checklist

### API Tests
- [x] GET /api/review/cards - 获取卡片列表正常返回
- [x] POST /api/review/cards - 创建卡片成功
- [x] GET /api/review/cards/:id - 获取单个卡片正常返回
- [x] PUT /api/review/cards/:id - 更新卡片成功
- [x] DELETE /api/review/cards/:id - 删除卡片成功
- [x] POST /api/review/cards/:id/suspend - 暂停卡片成功
- [x] POST /api/review/cards/:id/resume - 恢复卡片成功
- [x] POST /api/review/cards/:id/reset - 重置卡片成功
- [x] GET /api/review/sessions/due - 获取到期卡片正常返回
- [x] POST /api/review/sessions - 创建复习会话成功
- [x] GET /api/review/sessions/:id - 获取会话详情正常返回
- [x] POST /api/review/sessions/:id/review - 提交复习评分成功
- [x] POST /api/review/sessions/:id/complete - 完成会话成功
- [x] GET /api/review/stats - 获取统计数据正常返回
- [x] GET /api/review/heatmap - 获取热力图数据正常返回
- [x] GET /api/review/dashboard - 获取仪表盘数据正常返回
- [x] 错误处理 - 返回正确错误码 (404, 400, 500)

### Frontend Tests
- [x] 复习中心页面加载正常 (/review)
- [x] 统计卡片显示正确
- [x] 学习热力图显示正确
- [x] 开始复习按钮可用
- [x] 复习会话界面加载正常
- [x] 卡片翻转功能正常
- [x] 评分按钮 (0-5) 可用
- [x] 键盘快捷键支持 (空格翻转, 0-5评分)
- [x] 卡片管理页面加载正常
- [x] 新建卡片对话框可用
- [x] 卡片列表显示正确
- [x] 卡片操作 (编辑/暂停/删除) 可用

### Integration Tests
- [x] 端到端复习流程: 创建卡片 → 开始会话 → 评分 → 完成
- [x] SM-2 算法正确计算间隔和 EF
- [x] 复习日志正确记录
- [x] 统计数据正确更新

### Database Schema
- [x] ReviewCard 表创建
- [x] ReviewSession 表创建
- [x] ReviewSessionCard 表创建
- [x] ReviewLog 表创建
- [x] 索引正确创建

### Unit Tests
- [x] SM2Algorithm.calculate - 所有评分场景
- [x] SM2Algorithm.calculate - 边界条件
- [x] SM2Algorithm.getNextReviewDate
- [x] SM2Algorithm.handleOverdue

## 实现的功能

### 核心功能
1. **SM-2 间隔重复算法完整实现**
   - EF (Easiness Factor) 计算
   - 间隔计算 (1, 6, then EF-based)
   - 高分奖励机制 (rating >= 4)
   - 失败重置机制
   - 逾期处理

2. **复习卡片管理**
   - 创建/读取/更新/删除卡片
   - 卡片状态管理 (NEW, LEARNING, REVIEW, MASTERED, SUSPENDED)
   - 标签系统
   - 搜索和过滤

3. **复习会话**
   - 会话创建和管理
   - 卡片队列
   - 评分提交
   - 会话统计

4. **统计和可视化**
   - 学习热力图 (GitHub-style)
   - 统计数据 (总卡片、待复习、连续天数等)
   - 复习历史

### 技术实现
- 后端: Node.js + Express + TypeScript + Prisma
- 前端: React + TypeScript + TanStack Query
- UI组件: Radix UI + Tailwind CSS
- 算法: SM-2 间隔重复算法

## 已知限制
1. 用户认证使用简单的 header 传递，需要后续集成完整的 auth 系统
2. 自动提取功能需要 AI 服务集成，当前版本仅支持手动创建卡片
3. 通知系统需要后续实现

## 下一步 (Module 2: 知识图谱自动维护)
1. 实体相似度计算服务
2. 维护任务系统
3. 实体合并工作流
4. 健康度报告
