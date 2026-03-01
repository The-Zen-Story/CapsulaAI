# CapsulaAI Phase 3 - 产品需求文档 (PRD)

**版本**: v2.0  
**日期**: 2026-03-01  
**状态**: 待评审（已增强详细逻辑）  
**作者**: Product Manager (虚拟团队成员)  

---

## 1. 功能概述

### 1.1 项目背景

CapsulaAI 是一个本地优先的 AI 记忆引擎，旨在帮助用户将碎片化的信息（截图、笔记、文档、想法）转化为结构化的知识胶囊，构建一个私密、可进化的个人记忆层。

目前项目已完成：
- **Phase 1**: 多模态胶囊系统、VLM 管道、本地处理
- **Phase 2**: 显式知识图谱、时间线视图、语义搜索

### 1.2 Phase 3 目标

Phase 3 的核心目标是实现**知识进化**——让 CapsulaAI 不仅是一个存储系统，更是一个能够主动帮助用户学习、整理和获得洞察的智能助手。

### 1.3 三大核心功能

| 功能 | 英文名称 | 核心价值 |
|------|----------|----------|
| 间隔重复系统 | Spaced Repetition System | 帮助用户高效复习和巩固知识 |
| 知识图谱自动维护 | Self-improving Graph Maintenance | 自动发现、合并、优化知识图谱 |
| 动态可执行洞察 | Dynamic Actionable Insights | 主动提供基于个人知识的行动建议 |

---

## 2. 用户故事

### 2.1 间隔重复系统 (Spaced Repetition)

**US-SR-001**: 作为用户，我希望 CapsulaAI 能自动识别需要复习的知识点，这样我可以巩固记忆而不遗忘重要信息。

**US-SR-002**: 作为用户，我希望系统能根据我的记忆表现动态调整复习间隔，这样我可以高效学习而不浪费时间。

**US-SR-003**: 作为用户，我希望在复习时能看到知识点的上下文和关联内容，这样我可以更好地理解知识的联系。

**US-SR-004**: 作为用户，我希望可以通过多种方式复习（闪卡、问答、填空），这样我可以选择最适合自己的学习方式。

**US-SR-005**: 作为用户，我希望收到复习提醒通知，这样我不会错过最佳复习时机。

### 2.2 知识图谱自动维护 (Self-improving Graph)

**US-SG-001**: 作为用户，我希望系统能自动发现重复或相似的实体，并提示我合并，这样我的知识图谱保持整洁。

**US-SG-002**: 作为用户，我希望系统能根据新添加的胶囊自动发现实体间的新关联，这样我的知识网络不断扩展。

**US-SG-003**: 作为用户，我希望系统能识别过时或不再相关的知识，并提示我归档或删除，这样我的知识库保持时效性。

**US-SG-004**: 作为用户，我希望系统能自动为知识分类和打标签，这样可以减少我的手动整理工作。

**US-SG-005**: 作为用户，我希望看到知识图谱的健康度报告，这样我可以了解我的知识库状态。

### 2.3 动态可执行洞察 (Actionable Insights)

**US-AI-001**: 作为用户，我希望系统能基于我的知识主动提醒我待办事项，这样我不会遗漏重要任务。

**US-AI-002**: 作为用户，我希望系统能发现我知识体系中的空白，并推荐相关学习资源，这样我可以持续成长。

**US-AI-003**: 作为用户，我希望系统能根据我的项目进展提供下一步行动建议，这样我可以更高效地推进工作。

**US-AI-004**: 作为用户，我希望系统能识别我笔记中的承诺和截止日期，并创建提醒，这样我不会错过重要时间节点。

**US-AI-005**: 作为用户，我希望系统能分析我的知识使用模式，并提供优化建议，这样我可以改进我的知识管理习惯。

---

## 3. 功能详细设计

### 3.1 间隔重复系统 (Spaced Repetition System)

#### 3.1.1 功能描述

基于艾宾浩斯遗忘曲线和 SM-2 算法，自动安排知识点的复习计划。系统从用户的胶囊中提取关键知识点，生成复习卡片，并根据用户的记忆表现动态调整复习间隔。

#### 3.1.2 核心算法 - SM-2 完整实现

**算法参数定义**:
```
- EF (Easiness Factor): 难度系数，初始值 2.5，范围 [1.3, 2.5]
- interval: 复习间隔（天），初始值 0
- repetition: 连续成功复习次数，初始值 0
- q: 用户评分 (0-5)
  * 0 = 完全忘记
  * 1 = 错误，正确答案很熟悉
  * 2 = 错误，但答案不太难记
  * 3 = 正确，但很难回忆
  * 4 = 正确，有点困难
  * 5 = 完美回答
```

**完整伪代码**:
```
function calculateNextReview(card, rating):
    // 输入验证
    if rating < 0 or rating > 5:
        throw InvalidRatingError("Rating must be between 0 and 5")
    
    // 记录历史值
    previousInterval = card.interval
    previousEF = card.easinessFactor
    
    // 更新 EF (难度系数)
    newEF = previousEF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    
    // EF 边界处理
    if newEF < 1.3:
        newEF = 1.3
    if newEF > 2.5:
        newEF = 2.5
    
    // 计算新的间隔
    if rating < 3:
        // 记忆失败，重置
        newRepetition = 0
        newInterval = 1
        card.status = 'learning'
    else:
        // 记忆成功
        newRepetition = card.repetitionCount + 1
        
        if newRepetition == 1:
            newInterval = 1
        else if newRepetition == 2:
            newInterval = 6
        else:
            newInterval = round(previousInterval * newEF)
        
        // 高分奖励：如果评分 >= 4，额外增加 20% 间隔
        if rating >= 4 and newRepetition > 2:
            newInterval = round(newInterval * 1.2)
        
        // 更新状态
        if newRepetition >= 5 and newInterval >= 21:
            card.status = 'mastered'
        else:
            card.status = 'review'
    
    // 间隔边界处理
    if newInterval > 365:
        newInterval = 365  // 最大间隔 1 年
    
    // 计算下次复习时间
    nextReviewAt = now() + days(newInterval)
    
    // 更新卡片
    card.interval = newInterval
    card.easinessFactor = newEF
    card.repetitionCount = newRepetition
    card.nextReviewAt = nextReviewAt
    card.lastReviewedAt = now()
    card.totalReviews += 1
    
    if rating >= 3:
        card.correctCount += 1
        card.streak += 1
    else:
        card.streak = 0
    
    // 创建复习日志
    reviewLog = {
        cardId: card.id,
        rating: rating,
        responseTime: responseTime,
        reviewedAt: now(),
        previousInterval: previousInterval,
        newInterval: newInterval,
        previousEF: previousEF,
        newEF: newEF
    }
    
    return {
        card: card,
        reviewLog: reviewLog,
        nextReviewAt: nextReviewAt
    }
```

**边界情况处理**:

