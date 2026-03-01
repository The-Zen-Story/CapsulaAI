# CapsulaAI Phase 3 技术方案文档

**版本**: v1.0  
**日期**: 2026-03-01  
**状态**: 待评审  
**作者**: Technical Architect

---

## 目录

1. [系统架构概览](#1-系统架构概览)
2. [数据库 Schema 设计](#2-数据库-schema-设计)
3. [API 接口设计](#3-api-接口设计)
4. [核心算法实现方案](#4-核心算法实现方案)
5. [第三方库/工具选型](#5-第三方库工具选型)
6. [性能优化策略](#6-性能优化策略)
7. [测试策略](#7-测试策略)
8. [实施计划](#8-实施计划)

---

## 1. 系统架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React + TypeScript)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Review    │  │ Maintenance │  │   Insights  │  │   Settings          │ │
│  │   Module    │  │   Module    │  │   Module    │  │   Module            │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                    │            │
│         └────────────────┴────────────────┴────────────────────┘            │
│                                       │                                     │
│                              React Query / Zustand                          │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ HTTP/WebSocket
┌───────────────────────────────────────┼─────────────────────────────────────┐
│                           Backend (Node.js + Express)                       │
│  ┌────────────────────────────────────┼────────────────────────────────┐   │
│  │                           API Layer                                 │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │Review Routes│ │Maint. Routes│ │Insight Routes│ │Stats Routes│   │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘   │   │
│  │         └───────────────┴───────────────┴───────────────┘           │   │
│  │                              │                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                     Service Layer                              │  │   │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │  │   │
│  │  │  │ReviewService│ │GraphMaint.  │ │InsightEngine│              │  │   │
│  │  │  │             │ │  Service    │ │             │              │  │   │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘              │  │   │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │  │   │
│  │  │  │SM2Algorithm │ │Similarity   │ │RuleEngine   │              │  │   │
│  │  │  │             │ │  Service    │ │             │              │  │   │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘              │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                              │                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                     Job Queue (BullMQ)                         │  │   │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │  │   │
│  │  │  │ReviewCard   │ │EntityMerge  │ │InsightGen   │              │  │   │
│  │  │  │  Extract    │ │  Worker     │ │  Worker     │              │  │   │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘              │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                     Scheduler (node-cron)                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │   │
│  │  │Daily Review │ │Graph Health │ │Insight Scan │                   │   │
│  │  │  Reminder   │ │   Scan      │ │   Job       │                   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────┼─────────────────────────────────────┐
│                           Data Layer                                        │
│  ┌─────────────────────┐  ┌──────────┴──────────┐  ┌─────────────────────┐  │
│  │   PostgreSQL        │  │      MinIO          │  │      Redis          │  │
│  │  (Prisma ORM)       │  │  (Object Storage)   │  │   (BullMQ/Cache)    │  │
│  │                     │  │                     │  │                     │  │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │
│  │  │  ReviewCard   │  │  │  │   Assets      │  │  │  │  Job Queue    │  │  │
│  │  │  ReviewSession│  │  │  │   (Images)    │  │  │  │  Cache        │  │  │
│  │  │  ReviewLog    │  │  │  └───────────────┘  │  │  │  Rate Limit   │  │  │
│  │  ├───────────────┤  │  │                     │  │  └───────────────┘  │  │
│  │  │  Entity       │  │  │                     │  │                     │  │
│  │  │  Relation     │  │  │                     │  │                     │  │
│  │  ├───────────────┤  │  │                     │  │                     │  │
│  │  │  Insight      │  │  │                     │  │                     │  │
│  │  │  Maintenance  │  │  │                     │  │                     │  │
│  │  │  Task         │  │  │                     │  │                     │  │
│  │  ├───────────────┤  │  │                     │  │                     │  │
│  │  │  UserSettings │  │  │                     │  │                     │  │
│  │  └───────────────┘  │  │                     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 模块划分

| 模块 | 职责 | 核心文件 |
|------|------|----------|
| **Review Module** | 间隔重复系统 | `services/review/`, `routes/review/` |
| **Graph Maintenance** | 知识图谱自动维护 | `services/maintenance/`, `routes/maintenance/` |
| **Insights Module** | 动态可执行洞察 | `services/insights/`, `routes/insights/` |
| **Scheduler** | 定时任务调度 | `services/scheduler/` |
| **AI Integration** | AI 服务集成 | `services/ai/` |

---

## 2. 数据库 Schema 设计

### 2.1 Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// 现有模型 (Phase 1/2)
// ============================================

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  capsules      Capsule[]
  entities      Entity[]
  relations     Relation[]
  reviewCards   ReviewCard[]
  reviewSessions ReviewSession[]
  insights      Insight[]
  maintenanceTasks MaintenanceTask[]
  settings      UserSettings?
}

model Capsule {
  id          String   @id @default(uuid())
  userId      String
  rawContent  String?
  summary     String?
  sourceTypes String[]
  status      CapsuleStatus @default(PENDING)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  reviewCards ReviewCard[]
  insights    Insight[]
}

model Entity {
  id              String   @id @default(uuid())
  userId          String
  name            String
  normalizedName  String
  type            EntityType
  aliases         String[]
  description     String?
  mentionCount    Int      @default(0)
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @updatedAt
  status          EntityStatus @default(ACTIVE)
  mergedIntoId    String?
  
  // Vector embedding for semantic search
  embedding       Unsupported("vector(1536)")?

  user            User     @relation(fields: [userId], references: [id])
  mergedInto      Entity?  @relation("EntityMerge", fields: [mergedIntoId], references: [id])
  mergedEntities  Entity[] @relation("EntityMerge")
  sourceRelations Relation[] @relation("SourceEntity")
  targetRelations Relation[] @relation("TargetEntity")
}

model Relation {
  id              String   @id @default(uuid())
  userId          String
  sourceEntityId  String
  targetEntityId  String
  type            RelationType
  customType      String?
  description     String?
  strength        Float    @default(0.5)
  isInferred      Boolean  @default(false)
  isConfirmed     Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id])
  sourceEntity    Entity   @relation("SourceEntity", fields: [sourceEntityId], references: [id])
  targetEntity    Entity   @relation("TargetEntity", fields: [targetEntityId], references: [id])
}

// ============================================
// Phase 3: 间隔重复系统
// ============================================

model ReviewCard {
  id                String   @id @default(uuid())
  userId            String
  capsuleId         String?
  
  // Card Content
  front             String
  back              String
  cardType          CardType @default(FLASHCARD)
  
  // SM-2 Algorithm Parameters
  easinessFactor    Float    @default(2.5)
  interval          Int      @default(0)  // days
  repetitionCount   Int      @default(0)
  
  // Scheduling
  nextReviewAt      DateTime @default(now())
  lastReviewedAt    DateTime?
  status            ReviewStatus @default(NEW)
  
  // Statistics
  totalReviews      Int      @default(0)
  correctCount      Int      @default(0)
  streak            Int      @default(0)
  
  // Metadata
  tags              String[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id])
  capsule           Capsule? @relation(fields: [capsuleId], references: [id])
  reviewLogs        ReviewLog[]
  sessions          ReviewSessionCard[]

  @@index([userId, nextReviewAt])
  @@index([userId, status])
  @@index([capsuleId])
}

model ReviewSession {
  id                String   @id @default(uuid())
  userId            String
  startedAt         DateTime @default(now())
  endedAt           DateTime?
  
  // Statistics
  cardsReviewed     Int      @default(0)
  correctCount      Int      @default(0)
  incorrectCount    Int      @default(0)
  averageTimePerCard Float?
  
  user              User     @relation(fields: [userId], references: [id])
  cards             ReviewSessionCard[]
  logs              ReviewLog[]

  @@index([userId, startedAt])
}

model ReviewSessionCard {
  id              String   @id @default(uuid())
  sessionId       String
  cardId          String
  orderIndex      Int
  
  session         ReviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  card            ReviewCard    @relation(fields: [cardId], references: [id])

  @@unique([sessionId, cardId])
  @@index([sessionId, orderIndex])
}

model ReviewLog {
  id                String   @id @default(uuid())
  userId            String
  cardId            String
  sessionId         String?
  
  // User Response
  rating            Int      // 0-5
  responseTime      Int      // seconds
  reviewedAt        DateTime @default(now())
  
  // Algorithm State (snapshot)
  previousInterval  Int
  newInterval       Int
  previousEF        Float
  newEF             Float

  card              ReviewCard    @relation(fields: [cardId], references: [id])
  session           ReviewSession? @relation(fields: [sessionId], references: [id])

  @@index([userId, reviewedAt])
  @@index([cardId, reviewedAt])
}

// ============================================
// Phase 3: 知识图谱维护
// ============================================

model MaintenanceTask {
  id                String   @id @default(uuid())
  userId            String
  
  // Task Info
  taskType          MaintenanceType
  description       String
  status            MaintenanceStatus @default(PENDING)
  confidence        Float    // 0-1
  
  // Affected Entities/Relations
  sourceEntityId    String?
  targetEntityId    String?
  relationId        String?
  
  // Changes (JSON for flexibility)
  changes           Json?    // MaintenanceChange[]
  
  // Review
  reviewedAt        DateTime?
  reviewedBy        ReviewerType?
  reviewComment     String?
  
  // Execution
  appliedAt         DateTime?
  errorMessage      String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id])

  @@index([userId, status])
  @@index([userId, taskType])
  @@index([confidence])
}

// ============================================
// Phase 3: 洞察系统
// ============================================

model Insight {
  id                String   @id @default(uuid())
  userId            String
  
  // Content
  type              InsightType
  title             String
  description       String
  priority          Priority
  priorityScore     Int      // 0-100
  status            InsightStatus @default(NEW)
  
  // Related Data
  relatedCapsuleIds String[]
  relatedEntityIds  String[]
  suggestedAction   String?
  extractedData     Json?    // Type-specific data (dates, etc.)
  
  // Timing
  generatedAt       DateTime @default(now())
  expiresAt         DateTime?
  actionedAt        DateTime?
  snoozedUntil      DateTime?
  
  // Feedback
  userFeedback      UserFeedback?
  
  // Deduplication
  contentHash       String   @unique
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id])
  capsule           Capsule? @relation(fields: [relatedCapsuleIds], references: [id])

  @@index([userId, status])
  @@index([userId, priority])
  @@index([userId, generatedAt])
  @@index([expiresAt])
}

