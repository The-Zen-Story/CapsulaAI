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

    it('should calculate correct interval for first repetition', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 0,
        repetitionCount: 0,
      };

      const result = SM2Algorithm.calculate(card, 3);

      expect(result.newInterval).toBe(1);
      expect(result.newRepetitionCount).toBe(1);
    });

    it('should calculate correct interval for second repetition', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 1,
        repetitionCount: 1,
      };

      const result = SM2Algorithm.calculate(card, 3);

      expect(result.newInterval).toBe(6);
      expect(result.newRepetitionCount).toBe(2);
    });

    it('should decrease EF on failure', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 6,
        repetitionCount: 2,
      };

      const result = SM2Algorithm.calculate(card, 2);

      // EF should decrease but stay above 1.3
      expect(result.newEF).toBeLessThan(2.5);
      expect(result.newEF).toBeGreaterThanOrEqual(1.3);
    });

    it('should increase EF on perfect score', () => {
      const card = {
        easinessFactor: 2.0,
        interval: 6,
        repetitionCount: 3,
      };

      const result = SM2Algorithm.calculate(card, 5);

      expect(result.newEF).toBeGreaterThan(2.0);
    });
  });

  describe('getNextReviewDate', () => {
    it('should return date with correct interval', () => {
      const result = SM2Algorithm.getNextReviewDate(7);
      const expected = new Date();
      expected.setDate(expected.getDate() + 7);
      expected.setHours(9, 0, 0, 0);

      expect(result.getDate()).toBe(expected.getDate());
      expect(result.getHours()).toBe(9);
    });
  });

  describe('handleOverdue', () => {
    it('should treat significantly overdue as failure', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 10,
        repetitionCount: 5,
      };

      // Overdue by 25 days (more than 2x interval)
      const result = SM2Algorithm.handleOverdue(card, 25);

      expect(result.newRepetitionCount).toBe(0);
      expect(result.status).toBe('learning');
    });

    it('should reduce interval slightly for moderately overdue', () => {
      const card = {
        easinessFactor: 2.5,
        interval: 10,
        repetitionCount: 5,
      };

      // Overdue by 5 days (less than 2x interval)
      const result = SM2Algorithm.handleOverdue(card, 5);

      expect(result.newInterval).toBe(8); // 10 * 0.8
      expect(result.newEF).toBe(2.5); // EF unchanged
    });
  });
});