| 场景 | 处理逻辑 |
|------|----------|
| 用户连续多次失败 (rating < 3) | 每次重置 repetition=0, interval=1，但 EF 不会低于 1.3 |
| 卡片长期未复习（逾期） | 逾期天数 > interval * 2 时，视为失败处理，重置间隔 |
| 用户暂停卡片后恢复 | 恢复时 interval = min(interval, 7)，避免间隔过大 |
| 手动调整难度 | 允许用户手动设置 EF，范围 1.3-2.5 |
| 批量复习中断 | 保存已完成的复习记录，下次从中断处继续 |

#### 3.1.3 状态机设计 - ReviewCard

```
┌─────────┐    创建     ┌─────────┐
│  NONE   │ ──────────▶ │   NEW   │
└─────────┘             └────┬────┘
                             │
                    首次安排复习 │
                             ▼
┌─────────┐   rating < 3   ┌──────────┐
│LEARNING │ ◀───────────── │ SCHEDULED│
└────┬────┘                └────┬─────┘
     │                          │
     │ rating >= 3              │ rating >= 3
     │ (连续3次)                │ (repetition >=5
     │                          │  && interval >=21)
     ▼                          ▼
┌─────────┐   rating < 3    ┌─────────┐
│ REVIEW  │ ◀────────────── │MASTERED │
└────┬────┘                 └────┬────┘
     │                           │
     │ 用户暂停                   │ 用户暂停
     ▼                           ▼
┌─────────┐                 ┌─────────┐
│SUSPENDED│                 │SUSPENDED│
└────┬────┘                 └────┬────┘
     │                           │
     │ 用户恢复                   │ 用户恢复
     └───────────┬───────────────┘
                 ▼
            ┌─────────┐
            │ SCHEDULED│ (interval = min(current, 7))
            └─────────┘

状态转换表:
+----------------+---------------+---------------+------------------+
| 当前状态       | 事件          | 条件          | 下一状态         |
+----------------+---------------+---------------+------------------+
| NEW            | schedule      | -             | SCHEDULED        |
| SCHEDULED      | review        | rating < 3    | LEARNING         |
| SCHEDULED      | review        | rating >=3    | REVIEW/MASTERED  |
| LEARNING       | review        | rating < 3    | LEARNING         |
| LEARNING       | review        | rating >=3    | REVIEW           |
| REVIEW         | review        | rating < 3    | LEARNING         |
| REVIEW         | review        | mastered      | MASTERED         |
| REVIEW         | review        | !mastered     | REVIEW           |
| MASTERED       | review        | rating < 3    | LEARNING         |
| MASTERED       | review        | rating >=3    | MASTERED         |
| *              | suspend       | -             | SUSPENDED        |
| SUSPENDED      | resume        | -             | SCHEDULED        |
| *              | delete        | -             | (删除)           |
+----------------+---------------+---------------+------------------+
```

#### 3.1.4 详细功能流程

**流程 1: 知识点提取与卡片生成**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户创建    │     │  系统分析    │     │  AI 提取    │
│  新胶囊     │────▶│  胶囊内容   │────▶│  知识点     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户确认   │◀────│  生成卡片   │◀────│  候选列表   │
│  并编辑     │     │  草稿       │     │  (待审核)   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ 用户确认
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  卡片进入   │────▶│  SM-2 初始化 │────▶│  等待首次   │
│  复习队列   │     │  EF=2.5     │     │  复习       │
└─────────────┘     └─────────────┘     └─────────────┘

异常处理:
- AI 提取失败: 提示用户手动创建卡片
- 内容过长: 自动拆分为多个卡片
- 重复知识点: 与现有卡片对比，提示合并
```

**流程 2: 复习调度与提醒**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  定时任务    │     │  查询到期    │     │  生成提醒    │
│  (每日 9:00)│────▶│  卡片       │────▶│  列表       │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
            ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
            │  应用内通知  │           │  桌面通知   │           │  邮件提醒   │
            │  (主要)     │           │  (可选)     │           │  (可选)     │
            └─────────────┘           └─────────────┘           └─────────────┘

边界情况:
- 到期卡片数 > 每日上限: 按 EF 排序，优先复习难记的
- 用户设置免打扰: 延迟到下一个允许时段
- 连续多天未复习: 增加提醒频率，标记为"需要关注"
```

**流程 3: 复习会话完整流程**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户开始   │     │  创建会话   │     │  加载待复习  │
│  复习会话   │────▶│  记录      │────▶│  卡片队列   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  显示正面   │◀────│  取队列首   │◀────│  队列非空   │
│  (问题)     │     │  卡片       │     │             │
└──────┬──────┘     └─────────────┘     └──────┬──────┘
       │                                        │ 队列为空
       │ 用户翻转                               ▼
       ▼                                 ┌─────────────┐
┌─────────────┐                         │  结束会话   │
│  显示背面   │                         │  生成统计   │
│  (答案)     │                         └─────────────┘
└──────┬──────┘
       │
       │ 用户评分 (0-5)
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  应用 SM-2  │────▶│  更新卡片   │────▶│  记录复习   │
│  算法       │     │  状态       │     │  日志       │
└─────────────┘     └─────────────┘     └─────────────┘

异常处理:
- 会话中断: 保存已完成的部分，下次可继续
- 网络异常: 本地缓存，恢复后同步
- 卡片内容错误: 提供"报告问题"按钮，暂停该卡片
```

#### 3.1.5 时序图 - 完整复习流程

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌─────────┐
│  User   │    │ Frontend │    │ Review API  │    │ Scheduler│    │ Database│
└────┬────┘    └────┬─────┘    └──────┬──────┘    └────┬─────┘    └────┬────┘
     │              │                 │                │               │
     │ 1.开始复习    │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │ 2.创建会话       │                │               │
     │              │────────────────▶│                │               │
     │              │                 │ 3.查询到期卡片  │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │ 4.返回卡片列表  │               │
     │              │                 │◀───────────────────────────────│
     │              │                 │                │               │
     │              │ 5.返回会话信息   │                │               │
     │              │◀────────────────│                │               │
     │              │                 │                │               │
     │ 6.显示卡片正面 │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
     │ 7.用户翻转    │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │                 │                │               │
     │ 8.显示卡片背面 │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
     │ 9.用户评分    │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │ 10.提交评分     │                │               │
     │              │────────────────▶│                │               │
     │              │                 │ 11.应用 SM-2   │               │
     │              │                 │                │               │
     │              │                 │ 12.更新数据库   │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │ 13.确认更新    │               │
     │              │                 │◀───────────────────────────────│
     │              │                 │                │               │
     │              │ 14.返回结果     │                │               │
     │              │◀────────────────│                │               │
     │              │                 │                │               │
     │ 15.显示下一张 │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
     │              │                 │                │               │
     │              │                 │ 定时触发       │               │
     │              │                 │◀───────────────│               │
     │              │                 │                │               │
     │              │                 │ 16.生成每日提醒 │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │                │               │
     │ 17.推送通知   │                 │                │               │
     │◀───────────────────────────────│                │               │
     │              │                 │                │               │
```

---

### 3.2 知识图谱自动维护 (Self-improving Graph Maintenance)

#### 3.2.1 功能描述

