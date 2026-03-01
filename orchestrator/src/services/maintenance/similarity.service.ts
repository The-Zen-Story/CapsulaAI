import { distance as levenshteinDistance } from 'fast-levenshtein';
import { distance as jaroWinklerDistance } from 'jaro-winkler';

/**
 * Similarity weights configuration interface
 */
export interface SimilarityWeights {
  /** Name similarity weight */
  name: number;
  /** Alias overlap weight */
  alias: number;
  /** Semantic similarity weight */
  semantic: number;
  /** Context similarity weight */
  context: number;
  /** Type match weight */
  type: number;
}

/**
 * Default similarity weights configuration
 * - name: 0.25 - Name similarity
 * - alias: 0.15 - Alias overlap
 * - semantic: 0.35 - Semantic similarity
 * - context: 0.15 - Context similarity
 * - type: 0.10 - Type match
 */
export const DEFAULT_WEIGHTS: SimilarityWeights = {
  name: 0.25,
  alias: 0.15,
  semantic: 0.35,
  context: 0.15,
  type: 0.10,
};

/**
 * Entity data structure interface
 */
export interface EntityData {
  /** Entity unique identifier */
  id: string;
  /** Entity name */
  name: string;
  /** Entity type */
  type: string;
  /** Entity alias list */
  aliases: string[];
  /** Semantic vector embedding */
  embedding?: number[];
  /** Related entity ID list */
  relatedEntities: string[];
}

/**
 * Similar entity pair result interface
 */
export interface SimilarPair {
  /** Entity A */
  entityA: EntityData;
  /** Entity B */
  entityB: EntityData;
  /** Combined similarity score (0-1) */
  similarity: number;
  /** Detailed similarity scores for each dimension */
  details?: SimilarityDetails;
}

/**
 * Detailed similarity scores for each dimension
 */
export interface SimilarityDetails {
  /** Name similarity */
  nameSimilarity: number;
  /** Alias overlap */
  aliasOverlap: number;
  /** Semantic similarity */
  semanticSimilarity: number;
  /** Context similarity */
  contextSimilarity: number;
  /** Type match score */
  typeMatch: number;
}

/**
 * Entity similarity calculation service
 * 
 * Provides multiple similarity calculation algorithms:
 * - Name similarity: Based on Levenshtein distance and Jaro-Winkler similarity
 * - Alias overlap: Based on Jaccard coefficient
 * - Semantic similarity: Based on vector cosine similarity
 * - Context similarity: Based on Jaccard coefficient of co-occurring entities
 * - Type match: Binary match
 * 
 * Supports configurable weight combination for calculating combined similarity
 */
export class SimilarityService {
  private weights: SimilarityWeights;

  /**
   * Create a similarity service instance
   * @param weights - Similarity weights configuration, defaults to DEFAULT_WEIGHTS
   */
  constructor(weights: SimilarityWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.validateWeights();
  }