// ============================================
// Phase 3: 用户设置
// ============================================

model UserSettings {
  id                String   @id @default(uuid())
  userId            String   @unique
  
  // Spaced Repetition Settings (JSON for flexibility)
  spacedRepetition  Json     // SpacedRepetitionSettings
  
  // Graph Maintenance Settings
  graphMaintenance  Json     // GraphMaintenanceSettings
  
  // Insights Settings
  insights          Json     // InsightsSettings
  
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id])
}

// ============================================
// Enums
// ============================================

enum CapsuleStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum EntityType {
  PERSON
  PLACE
  ORGANIZATION
  CONCEPT
  EVENT
  TOPIC
  DOCUMENT
  OTHER
}

enum EntityStatus {
  ACTIVE
  MERGED
  ARCHIVED
}

enum RelationType {
  RELATED_TO
  PART_OF
  CAUSES
  INFLUENCES
  CONTRADICTS
  SUPPORTS
  CUSTOM
}

enum CardType {
  FLASHCARD
  QA
  FILL_BLANK
  CLOZE
}

enum ReviewStatus {
  NEW
  SCHEDULED
  LEARNING
  REVIEW
  MASTERED
  SUSPENDED
}

enum MaintenanceType {
  ENTITY_MERGE
  RELATION_DISCOVERY
  TAG_OPTIMIZATION
  STALE_DETECTION
  ORPHAN_CLEANUP
}

enum MaintenanceStatus {
  PENDING
  AUTO_APPROVED
  AWAITING_USER_REVIEW
  APPROVED
  REJECTED
  APPLIED
  FAILED
  REVERTED
}

enum ReviewerType {
  USER
  SYSTEM
}

enum InsightType {
  TASK_REMINDER
  KNOWLEDGE_GAP
  CONNECTION
  ACTION_SUGGESTION
  HABIT_ANALYSIS
  OPPORTUNITY
}

enum Priority {
  HIGH
  MEDIUM
  LOW
}