系统自动分析知识图谱的健康状况，执行实体消歧、关系发现、标签优化等维护任务，保持知识图谱的准确性和时效性。

#### 3.2.2 实体相似度计算详细算法

**多维度相似度计算**:

```
function calculateEntitySimilarity(entityA, entityB):
    // 1. 名称相似度 (编辑距离)
    nameSim = calculateNameSimilarity(entityA.name, entityB.name)
    
    // 2. 别名重叠度
    aliasSim = calculateAliasOverlap(entityA.aliases, entityB.aliases)
    
    // 3. 语义相似度 (向量余弦)
    semanticSim = cosineSimilarity(entityA.embedding, entityB.embedding)
    
    // 4. 上下文相似度 (共现实体)
    contextSim = calculateContextSimilarity(entityA, entityB)
    
    // 5. 类型一致性
    typeSim = (entityA.type == entityB.type) ? 1.0 : 0.0
    
    // 加权综合 (权重可配置)
    weights = {
        name: 0.25,
        alias: 0.15,
        semantic: 0.35,
        context: 0.15,
        type: 0.10
    }
    
    totalSim = nameSim * weights.name +
               aliasSim * weights.alias +
               semanticSim * weights.semantic +
               contextSim * weights.context +
               typeSim * weights.type
    
    return totalSim

// 名称相似度计算 (Levenshtein + Jaro-Winkler)
function calculateNameSimilarity(nameA, nameB):
    // 标准化处理
    normA = normalize(nameA)  // 小写、去空格、去标点
    normB = normalize(nameB)
    
    // 完全匹配
    if normA == normB:
        return 1.0
    
    // 包含关系
    if normA.includes(normB) or normB.includes(normA):
        return 0.9
    
    // Levenshtein 距离
    levDist = levenshteinDistance(normA, normB)
    maxLen = max(normA.length, normB.length)
    levSim = 1 - (levDist / maxLen)
    
    // Jaro-Winkler (适合短字符串)
    jaroSim = jaroWinklerSimilarity(normA, normB)
    
    // 综合
    return max(levSim, jaroSim * 1.1)  // Jaro-Winkler 加权

// 上下文相似度 (共现实体)
function calculateContextSimilarity(entityA, entityB):
    // 获取与实体 A 相关的所有实体
    neighborsA = getRelatedEntities(entityA.id)
    neighborsB = getRelatedEntities(entityB.id)
    
    // 计算重叠
    intersection = neighborsA ∩ neighborsB
    union = neighborsA ∪ neighborsB
    
    if union.size == 0:
        return 0.0
    
    return intersection.size / union.size  // Jaccard 系数
```

**相似度阈值策略**:

| 相似度范围 | 处理策略 | 人工审核 |
|------------|----------|----------|
| >= 0.90 | 自动合并（如开启自动合并） | 可选 |
| 0.80 - 0.89 | 高置信度建议，优先展示 | 推荐 |
| 0.70 - 0.79 | 中等置信度建议 | 必须 |
| 0.60 - 0.69 | 低置信度，仅记录 | 可选 |
| < 0.60 | 忽略 | 否 |

#### 3.2.3 状态机设计 - MaintenanceTask

```
                    自动扫描触发
                           │
                           ▼
┌─────────┐    创建      ┌─────────┐
│  NONE   │ ────────────▶│ PENDING │
└─────────┘              └────┬────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           │ 置信度 >= 阈值   │ 置信度 < 阈值    │ 用户手动
           │ (自动批准)       │ (需人工审核)     │ 创建
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │AUTO_APPROVED│    │AWAITING_USER│    │AWAITING_USER│
    └──────┬──────┘    │   _REVIEW   │    │   _REVIEW   │
           │           └──────┬──────┘    └─────────────┘
           │                  │
           │ 执行变更         │ 用户批准
           ▼                  ▼
    ┌─────────────┐    ┌─────────────┐
    │  APPLIED    │    │  APPROVED   │
    └─────────────┘    └──────┬──────┘
                              │
                              │ 执行变更
                              ▼
                       ┌─────────────┐
                       │   APPLIED   │
                       └─────────────┘

用户拒绝路径:
AWAITING_USER_REVIEW ──用户拒绝──▶ REJECTED

撤销路径:
APPLIED ──用户撤销──▶ REVERTED (创建反向任务)

状态转换表:
+------------------+---------------+---------------+------------------+
| 当前状态         | 事件          | 条件          | 下一状态         |
+------------------+---------------+---------------+------------------+
| PENDING          | auto_check    | confidence>=threshold | AUTO_APPROVED |
| PENDING          | auto_check    | confidence<threshold  | AWAITING_USER_REVIEW |
| AUTO_APPROVED    | apply         | 成功          | APPLIED          |
| AUTO_APPROVED    | apply         | 失败          | FAILED (重试)    |
| AWAITING_USER_REVIEW | approve   | -             | APPROVED         |
| AWAITING_USER_REVIEW | reject    | -             | REJECTED         |
| APPROVED         | apply         | 成功          | APPLIED          |
| APPROVED         | apply         | 失败          | FAILED (重试)    |
| APPLIED          | revert        | 用户撤销      | REVERTED         |
+------------------+---------------+---------------+------------------+
```

#### 3.2.4 详细功能流程

**流程 1: 实体相似度检测与合并**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  触发条件   │     │  获取候选    │     │  计算相似度  │
│ (定时/手动) │────▶│  实体对     │────▶│  (多维度)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────┐
                    │                          │                  │
                    ▼                          ▼                  ▼
            ┌─────────────┐           ┌─────────────┐     ┌─────────────┐
            │  >= 0.90    │           │ 0.80-0.89   │     │  0.70-0.79  │
            │  自动合并   │           │  高优建议   │     │  普通建议   │
            └─────────────┘           └─────────────┘     └─────────────┘
                    │                          │                  │
                    ▼                          ▼                  ▼
            ┌─────────────┐           ┌─────────────┐     ┌─────────────┐
            │  执行合并   │           │  创建任务   │     │  创建任务   │
            │  记录日志   │           │  等待审核   │     │  等待审核   │
            └─────────────┘           └─────────────┘     └─────────────┘

合并执行逻辑:
1. 选择保留实体 (mentionCount 高、更新近)
2. 迁移关系 (source/target 指向保留实体)
3. 合并别名 (去重)
4. 合并标签 (去重)
5. 更新引用 (所有引用旧实体的 capsule)
6. 标记旧实体为 merged，设置 mergedIntoId
7. 创建合并日志

