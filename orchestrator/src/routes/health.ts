// routes/health.ts
// 健康检查路由 - 系统和知识图谱健康检查

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { maintenanceService } from '../services/maintenance/maintenance.service';

const prisma = new PrismaClient();
const router = Router();

// Helper to get userId from request (预留认证中间件)
const getUserId = (req: any): string => {
  return req.user?.id || req.headers['x-user-id'] as string || 'test-user';
};

/**
 * GET /api/health
 * 系统健康检查
 * 
 * 检查项目:
 * - 数据库连接
 * - 基本服务状态
 * - 系统资源使用情况
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    // 获取系统信息
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const nodeVersion = process.version;
    const platform = process.platform;

    // 获取数据库统计
    const [
      capsuleCount,
      entityCount,
      relationCount,
    ] = await Promise.all([
      prisma.capsule.count(),
      prisma.entity.count(),
      prisma.relation.count(),
    ]);

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: {
            status: 'connected',
            latency: `${dbLatency}ms`,
          },
          api: {
            status: 'running',
            uptime: `${Math.floor(uptime / 60 / 60)}h ${Math.floor((uptime / 60) % 60)}m ${Math.floor(uptime % 60)}s`,
          },
        },
        system: {
          nodeVersion,
          platform,
          memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          },
        },
        data: {
          capsules: capsuleCount,
          entities: entityCount,
          relations: relationCount,
        },
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'disconnected',
            error: (error as Error).message,
          },
          api: {
            status: 'running',
          },
        },
      },
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'One or more services are unavailable',
      },
    });
  }
});

/**
 * GET /api/health/kg
 * 知识图谱健康检查
 * 
 * 检查项目:
 * - 知识图谱健康评分
 * - 实体和关系统计
 * - 数据质量问题（孤立实体、重复实体等）
 * - 维护任务状态
 */
router.get('/kg', async (req, res) => {
  try {
    const userId = getUserId(req);

    // 并行获取各项数据
    const [
      healthReport,
      entityStats,
      relationStats,
      maintenanceStats,
      dataQualityIssues,
    ] = await Promise.all([
      // 1. 获取健康报告
      maintenanceService.getHealthReport(userId),
      
      // 2. 获取实体统计
      getEntityStats(),
      
      // 3. 获取关系统计
      getRelationStats(),
      
      // 4. 获取维护任务统计
      getMaintenanceTaskStats(userId),
      
      // 5. 获取数据质量问题
      getDataQualityIssues(),
    ]);

    // 计算整体健康状态
    const overallHealth = calculateOverallHealth(healthReport.score, dataQualityIssues);

    res.json({
      success: true,
      data: {
        status: overallHealth.status,
        score: healthReport.score,
        summary: {
          totalEntities: healthReport.totalEntities,
          totalRelations: healthReport.totalRelations,
          orphanEntities: healthReport.orphanEntities,
          potentialDuplicates: healthReport.potentialDuplicates,
          staleEntities: healthReport.staleEntities,
          brokenRelations: healthReport.brokenRelations,
        },
        entityStats,
        relationStats,
        maintenance: maintenanceStats,
        issues: dataQualityIssues,
        recommendations: generateRecommendations(healthReport, dataQualityIssues),
      },
    });
  } catch (error) {
    console.error('Knowledge graph health check failed:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check knowledge graph health',
      },
    });
  }
});

/**
 * GET /api/health/db
 * 数据库健康检查（详细）
 */
