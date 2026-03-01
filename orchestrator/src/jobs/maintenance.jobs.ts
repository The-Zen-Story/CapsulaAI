import * as cron from 'node-cron';
import { maintenanceService } from '../services/maintenance/maintenance.service';
import { mergeService } from '../services/maintenance/merge.service';
import { MaintenanceStatus } from '@prisma/client';

/**
 * Task execution state tracking
 * Used to prevent task overlapping execution
 */
interface TaskExecutionState {
  isRunning: boolean;
  lastRunAt: Date | null;
  lastRunDuration: number;
  lastError: string | null;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
}

/**
 * Task configuration constants
 */
const JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout

/**
 * Cron job configuration interface
 */
interface CronJobConfig {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
}

/**
 * Cron job scheduler
 *
 * Manages CapsulaAI's maintenance-related scheduled tasks:
 * 1. Daily scan task (daily-scan) - Every day at 2:00 AM
 * 2. Auto-approve task (auto-approve) - Every hour
 * 3. Expired task cleanup (cleanup) - Every Sunday at 3:00 AM
 * 4. Health report generation (health-report) - Every day at 9:00 AM
 */
export class MaintenanceJobScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private executionStates: Map<string, TaskExecutionState> = new Map();
  private userId: string;

  // Job configurations
  private readonly jobConfigs: CronJobConfig[] = [
    {
      name: 'daily-scan',
      schedule: '0 2 * * *', // Every day at 2:00 AM
      description: 'Daily scan task: Scan for duplicate entities, discover new relationships, detect stale entities, detect orphan nodes',
      enabled: true,
    },
    {
      name: 'auto-approve',
      schedule: '0 * * * *', // Every hour
      description: 'Auto-approve task: Automatically approve and execute tasks with confidence >= 0.95',
      enabled: true,
    },
    {
      name: 'cleanup',
      schedule: '0 3 * * 0', // Every Sunday at 3:00 AM
      description: 'Expired task cleanup: Clean up tasks rejected for more than 30 days and tasks reverted for more than 7 days',
      enabled: true,
    },
    {
      name: 'health-report',
      schedule: '0 9 * * *', // Every day at 9:00 AM
      description: 'Health report generation: Generate knowledge graph health report',
      enabled: true,
    },
  ];

  constructor(userId: string = 'system') {
    this.userId = userId;
    this.initializeExecutionStates();
  }

  /**
   * Initialize task execution states
   */
  private initializeExecutionStates(): void {
    for (const config of this.jobConfigs) {
      this.executionStates.set(config.name, {
        isRunning: false,
        lastRunAt: null,
        lastRunDuration: 0,
        lastError: null,
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
      });
    }
  }

  /**
   * Start all scheduled tasks
   */
  startAll(): void {
    console.log('[MaintenanceJobScheduler] Starting all scheduled tasks...');

    for (const config of this.jobConfigs) {
      if (config.enabled) {
        this.startJob(config);
      }
    }

    console.log('[MaintenanceJobScheduler] All scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll(): void {
    console.log('[MaintenanceJobScheduler] Stopping all scheduled tasks...');

    for (const [name, job] of Array.from(this.jobs.entries())) {
      job.stop();
      console.log(`[MaintenanceJobScheduler] Task "${name}" stopped`);
    }

    this.jobs.clear();

    // Reset all execution states
    for (const [name, state] of Array.from(this.executionStates.entries())) {
      state.isRunning = false;
      console.log(`[MaintenanceJobScheduler] Task "${name}" execution state reset`);
    }

    console.log('[MaintenanceJobScheduler] All scheduled tasks stopped');
  }

  /**
   * Start a single task
   */
  private startJob(config: CronJobConfig): void {
    const existingJob = this.jobs.get(config.name);
    if (existingJob) {
      existingJob.stop();
    }

    const task = cron.schedule(
      config.schedule,
      async () => {
        await this.executeJob(config.name);
      },
      {
        scheduled: true,
        timezone: 'Asia/Shanghai',
      }
    );

    this.jobs.set(config.name, task);
    console.log(`[MaintenanceJobScheduler] Task "${config.name}" started (${config.schedule}): ${config.description}`);
  }

  /**
   * Execute task (with overlap protection and timeout control)
   */
  private async executeJob(jobName: string): Promise<void> {
    const state = this.executionStates.get(jobName);

    if (!state) {
      console.error(`[MaintenanceJobScheduler] Unknown task: ${jobName}`);
      return;
    }

    // Check if already running
    if (state.isRunning) {
      console.warn(`[MaintenanceJobScheduler] Task "${jobName}" is already running, skipping this execution`);
      return;
    }

    const startTime = Date.now();
    state.isRunning = true;
    state.lastError = null;
    state.totalRuns++;

    console.log(`[MaintenanceJobScheduler] Task "${jobName}" started`);

    // Create timeout Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task execution timeout (${JOB_TIMEOUT_MS}ms)`));
      }, JOB_TIMEOUT_MS);
    });

    try {
      // Execute task with timeout
      await Promise.race([
        this.executeJobLogic(jobName),
        timeoutPromise,
      ]);

      state.lastRunAt = new Date();
      state.lastRunDuration = Date.now() - startTime;
      state.successRuns++;
      console.log(`[MaintenanceJobScheduler] Task "${jobName}" completed, took ${state.lastRunDuration}ms`);
    } catch (error) {
      state.lastError = (error as Error).message;
      state.failedRuns++;
      console.error(`[MaintenanceJobScheduler] Task "${jobName}" execution failed:`, error);
    } finally {
      state.isRunning = false;
    }
  }

  /**
   * Execute task logic
   */
  private async executeJobLogic(jobName: string): Promise<void> {
    switch (jobName) {
      case 'daily-scan':
        await this.runDailyScan();
        break;
      case 'auto-approve':
        await this.runAutoApprove();
        break;
      case 'cleanup':
        await this.runCleanup();
        break;
      case 'health-report':
        await this.runHealthReport();
        break;
      default:
        throw new Error(`[MaintenanceJobScheduler] Unknown task type: ${jobName}`);
    }
  }

  /**
   * Daily scan task
   * - Scan for duplicate entities
   * - Discover new relationships
   * - Detect stale entities
   * - Detect orphan nodes
   */
  private async runDailyScan(): Promise<void> {
    console.log('[MaintenanceJobScheduler] Starting daily scan...');

    try {
      // 1. Scan for duplicate entities
      console.log('[MaintenanceJobScheduler] Scanning for duplicate entities...');
      const duplicateTasks = await maintenanceService.scanForDuplicates(this.userId);
      console.log(`[MaintenanceJobScheduler] Found ${duplicateTasks.length} potential duplicate entities`);

      // 2. Discover new relationships
      console.log('[MaintenanceJobScheduler] Discovering new relationships...');
      const relationTasks = await maintenanceService.discoverRelations(this.userId);
      console.log(`[MaintenanceJobScheduler] Found ${relationTasks.length} new relationships`);

      // 3. Detect stale entities
      console.log('[MaintenanceJobScheduler] Detecting stale entities...');
      const staleTasks = await maintenanceService.detectStaleEntities(this.userId);
      console.log(`[MaintenanceJobScheduler] Found ${staleTasks.length} stale entities`);

      // 4. Detect orphan nodes
      console.log('[MaintenanceJobScheduler] Detecting orphan nodes...');
      const orphanTasks = await maintenanceService.detectOrphanEntities(this.userId);
      console.log(`[MaintenanceJobScheduler] Found ${orphanTasks.length} orphan nodes`);

      // 5. Tag optimization
      console.log('[MaintenanceJobScheduler] Tag optimization...');
      const tagTasks = await maintenanceService.optimizeTags(this.userId);
      console.log(`[MaintenanceJobScheduler] Found ${tagTasks.length} tag optimization opportunities`);

      const totalTasks = duplicateTasks.length + relationTasks.length + staleTasks.length + orphanTasks.length + tagTasks.length;
      console.log(`[MaintenanceJobScheduler] Daily scan completed, created ${totalTasks} maintenance tasks`);
    } catch (error) {
      console.error('[MaintenanceJobScheduler] Daily scan failed:', error);
      throw error;
    }
  }

  /**
   * Auto-approve task
   * - Automatically approve tasks with confidence >= 0.95
   * - Automatically execute approved tasks
   */
  private async runAutoApprove(): Promise<void> {
    console.log('[MaintenanceJobScheduler] Starting auto-approve task...');

    try {
      // Get all pending review tasks
      const { tasks: pendingTasks } = await maintenanceService.getTasks(this.userId, {
        status: MaintenanceStatus.AWAITING_USER_REVIEW,
        limit: 100,
      });

      // Filter high confidence tasks (>= 0.95)
      const highConfidenceTasks = pendingTasks.filter(task => task.confidence >= 0.95);
      console.log(`[MaintenanceJobScheduler] Found ${highConfidenceTasks.length} high confidence tasks`);

      // Auto-approve high confidence tasks
      const approvedTasks: string[] = [];
      for (const task of highConfidenceTasks) {
        try {
          await maintenanceService.approveTask(this.userId, task.id, 'System auto-approved (confidence >= 0.95)');
          approvedTasks.push(task.id);
          console.log(`[MaintenanceJobScheduler] Task ${task.id} auto-approved`);
        } catch (error) {
          console.error(`[MaintenanceJobScheduler] Failed to approve task ${task.id}:`, error);
        }
      }

      // Auto-execute approved tasks (including AUTO_APPROVED and newly approved APPROVED)
      const { tasks: approvedTasksToExecute } = await maintenanceService.getTasks(this.userId, {
        status: MaintenanceStatus.AUTO_APPROVED,
        limit: 100,
      });

      const executedTasks: string[] = [];
      for (const task of approvedTasksToExecute) {
        try {
          const result = await maintenanceService.applyTask(this.userId, task.id);
          if (result.success) {
            executedTasks.push(task.id);
            console.log(`[MaintenanceJobScheduler] Task ${task.id} auto-executed`);
          } else {
            console.error(`[MaintenanceJobScheduler] Failed to execute task ${task.id}:`, result.error);
          }
        } catch (error) {
          console.error(`[MaintenanceJobScheduler] Failed to execute task ${task.id}:`, error);
        }
      }

      console.log(`[MaintenanceJobScheduler] Auto-approve completed: approved ${approvedTasks.length} tasks, executed ${executedTasks.length} tasks`);
    } catch (error) {
      console.error('[MaintenanceJobScheduler] Auto-approve task failed:', error);
      throw error;
    }
  }

  /**
   * Expired task cleanup
   * - Clean up tasks rejected for more than 30 days
   * - Clean up tasks reverted for more than 7 days
   * 
   * Note: Current version only logs, does not actually delete tasks
   * To enable deletion, need to add deleteTask method in maintenanceService first
   */
  private async runCleanup(): Promise<void> {
    console.log('[MaintenanceJobScheduler] Starting expired task cleanup check...');
    console.log('[MaintenanceJobScheduler] Note: Currently only logs, does not actually delete tasks');

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all rejected and reverted tasks
      const { tasks: rejectedTasks } = await maintenanceService.getTasks(this.userId, {
        status: MaintenanceStatus.REJECTED,
        limit: 1000,
      });

      const { tasks: revertedTasks } = await maintenanceService.getTasks(this.userId, {
        status: MaintenanceStatus.REVERTED,
        limit: 1000,
      });

      // Filter tasks to clean up
      const tasksToDelete = [
        ...rejectedTasks.filter(task => new Date(task.updatedAt) < thirtyDaysAgo),
        ...revertedTasks.filter(task => new Date(task.updatedAt) < sevenDaysAgo),
      ];

      console.log(`[MaintenanceJobScheduler] Found ${tasksToDelete.length} expired tasks to clean up`);

      // Log tasks to clean up (actual deletion not yet enabled)
      for (const task of tasksToDelete) {
        const daysOld = Math.floor((now.getTime() - new Date(task.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
        console.log(`[MaintenanceJobScheduler] [To clean up] Task ${task.id}: type=${task.taskType}, status=${task.status}, expired ${daysOld} days`);
      }

      console.log(`[MaintenanceJobScheduler] Expired task cleanup check completed, marked ${tasksToDelete.length} tasks for cleanup (not actually deleted)`);
    } catch (error) {
      console.error('[MaintenanceJobScheduler] Expired task cleanup check failed:', error);
      throw error;
    }
  }

  /**
   * Health report generation
   * - Generate knowledge graph health report
   * - Send notifications (reserved)
   */
  private async runHealthReport(): Promise<void> {
    console.log('[MaintenanceJobScheduler] Starting health report generation...');

    try {
      const report = await maintenanceService.getHealthReport(this.userId);

      console.log('[MaintenanceJobScheduler] ===== Knowledge Graph Health Report =====');
      console.log(`[MaintenanceJobScheduler] Health score: ${report.score}/100`);
      console.log(`[MaintenanceJobScheduler] Total entities: ${report.totalEntities}`);
      console.log(`[MaintenanceJobScheduler] Total relations: ${report.totalRelations}`);
      console.log(`[MaintenanceJobScheduler] Orphan entities: ${report.orphanEntities}`);
      console.log(`[MaintenanceJobScheduler] Potential duplicates: ${report.potentialDuplicates}`);
      console.log(`[MaintenanceJobScheduler] Stale entities: ${report.staleEntities}`);
      console.log(`[MaintenanceJobScheduler] Broken relations: ${report.brokenRelations}`);
      console.log('[MaintenanceJobScheduler] =============================');

      // TODO: Send notifications (reserved)
      // Can integrate email, Slack, Webhook, etc.
      if (report.score < 80) {
        console.warn(`[MaintenanceJobScheduler] Health score is low (${report.score}), maintenance recommended`);
        // await this.sendNotification('health-alert', report);
      }

      console.log('[MaintenanceJobScheduler] Health report generation completed');
    } catch (error) {
      console.error('[MaintenanceJobScheduler] Health report generation failed:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a task
   * @param jobName Task name
   */
  async triggerJob(jobName: string): Promise<void> {
    console.log(`[MaintenanceJobScheduler] Manually triggering task: ${jobName}`);
    await this.executeJob(jobName);
  }

  /**
   * Get task status
   */
  getJobStatus(): Array<{
    name: string;
    schedule: string;
    description: string;
    enabled: boolean;
    isRunning: boolean;
    lastRunAt: Date | null;
    lastRunDuration: number;
    lastError: string | null;
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    successRate: number;
  }> {
    return this.jobConfigs.map(config => {
      const state = this.executionStates.get(config.name);
      const totalRuns = state?.totalRuns ?? 0;
      const successRuns = state?.successRuns ?? 0;
      const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
      
      return {
        name: config.name,
        schedule: config.schedule,
        description: config.description,
        enabled: config.enabled,
        isRunning: state?.isRunning ?? false,
        lastRunAt: state?.lastRunAt ?? null,
        lastRunDuration: state?.lastRunDuration ?? 0,
        lastError: state?.lastError ?? null,
        totalRuns,
        successRuns,
        failedRuns: state?.failedRuns ?? 0,
        successRate,
      };
    });
  }

  /**
   * Enable/disable task
   */
  setJobEnabled(jobName: string, enabled: boolean): void {
    const config = this.jobConfigs.find(c => c.name === jobName);
    if (!config) {
      console.error(`[MaintenanceJobScheduler] Unknown task: ${jobName}`);
      return;
    }

    config.enabled = enabled;

    if (enabled) {
      this.startJob(config);
    } else {
      const job = this.jobs.get(jobName);
      if (job) {
        job.stop();
        this.jobs.delete(jobName);
        
        // Reset execution state
        const state = this.executionStates.get(jobName);
        if (state) {
          state.isRunning = false;
        }
        
        console.log(`[MaintenanceJobScheduler] Task "${jobName}" disabled`);
      }
    }
  }
}

// Default scheduler instance
let defaultScheduler: MaintenanceJobScheduler | null = null;
let initPromise: Promise<MaintenanceJobScheduler> | null = null;

/**
 * Initialize and start scheduled task scheduler (thread-safe)
 */
export async function initializeMaintenanceJobs(userId: string = 'system'): Promise<MaintenanceJobScheduler> {
  // If initialization is in progress, return existing Promise
  if (initPromise) {
    console.log('[MaintenanceJobScheduler] Initialization in progress, waiting for completion...');
    return initPromise;
  }

  // Create new initialization Promise
  initPromise = (async () => {
    try {
      if (defaultScheduler) {
        console.log('[MaintenanceJobScheduler] Scheduler already exists, stopping old instance');
        defaultScheduler.stopAll();
      }

      defaultScheduler = new MaintenanceJobScheduler(userId);
      defaultScheduler.startAll();

      console.log('[MaintenanceJobScheduler] Scheduler initialization completed');
      return defaultScheduler;
    } catch (error) {
      console.error('[MaintenanceJobScheduler] Initialization failed:', error);
      throw error;
    } finally {
      // Reset initialization Promise to allow subsequent re-initialization
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Get default scheduler instance
 */
export function getMaintenanceJobScheduler(): MaintenanceJobScheduler | null {
  return defaultScheduler;
}

/**
 * Stop scheduled task scheduler
 */
export function stopMaintenanceJobs(): void {
  if (defaultScheduler) {
    defaultScheduler.stopAll();
    defaultScheduler = null;
  }
}

/**
 * Manually trigger task
 */
export async function triggerMaintenanceJob(jobName: string): Promise<void> {
  if (!defaultScheduler) {
    throw new Error('Scheduler not initialized');
  }
  await defaultScheduler.triggerJob(jobName);
}

/**
 * Get task status
 */
export function getMaintenanceJobStatus(): Array<{
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: Date | null;
  lastRunDuration: number;
  lastError: string | null;
}> {
  if (!defaultScheduler) {
    return [];
  }
  return defaultScheduler.getJobStatus();
}
