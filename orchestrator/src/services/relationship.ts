import { PrismaClient, Prisma } from '@prisma/client';
import { Relationship as RelationshipData } from '../ai/schemas';

const prisma = new PrismaClient();

export interface CreateRelationshipInput {
  fromEntityId: string;
  toEntityId: string;
  type: string;
  confidence: number;
  capsuleId: string;
  metadata?: any;
}

export class RelationshipService {
  /**
   * Extract and store relationships from capsule structured data
   */
  static async extractFromCapsule(capsuleId: string, relationships: RelationshipData[]) {
    if (!relationships || relationships.length === 0) {
      return [];
    }

    const created: any[] = [];

    for (const rel of relationships) {
      try {
        // Normalize types to UPPERCASE to avoid case-mismatch duplicates
        const fromType = String(rel.fromType || 'OTHER').toUpperCase().trim();
        const toType = String(rel.toType || 'OTHER').toUpperCase().trim();

        // ── Resolve fromEntity ────────────────────────────────────────────
        const normalizedFromName = rel.from.toLowerCase().trim();
        let fromEntity = await prisma.entity.findFirst({
          where: { normalizedName: normalizedFromName, type: fromType }
        });
        if (!fromEntity) {
          fromEntity = await prisma.entity.create({
            data: {
              canonicalName: rel.from.trim(),
              normalizedName: normalizedFromName,
              type: fromType
            }
          });
          // Link newly created entity to the capsule so it's not an orphan
          const existingFromLink = await prisma.capsuleEntity.findFirst({
            where: { capsuleId, entityId: fromEntity.id }
          });
          if (!existingFromLink) {
            await prisma.capsuleEntity.create({ data: { capsuleId, entityId: fromEntity.id } });
          }
        } else {
          fromEntity = await prisma.entity.update({
            where: { id: fromEntity.id },
            data: { mentionCount: { increment: 1 }, lastSeenAt: new Date() }
          });
        }

        // ── Resolve toEntity ──────────────────────────────────────────────
        const normalizedToName = rel.to.toLowerCase().trim();
        let toEntity = await prisma.entity.findFirst({
          where: { normalizedName: normalizedToName, type: toType }
        });
        if (!toEntity) {
          toEntity = await prisma.entity.create({
            data: {
              canonicalName: rel.to.trim(),
              normalizedName: normalizedToName,
              type: toType
            }
          });
          // Link newly created entity to the capsule so it's not an orphan
          const existingToLink = await prisma.capsuleEntity.findFirst({
            where: { capsuleId, entityId: toEntity.id }
          });
          if (!existingToLink) {
            await prisma.capsuleEntity.create({ data: { capsuleId, entityId: toEntity.id } });
          }
        } else {
          toEntity = await prisma.entity.update({
            where: { id: toEntity.id },
            data: { mentionCount: { increment: 1 }, lastSeenAt: new Date() }
          });
        }

        // ── Create/upsert the Relation ────────────────────────────────────
        const relType = String(rel.type).toUpperCase();

        const relation = await prisma.relation.upsert({
          where: {
            fromEntityId_toEntityId_relationType: {
              fromEntityId: fromEntity.id,
              toEntityId: toEntity.id,
              relationType: relType
            }
          },
          create: {
            fromEntityId: fromEntity.id,
            toEntityId: toEntity.id,
            relationType: relType,
            strength: typeof rel.confidence === 'string' ? parseFloat(rel.confidence) : (rel.confidence || 1.0),
            createdBy: 'system'
          },
          update: {
            mentionCount: { increment: 1 },
            strength: (typeof rel.confidence === 'string' ? parseFloat(rel.confidence) : rel.confidence) > 0
              ? (typeof rel.confidence === 'string' ? parseFloat(rel.confidence) : rel.confidence)
              : undefined
          },
          include: {
            fromEntity: true,
            toEntity: true
          }
        });

        created.push(relation);
      } catch (error) {
        console.error(`Failed to create relationship ${rel.from} -> ${rel.to}:`, error);
      }
    }

    return created;
  }

  /**
   * Get all relationships for an entity
   */
  static async getEntityRelationships(
    entityId: string,
    type?: string,
    direction?: 'from' | 'to' | 'both'
  ) {
    const where: Prisma.RelationWhereInput = {};

    if (type) {
      where.relationType = type;
    }

    if (direction === 'from') {
      where.fromEntityId = entityId;
    } else if (direction === 'to') {
      where.toEntityId = entityId;
    } else {
      // Both directions
      where.OR = [
        { fromEntityId: entityId },
        { toEntityId: entityId }
      ];
    }

    const relationships = await prisma.relation.findMany({
      where,
      include: {
        fromEntity: true,
        toEntity: true,
        capsuleRelations: { include: { capsule: true } }
      },
      orderBy: {
        strength: 'desc'
      }
    });

    return relationships.map(rel => ({
      id: rel.id,
      type: rel.relationType,
      direction: rel.fromEntityId === entityId ? 'from' : 'to',
      relatedEntity: rel.fromEntityId === entityId ? {
        id: rel.toEntity.id,
        name: rel.toEntity.canonicalName,
        type: rel.toEntity.type
      } : {
        id: rel.fromEntity.id,
        name: rel.fromEntity.canonicalName,
        type: rel.fromEntity.type
      },
      strength: rel.strength,
      source: rel.capsuleRelations[0] ? {
        capsuleId: rel.capsuleRelations[0].capsule.id,
        title: rel.capsuleRelations[0].capsule.summary || 'Untitled',
        createdAt: rel.capsuleRelations[0].capsule.createdAt
      } : undefined
    }));
  }