异常处理:
- 合并冲突: 暂停合并，提示用户手动解决
- 环形合并检测: 检查 mergedIntoId 链，防止 A→B→C→A
- 批量合并: 支持一次合并多个实体，使用事务保证一致性
```

**流程 2: 关系自动发现**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  新实体     │     │  查找候选    │     │  语义关联    │
│  创建/更新  │────▶│  关联实体   │────▶│  分析       │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户确认   │◀────│  生成关系   │◀────│  共现分析   │
│  推断关系   │     │  建议       │     │  (可选)     │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ 用户确认/修改
       ▼
┌─────────────┐     ┌─────────────┐
│  创建关系   │────▶│  标记为     │
│  记录       │     │  confirmed  │
└─────────────┘     └─────────────┘

关系发现规则:
1. 语义相似度 > 0.85 的实体 → "related_to"
2. 同一句子中共同出现 → "co_occurs_with"
3. 实体 A 的描述包含实体 B → "mentions"
4. 时间序列关系 (事件 A 在 B 之前) → "precedes"
5. 包含关系 (城市属于国家) → "part_of"

置信度计算:
confidence = w1*semanticSim + w2*coOccurrence + w3*patternMatch
```

**流程 3: 图谱健康度扫描**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  定时触发   │     │  扫描实体   │     │  检测问题   │
│  (每日/每周)│────▶│  和关系     │────▶│  类型:      │
└─────────────┘     └─────────────┘     │ - 孤立节点  │
                                        │ - 重复实体  │
                                        │ - 过时实体  │
                                        │ - 断裂关系  │
                                        └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  生成健康   │◀────│  计算健康   │◀────│  统计指标   │
│  度报告     │     │  度分数     │     │  (各维度)   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  推送用户   │
│  通知       │
└─────────────┘

健康度评分算法:
healthScore = 100
  - (orphanEntities * 2)           // 孤立节点扣分
  - (potentialDuplicates * 5)      // 重复实体扣分
  - (staleEntities * 3)            // 过时实体扣分
  - (brokenRelations * 4)          // 断裂关系扣分

评分等级:
- 90-100: 优秀 (绿色)
- 70-89:  良好 (黄色)
- 50-69:  一般 (橙色)
- < 50:   需关注 (红色)
```

#### 3.2.5 时序图 - 实体合并流程

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌─────────┐
│  User   │    │ Frontend │    │Graph Maint. │    │ AI Engine│    │ Database│
│         │    │          │    │    API      │    │          │    │         │
└────┬────┘    └────┬─────┘    └──────┬──────┘    └────┬─────┘    └────┬────┘
     │              │                 │                │               │
     │              │                 │ 定时触发扫描    │               │
     │              │                 │◀───────────────│               │
     │              │                 │                │               │
     │              │                 │ 1.查询所有实体  │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │ 2.返回实体列表  │               │
     │              │                 │◀───────────────────────────────│
     │              │                 │                │               │
     │              │                 │ 3.计算相似度矩阵│               │
     │              │                 │────────────────▶               │
     │              │                 │                │               │
     │              │                 │ 4.返回相似度结果│               │
     │              │                 │◀───────────────│               │
     │              │                 │                │               │
     │              │                 │ 5.创建维护任务  │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │ 6.推送通知    │                 │                │               │
     │◀───────────────────────────────│                │               │
     │              │                 │                │               │
     │ 7.查看建议    │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │ 8.获取任务列表   │                │               │
     │              │────────────────▶│                │               │
     │              │                 │                │               │
     │              │ 9.返回任务详情   │                │               │
     │              │◀────────────────│                │               │
     │              │                 │                │               │
     │ 10.显示建议   │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
     │ 11.批准合并   │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │ 12.提交批准     │                │               │
     │              │────────────────▶│                │               │
     │              │                 │                │               │
     │              │                 │ 13.执行合并操作 │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │ 14.确认完成    │               │
     │              │                 │◀───────────────────────────────│
     │              │                 │                │               │
     │              │ 15.返回成功     │                │               │
     │              │◀────────────────│                │               │
     │              │                 │                │               │
     │ 16.显示成功   │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
```

---

### 3.3 动态可执行洞察 (Dynamic Actionable Insights)

#### 3.3.1 功能描述

基于用户的知识库和行为模式，主动提供个性化的洞察和行动建议，帮助用户更好地利用知识、发现机会、管理任务。

#### 3.3.2 洞察生成规则引擎

**规则定义格式**:
```yaml
rule:
  id: "task_reminder_001"
  name: "Deadline Approaching"
  type: "task_reminder"
  priority: "high"
  
  # 触发条件
  trigger:
    event: "capsule_created"
    schedule: "daily_at_09:00"
  
  # 匹配条件
  conditions:
    - type: "pattern_match"
      pattern: "(截止|deadline|before|之前).*?(\d{1,2}[月/]\d{1,2}[日号])"
      confidence_threshold: 0.8
    - type: "date_proximity"
      days_ahead: [1, 3, 7]  # 提前 1/3/7 天提醒
  
  # 去重策略
  deduplication:
    key: "{capsule_id}_{extracted_date}"
    window: "7d"  # 7 天内不重复生成
  
  # 过期策略
  expiration:
    after_date_passed: true
    max_age: "30d"
```

**洞察类型详细规则**:

| 类型 | 触发条件 | 生成规则 | 优先级计算 |
|------|----------|----------|------------|
| task_reminder | 检测到截止日期/承诺 | 提取日期，提前 1/3/7 天提醒 | 剩余天数越少优先级越高 |
| knowledge_gap | 学习主题检测到缺失前置知识 | 分析主题依赖图谱 | 基于学习进度和重要性 |
| connection | 新内容与已有知识相关 | 语义相似度 > 0.75 | 相似度越高优先级越高 |
| action_suggestion | 项目笔记缺少下一步行动 | 检测项目状态 | 项目越活跃优先级越高 |
| habit_analysis | 连续 N 天未复习某主题 | 统计复习频率 | 基于遗忘风险 |
| opportunity | 关注主题有新资源 | 外部源更新 | 基于用户关注度 |

**优先级计算算法**:
```
function calculatePriority(insight):
    baseScore = 0
    
    switch insight.type:
        case 'task_reminder':
            daysUntil = daysUntilDeadline(insight)
            baseScore = 100 - (daysUntil * 10)  // 越近分越高
            if daysUntil <= 1:
                baseScore += 50  // 紧急加分
            break
            
        case 'knowledge_gap':
            importance = getTopicImportance(insight.topic)
            progress = getLearningProgress(insight.topic)
            baseScore = importance * (1 - progress) * 100
            break
            
        case 'connection':
            similarity = insight.similarityScore
            recency = getCapsuleRecency(insight.sourceCapsule)
            baseScore = similarity * 50 + recency * 50
            break
            
        case 'habit_analysis':
            daysSince = daysSinceLastReview(insight.topic)
            expectedInterval = getExpectedInterval(insight.topic)
            overdueRatio = daysSince / expectedInterval
            baseScore = overdueRatio * 50
            break
    
    // 归一化到 0-100
    return clamp(baseScore, 0, 100)

// 优先级分级
if score >= 80: return 'high'
if score >= 50: return 'medium'
return 'low'
```

#### 3.3.3 状态机设计 - Insight