enum InsightStatus {
  NEW
  VIEWED
  ACTIONED
  DISMISSED
  SNOOZED
  EXPIRED
  COMPLETED
}

enum UserFeedback {
  HELPFUL
  NOT_HELPFUL
}
```

### 2.2 JSON Schema 定义

```typescript
// types/settings.ts

export interface SpacedRepetitionSettings {
  enabled: boolean;
  dailyReviewLimit: number;      // default: 50
  newCardsPerDay: number;        // default: 20
  defaultEasinessFactor: number; // default: 2.5
  notificationEnabled: boolean;
  notificationTime: string;      // "09:00"
  notificationChannels: ('in_app' | 'desktop' | 'email')[];
}

export interface GraphMaintenanceSettings {
  enabled: boolean;
  autoMergeThreshold: number;    // default: 0.90
  autoApplyConfidence: number;   // default: 0.95
  scanInterval: 'daily' | 'weekly' | 'manual';
  scanTime: string;              // "02:00"
  notificationSettings: {
    onComplete: boolean;
    onTaskPending: boolean;
    onHealthDecline: boolean;
  };
}

export interface InsightsSettings {
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
  maxPerDay: number;             // default: 10
  quietHours: {
    enabled: boolean;
    start: string;               // "22:00"
    end: string;                 // "08:00"
  };
}

export interface MaintenanceChange {
  entityId?: string;
  relationId?: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'create' | 'update' | 'delete' | 'merge';
}
```

---

## 3. API 接口设计

### 3.1 间隔重复系统 API

```typescript
// routes/review/review.routes.ts

import { Router } from 'express';
import { ReviewController } from './review.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ReviewController();

// Card Management
router.get('/cards', authenticate, controller.getCards);
router.post('/cards', authenticate, controller.createCard);
router.get('/cards/:id', authenticate, controller.getCard);
router.put('/cards/:id', authenticate, controller.updateCard);
router.delete('/cards/:id', authenticate, controller.deleteCard);

// Card Actions
router.post('/cards/:id/suspend', authenticate, controller.suspendCard);
router.post('/cards/:id/resume', authenticate, controller.resumeCard);
router.post('/cards/:id/reset', authenticate, controller.resetCard);

// Review Session
router.get('/sessions/due', authenticate, controller.getDueCards);
router.post('/sessions', authenticate, controller.startSession);
router.get('/sessions/:id', authenticate, controller.getSession);
router.post('/sessions/:id/review', authenticate, controller.submitReview);
router.post('/sessions/:id/complete', authenticate, controller.completeSession);

// Statistics
router.get('/stats', authenticate, controller.getStats);
router.get('/stats/heatmap', authenticate, controller.getHeatmap);
router.get('/dashboard', authenticate, controller.getDashboard);

// Auto Extraction
router.post('/extract', authenticate, controller.extractCards);
router.get('/extract/:jobId/status', authenticate, controller.getExtractionStatus);
router.post('/extract/:jobId/confirm', authenticate, controller.confirmExtraction);

export default router;
```

#### 请求/响应示例

```typescript
// GET /api/v1/review/cards?status=scheduled&limit=20
interface GetCardsRequest {
  status?: ReviewStatus;
  tags?: string[];
  search?: string;
  dueBefore?: string; // ISO date
  limit?: number;
  offset?: number;
}