  /**
   * Find shortest path between two entities
   */
  static async findPath(fromEntityId: string, toEntityId: string, maxDepth: number = 5) {
    // BFS to find shortest path
    const visited = new Set<string>();
    const queue: Array<{ entityId: string; path: any[] }> = [
      { entityId: fromEntityId, path: [] }
    ];

    while (queue.length > 0) {
      const { entityId, path } = queue.shift()!;

      if (entityId === toEntityId) {
        return path;
      }

      if (path.length >= maxDepth || visited.has(entityId)) {
        continue;
      }

      visited.add(entityId);

      // Get all relationships for this entity
      const relationships = await prisma.relation.findMany({
        where: {
          OR: [
            { fromEntityId: entityId },
            { toEntityId: entityId }
          ]
        },
        include: {
          fromEntity: true,
          toEntity: true
        }
      });

      for (const rel of relationships) {
        const nextEntityId = rel.fromEntityId === entityId ? rel.toEntityId : rel.fromEntityId;
        const nextEntity = rel.fromEntityId === entityId ? rel.toEntity : rel.fromEntity;

        if (!visited.has(nextEntityId)) {
          queue.push({
            entityId: nextEntityId,
            path: [
              ...path,
              {
                entity: { id: entityId },
                relationship: { type: rel.relationType, strength: rel.strength },
                nextEntity: { id: nextEntity.id, name: nextEntity.canonicalName, type: nextEntity.type }
              }
            ]
          });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get all related entities within N hops
   */
  static async getRelatedEntities(entityId: string, depth: number = 2, type?: string) {
    const visited = new Set<string>();
    const entities: any[] = [];
    const queue: Array<{ entityId: string; currentDepth: number }> = [
      { entityId, currentDepth: 0 }
    ];

    while (queue.length > 0) {
      const { entityId: currentId, currentDepth } = queue.shift()!;

      if (currentDepth > depth || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Get entity details
      if (currentId !== entityId) {
        const entity = await prisma.entity.findUnique({
          where: { id: currentId }
        });

        if (entity) {
          entities.push({
            ...entity,
            depth: currentDepth
          });
        }
      }

      // Get relationships
      const where: Prisma.RelationWhereInput = {
        OR: [
          { fromEntityId: currentId },
          { toEntityId: currentId }
        ]
      };

      if (type) {
        where.relationType = type;
      }

      const relationships = await prisma.relation.findMany({
        where,
        include: {
          fromEntity: true,
          toEntity: true
        }
      });

      for (const rel of relationships) {
        const nextEntityId = rel.fromEntityId === currentId ? rel.toEntityId : rel.fromEntityId;

        if (!visited.has(nextEntityId)) {
          queue.push({
            entityId: nextEntityId,
            currentDepth: currentDepth + 1
          });
        }
      }
    }

    return entities;
  }

  /**
   * Get relationship statistics
   */
  static async getStats() {
    const totalRelationships = await prisma.relation.count();

    // Count by type
    const byType = await prisma.relation.groupBy({
      by: ['relationType'],
      _count: true
    });

    const typeStats = byType.reduce((acc: any, item) => {
      acc[item.relationType] = item._count;
      return acc;
    }, {});

    // Top connected entities
    const topConnected = await prisma.$queryRaw<Array<{
      id: string;
      canonicalName: string;
      type: string;
      connectionCount: bigint;
    }>>`
      SELECT 
        e.id,
        e."canonicalName",
        e.type,
        COUNT(*) as "connectionCount"
      FROM "Entity" e
      LEFT JOIN "Relation" r ON (r."fromEntityId" = e.id OR r."toEntityId" = e.id)
      GROUP BY e.id, e."canonicalName", e.type
      ORDER BY "connectionCount" DESC
      LIMIT 10
    `;

    return {
      totalRelationships,
      byType: typeStats,
      topConnectedEntities: topConnected.map(e => ({
        id: e.id,
        name: e.canonicalName,
        type: e.type,
        connectionCount: Number(e.connectionCount)
      }))
    };
  }

  /**
   * Get visualization data for knowledge graph
   */
  static async getVisualizationData(entityId?: string, depth: number = 2) {
    let entities: any[];
    let relationships: any[];

    if (entityId) {
      // Get entities within N hops
      const relatedEntities = await this.getRelatedEntities(entityId, depth);
      const entityIds = [entityId, ...relatedEntities.map((e: any) => e.id)];

      entities = await prisma.entity.findMany({
        where: {
          id: { in: entityIds }
        }
      });

      // Get relationships between these entities
      relationships = await prisma.relation.findMany({
        where: {
          AND: [
            { fromEntityId: { in: entityIds } },
            { toEntityId: { in: entityIds } }
          ]
        }
      });
    } else {
      // Get all entities and relationships (limited)
      entities = await prisma.entity.findMany({
        take: 100,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const entityIds = entities.map(e => e.id);

      relationships = await prisma.relation.findMany({
        where: {
          AND: [
            { fromEntityId: { in: entityIds } },
            { toEntityId: { in: entityIds } }
          ]
        },
        take: 200
      });
    }

    // Count connections for each entity
    const connectionCounts: { [key: string]: number } = {};
    relationships.forEach(rel => {
      connectionCounts[rel.fromEntityId] = (connectionCounts[rel.fromEntityId] || 0) + 1;
      connectionCounts[rel.toEntityId] = (connectionCounts[rel.toEntityId] || 0) + 1;
    });

    return {
      nodes: entities.map(e => ({
        id: e.id,
        label: e.canonicalName,
        type: e.type,
        connectionCount: connectionCounts[e.id] || 0
      })),
      edges: relationships.map(r => ({
        id: r.id,
        source: r.fromEntityId,
        target: r.toEntityId,
        type: r.relationType,
        confidence: r.strength
      }))
    };
  }
}