router.get('/db', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 基本连接检查
    await prisma.$queryRaw`SELECT 1`;
    const connectionLatency = Date.now() - startTime;

    // 获取表统计
    const tableStats = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `;

    // 获取数据库大小
    const dbSize = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;

    res.json({
      success: true,
      data: {
        status: 'healthy',
        connection: {
          latency: `${connectionLatency}ms`,
          status: 'connected',
        },
        size: (dbSize as any)[0]?.size || 'unknown',
        tables: tableStats,
      },
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database health check failed',
        details: (error as Error).message,
      },
    });
  }
});

// ==================== 辅助函数 ====================

/**
 * 获取实体统计
 */
async function getEntityStats() {
  const [
    byType,
    byStatus,
    recentEntities,
  ] = await Promise.all([
    // 按类型分组
    prisma.entity.groupBy({
      by: ['type'],
      _count: { id: true },
    }),
    // 按状态分组
    prisma.entity.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // 最近7天新增的实体
    prisma.entity.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    byType: byType.map(t => ({ type: t.type, count: t._count.id })),
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
    recentCount: recentEntities,
  };
}

/**
 * 获取关系统计
 */
async function getRelationStats() {
  const [
    byType,
    avgStrength,
    recentRelations,
  ] = await Promise.all([
    // 按类型分组
    prisma.relation.groupBy({
      by: ['relationType'],
      _count: { id: true },
    }),
    // 平均强度
    prisma.relation.aggregate({
      _avg: { strength: true },
    }),
    // 最近7天新增的关系
    prisma.relation.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    byType: byType.map(t => ({ type: t.relationType, count: t._count.id })),
    averageStrength: Math.round((avgStrength._avg.strength || 0) * 100) / 100,
    recentCount: recentRelations,
  };
}

/**
 * 获取维护任务统计
 */
async function getMaintenanceTaskStats(userId: string) {
  const { PrismaClient, MaintenanceStatus } = require('@prisma/client');
  
  const [
    byStatus,
    byType,
    pendingReview,
    autoApproved,
  ] = await Promise.all([
    // 按状态分组
    prisma.maintenanceTask.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    }),
    // 按类型分组
    prisma.maintenanceTask.groupBy({
      by: ['taskType'],
      where: { userId },
      _count: { id: true },
    }),
    // 待审查数量
    prisma.maintenanceTask.count({
      where: { 
        userId, 
        status: MaintenanceStatus.AWAITING_USER_REVIEW,
      },
    }),
    // 自动批准数量
    prisma.maintenanceTask.count({
      where: { 
        userId, 
        status: MaintenanceStatus.AUTO_APPROVED,
      },
    }),
  ]);

  return {
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
    byType: byType.map(t => ({ type: t.taskType, count: t._count.id })),
    pendingReview,
    autoApproved,
    requiresAction: pendingReview + autoApproved,
  };
}

/**
 * 获取数据质量问题
 */
async function getDataQualityIssues() {
  const issues: any[] = [];

  // 1. 孤立实体（没有任何关系）
  const orphanCount = await prisma.entity.count({
    where: {
      AND: [
        { relationsFrom: { none: {} } },
        { relationsTo: { none: {} } },
      ],
    },
  });

  if (orphanCount > 0) {
    issues.push({
      type: 'orphan_entities',
      severity: orphanCount > 10 ? 'warning' : 'info',
      count: orphanCount,
      description: `发现 ${orphanCount} 个孤立实体，建议检查并建立关系`,
    });
  }

  // 2. 过时实体（90天未更新）
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 90);
  
  const staleCount = await prisma.entity.count({
    where: {
      lastSeenAt: { lt: staleThreshold },
    },
  });

  if (staleCount > 0) {
    issues.push({
      type: 'stale_entities',
      severity: staleCount > 20 ? 'warning' : 'info',
      count: staleCount,
      description: `发现 ${staleCount} 个过时实体（90天未更新）`,
    });
  }

  // 3. 重复关系（相同实体对之间的多个关系）
  const duplicateRelations = await prisma.$queryRaw`
    SELECT from_entity_id, to_entity_id, COUNT(*) as count
    FROM "Relation"
    GROUP BY from_entity_id, to_entity_id
    HAVING COUNT(*) > 1
    LIMIT 10
  `;

  if (Array.isArray(duplicateRelations) && duplicateRelations.length > 0) {
    issues.push({
      type: 'duplicate_relations',
      severity: 'warning',
      count: duplicateRelations.length,
      description: `发现 ${duplicateRelations.length} 对实体之间存在多个关系，建议合并`,
    });
  }

  // 4. 低置信度实体
  const lowConfidenceCount = await prisma.entity.count({
    where: {
      confidenceScore: { lt: 0.5 },
    },
  });

  if (lowConfidenceCount > 0) {
    issues.push({
      type: 'low_confidence_entities',
      severity: 'info',
      count: lowConfidenceCount,
      description: `发现 ${lowConfidenceCount} 个低置信度实体（< 0.5）`,
    });
  }

  // 5. 检查损坏的关系（指向不存在的实体）
  const brokenRelations = await prisma.$queryRaw`
    SELECT r.id
    FROM "Relation" r
    LEFT JOIN "Entity" fe ON r.from_entity_id = fe.id
    LEFT JOIN "Entity" te ON r.to_entity_id = te.id
    WHERE fe.id IS NULL OR te.id IS NULL
    LIMIT 10
  `;

  if (Array.isArray(brokenRelations) && brokenRelations.length > 0) {
    issues.push({
      type: 'broken_relations',
      severity: 'critical',
      count: brokenRelations.length,
      description: `发现 ${brokenRelations.length} 个损坏的关系（指向不存在的实体）`,
    });
  }

  return issues;
}

/**
 * 计算整体健康状态
 */
function calculateOverallHealth(score: number, issues: any[]) {
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const warningIssues = issues.filter(i => i.severity === 'warning').length;

  if (criticalIssues > 0) {
    return { status: 'critical', score };
  }
  if (score < 60 || warningIssues > 5) {
    return { status: 'warning', score };
  }
  if (score >= 80) {
    return { status: 'healthy', score };
  }
  return { status: 'fair', score };
}

/**
 * 生成建议
 */
function generateRecommendations(healthReport: any, issues: any[]) {
  const recommendations: string[] = [];

  if (healthReport.orphanEntities > 0) {
    recommendations.push(`运行关系发现扫描，为 ${healthReport.orphanEntities} 个孤立实体建立连接`);
  }

  if (healthReport.potentialDuplicates > 0) {
    recommendations.push(`检查 ${healthReport.potentialDuplicates} 个潜在重复实体，考虑合并`);
  }

  if (healthReport.staleEntities > 0) {
    recommendations.push(`审查 ${healthReport.staleEntities} 个过时实体，更新或归档不再相关的内容`);
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    recommendations.push(`优先处理 ${criticalIssues.length} 个严重问题`);
  }

  if (healthReport.score < 80) {
    recommendations.push('运行完整维护扫描以改善知识图谱健康度');
  }

  if (recommendations.length === 0) {
    recommendations.push('知识图谱健康状况良好，继续保持！');
  }

  return recommendations;
}

export default router;
