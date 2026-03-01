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