  /**
   * Validate if the weights configuration is valid
   * @throws Error when the sum of weights is not equal to 1
   */
  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((acc, w) => acc + w, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(
        `权重总和必须等于1.0，当前总和: ${sum.toFixed(3)}`
      );
    }
  }

  /**
   * Update weights configuration
   * @param weights - New weights configuration
   */
  updateWeights(weights: SimilarityWeights): void {
    this.weights = weights;
    this.validateWeights();
  }

  /**
   * Get current weights configuration
   * @returns Current weights configuration
   */
  getWeights(): SimilarityWeights {
    return { ...this.weights };
  }

  /**
   * Calculate combined similarity between two entities
   * 
   * Combined similarity = Σ(dimension similarity × corresponding weight)
   * 
   * @param entityA - Entity A
   * @param entityB - Entity B
   * @returns Combined similarity score (0-1), rounded to 2 decimal places
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
   * Calculate detailed similarity between two entities
   * 
   * @param entityA - Entity A
   * @param entityB - Entity B
   * @returns Detailed result containing similarity scores for each dimension
   */
  calculateSimilarityWithDetails(
    entityA: EntityData,
    entityB: EntityData
  ): SimilarPair {
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

    return {
      entityA,
      entityB,
      similarity: Math.round(totalSim * 100) / 100,
      details: {
        nameSimilarity: Math.round(nameSim * 100) / 100,
        aliasOverlap: Math.round(aliasSim * 100) / 100,
        semanticSimilarity: Math.round(semanticSim * 100) / 100,
        contextSimilarity: Math.round(contextSim * 100) / 100,
        typeMatch: typeSim,
      },
    };
  }

  /**
   * Calculate name similarity
   * 
   * Algorithm steps:
   * 1. Normalize names (lowercase, remove spaces and punctuation)
   * 2. Exact match returns 1.0
   * 3. Substring match returns 0.9
   * 4. Calculate Levenshtein similarity: 1 - (edit distance / max length)
   * 5. Calculate Jaro-Winkler similarity
   * 6. Return the maximum of both
   * 
   * @param nameA - Name A
   * @param nameB - Name B
   * @returns Name similarity (0-1)
   */
  calculateNameSimilarity(nameA: string, nameB: string): number {
    const normA = this.normalize(nameA);
    const normB = this.normalize(nameB);

    // Exact match
    if (normA === normB) return 1.0;

    // Empty string check
    if (normA.length === 0 || normB.length === 0) return 0.0;

    // Substring match
    if (normA.includes(normB) || normB.includes(normA)) return 0.9;

    // Levenshtein similarity
    const maxLen = Math.max(normA.length, normB.length);
    const levDist = levenshteinDistance(normA, normB);
    const levSim = 1 - levDist / maxLen;

    // Jaro-Winkler similarity (using jaro-winkler library)
    const jaroSim = jaroWinklerDistance(normA, normB);

    // Return maximum value
    return Math.max(levSim, jaroSim);
  }

  /**
   * Calculate alias overlap (Jaccard coefficient)
   * 
   * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
   * 
   * @param aliasesA - Entity A's alias list
   * @param aliasesB - Entity B's alias list
   * @returns Alias overlap (0-1)
   */
  calculateAliasOverlap(aliasesA: string[], aliasesB: string[]): number {
    const setA = new Set(aliasesA.map((a) => this.normalize(a)));
    const setB = new Set(aliasesB.map((b) => this.normalize(b)));

    const intersection = new Set(Array.from(setA).filter((x) => setB.has(x)));
    const union = new Set(Array.from(setA).concat(Array.from(setB)));

    if (union.size === 0) return 0.0;

    return intersection.size / union.size;
  }

  /**
   * Calculate semantic similarity (vector cosine similarity)
   * 
   * cos(θ) = (A · B) / (||A|| × ||B||)
   * 
   * @param embeddingA - Entity A's vector embedding
   * @param embeddingB - Entity B's vector embedding
   * @returns Semantic similarity (0-1), returns 0 when no embedding
   */
  calculateSemanticSimilarity(
    embeddingA?: number[],
    embeddingB?: number[]
  ): number {
    if (!embeddingA || !embeddingB) return 0.0;
    if (embeddingA.length !== embeddingB.length) return 0.0;
    if (embeddingA.length === 0) return 0.0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i];
      normA += embeddingA[i] * embeddingA[i];
      normB += embeddingB[i] * embeddingB[i];
    }

    if (normA === 0 || normB === 0) return 0.0;

    // Calculate cosine similarity
    // Note: Assumes vectors are already normalized, result in [0, 1] range
    // If vectors are not normalized, result may be in [-1, 1], needs mapping to [0, 1]
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    
    // Map [-1, 1] to [0, 1], ensure result is non-negative
    return Math.max(0, Math.min(1, (similarity + 1) / 2));
  }

  /**
   * Calculate context similarity (Jaccard coefficient of co-occurring entities)
   * 
   * Calculates similarity based on shared related entities between two entities
   * 
   * @param relatedA - Entity A's related entity ID list
   * @param relatedB - Entity B's related entity ID list
   * @returns Context similarity (0-1)
   */
  calculateContextSimilarity(
    relatedA: string[],
    relatedB: string[]
  ): number {
    const setA = new Set(relatedA);
    const setB = new Set(relatedB);

    const intersection = new Set(Array.from(setA).filter((x) => setB.has(x)));
    const union = new Set(Array.from(setA).concat(Array.from(setB)));

    if (union.size === 0) return 0.0;

    return intersection.size / union.size;
  }

  /**
   * Calculate Jaccard similarity coefficient
   * 
   * @param setA - Set A
   * @param setB - Set B
   * @returns Jaccard coefficient (0-1)
   */
  calculateJaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    
    const intersection = new Set(Array.from(setA).filter((x) => setB.has(x)));
    const union = new Set(Array.from(setA).concat(Array.from(setB)));

    return intersection.size / union.size;
  }

  /**
   * Normalize string for comparison
   * 
   * Transformation steps:
   * 1. Convert to lowercase
   * 2. Remove all spaces
   * 3. Remove all punctuation
   * 4. Trim leading and trailing whitespace
   * 
   * @param str - Original string
   * @returns Normalized string
   */
  normalize(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\s!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '') // Remove spaces and punctuation
      .trim();
  }

  /**
   * Calculate Levenshtein distance
   * 
   * Uses fast-levenshtein library to calculate edit distance between two strings
   * 
   * @param strA - String A
   * @param strB - String B
   * @returns Edit distance
   */
  calculateLevenshteinDistance(strA: string, strB: string): number {
    return levenshteinDistance(strA, strB);
  }

  /**
   * Calculate Jaro-Winkler similarity
   * 
   * Uses jaro-winkler library to calculate similarity
   * Gives extra weight to prefix matching, suitable for name matching
   * 
   * Note: The distance function from jaro-winkler library returns similarity (0-1),
   * not distance. Higher values indicate greater similarity.
   * 
   * @param strA - String A
   * @param strB - String B
   * @returns Jaro-Winkler similarity (0-1)
   */
  calculateJaroWinklerSimilarity(strA: string, strB: string): number {
    return jaroWinklerDistance(strA, strB);
  }

  /**
   * Find similar entity pairs from entity list
   * 
   * Uses O(n²) algorithm to compare all entity pairs
   * 
   * @param entities - Entity list
   * @param threshold - Similarity threshold (default 0.7)
   * @param includeDetails - Whether to include detailed similarity information
   * @returns List of similar entity pairs, sorted by similarity in descending order
   */
  async findSimilarPairs(
    entities: EntityData[],
    threshold = 0.7,
    includeDetails = false
  ): Promise<SimilarPair[]> {
    const pairs: SimilarPair[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const pair = includeDetails
          ? this.calculateSimilarityWithDetails(entities[i], entities[j])
          : {
              entityA: entities[i],
              entityB: entities[j],
              similarity: this.calculateSimilarity(entities[i], entities[j]),
            };

        if (pair.similarity >= threshold) {
          pairs.push(pair);
        }
      }
    }

    // Sort by similarity in descending order
    return pairs.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Batch process similarity calculation
   * 
   * Uses sliding window to avoid O(n²) memory usage
   * Suitable for processing large entity lists
   * 
   * @param entities - Entity list
   * @param callback - Callback function for each batch of results
   * @param batchSize - Batch processing size (default 100)
   * @param threshold - Similarity threshold (default 0.7)
   */
  async processSimilarityBatch(
    entities: EntityData[],
    callback: (pairs: SimilarPair[]) => Promise<void>,
    batchSize = 100,
    threshold = 0.7
  ): Promise<void> {
    // Use sliding window to avoid O(n²) memory usage
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);

      // Compare within current batch
      const internalPairs = await this.calculateSimilarityBatch(
        batch,
        batch,
        threshold,
        true
      );
      if (internalPairs.length > 0) {
        await callback(internalPairs);
      }

      // Compare with subsequent batches
      for (let j = i + batchSize; j < entities.length; j += batchSize) {
        const compareBatch = entities.slice(j, j + batchSize);
        const pairs = await this.calculateSimilarityBatch(
          batch,
          compareBatch,
          threshold
        );

        if (pairs.length > 0) {
          await callback(pairs);
        }
      }
    }
  }

  /**
   * Calculate similarity between two batches
   * 
   * @param batchA - Batch A
   * @param batchB - Batch B
   * @param threshold - Similarity threshold
   * @param skipSameIndex - Whether to skip same index (for internal batch comparison)
   * @returns List of similar entity pairs
   */
  private async calculateSimilarityBatch(
    batchA: EntityData[],
    batchB: EntityData[],
    threshold = 0.7,
    skipSameIndex = false
  ): Promise<SimilarPair[]> {
    const pairs: SimilarPair[] = [];

    for (let i = 0; i < batchA.length; i++) {
      const entityA = batchA[i];
      const startJ = skipSameIndex ? i + 1 : 0;

      for (let j = startJ; j < batchB.length; j++) {
        const entityB = batchB[j];

        // Skip if same entity in same batch
        if (skipSameIndex && entityA.id === entityB.id) continue;

        const similarity = this.calculateSimilarity(entityA, entityB);
        if (similarity >= threshold) {
          pairs.push({ entityA, entityB, similarity });
        }
      }
    }

    return pairs;
  }

  /**
   * Find entities most similar to the given entity
   * 
   * @param target - Target entity
   * @param candidates - Candidate entity list
   * @param topK - Return top K most similar (default 5)
   * @param threshold - Similarity threshold (default 0.5)
   * @returns List of most similar entity pairs
   */
  async findMostSimilar(
    target: EntityData,
    candidates: EntityData[],
    topK = 5,
    threshold = 0.5
  ): Promise<SimilarPair[]> {
    const pairs: SimilarPair[] = [];

    for (const candidate of candidates) {
      // Skip self
      if (target.id === candidate.id) continue;

      const similarity = this.calculateSimilarity(target, candidate);
      if (similarity >= threshold) {
        pairs.push({
          entityA: target,
          entityB: candidate,
          similarity,
        });
      }
    }

    // Sort by similarity in descending order and take top K
    return pairs
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

/**
 * Default similarity service instance
 */
export const similarityService = new SimilarityService();
