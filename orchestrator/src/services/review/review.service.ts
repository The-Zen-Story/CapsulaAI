// services/review/review.service.ts

import { PrismaClient, ReviewCard, ReviewSession, ReviewLog, Prisma } from '@prisma/client';
import { SM2Algorithm } from './sm2.algorithm';

const prisma = new PrismaClient();

export interface CreateCardInput {
  front: string;
  back: string;
  cardType?: 'FLASHCARD' | 'QA' | 'FILL_BLANK' | 'CLOZE';
  capsuleId?: string;
  tags?: string[];
}

export interface SubmitReviewInput {
  cardId: string;
  rating: 0 | 1 | 2 | 3 | 4 | 5;
  responseTime: number; // seconds
}

export interface ReviewStats {
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  masteredCards: number;
  streak: number;
  totalReviews: number;
  averageAccuracy: number;
}

export class ReviewService {
  /**
   * Create a new review card
   */
  async createCard(userId: string, input: CreateCardInput): Promise<ReviewCard> {
    const now = new Date();
    // Set initial review to tomorrow at 9 AM
    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);
    nextReviewAt.setHours(9, 0, 0, 0);

    return prisma.reviewCard.create({
      data: {
        userId,
        front: input.front,
        back: input.back,
        cardType: input.cardType || 'FLASHCARD',
        capsuleId: input.capsuleId,
        tags: input.tags || [],
        nextReviewAt,
        status: 'NEW',
        easinessFactor: 2.5,
        interval: 0,
        repetitionCount: 0,
        totalReviews: 0,
        correctCount: 0,
        streak: 0,
      },
    });
  }

  /**
   * Get a single card by ID
   */
  async getCard(userId: string, cardId: string): Promise<ReviewCard | null> {
    return prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });
  }

  /**
   * Get all cards for a user with optional filters
   */
  async getCards(
    userId: string,
    options: {
      status?: string;
      tags?: string[];
      search?: string;
      dueBefore?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ cards: ReviewCard[]; total: number }> {
    const { status, tags, search, dueBefore, limit = 50, offset = 0 } = options;

    const where: Prisma.ReviewCardWhereInput = { userId };

    if (status) {
      where.status = status as any;
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (search) {
      where.OR = [
        { front: { contains: search, mode: 'insensitive' } },
        { back: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dueBefore) {
      where.nextReviewAt = { lte: dueBefore };
    }

    const [cards, total] = await Promise.all([
      prisma.reviewCard.findMany({
        where,
        orderBy: [{ nextReviewAt: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.reviewCard.count({ where }),
    ]);

    return { cards, total };
  }

  /**
   * Get cards due for review
   */
  async getDueCards(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ReviewCard[]> {
    const { limit = 50, offset = 0 } = options;
    const now = new Date();

    return prisma.reviewCard.findMany({
      where: {
        userId,
        status: { not: 'SUSPENDED' },
        nextReviewAt: { lte: now },
      },
      orderBy: [
        { easinessFactor: 'asc' }, // Harder cards first
        { nextReviewAt: 'asc' },
      ],
      take: limit,
      skip: offset,
    });
  }

  /**
   * Update a card
   */
  async updateCard(
    userId: string,
    cardId: string,
    data: Partial<Pick<ReviewCard, 'front' | 'back' | 'tags'>>
  ): Promise<ReviewCard> {
    const card = await prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    return prisma.reviewCard.update({
      where: { id: cardId },
      data,
    });
  }

  /**
   * Delete a card
   */
  async deleteCard(userId: string, cardId: string): Promise<void> {
    const card = await prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    await prisma.reviewCard.delete({
      where: { id: cardId },
    });
  }

  /**
   * Suspend a card (pause reviews)
   */
  async suspendCard(userId: string, cardId: string): Promise<ReviewCard> {
    const card = await prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    return prisma.reviewCard.update({
      where: { id: cardId },
      data: { status: 'SUSPENDED' },
    });
  }

  /**
   * Resume a suspended card
   */
  async resumeCard(userId: string, cardId: string): Promise<ReviewCard> {
    const card = await prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    // Resume with reduced interval to avoid overwhelming the user
    const newInterval = Math.min(card.interval, 7);
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
    nextReviewAt.setHours(9, 0, 0, 0);

    return prisma.reviewCard.update({
      where: { id: cardId },
      data: {
        status: card.repetitionCount >= 5 ? 'REVIEW' : 'LEARNING',
        interval: newInterval,
        nextReviewAt,
      },
    });
  }

  /**
   * Reset a card to initial state
   */
  async resetCard(userId: string, cardId: string): Promise<ReviewCard> {
    const card = await prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);
    nextReviewAt.setHours(9, 0, 0, 0);

    return prisma.reviewCard.update({
      where: { id: cardId },
      data: {
        status: 'NEW',
        easinessFactor: 2.5,
        interval: 0,
        repetitionCount: 0,
        nextReviewAt,
        totalReviews: 0,
        correctCount: 0,
        streak: 0,
      },
    });
  }

  /**
   * Start a new review session
   */
  async startSession(userId: string): Promise<{ session: ReviewSession; cards: ReviewCard[] }> {
    const dueCards = await this.getDueCards(userId, { limit: 50 });

    if (dueCards.length === 0) {
      throw new Error('No cards due for review');
    }

    const session = await prisma.reviewSession.create({
      data: {
        userId,
        startedAt: new Date(),
        cardsReviewed: 0,
        correctCount: 0,
        incorrectCount: 0,
      },
    });

    // Create session card entries
    await prisma.reviewSessionCard.createMany({
      data: dueCards.map((card, index) => ({
        sessionId: session.id,
        cardId: card.id,
        orderIndex: index,
      })),
    });

    return { session, cards: dueCards };
  }

  /**
   * Get a session by ID
   */
  async getSession(userId: string, sessionId: string): Promise<ReviewSession | null> {
    return prisma.reviewSession.findFirst({
      where: { id: sessionId, userId },
    });
  }

  /**
   * Submit a review for a card
   */
  async submitReview(
    userId: string,
    sessionId: string,
    input: SubmitReviewInput
  ): Promise<{ reviewLog: ReviewLog; card: ReviewCard }> {
    const { cardId, rating, responseTime } = input;

    const card = await prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    const session = await prisma.reviewSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Apply SM-2 algorithm
    const sm2Result = SM2Algorithm.calculate(
      {
        easinessFactor: card.easinessFactor,
        interval: card.interval,
        repetitionCount: card.repetitionCount,
      },
      rating
    );

    const nextReviewAt = SM2Algorithm.getNextReviewDate(sm2Result.newInterval);

    // Update card
    const updatedCard = await prisma.reviewCard.update({
      where: { id: cardId },
      data: {
        easinessFactor: sm2Result.newEF,
        interval: sm2Result.newInterval,
        repetitionCount: sm2Result.newRepetitionCount,
        status: sm2Result.status.toUpperCase() as any,
        nextReviewAt,
        lastReviewedAt: new Date(),
        totalReviews: { increment: 1 },
        correctCount: rating >= 3 ? { increment: 1 } : undefined,
        streak: rating >= 3 ? { increment: 1 } : 0,
      },
    });

    // Create review log
    const reviewLog = await prisma.reviewLog.create({
      data: {
        userId,
        cardId,
        sessionId,
        rating,
        responseTime,
        previousInterval: card.interval,
        newInterval: sm2Result.newInterval,
        previousEF: card.easinessFactor,
        newEF: sm2Result.newEF,
      },
    });

    // Update session stats
    await prisma.reviewSession.update({
      where: { id: sessionId },
      data: {
        cardsReviewed: { increment: 1 },
        correctCount: rating >= 3 ? { increment: 1 } : undefined,
        incorrectCount: rating < 3 ? { increment: 1 } : undefined,
      },
    });

    return { reviewLog, card: updatedCard };
  }

  /**
   * Complete a review session
   */
  async completeSession(userId: string, sessionId: string): Promise<ReviewSession> {
    const session = await prisma.reviewSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Calculate average time per card
    const logs = await prisma.reviewLog.findMany({
      where: { sessionId },
      select: { responseTime: true },
    });

    const averageTimePerCard =
      logs.length > 0
        ? logs.reduce((sum, log) => sum + log.responseTime, 0) / logs.length
        : null;

    return prisma.reviewSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        averageTimePerCard,
      },
    });
  }

  /**
   * Get review statistics for a user
   */
  async getStats(userId: string): Promise<ReviewStats> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalCards,
      dueToday,
      newCards,
      learningCards,
      reviewCards,
      masteredCards,
      totalReviews,
      correctReviews,
    ] = await Promise.all([
      prisma.reviewCard.count({ where: { userId } }),
      prisma.reviewCard.count({
        where: { userId, status: { not: 'SUSPENDED' }, nextReviewAt: { lte: now } },
      }),
      prisma.reviewCard.count({ where: { userId, status: 'NEW' } }),
      prisma.reviewCard.count({ where: { userId, status: 'LEARNING' } }),
      prisma.reviewCard.count({ where: { userId, status: 'REVIEW' } }),
      prisma.reviewCard.count({ where: { userId, status: 'MASTERED' } }),
      prisma.reviewLog.count({ where: { userId } }),
      prisma.reviewLog.count({ where: { userId, rating: { gte: 3 } } }),
    ]);

    // Calculate streak (consecutive days with reviews)
    const streak = await this.calculateStreak(userId);

    const averageAccuracy = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;

    return {
      totalCards,
      dueToday,
      newCards,
      learningCards,
      reviewCards,
      masteredCards,
      streak,
      totalReviews,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
    };
  }

  /**
   * Calculate the user's current streak
   */
  private async calculateStreak(userId: string): Promise<number> {
    const logs = await prisma.reviewLog.findMany({
      where: { userId },
      orderBy: { reviewedAt: 'desc' },
      select: { reviewedAt: true },
    });

    if (logs.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    // Group logs by date
    const reviewDates = new Set(
      logs.map((log) => {
        const date = new Date(log.reviewedAt);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    );

    // Check if reviewed today or yesterday
    const lastReviewDate = new Date(logs[0].reviewedAt);
    lastReviewDate.setHours(0, 0, 0, 0);

    const daysSinceLastReview = Math.floor(
      (today.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastReview > 1) {
      return 0; // Streak broken
    }

    // Count consecutive days
    while (reviewDates.has(currentDate.getTime())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  /**
   * Get review heatmap data
   */
  async getHeatmap(
    userId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{ date: string; count: number }[]> {
    const { startDate, endDate = new Date() } = options;

    const start = startDate || new Date();
    start.setDate(start.getDate() - 365); // Default to last year

    const logs = await prisma.reviewLog.groupBy({
      by: ['reviewedAt'],
      where: {
        userId,
        reviewedAt: {
          gte: start,
          lte: endDate,
        },
      },
      _count: { id: true },
    });

    // Group by date (remove time component)
    const dateMap = new Map<string, number>();

    logs.forEach((log) => {
      const date = new Date(log.reviewedAt);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + log._count.id);
    });

    return Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  /**
   * Get dashboard data
   */
  async getDashboard(userId: string): Promise<{
    stats: ReviewStats;
    recentCards: ReviewCard[];
    dueCards: ReviewCard[];
    lastSession?: ReviewSession;
  }> {
    const [stats, recentCards, dueCards, lastSession] = await Promise.all([
      this.getStats(userId),
      prisma.reviewCard.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.getDueCards(userId, { limit: 10 }),
      prisma.reviewSession.findFirst({
        where: { userId },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      stats,
      recentCards,
      dueCards,
      lastSession: lastSession || undefined,
    };
  }
}

export const reviewService = new ReviewService();