interface GetCardsResponse {
  cards: ReviewCardDTO[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// POST /api/v1/review/sessions/:id/review
interface SubmitReviewRequest {
  cardId: string;
  rating: 0 | 1 | 2 | 3 | 4 | 5;
  responseTime: number; // seconds
}

interface SubmitReviewResponse {
  reviewLog: ReviewLogDTO;
  card: ReviewCardDTO;
  nextCard?: ReviewCardDTO;
  sessionComplete: boolean;
}
```

### 3.2 知识图谱维护 API

```typescript
// routes/maintenance/maintenance.routes.ts

import { Router } from 'express';
import { MaintenanceController } from './maintenance.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new MaintenanceController();

// Entity Management
router.get('/entities', authenticate, controller.getEntities);
router.get('/entities/:id', authenticate, controller.getEntity);
router.get('/entities/:id/relations', authenticate, controller.getEntityRelations);
router.get('/entities/:id/similar', authenticate, controller.getSimilarEntities);
router.post('/entities/:id/merge', authenticate, controller.mergeEntity);

// Relation Management
router.get('/relations', authenticate, controller.getRelations);
router.post('/relations', authenticate, controller.createRelation);
router.put('/relations/:id', authenticate, controller.updateRelation);
router.delete('/relations/:id', authenticate, controller.deleteRelation);
router.post('/relations/:id/confirm', authenticate, controller.confirmRelation);
router.post('/relations/discover', authenticate, controller.discoverRelations);

// Maintenance Tasks
router.get('/tasks', authenticate, controller.getTasks);
router.get('/tasks/:id', authenticate, controller.getTask);
router.post('/tasks/:id/approve', authenticate, controller.approveTask);
router.post('/tasks/:id/reject', authenticate, controller.rejectTask);
router.post('/tasks/:id/revert', authenticate, controller.revertTask);

// Health & Stats
router.get('/health', authenticate, controller.getHealthReport);
router.get('/stats', authenticate, controller.getMaintenanceStats);
router.post('/scan', authenticate, controller.triggerScan);

export default router;
```

### 3.3 洞察系统 API

```typescript
// routes/insights/insights.routes.ts

import { Router } from 'express';
import { InsightsController } from './insights.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new InsightsController();

// Insight Management
router.get('/', authenticate, controller.getInsights);
router.get('/:id', authenticate, controller.getInsight);
router.post('/:id/action', authenticate, controller.markActioned);
router.post('/:id/dismiss', authenticate, controller.dismissInsight);
router.post('/:id/snooze', authenticate, controller.snoozeInsight);
router.post('/:id/feedback', authenticate, controller.submitFeedback);

// Statistics
router.get('/stats', authenticate, controller.getInsightStats);

// Settings
router.get('/settings', authenticate, controller.getSettings);
router.put('/settings', authenticate, controller.updateSettings);

export default router;
```

### 3.4 统一响应格式

```typescript
// types/api.ts

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

// Error Codes
enum ErrorCode {
  // General
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Review
  INVALID_RATING = 'INVALID_RATING',
  CARD_SUSPENDED = 'CARD_SUSPENDED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Maintenance
  MERGE_CONFLICT = 'MERGE_CONFLICT',
  ENTITY_NOT_MERGEABLE = 'ENTITY_NOT_MERGEABLE',
  TASK_ALREADY_APPLIED = 'TASK_ALREADY_APPLIED',
  
  // Insights
  INSIGHT_EXPIRED = 'INSIGHT_EXPIRED',
  INVALID_SNOOZE_DURATION = 'INVALID_SNOOZE_DURATION',
}
```

---

## 4. 核心算法实现方案

### 4.1 SM-2 间隔重复算法

```typescript
// services/review/sm2.algorithm.ts

export interface SM2Card {
  easinessFactor: number;  // EF
  interval: number;        // days
  repetitionCount: number;
}

export interface SM2Result {
  newEF: number;
  newInterval: number;
  newRepetitionCount: number;
  status: 'learning' | 'review' | 'mastered';
}

export class SM2Algorithm {
  private static readonly MIN_EF = 1.3;
  private static readonly MAX_EF = 2.5;
  private static readonly MAX_INTERVAL = 365;

  /**
   * Calculate next review parameters based on user rating
   * @param card Current card state
   * @param rating User rating (0-5)
   * @returns New card parameters
   */
  static calculate(card: SM2Card, rating: number): SM2Result {
    // Validate rating
    if (rating < 0 || rating > 5) {
      throw new Error(`Invalid rating: ${rating}. Must be between 0 and 5.`);
    }

    const { easinessFactor: ef, interval, repetitionCount } = card;

    // Calculate new EF
    let newEF = ef + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    newEF = Math.max(this.MIN_EF, Math.min(this.MAX_EF, newEF));

    let newInterval: number;
    let newRepetitionCount: number;
    let status: SM2Result['status'];

    if (rating < 3) {
      // Failed - reset
      newRepetitionCount = 0;
      newInterval = 1;
      status = 'learning';
    } else {
      // Success
      newRepetitionCount = repetitionCount + 1;

      if (newRepetitionCount === 1) {
        newInterval = 1;
      } else if (newRepetitionCount === 2) {
        newInterval = 6;
      } else {
        newInterval = Math.round(interval * newEF);
      }

      // Bonus for high rating
      if (rating >= 4 && newRepetitionCount > 2) {
        newInterval = Math.round(newInterval * 1.2);
      }

      // Determine status
      if (newRepetitionCount >= 5 && newInterval >= 21) {
        status = 'mastered';
      } else {
        status = 'review';
      }
    }

    // Cap interval
    newInterval = Math.min(newInterval, this.MAX_INTERVAL);

    return {
      newEF: Math.round(newEF * 100) / 100,
      newInterval,
      newRepetitionCount,
      status,
    };
  }

  /**
   * Calculate next review date
   */
  static getNextReviewDate(interval: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + interval);
    // Set to 9:00 AM (user's preferred time)
    date.setHours(9, 0, 0, 0);
    return date;
  }

  /**
   * Handle overdue cards
   */
  static handleOverdue(card: SM2Card, overdueDays: number): SM2Result {
    const threshold = card.interval * 2;
    
    if (overdueDays > threshold) {
      // Treat as failure
      return this.calculate(card, 2);
    }
    
    // Continue with current interval but reduce slightly
    return {
      newEF: card.easinessFactor,
      newInterval: Math.max(1, Math.floor(card.interval * 0.8)),
      newRepetitionCount: card.repetitionCount,
      status: card.repetitionCount >= 5 ? 'review' : 'learning',
    };
  }
}
```

### 4.2 实体相似度计算

```typescript
// services/maintenance/similarity.service.ts

import { distance as levenshteinDistance } from 'fast-levenshtein';
import { jaroWinkler } from 'jaro-winkler';

export interface SimilarityWeights {
  name: number;
  alias: number;
  semantic: number;
  context: number;
  type: number;
}

export const DEFAULT_WEIGHTS: SimilarityWeights = {
  name: 0.25,
  alias: 0.15,
  semantic: 0.35,
  context: 0.15,
  type: 0.10,
};

export class SimilarityService {
  private weights: SimilarityWeights;