```
                    洞察生成
                           │
                           ▼
┌─────────┐              ┌─────────┐
│  NONE   │              │   NEW   │
└─────────┘              └────┬────┘
                              │
                              │ 用户查看
                              ▼
┌─────────┐    用户行动     ┌─────────┐
│ACTIONED │◀───────────────│ VIEWED  │
└────┬────┘                └────┬────┘
     │                          │
     │                          │ 用户忽略
     │                          ▼
     │                   ┌─────────┐
     │                   │DISMISSED│
     │                   └─────────┘
     │
     │ 用户标记完成
     ▼
┌─────────┐
│COMPLETED│
└─────────┘

推迟路径:
VIEWED ──用户推迟──▶ SNOOZED ──延迟到期──▶ NEW

过期处理:
任意状态 ──超过过期时间──▶ EXPIRED

状态转换表:
+---------------+---------------+---------------+------------------+
| 当前状态      | 事件          | 条件          | 下一状态         |
+---------------+---------------+---------------+------------------+
| NEW           | view          | -             | VIEWED           |
| NEW           | expire        | 超过过期时间   | EXPIRED          |
| VIEWED        | action        | 用户采取行动   | ACTIONED         |
| VIEWED        | dismiss       | 用户忽略      | DISMISSED        |
| VIEWED        | snooze        | 用户推迟      | SNOOZED          |
| VIEWED        | expire        | 超过过期时间   | EXPIRED          |
| SNOOZED       | wake          | 延迟到期      | NEW              |
| SNOOZED       | expire        | 超过最大延迟   | EXPIRED          |
| ACTIONED      | complete      | 标记完成      | COMPLETED        |
| *             | feedback      | helpful       | (记录反馈)       |
+---------------+---------------+---------------+------------------+
```

#### 3.3.4 详细功能流程

**流程 1: 洞察生成与推送**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  触发事件   │     │  规则引擎   │     │  生成洞察   │
│  (多源)     │────▶│  匹配规则   │────▶│  候选       │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  推送用户   │◀────│  过滤排序   │◀────│  去重检查   │
│  (多渠道)   │     │  (优先级)   │     │  (防重复)   │
└─────────────┘     └─────────────┘     └─────────────┘

触发源:
1. 定时任务 (每日 9:00 扫描)
2. 胶囊创建/更新事件
3. 实体关系变化
4. 外部数据更新 (RSS/论文库)

去重策略:
- 基于内容指纹 (hash)
- 时间窗口内去重 (7天/30天)
- 相似洞察合并

过滤规则:
- 用户设置偏好
- 洞察类型开关
- 频率限制 (每日最多 N 条)
- 免打扰时段
```

**流程 2: 任务提醒洞察**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  NLP 分析   │     │  提取日期   │     │  验证日期   │
│  胶囊内容   │────▶│  和承诺     │────▶│  有效性     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┴──────────────────┐
                    │ 有效                                          │ 无效
                    ▼                                               ▼
            ┌─────────────┐                                  ┌─────────────┐
            │  计算提醒    │                                  │  记录日志   │
            │  时间点      │                                  │  丢弃       │
            └──────┬──────┘                                  └─────────────┘
                   │
                   ▼
            ┌─────────────┐
            │  创建洞察    │
            │  设置过期    │
            └─────────────┘

NLP 提取模式:
- "本周五前完成报告" → 提取 "本周五"
- "deadline: 2026-03-15" → 提取 "2026-03-15"
- "记得明天给张三打电话" → 提取 "明天" + 承诺类型

日期解析:
- 相对日期: "明天" "下周三" "3天后"
- 绝对日期: "2026-03-15" "3月15日"
- 模糊日期: "月底前" → 取当月最后一天

提醒策略:
- 高优先级: 提前 1/3/7 天提醒
- 中优先级: 提前 3/7 天提醒
- 低优先级: 提前 7 天提醒
```

**流程 3: 知识空白检测**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  分析用户   │     │  查询知识   │     │  识别缺失    │
│  学习主题   │────▶│  依赖图谱   │────▶│  前置知识   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  生成学习   │◀────│  推荐资源   │◀────│  匹配用户    │
│  建议洞察   │     │  (可选)     │     │  现有知识   │
└─────────────┘     └─────────────┘     └─────────────┘

知识依赖示例:
- 机器学习 → 需要: 线性代数、概率论、Python
- React → 需要: JavaScript、HTML/CSS、Node.js

检测逻辑:
1. 识别用户正在学习的主题 (基于最近胶囊标签)
2. 查询该主题的依赖知识图谱
3. 对比用户已有知识 (实体/标签)
4. 找出缺失的前置知识
5. 生成洞察，推荐学习路径

个性化排序:
- 基于用户学习目标优先级
- 基于缺失知识的基础程度
- 基于用户可用学习时间
```

#### 3.3.5 时序图 - 洞察生成与交互

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌─────────┐
│  User   │    │ Frontend │    │Insight API  │    │ NLP Eng. │    │ Database│
└────┬────┘    └────┬─────┘    └──────┬──────┘    └────┬─────┘    └────┬────┘
     │              │                 │                │               │
     │              │                 │ 定时触发       │               │
     │              │                 │◀───────────────│               │
     │              │                 │                │               │
     │              │                 │ 1.查询近期胶囊  │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │ 2.返回胶囊内容  │               │
     │              │                 │◀───────────────────────────────│
     │              │                 │                │               │
     │              │                 │ 3.NLP 分析     │               │
     │              │                 │────────────────▶               │
     │              │                 │                │               │
     │              │                 │ 4.返回提取结果  │               │
     │              │                 │◀───────────────│               │
     │              │                 │                │               │
     │              │                 │ 5.应用规则引擎  │               │
     │              │                 │                │               │
     │              │                 │ 6.生成洞察候选  │               │
     │              │                 │                │               │
     │              │                 │ 7.去重过滤     │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │                 │ 8.确认可创建   │               │
     │              │                 │◀───────────────────────────────│
     │              │                 │                │               │
     │              │                 │ 9.保存洞察     │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │ 10.推送通知   │                 │                │               │
     │◀───────────────────────────────│                │               │
     │              │                 │                │               │
     │ 11.查看洞察   │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │ 12.获取洞察列表  │                │               │
     │              │────────────────▶│                │               │
     │              │                 │                │               │
     │              │ 13.返回洞察详情  │                │               │
     │              │◀────────────────│                │               │
     │              │                 │                │               │
     │ 14.显示洞察   │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
     │ 15.标记已行动 │                 │                │               │
     │─────────────▶│                 │                │               │
     │              │ 16.更新状态     │                │               │
     │              │────────────────▶│                │               │
     │              │                 │ 17.保存状态    │               │
     │              │                 │───────────────────────────────▶│
     │              │                 │                │               │
     │              │ 18.确认更新     │                │               │
     │              │◀────────────────│                │               │
     │              │                 │                │               │
     │ 19.显示完成   │                 │                │               │
     │◀─────────────│                 │                │               │
     │              │                 │                │               │
```

---

## 4. 数据模型设计

### 4.1 核心实体关系图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     User        │────<│   Capsule       │>────│     Tag         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │              ┌────────┴────────┐
         │              │                 │
         ▼              ▼                 ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  ReviewCard     │  │    Entity       │  │   Insight       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         │              ┌─────┴─────┐
         │              │           │
         ▼              ▼           ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ ReviewSession   │  │   Relation      │  │  MaintenanceLog │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 4.2 详细数据模型

