// services/insights/rule-engine.ts

export type InsightType = 'TASK_REMINDER' | 'KNOWLEDGE_GAP' | 'CONNECTION' | 'ACTION_SUGGESTION' | 'HABIT_ANALYSIS' | 'OPPORTUNITY';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

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

export interface InsightCandidate {
  ruleId: string;
  type: InsightType;
  priority: Priority;
  priorityScore: number;
  confidence: number;
  deduplicationKey: string;
  expiresAt: Date;
  extractedData: Record<string, unknown>;
  title: string;
  description: string;
}

export interface EvaluationContext {
  event?: string;
  timestamp: Date;
  userId: string;
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

    // Action Suggestion Rule
    this.rules.push({
      id: 'action_suggestion_001',
      type: 'ACTION_SUGGESTION',
      priority: 'MEDIUM',
      trigger: {
        schedule: '0 10 * * *', // Daily at 10:00 AM
      },
      conditions: [
        {
          type: 'pattern_match',
          config: {
            patterns: [
              '(TODO|待办|需要|应该).*',
            ],
            confidenceThreshold: 0.7,
          },
        },
      ],
      deduplication: {
        key: '{capsuleId}_{action}',
        window: '14d',
      },
      expiration: {
        maxAge: '7d',
      },
    });

    // Habit Analysis Rule
    this.rules.push({
      id: 'habit_analysis_001',
      type: 'HABIT_ANALYSIS',
      priority: 'LOW',
      trigger: {
        schedule: '0 9 * * 1', // Weekly on Monday at 9:00 AM
      },
      conditions: [
        {
          type: 'frequency_threshold',
          config: {
            minReviewsPerWeek: 5,
            topic: 'any',
          },
        },
      ],
      deduplication: {
        key: 'weekly_habit_{week}',
        window: '7d',
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
        confidence: 1.0 - diffDays / 30,
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

    const extractedData = this.mergeExtractedData(conditionResults);
    const priorityScore = this.calculatePriorityScore(rule, extractedData);

    return {
      ruleId: rule.id,
      type: rule.type,
      priority: rule.priority,
      priorityScore,
      confidence: avgConfidence,
      deduplicationKey: this.generateDeduplicationKey(rule, data),
      expiresAt: this.calculateExpiration(rule.expiration, extractedData),
      extractedData,
      title: this.generateTitle(rule, extractedData),
      description: this.generateDescription(rule, extractedData),
    };
  }

  private calculatePriorityScore(
    rule: InsightRule,
    extractedData: Record<string, unknown>
  ): number {
    let baseScore = 0;

    switch (rule.type) {
      case 'TASK_REMINDER':
        const daysUntil = extractedData.daysUntil as number;
        baseScore = 100 - (daysUntil || 7) * 10;
        if (daysUntil <= 1) baseScore += 50;
        break;
      case 'KNOWLEDGE_GAP':
        baseScore = 70;
        break;
      case 'CONNECTION':
        baseScore = 50;
        break;
      case 'ACTION_SUGGESTION':
        baseScore = 60;
        break;
      case 'HABIT_ANALYSIS':
        baseScore = 40;
        break;
      default:
        baseScore = 50;
    }

    return Math.min(100, Math.max(0, baseScore));
  }

  private generateDeduplicationKey(rule: InsightRule, data: unknown): string {
    let key = rule.deduplication.key;
    const dataObj = data as Record<string, string>;
    
    for (const [k, v] of Object.entries(dataObj)) {
      key = key.replace(`{${k}}`, String(v));
    }
    
    return key;
  }

  private calculateExpiration(
    config: ExpirationConfig,
    extractedData: Record<string, unknown>
  ): Date {
    const now = new Date();
    
    if (config.afterDatePassed) {
      const extractedDate = extractedData.extractedDate as string;
      if (extractedDate) {
        return new Date(extractedDate);
      }
    }

    if (config.maxAge) {
      const days = parseInt(config.maxAge);
      now.setDate(now.getDate() + days);
      return now;
    }

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

  private generateTitle(rule: InsightRule, data: Record<string, unknown>): string {
    switch (rule.type) {
      case 'TASK_REMINDER':
        return '待办提醒';
      case 'KNOWLEDGE_GAP':
        return '知识空白检测';
      case 'CONNECTION':
        return '发现关联';
      case 'ACTION_SUGGESTION':
        return '行动建议';
      case 'HABIT_ANALYSIS':
        return '学习习惯分析';
      default:
        return '洞察';
    }
  }

  private generateDescription(rule: InsightRule, data: Record<string, unknown>): string {
    switch (rule.type) {
      case 'TASK_REMINDER':
        return `检测到截止日期: ${data.extractedDate || '未知'}`;
      case 'KNOWLEDGE_GAP':
        return '您正在学习的主题缺少前置知识';
      case 'CONNECTION':
        return '新内容与已有知识相关';
      case 'ACTION_SUGGESTION':
        return '检测到可能的待办事项';
      case 'HABIT_ANALYSIS':
        return '基于您的学习模式分析';
      default:
        return '新的洞察';
    }
  }
}

interface ConditionResult {
  matched: boolean;
  confidence?: number;
  extractedData?: Record<string, unknown>;
}

export const ruleEngine = new InsightRuleEngine();