  constructor(weights: SimilarityWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculate comprehensive similarity between two entities
   */
  calculateSimilarity(entityA: EntityData, entityB: EntityData): number {
    const nameSim = this.calculateNameSimilarity(entityA.name, entityB.name);
    const aliasSim = this.calculateAliasOverlap(entityA.aliases, entityB.aliases);
    const semanticSim = this.calculateSemanticSimilarity(
      entityA.embedding,
      entityB.embedding
    );
    const contextSim = this.calculateContextSimilarity(
      entityA.relatedEntities,
      entityB.relatedEntities
    );
    const typeSim = entityA.type === entityB.type ? 1.0 : 0.0;

    const totalSim =
      nameSim * this.weights.name +
      aliasSim * this.weights.alias +
      semanticSim * this.weights.semantic +
      contextSim * this.weights.context +
      typeSim * this.weights.type;

    return Math.round(totalSim * 100) / 100;
  }

  /**
   * Calculate name similarity using Levenshtein and Jaro-Winkler
   */
  private calculateNameSimilarity(nameA: string, nameB: string): number {
    const normA = this.normalize(nameA);
    const normB = this.normalize(nameB);

    // Exact match
    if (normA === normB) return 1.0;

    // Substring match
    if (normA.includes(normB) || normB.includes(normA)) return 0.9;

    // Levenshtein similarity
    const maxLen = Math.max(normA.length, normB.length);
    const levDist = levenshteinDistance(normA, normB);
    const levSim = 1 - levDist / maxLen;

    // Jaro-Winkler similarity
    const jaroSim = jaroWinkler(normA, normB);

    // Return max with slight boost for Jaro-Winkler
    return Math.max(levSim, Math.min(1.0, jaroSim * 1.1));
  }

  /**
   * Calculate alias overlap using Jaccard coefficient
   */
  private calculateAliasOverlap(aliasesA: string[], aliasesB: string[]): number {
    const setA = new Set(aliasesA.map(a => this.normalize(a)));
    const setB = new Set(aliasesB.map(b => this.normalize(b)));

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0.0;

    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private calculateSemanticSimilarity(
    embeddingA: number[],
    embeddingB: number[]
  ): number {
    if (!embeddingA || !embeddingB) return 0.0;
    if (embeddingA.length !== embeddingB.length) return 0.0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i];
      normA += embeddingA[i] * embeddingA[i];
      normB += embeddingB[i] * embeddingB[i];
    }

    if (normA === 0 || normB === 0) return 0.0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate context similarity using Jaccard coefficient
   */
  private calculateContextSimilarity(
    relatedA: string[],
    relatedB: string[]
  ): number {
    const setA = new Set(relatedA);
    const setB = new Set(relatedB);

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0.0;

    return intersection.size / union.size;
  }

  /**
   * Normalize string for comparison
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\s\p{P}]/gu, '') // Remove spaces and punctuation
      .trim();
  }

  /**
   * Find similar entity pairs from a list
   */
  async findSimilarPairs(
    entities: EntityData[],
    threshold = 0.7
  ): Promise<SimilarPair[]> {
    const pairs: SimilarPair[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = this.calculateSimilarity(entities[i], entities[j]);
        
        if (similarity >= threshold) {
          pairs.push({
            entityA: entities[i],
            entityB: entities[j],
            similarity,
          });
        }
      }
    }

    // Sort by similarity descending
    return pairs.sort((a, b) => b.similarity - a.similarity);
  }
}

interface EntityData {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  embedding?: number[];
  relatedEntities: string[];
}

interface SimilarPair {
  entityA: EntityData;
  entityB: EntityData;
  similarity: number;
}
```

### 4.3 洞察规则引擎

```typescript
// services/insights/rule-engine.ts

export interface InsightRule {
  id: string;
  type: InsightType;
  priority: Priority;
  trigger: TriggerConfig;
  conditions: Condition[];
  deduplication: DeduplicationConfig;
  expiration: ExpirationConfig;
}

export interface TriggerConfig {
  event?: 'capsule_created' | 'capsule_updated' | 'entity_merged';
  schedule?: string; // cron expression
}

export interface Condition {
  type: 'pattern_match' | 'date_proximity' | 'semantic_similarity' | 'frequency_threshold';
  config: Record<string, unknown>;
}

export interface DeduplicationConfig {
  key: string;
  window: string; // e.g., "7d"
}

export interface ExpirationConfig {
  afterDatePassed?: boolean;
  maxAge?: string; // e.g., "30d"
}

export class InsightRuleEngine {
  private rules: InsightRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  private registerDefaultRules() {
    // Task Reminder Rule
    this.rules.push({
      id: 'task_reminder_001',
      type: 'TASK_REMINDER',
      priority: 'HIGH',
      trigger: {
        schedule: '0 9 * * *', // Daily at 9:00 AM
      },
      conditions: [
        {
          type: 'pattern_match',
          config: {
            patterns: [
              '(截止|deadline|before|之前).*?(\\d{1,2}[月/]\\d{1,2}[日号])',
              '(完成|finish|done).*?(\\d{1,2}[月/]\\d{1,2}[日号])',
            ],
            confidenceThreshold: 0.8,
          },
        },
        {
          type: 'date_proximity',
          config: {
            daysAhead: [1, 3, 7],
          },
        },
      ],
      deduplication: {
        key: '{capsuleId}_{extractedDate}',
        window: '7d',
      },
      expiration: {
        afterDatePassed: true,
        maxAge: '30d',
      },
    });

    // Knowledge Gap Rule
    this.rules.push({
      id: 'knowledge_gap_001',
      type: 'KNOWLEDGE_GAP',
      priority: 'MEDIUM',
      trigger: {
        event: 'capsule_created',
      },
      conditions: [
        {
          type: 'semantic_similarity',
          config: {
            topicThreshold: 0.75,
            missingPrerequisiteThreshold: 0.8,
          },
        },
      ],
      deduplication: {
        key: '{topic}_{prerequisite}',
        window: '30d',
      },
      expiration: {
        maxAge: '14d',
      },
    });

    // Connection Discovery Rule
    this.rules.push({
      id: 'connection_001',
      type: 'CONNECTION',
      priority: 'LOW',
      trigger: {
        event: 'capsule_created',
      },
      conditions: [
        {
          type: 'semantic_similarity',
          config: {
            similarityThreshold: 0.75,
            excludeRecent: '7d',
          },
        },
      ],
      deduplication: {
        key: '{capsuleA}_{capsuleB}',
        window: '30d',
      },
      expiration: {
        maxAge: '7d',
      },
    });
  }