#### 4.2.1 ReviewCard (复习卡片)

```typescript
interface ReviewCard {
  id: string;                    // 唯一标识
  userId: string;                // 所属用户
  capsuleId: string;             // 来源胶囊
  
  // 卡片内容
  front: string;                 // 正面内容（问题/提示）
  back: string;                  // 背面内容（答案）
  cardType: 'flashcard' | 'qa' | 'fill_blank' | 'cloze';
  
  // SM-2 算法参数
  easinessFactor: number;        // 难度系数 (默认 2.5)
  interval: number;              // 当前间隔（天）
  repetitionCount: number;       // 连续成功次数
  
  // 状态
  nextReviewAt: Date;            // 下次复习时间
  lastReviewedAt: Date | null;   // 上次复习时间
  status: 'new' | 'scheduled' | 'learning' | 'review' | 'mastered' | 'suspended';
  
  // 统计
  totalReviews: number;          // 总复习次数
  correctCount: number;          // 正确次数
  streak: number;                // 当前连续正确次数
  
  // 元数据
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.2.2 ReviewSession (复习会话)

```typescript
interface ReviewSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  
  // 会话统计
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  averageTimePerCard: number;    // 秒
  
  // 详细记录
  reviews: ReviewLog[];
}

interface ReviewLog {
  cardId: string;
  rating: 0 | 1 | 2 | 3 | 4 | 5; // 用户评分
  responseTime: number;          // 响应时间（秒）
  reviewedAt: Date;
  
  // 算法参数（记录当时值）
  previousInterval: number;
  newInterval: number;
  previousEF: number;
  newEF: number;
}
```

#### 4.2.3 Entity (实体)

```typescript
interface Entity {
  id: string;
  userId: string;
  
  // 基本信息
  name: string;
  type: 'person' | 'place' | 'organization' | 'concept' | 'event' | 'topic' | 'other';
  aliases: string[];             // 别名
  
  // 描述
  description: string;
  summary: string;               // AI 生成的摘要
  
  // 图谱属性
  mentionCount: number;          // 被提及次数
  firstSeenAt: Date;
  lastSeenAt: Date;
  
  // 向量表示
  embedding: number[];           // 用于语义搜索
  
  // 状态
  status: 'active' | 'merged' | 'archived';
  mergedIntoId: string | null;   // 合并目标实体
  
  // 元数据
  tags: string[];
  sourceCapsuleIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.2.4 Relation (关系)

```typescript
interface Relation {
  id: string;
  userId: string;
  
  // 关系端点
  sourceEntityId: string;
  targetEntityId: string;
  
  // 关系类型
  type: 'related_to' | 'part_of' | 'causes' | 'influences' | 'contradicts' | 'supports' | 'custom';
  customType: string | null;
  
  // 关系属性
  description: string;
  strength: number;              // 关系强度 0-1
  isInferred: boolean;           // 是否 AI 推断
  isConfirmed: boolean;          // 用户是否确认
  
  // 来源
  sourceCapsuleIds: string[];
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.2.5 Insight (洞察)

```typescript
interface Insight {
  id: string;
  userId: string;
  
  // 洞察内容
  type: 'task_reminder' | 'knowledge_gap' | 'connection' | 'action_suggestion' | 'habit_analysis' | 'opportunity';
  title: string;
  description: string;
  
  // 优先级和状态
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'viewed' | 'actioned' | 'dismissed' | 'snoozed' | 'expired' | 'completed';
  
  // 关联数据
  relatedCapsuleIds: string[];
  relatedEntityIds: string[];
  suggestedAction: string | null;
  
  // 时间
  generatedAt: Date;
  expiresAt: Date | null;
  actionedAt: Date | null;
  snoozedUntil: Date | null;
  
  // 反馈
  userFeedback: 'helpful' | 'not_helpful' | null;
  
