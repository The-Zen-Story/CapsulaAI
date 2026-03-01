// test-utils/testDb.ts
/**
 * 内存数据库测试工具
 * 用于集成测试
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

export class TestDatabase {
  private static instance: TestDatabase;
  private prisma: PrismaClient | null = null;
  private databaseUrl: string | null = null;

  private constructor() {}

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  /**
   * 设置测试数据库
   * 使用环境变量中的 DATABASE_URL 或创建内存数据库
   */
  async setup(): Promise<void> {
    // 使用 SQLite 内存数据库进行测试
    this.databaseUrl = process.env.TEST_DATABASE_URL || 'file:./test.db?mode=memory';
    
    // 创建新的 PrismaClient 实例
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.databaseUrl,
        },
      },
    });

    // 运行迁移
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: this.databaseUrl },
        stdio: 'pipe',
      });
    } catch (error) {
      console.warn('Migration failed, trying to push schema:', error);
      // 如果迁移失败，尝试直接推送 schema
      execSync('npx prisma db push --accept-data-loss', {
        env: { ...process.env, DATABASE_URL: this.databaseUrl },
        stdio: 'pipe',
      });
    }
  }

  /**
   * 清理所有数据
   */
  async cleanup(): Promise<void> {
    if (!this.prisma) return;

    const tables = [
      'MaintenanceTask',
      'MergeLog',
      'CapsuleTag',
      'CapsuleEntity',
      'Relation',
      'Entity',
      'Capsule',
      'Tag',
      'Embedding',
    ];

    for (const table of tables) {
      try {
        // @ts-ignore - 动态访问模型
        await this.prisma[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({});
      } catch {
        // 忽略不存在的表
      }
    }
  }

  /**
   * 断开数据库连接
   */
  async teardown(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  /**
   * 获取 PrismaClient 实例
   */
  getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call setup() first.');
    }
    return this.prisma;
  }
}

// 导出单例实例
export const testDb = TestDatabase.getInstance();

/**
 * 测试数据库辅助函数
 */
export async function setupTestDb(): Promise<void> {
  await testDb.setup();
}

export async function cleanupTestDb(): Promise<void> {
  await testDb.cleanup();
}

export async function teardownTestDb(): Promise<void> {
  await testDb.teardown();
}

export function getTestPrisma(): PrismaClient {
  return testDb.getPrisma();
}