  /**
   * Evaluate rules against context
   */
  async evaluate(
    context: EvaluationContext,
    data: unknown
  ): Promise<InsightCandidate[]> {
    const candidates: InsightCandidate[] = [];

    for (const rule of this.rules) {
      // Check trigger
      if (!this.matchesTrigger(rule.trigger, context)) {
        continue;
      }

      // Check conditions
      const conditionResults = await Promise.all(
        rule.conditions.map(c => this.evaluateCondition(c, data))
      );

      if (conditionResults.every(r => r.matched)) {
        const candidate = this.createCandidate(rule, conditionResults, data);
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private matchesTrigger(trigger: TriggerConfig, context: EvaluationContext): boolean {
    if (trigger.event && trigger.event !== context.event) {
      return false;
    }
    return true;
  }

  private async evaluateCondition(
    condition: Condition,
    data: unknown
  ): Promise<ConditionResult> {
    switch (condition.type) {
      case 'pattern_match':
        return this.evaluatePatternMatch(condition.config, data);
      case 'date_proximity':
        return this.evaluateDateProximity(condition.config, data);
      case 'semantic_similarity':
        return this.evaluateSemanticSimilarity(condition.config, data);
      case 'frequency_threshold':
        return this.evaluateFrequencyThreshold(condition.config, data);
      default:
        return { matched: false };
    }
  }

  private evaluatePatternMatch(
    config: Record<string, unknown>,
    data: unknown
  ): ConditionResult {
    const patterns = config.patterns as string[];
    const content = (data as { content?: string }).content || '';
    const threshold = (config.confidenceThreshold as number) || 0.8;

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = content.match(regex);
      if (match) {
        return {
          matched: true,
          confidence: 1.0,
          extractedData: {
            matchedText: match[0],
            extractedDate: match[1],
          },
        };
      }
    }

    return { matched: false };
  }

  private evaluateDateProximity(
    config: Record<string, unknown>,
    data: unknown
  ): ConditionResult {
    const daysAhead = config.daysAhead as number[];
    const extractedDate = (data as { extractedDate?: string }).extractedDate;

    if (!extractedDate) {
      return { matched: false };
    }

    const targetDate = new Date(extractedDate);
    const now = new Date();
    const diffDays = Math.ceil(
      (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysAhead.includes(diffDays)) {
      return {
        matched: true,
        confidence: 1.0 - diffDays / 30, // Higher confidence for closer dates
        extractedData: { daysUntil: diffDays },
      };
    }

    return { matched: false };
  }

  private async evaluateSemanticSimilarity(
    config: Record<string, unknown>,
    data: unknown
  ): Promise<ConditionResult> {
    // Implementation depends on embedding service
    return { matched: false };
  }

  private evaluateFrequencyThreshold(
    config: Record<string, unknown>,
    data: unknown
  ): ConditionResult {
    // Implementation for habit analysis
    return { matched: false };
  }

  private createCandidate(
    rule: InsightRule,
    conditionResults: ConditionResult[],
    data: unknown
  ): InsightCandidate {
    const avgConfidence =
      conditionResults.reduce((sum, r) => sum + (r.confidence || 0), 0) /
      conditionResults.length;

    return {
      ruleId: rule.id,
      type: rule.type,
      priority: rule.priority,
      priorityScore: this.calculatePriorityScore(rule, conditionResults),
      confidence: avgConfidence,
      deduplicationKey: this.generateDeduplicationKey(rule, data),
      expiresAt: this.calculateExpiration(rule.expiration, conditionResults),
      extractedData: this.mergeExtractedData(conditionResults),
    };
  }

  private calculatePriorityScore(
    rule: InsightRule,
    results: ConditionResult[]
  ): number {
    let baseScore = 0;

    switch (rule.type) {
      case 'TASK_REMINDER':
        const daysUntil = results.find(r => r.extractedData?.daysUntil)
          ?.extractedData?.daysUntil as number;
        baseScore = 100 - (daysUntil || 7) * 10;
        if (daysUntil <= 1) baseScore += 50;
        break;
      case 'KNOWLEDGE_GAP':
        baseScore = 70;
        break;
      case 'CONNECTION':
        baseScore = 50;
        break;
      default:
        baseScore = 50;
    }

    return Math.min(100, Math.max(0, baseScore));
  }

  private generateDeduplicationKey(rule: InsightRule, data: unknown): string {
    // Simple template replacement
    let key = rule.deduplication.key;
    const dataObj = data as Record<string, string>;
    
    for (const [k, v] of Object.entries(dataObj)) {
      key = key.replace(`{${k}}`, String(v));
    }
    
    return key;
  }

  private calculateExpiration(
    config: ExpirationConfig,
    results: ConditionResult[]
  ): Date {
    const now = new Date();
    
    if (config.afterDatePassed) {
      const extractedDate = results.find(r => r.extractedData?.extractedDate)
        ?.extractedData?.extractedDate as string;
      if (extractedDate) {
        return new Date(extractedDate);
      }
    }

    if (config.maxAge) {
      const days = parseInt(config.maxAge);
      now.setDate(now.getDate() + days);
      return now;
    }

    // Default: 7 days
    now.setDate(now.getDate() + 7);
    return now;
  }

  private mergeExtractedData(results: ConditionResult[]): Record<string, unknown> {
    return results.reduce((acc, r) => {
      if (r.extractedData) {
        Object.assign(acc, r.extractedData);
      }
      return acc;
    }, {} as Record<string, unknown>);
  }
}

interface EvaluationContext {
  event?: string;
  timestamp: Date;
  userId: string;
}

interface ConditionResult {
  matched: boolean;
  confidence?: number;
  extractedData?: Record<string, unknown>;
}

interface InsightCandidate {
  ruleId: string;
  type: string;
  priority: string;
  priorityScore: number;
  confidence: number;
  deduplicationKey: string;
  expiresAt: Date;
  extractedData: Record<string, unknown>;
}
```

---

## 5. 第三方库/工具选型

### 5.1 核心依赖

| 类别 | 库名 | 版本 | 用途 |
|------|------|------|------|
| **Backend** | | | |
| Web Framework | express | ^4.18.x | HTTP 服务器 |
| ORM | @prisma/client | ^5.x | 数据库操作 |
| Queue | bullmq | ^4.x | 异步任务队列 |
| Scheduler | node-cron | ^3.x | 定时任务 |
| Validation | zod | ^3.x | 数据验证 |
| **Algorithm** | | | |
| String Similarity | fast-levenshtein | ^3.x | 编辑距离计算 |
| String Similarity | jaro-winkler | ^0.2.x | Jaro-Winkler 相似度 |
| Date Parsing | date-fns | ^3.x | 日期处理 |
| **AI Integration** | | | |
| HTTP Client | axios | ^1.x | API 调用 |
| **Frontend** | | | |
| UI Library | @radix-ui/* | latest | 基础组件 |
| Styling | tailwindcss | ^3.x | CSS 框架 |
| Animation | framer-motion | ^11.x | 动画效果 |
| Charts | recharts | ^2.x | 数据可视化 |
| Calendar | react-calendar-heatmap | ^1.x | 学习热力图 |

### 5.2 开发依赖

| 类别 | 库名 | 用途 |
|------|------|------|
| TypeScript | typescript | 类型检查 |
| Testing | vitest | 单元测试 |
| Testing | @testing-library/react | 组件测试 |
| Linting | eslint | 代码检查 |
| Formatting | prettier | 代码格式化 |

### 5.3 选型理由

1. **BullMQ**: 基于 Redis 的可靠队列，支持延迟任务、优先级、重试策略
2. **Prisma**: 类型安全的数据库操作，优秀的迁移工具
3. **date-fns**: 轻量级、函数式的日期处理，比 moment.js 更小
4. **Zod**: 运行时类型验证，与 TypeScript 完美集成
5. **Framer Motion**: 声明式动画，适合 React 组件动画

---

## 6. 性能优化策略

### 6.1 数据库优化

```sql
-- 关键索引 (已在 Prisma schema 中定义)
-- 复习卡片查询优化
CREATE INDEX CONCURRENTLY "ReviewCard_userId_nextReviewAt_idx" 
  ON "ReviewCard"("userId", "nextReviewAt");

-- 实体相似度查询优化
CREATE INDEX CONCURRENTLY "Entity_userId_normalizedName_idx" 
  ON "Entity"("userId", "normalizedName");

-- 洞察查询优化
CREATE INDEX CONCURRENTLY "Insight_userId_status_priority_idx" 
  ON "Insight"("userId", "status", "priority");

-- 维护任务查询优化
CREATE INDEX CONCURRENTLY "MaintenanceTask_userId_status_idx" 
  ON "MaintenanceTask"("userId", "status");
```

### 6.2 缓存策略

```typescript
// services/cache/cache.service.ts

import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  // Cache keys
  private static KEYS = {
    DUE_CARDS: (userId: string) => `review:due:${userId}`,
    DASHBOARD: (userId: string) => `dashboard:${userId}`,
    HEALTH_SCORE: (userId: string) => `maintenance:health:${userId}`,
    INSIGHTS_COUNT: (userId: string) => `insights:count:${userId}`,
  };

  async getDueCards(userId: string): Promise<ReviewCardDTO[] | null> {
    const cached = await this.redis.get(CacheService.KEYS.DUE_CARDS(userId));
    return cached ? JSON.parse(cached) : null;
  }

  async setDueCards(userId: string, cards: ReviewCardDTO[], ttl = 300): Promise<void> {
    await this.redis.setex(
      CacheService.KEYS.DUE_CARDS(userId),
      ttl,
      JSON.stringify(cards)
    );
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const pattern = `*:${userId}`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 6.3 批量处理优化

```typescript
// services/maintenance/batch-processor.ts

export class BatchProcessor {
  private readonly BATCH_SIZE = 100;

  /**
   * Process entity similarity in batches
   */
  async processSimilarityBatch(
    entities: EntityData[],
    callback: (pairs: SimilarPair[]) => Promise<void>
  ): Promise<void> {
    // Use sliding window to avoid O(n²) memory
    for (let i = 0; i < entities.length; i += this.BATCH_SIZE) {
      const batch = entities.slice(i, i + this.BATCH_SIZE);
      
      for (let j = i + this.BATCH_SIZE; j < entities.length; j += this.BATCH_SIZE) {
        const compareBatch = entities.slice(j, j + this.BATCH_SIZE);
        const pairs = await this.calculateSimilarityBatch(batch, compareBatch);
        
        if (pairs.length > 0) {
          await callback(pairs);
        }
      }
    }
  }

  private async calculateSimilarityBatch(
    batchA: EntityData[],
    batchB: EntityData[]
  ): Promise<SimilarPair[]> {
    const pairs: SimilarPair[] = [];
    const similarityService = new SimilarityService();

    for (const entityA of batchA) {
      for (const entityB of batchB) {
        const similarity = similarityService.calculateSimilarity(entityA, entityB);
        if (similarity >= 0.7) {
          pairs.push({ entityA, entityB, similarity });
        }
      }
    }

    return pairs;
  }
}
```

### 6.4 查询优化

```typescript
// services/review/review.service.ts

export class ReviewService {
  /**
   * Optimized query for due cards with pagination
   */
  async getDueCards(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ReviewCard[]> {
    const { limit = 50, offset = 0 } = options;

    return prisma.reviewCard.findMany({
      where: {
        userId,
        status: { not: 'SUSPENDED' },
        nextReviewAt: { lte: new Date() },
      },
      orderBy: [
        { easinessFactor: 'asc' }, // Harder cards first
        { nextReviewAt: 'asc' },
      ],
      take: limit,
      skip: offset,
      // Select only needed fields
      select: {
        id: true,
        front: true,
        back: true,
        cardType: true,
        status: true,
        easinessFactor: true,
        interval: true,
        tags: true,
        capsule: {
          select: {
            id: true,
            summary: true,
          },
        },
      },
    });
  }
}
```

---

## 7. 测试策略

### 7.1 单元测试

```typescript
// services/review/__tests__/sm2.algorithm.test.ts

import { describe, it, expect } from 'vitest';
import { SM2Algorithm } from '../sm2.algorithm';

describe('SM2Algorithm', () => {
  describe('calculate', () => {
    it('should reset card on rating < 3', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 6,
        repetitionCount: 3,
      };

      const result = SM2Algorithm.calculate(card, 2);

      expect(result.newRepetitionCount).toBe(0);
      expect(result.newInterval).toBe(1);
      expect(result.status).toBe('learning');
    });

    it('should increase interval on successful review', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 1,
        repetitionCount: 1,
      };

      const result = SM2Algorithm.calculate(card, 4);

      expect(result.newInterval).toBe(6);
      expect(result.newRepetitionCount).toBe(2);
    });

    it('should apply bonus for rating >= 4', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 6,
        repetitionCount: 3,
      };

      const result = SM2Algorithm.calculate(card, 5);

      // 6 * 2.5 * 1.2 = 18
      expect(result.newInterval).toBe(18);
    });

    it('should cap EF at minimum 1.3', () => {
      const card = {
        easinessFactor: 1.3,
        interval: 1,
        repetitionCount: 0,
      };

      const result = SM2Algorithm.calculate(card, 0);

      expect(result.newEF).toBe(1.3);
    });

    it('should cap interval at maximum 365 days', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 200,
        repetitionCount: 10,
      };

      const result = SM2Algorithm.calculate(card, 5);

      expect(result.newInterval).toBeLessThanOrEqual(365);
    });

    it('should mark as mastered after 5+ repetitions and 21+ days', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 21,
        repetitionCount: 4,
      };

      const result = SM2Algorithm.calculate(card, 4);

      expect(result.status).toBe('mastered');
    });

    it('should throw on invalid rating', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 1,
        repetitionCount: 0,
      };

      expect(() => SM2Algorithm.calculate(card, 6)).toThrow();
      expect(() => SM2Algorithm.calculate(card, -1)).toThrow();
    });
  });
});
```

### 7.2 集成测试

```typescript
// services/review/__tests__/review.integration.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewService } from '../review.service';
import { prisma } from '../../../test/setup';

describe('ReviewService Integration', () => {
  let service: ReviewService;
  let userId: string;

  beforeEach(async () => {
    service = new ReviewService();
    const user = await prisma.user.create({
      data: { email: 'test@example.com' },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.reviewLog.deleteMany({ where: { userId } });
    await prisma.reviewCard.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('should create card and schedule review', async () => {
    const card = await service.createCard(userId, {
      front: 'What is SM-2?',
      back: 'Spaced Repetition algorithm',
      cardType: 'FLASHCARD',
    });

    expect(card.status).toBe('NEW');
    expect(card.easinessFactor).toBe(2.5);
    expect(card.nextReviewAt).toBeDefined();
  });

  it('should process review and update card', async () => {
    const card = await service.createCard(userId, {
      front: 'Test question',
      back: 'Test answer',
    });

    const result = await service.submitReview(userId, card.id, {
      rating: 4,
      responseTime: 5,
    });

    expect(result.card.status).toBe('REVIEW');
    expect(result.card.interval).toBeGreaterThan(0);
    expect(result.reviewLog.newEF).toBeGreaterThan(2.5);
  });
});
```

### 7.3 性能测试

```typescript
// benchmarks/similarity.benchmark.ts

import { bench, describe } from 'vitest';
import { SimilarityService } from '../services/maintenance/similarity.service';

describe('Similarity Calculation Performance', () => {
  const service = new SimilarityService();
  
  const entityA = {
    id: '1',
    name: 'React',
    type: 'CONCEPT',
    aliases: ['React.js', 'ReactJS'],
    embedding: new Array(1536).fill(0.1),
    relatedEntities: ['2', '3', '4'],
  };

  const entityB = {
    id: '2',
    name: 'React.js',
    type: 'CONCEPT',
    aliases: ['React', 'ReactJS'],
    embedding: new Array(1536).fill(0.11),
    relatedEntities: ['1', '3', '5'],
  };

  bench('calculate similarity', () => {
    service.calculateSimilarity(entityA, entityB);
  }, {
    iterations: 10000,
  });
});
```

### 7.4 E2E 测试

```typescript
// e2e/review.e2e.test.ts

import { test, expect } from '@playwright/test';

test.describe('Review Session', () => {
  test('complete review session', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('[type="submit"]');

    // Navigate to review
    await page.goto('/review');
    await page.click('text=开始今日复习');

    // Complete review
    await page.click('text=点击或按空格翻转');
    await page.click('text=4 - 正确');

    // Verify completion
    await expect(page.locator('text=复习完成')).toBeVisible();
  });
});
```

### 7.5 测试覆盖率目标

| 模块 | 目标覆盖率 | 重点测试内容 |
|------|-----------|-------------|
| SM2 Algorithm | 100% | 所有评分场景、边界条件 |
| Similarity Service | 90% | 各种相似度算法、权重组合 |
| Rule Engine | 85% | 规则匹配、条件组合 |
| API Routes | 80% | 请求验证、错误处理 |
| Database | 75% | 复杂查询、事务 |

---

## 8. 实施计划

### 8.1 Phase 3.1 - 基础复习系统 (Week 1-2)

- [ ] 数据库 Schema 创建 (ReviewCard, ReviewSession, ReviewLog)
- [ ] SM-2 算法实现与测试
- [ ] 基础 CRUD API
- [ ] 简单复习界面

### 8.2 Phase 3.2 - 复习系统完善 (Week 3-4)

- [ ] 复习会话管理
- [ ] 统计与热力图
- [ ] 自动提取集成
- [ ] 通知系统

### 8.3 Phase 3.3 - 图谱维护 (Week 5-6)

- [ ] 相似度计算服务
- [ ] 维护任务系统
- [ ] 实体合并工作流
- [ ] 健康度报告

### 8.4 Phase 3.4 - 洞察系统 (Week 7-8)

- [ ] 规则引擎实现
- [ ] 洞察生成服务
- [ ] 洞察中心界面
- [ ] 用户反馈收集

### 8.5 Phase 3.5 - 优化与测试 (Week 9-10)

- [ ] 性能优化
- [ ] 完整测试覆盖
- [ ] 文档完善
- [ ] Bug 修复

### 8.6 依赖关系图

```
Week 1-2: [Schema] → [SM2] → [API] → [UI Basic]
                ↓
Week 3-4: [Session] → [Stats] → [Extract] → [Notify]
                ↓
Week 5-6: [Similarity] → [Maintenance] → [Merge] → [Health]
                ↓
Week 7-8: [Rule Engine] → [Insight Gen] → [Insight UI]
                ↓
Week 9-10: [Optimize] → [Test] → [Document]
```

---

## 9. 风险评估与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 算法复杂度超预期 | 中 | 高 | 提前原型验证，预留缓冲时间 |
| 性能问题 (大数据量) | 中 | 中 | 早期性能测试，分批次处理 |
| AI 提取准确性 | 高 | 中 | 多模型对比，人工审核流程 |
| 数据迁移问题 | 低 | 高 | 完整迁移脚本，备份策略 |
| 用户接受度 | 中 | 中 | 渐进式发布，收集反馈 |

---

## 10. 附录

### 10.1 环境变量

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/capsulaai"

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# AI APIs
MINIMAX_API_KEY=
MOONSHOT_API_KEY=

# Optional: Local LLM
LOCAL_LLM_URL=http://localhost:11434
```

### 10.2 数据库迁移命令

```bash
# Generate migration
npx prisma migrate dev --name add_phase3_schema

# Apply migration
npx prisma migrate deploy

# Generate client
npx prisma generate
```

### 10.3 启动命令

```bash
# Development
docker-compose up -d postgres redis minio
npm run dev

# Production
npm run build
npm start

# Worker (for background jobs)
npm run worker
```

---

**文档状态**: 待评审  
**下一步**: 等待用户 Review 和确认，进入代码实现阶段