  // 去重指纹
  contentHash: string;
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.2.6 MaintenanceLog (维护日志)

```typescript
interface MaintenanceLog {
  id: string;
  userId: string;
  
  // 维护信息
  taskType: 'entity_merge' | 'relation_discovery' | 'tag_optimization' | 'stale_detection' | 'orphan_cleanup';
  description: string;
  
  // 影响范围
  affectedEntityIds: string[];
  affectedRelationIds: string[];
  
  // 状态
  status: 'pending' | 'auto_approved' | 'awaiting_user_review' | 'approved' | 'rejected' | 'applied' | 'failed' | 'reverted';
  confidence: number;            // AI 置信度
  
  // 变更详情
  changes: MaintenanceChange[];
  
  // 审核
  reviewedAt: Date | null;
  reviewedBy: 'user' | 'system' | null;
  reviewComment: string | null;
  
  // 执行记录
  appliedAt: Date | null;
  errorMessage: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

interface MaintenanceChange {
  entityId: string;
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'create' | 'update' | 'delete' | 'merge';
}
```

#### 4.2.7 UserSettings (用户设置)

```typescript
interface UserSettings {
  userId: string;
  
  // 间隔重复设置
  spacedRepetition: {
    enabled: boolean;
    dailyReviewLimit: number;      // 每日复习上限 (默认 50)
    newCardsPerDay: number;        // 每日新卡片上限 (默认 20)
    defaultEasinessFactor: number; // 默认 EF (默认 2.5)
    notificationEnabled: boolean;
    notificationTime: string;      // "09:00"
    notificationChannels: ('in_app' | 'desktop' | 'email')[];
  };
  
  // 图谱维护设置
  graphMaintenance: {
    enabled: boolean;
    autoMergeThreshold: number;    // 自动合并阈值 (默认 0.90)
    autoApplyConfidence: number;   // 自动应用置信度 (默认 0.95)
    scanInterval: 'daily' | 'weekly' | 'manual';
    scanTime: string;              // "02:00" (低峰期)
  };
  
  // 洞察设置
  insights: {
    enabled: boolean;
    types: {
      task_reminder: boolean;
      knowledge_gap: boolean;
      connection: boolean;
      action_suggestion: boolean;
      habit_analysis: boolean;
      opportunity: boolean;
    };
    notificationFrequency: 'realtime' | 'daily_digest' | 'weekly_digest';
    maxPerDay: number;             // 每日最大洞察数 (默认 10)
    quietHours: {
      enabled: boolean;
      start: string;               // "22:00"
      end: string;                 // "08:00"
    };
  };
  
  updatedAt: Date;
}
```

---

## 5. API 接口设计

### 5.1 间隔重复系统 API

#### 5.1.1 复习卡片管理

```
GET    /api/v1/review-cards              # 获取卡片列表（支持过滤、分页）
POST   /api/v1/review-cards              # 创建新卡片
GET    /api/v1/review-cards/:id          # 获取单个卡片详情
PUT    /api/v1/review-cards/:id          # 更新卡片
DELETE /api/v1/review-cards/:id          # 删除卡片

POST   /api/v1/review-cards/:id/suspend  # 暂停卡片
POST   /api/v1/review-cards/:id/resume   # 恢复卡片
POST   /api/v1/review-cards/:id/reset    # 重置卡片进度
```

**请求/响应示例**:

```typescript
// POST /api/v1/review-cards
// Request
{
  "capsuleId": "cap_xxx",
  "front": "什么是间隔重复？",
  "back": "一种基于遗忘曲线的学习方法，在最佳时间间隔复习内容",
  "cardType": "flashcard",
  "tags": ["学习方法", "记忆"]
}

// Response 201
{
  "id": "rc_xxx",
  "front": "什么是间隔重复？",
  "back": "一种基于遗忘曲线的学习方法，在最佳时间间隔复习内容",
  "cardType": "flashcard",
  "status": "new",
  "easinessFactor": 2.5,
  "interval": 0,
  "repetitionCount": 0,
  "nextReviewAt": "2026-03-01T09:00:00Z",
  "createdAt": "2026-03-01T01:20:00Z"
}
```

#### 5.1.2 复习会话

```
GET    /api/v1/review-sessions/due        # 获取今日待复习卡片
POST   /api/v1/review-sessions            # 开始复习会话
POST   /api/v1/review-sessions/:id/review # 提交复习结果
GET    /api/v1/review-sessions/:id        # 获取会话详情
GET    /api/v1/review-sessions/stats      # 获取学习统计
GET    /api/v1/review-sessions/heatmap    # 获取学习热力图数据
```

**请求/响应示例**:

```typescript
// POST /api/v1/review-sessions/:id/review
// Request
{
  "cardId": "rc_xxx",
  "rating": 4,              // 0-5，用户自评
  "responseTime": 5.2       // 响应时间（秒）
}

// Response 200
{
  "reviewLog": {
    "cardId": "rc_xxx",
    "rating": 4,
    "previousInterval": 1,
    "newInterval": 3,
    "previousEF": 2.5,
    "newEF": 2.6,
    "reviewedAt": "2026-03-01T09:30:00Z"
  },
  "card": {
    "id": "rc_xxx",
    "status": "review",
    "nextReviewAt": "2026-03-04T09:00:00Z",
    "streak": 1,
    "totalReviews": 5
  }
}
```

#### 5.1.3 自动提取

```
POST   /api/v1/review-cards/extract       # 从胶囊自动提取知识点
GET    /api/v1/review-cards/extract/:jobId/status  # 查询提取任务状态
POST   /api/v1/review-cards/extract/:jobId/confirm  # 确认提取结果
```

```typescript
// POST /api/v1/review-cards/extract
// Request
{
  "capsuleId": "cap_xxx",
  "extractionOptions": {
    "maxCards": 10,
    "cardTypes": ["flashcard", "qa"],
    "includeCode": true,
    "language": "zh"
  }
}

// Response 202
{
  "jobId": "job_xxx",
  "status": "processing",
  "estimatedCompletion": "2026-03-01T01:25:00Z"
}

// GET /api/v1/review-cards/extract/job_xxx/status
// Response 200
{
  "jobId": "job_xxx",
  "status": "completed",
  "result": {
    "extractedCards": [
      {
        "front": "什么是间隔重复？",
        "back": "一种基于遗忘曲线的学习方法...",
        "cardType": "flashcard",
        "confidence": 0.92,
        "sourceText": "原文段落"
      }
    ],
    "totalFound": 5,
    "processingTime": 3.2
  }
}
```

### 5.2 知识图谱维护 API

#### 5.2.1 实体管理

```
GET    /api/v1/entities                   # 获取实体列表
POST   /api/v1/entities                   # 创建实体
GET    /api/v1/entities/:id               # 获取实体详情
PUT    /api/v1/entities/:id               # 更新实体
DELETE /api/v1/entities/:id               # 删除实体

GET    /api/v1/entities/:id/relations     # 获取实体相关关系
GET    /api/v1/entities/:id/similar       # 获取相似实体
POST   /api/v1/entities/:id/merge         # 合并实体
GET    /api/v1/entities/search            # 语义搜索实体
```

#### 5.2.2 关系管理

```
GET    /api/v1/relations                  # 获取关系列表
POST   /api/v1/relations                  # 创建关系
PUT    /api/v1/relations/:id              # 更新关系
DELETE /api/v1/relations/:id              # 删除关系
POST   /api/v1/relations/:id/confirm      # 确认推断关系
POST   /api/v1/relations/discover         # 触发关系发现
```

#### 5.2.3 维护任务

```
GET    /api/v1/maintenance/tasks          # 获取维护任务列表
POST   /api/v1/maintenance/scan           # 触发手动扫描
POST   /api/v1/maintenance/tasks/:id/approve   # 批准维护任务
POST   /api/v1/maintenance/tasks/:id/reject    # 拒绝维护任务
POST   /api/v1/maintenance/tasks/:id/revert    # 撤销已执行任务
GET    /api/v1/maintenance/health         # 获取图谱健康度报告
GET    /api/v1/maintenance/stats          # 获取维护统计
```

**响应示例**:

```typescript
// GET /api/v1/maintenance/health
// Response 200
{
  "overallScore": 85,
  "grade": "good",
  "lastScanAt": "2026-03-01T02:00:00Z",
  "metrics": {
    "entityCount": 150,
    "relationCount": 320,
    "orphanEntities": 5,
    "potentialDuplicates": 3,
    "staleEntities": 2,
    "brokenRelations": 0
  },
  "suggestions": [
    {
      "type": "entity_merge",
      "description": "发现 3 对潜在重复实体",
      "priority": "medium",
      "estimatedImpact": "减少 2% 冗余"
    },
    {
      "type": "orphan_cleanup",
      "description": "5 个孤立实体需要处理",
      "priority": "low",
      "estimatedImpact": "改善图谱连通性"
    }
  ],
  "trends": {
    "scoreChange": +3,
    "period": "7d"
  }
}
```

### 5.3 洞察系统 API

#### 5.3.1 洞察管理

```
GET    /api/v1/insights                   # 获取洞察列表
GET    /api/v1/insights/:id               # 获取单个洞察
POST   /api/v1/insights/:id/action        # 标记已行动
POST   /api/v1/insights/:id/dismiss       # 忽略洞察
POST   /api/v1/insights/:id/snooze        # 推迟洞察
POST   /api/v1/insights/:id/feedback      # 提交反馈
GET    /api/v1/insights/stats             # 获取洞察统计
```

**响应示例**:

```typescript
// GET /api/v1/insights
// Response 200
{
  "insights": [
    {
      "id": "ins_xxx",
      "type": "task_reminder",
      "title": "待办提醒：完成项目报告",
      "description": "您在 2 月 25 日的会议笔记中提到需要在本周五前完成项目报告",
      "priority": "high",
      "priorityScore": 85,
      "status": "new",
      "relatedCapsuleIds": ["cap_xxx"],
      "relatedEntityIds": ["ent_project_x"],
      "suggestedAction": "查看相关笔记并创建任务",
      "generatedAt": "2026-03-01T00:00:00Z",
      "expiresAt": "2026-03-06T00:00:00Z"
    },
    {
      "id": "ins_yyy",
      "type": "connection",
      "title": "发现知识关联",
      "description": "您新添加的论文与之前收藏的《深度学习入门》相关",
      "priority": "medium",
      "priorityScore": 62,
      "status": "new",
      "relatedCapsuleIds": ["cap_new", "cap_old"],
      "suggestedAction": "查看关联内容",
      "generatedAt": "2026-02-28T20:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "pageSize": 10
  },
  "unreadCount": 5,
  "highPriorityCount": 2
}
```

#### 5.3.2 洞察设置

```
GET    /api/v1/insights/settings          # 获取洞察设置
PUT    /api/v1/insights/settings          # 更新洞察设置
POST   /api/v1/insights/rules/test        # 测试规则
```

### 5.4 统计与仪表盘 API

```
GET    /api/v1/stats/review               # 复习统计
GET    /api/v1/stats/knowledge            # 知识库统计
GET    /api/v1/stats/insights             # 洞察统计
GET    /api/v1/dashboard                  # 仪表盘数据（聚合）
GET    /api/v1/dashboard/activities       # 近期活动
```

**响应示例**:

```typescript
// GET /api/v1/dashboard
// Response 200
{
  "review": {
    "dueToday": 12,
    "dueTomorrow": 8,
    "streakDays": 15,
    "totalCards": 156,
    "masteredCards": 45,
    "learningCards": 32,
    "todayCompleted": 8,
    "weeklyAverage": 18.5
  },
  "knowledge": {
    "totalCapsules": 89,
    "totalEntities": 150,
    "totalRelations": 320,
    "thisWeekCapsules": 5,
    "growthRate": "+12%"
  },
  "insights": {
    "unreadCount": 5,
    "highPriority": 2,
    "todayGenerated": 3,
    "thisWeekHelpful": 8
  },
  "maintenance": {
    "healthScore": 85,
    "healthGrade": "good",
    "pendingTasks": 3,
    "lastScanAt": "2026-03-01T02:00:00Z"
  },
  "activity": {
    "lastActiveAt": "2026-03-01T08:30:00Z",
    "dailyGoalProgress": 0.67,
    "weeklyGoalProgress": 0.82
  }
}
```

---

## 6. 边界情况与异常处理

### 6.1 数据一致性保障

**事务处理**:
```
所有涉及多表更新的操作必须使用事务:
1. 实体合并: Entity + Relation + Capsule 引用更新
2. 复习评分: ReviewCard + ReviewLog + ReviewSession
3. 洞察行动: Insight + 可能的 Capsule/Entity 更新

事务隔离级别: READ COMMITTED
超时时间: 30 秒
重试策略: 指数退避，最多 3 次
```

**并发控制**:
```
- 乐观锁: 使用 version 字段检测冲突
- 悲观锁: 长时间操作使用 SELECT FOR UPDATE
- 分布式锁: 定时任务使用 Redis 分布式锁
```

### 6.2 异常场景处理

| 场景 | 检测方式 | 处理策略 | 用户通知 |
|------|----------|----------|----------|
| 复习会话中断 | 心跳超时 | 保存进度，下次恢复 | 提示"继续上次会话" |
| AI 提取失败 | API 错误码 | 回退到手动创建 | 提示"自动提取失败，请手动创建" |
| 实体合并冲突 | 外键约束 | 暂停合并，记录日志 | 提示"合并冲突，请手动解决" |
| 洞察重复生成 | 内容指纹 | 自动去重 | 无 |
| 数据损坏 | 校验和失败 | 从备份恢复 | 提示"数据已恢复" |
| 存储空间不足 | 磁盘监控 | 暂停非关键任务 | 提示"存储空间不足" |

### 6.3 性能边界

| 指标 | 上限 | 处理策略 |
|------|------|----------|
| 单用户卡片数 | 100,000 | 归档旧卡片，分页加载 |
| 单用户实体数 | 50,000 | 实体合并，分层存储 |
| 单次复习会话 | 200 张 | 分批处理，保存进度 |
| 洞察生成频率 | 100/小时 | 限流，优先级队列 |
| 相似度计算 | 10,000 对/秒 | 批量处理，缓存结果 |

---

## 7. 非功能性需求

### 7.1 性能要求

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| API 响应时间 | P95 < 200ms | K6 压力测试 |
| 复习卡片加载 | < 100ms | 前端性能监控 |
| 知识图谱查询 | < 500ms | 数据库慢查询日志 |
| 洞察生成 | 异步处理 | 队列延迟监控 |
| 同时在线用户 | 1000+ | 负载测试 |

### 7.2 安全要求

- 所有 API 需要认证（沿用现有认证机制）
- 敏感操作需要审计日志
- 用户数据隔离，防止跨用户访问
- 本地优先，云端同步需加密
- SQL 注入防护（使用 ORM 参数化查询）
- XSS 防护（输入过滤，输出转义）

### 7.3 兼容性要求

- 向后兼容 Phase 1/2 的数据模型
- API 版本控制（v1）
- 支持渐进式升级
- 数据库迁移脚本

---

## 8. 实施优先级

### Phase 3.1 (MVP - 4 周)
- [ ] 基础复习卡片 CRUD
- [ ] SM-2 算法实现
- [ ] 简单复习界面
- [ ] 基础实体相似度检测

### Phase 3.2 (核心功能 - 4 周)
- [ ] 自动知识点提取
- [ ] 复习统计与仪表盘
- [ ] 实体合并工作流
- [ ] 基础洞察生成（任务提醒）

### Phase 3.3 (增强功能 - 4 周)
- [ ] 多种卡片类型支持
- [ ] 关系自动发现
- [ ] 洞察中心完整功能
- [ ] 通知系统

### Phase 3.4 (优化 - 2 周)
- [ ] 性能优化
- [ ] 用户体验优化
- [ ] 文档完善
- [ ] Bug 修复

---

## 9. 附录

### 9.1 术语表

| 术语 | 解释 |
|------|------|
| Capsule | 知识胶囊，CapsulaAI 的核心存储单元 |
| Entity | 实体，知识图谱中的节点（人、地点、概念等） |
| Relation | 关系，知识图谱中实体间的连接 |
| SM-2 | SuperMemo-2，一种间隔重复算法 |
| EF | Easiness Factor，难度系数 |
| Insight | 洞察，系统基于知识生成的智能建议 |
| Maintenance Task | 维护任务，图谱自动维护的工作单元 |

### 9.2 参考资源

- [SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Spaced Repetition](https://gwern.net/spaced-repetition)
- [Knowledge Graph Maintenance](https://arxiv.org/abs/2001.08814)
- [Levenshtein Distance](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [Jaro-Winkler Distance](https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance)

### 9.3 变更日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-01 | 初始版本，基础功能设计 |
| v2.0 | 2026-03-01 | 增强版本，添加详细逻辑、状态机、算法、边界处理、时序图 |

---

**文档状态**: 待评审（已增强）  
**下一步**: 等待用户 Review 和反馈，确认后进入 UI/UX 设计阶段

