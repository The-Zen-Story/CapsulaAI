// web/src/services/review.ts

import { api } from '@/lib/api';

export interface ReviewCard {
  id: string;
  userId: string;
  capsuleId?: string;
  front: string;
  back: string;
  cardType: 'FLASHCARD' | 'QA' | 'FILL_BLANK' | 'CLOZE';
  easinessFactor: number;
  interval: number;
  repetitionCount: number;
  nextReviewAt: string;
  lastReviewedAt?: string;
  status: 'NEW' | 'SCHEDULED' | 'LEARNING' | 'REVIEW' | 'MASTERED' | 'SUSPENDED';
  totalReviews: number;
  correctCount: number;
  streak: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  averageTimePerCard?: number;
}

export interface ReviewLog {
  id: string;
  userId: string;
  cardId: string;
  sessionId?: string;
  rating: number;
  responseTime: number;
  reviewedAt: string;
  previousInterval: number;
  newInterval: number;
  previousEF: number;
  newEF: number;
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
  responseTime: number;
}

export interface DashboardData {
  stats: ReviewStats;
  recentCards: ReviewCard[];
  dueCards: ReviewCard[];
  lastSession?: ReviewSession;
}

// Card Management
export const getCards = async (params?: {
  status?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ cards: ReviewCard[]; total: number }> => {
  const response = await api.get('/review/cards', { params });
  return {
    cards: response.data.data,
    total: response.data.meta.pagination.total,
  };
};

export const getCard = async (id: string): Promise<ReviewCard> => {
  const response = await api.get(`/review/cards/${id}`);
  return response.data.data;
};

export const createCard = async (input: CreateCardInput): Promise<ReviewCard> => {
  const response = await api.post('/review/cards', input);
  return response.data.data;
};

export const updateCard = async (
  id: string,
  data: Partial<Pick<ReviewCard, 'front' | 'back' | 'tags'>>
): Promise<ReviewCard> => {
  const response = await api.put(`/review/cards/${id}`, data);
  return response.data.data;
};

export const deleteCard = async (id: string): Promise<void> => {
  await api.delete(`/review/cards/${id}`);
};

export const suspendCard = async (id: string): Promise<ReviewCard> => {
  const response = await api.post(`/review/cards/${id}/suspend`);
  return response.data.data;
};

export const resumeCard = async (id: string): Promise<ReviewCard> => {
  const response = await api.post(`/review/cards/${id}/resume`);
  return response.data.data;
};

export const resetCard = async (id: string): Promise<ReviewCard> => {
  const response = await api.post(`/review/cards/${id}/reset`);
  return response.data.data;
};

// Review Session
export const getDueCards = async (limit?: number): Promise<ReviewCard[]> => {
  const response = await api.get('/review/sessions/due', { params: { limit } });
  return response.data.data;
};

export const startSession = async (): Promise<{ session: ReviewSession; cards: ReviewCard[] }> => {
  const response = await api.post('/review/sessions');
  return response.data.data;
};

export const getSession = async (id: string): Promise<ReviewSession> => {
  const response = await api.get(`/review/sessions/${id}`);
  return response.data.data;
};

export const submitReview = async (
  sessionId: string,
  input: SubmitReviewInput
): Promise<{ reviewLog: ReviewLog; card: ReviewCard }> => {
  const response = await api.post(`/review/sessions/${sessionId}/review`, input);
  return response.data.data;
};

export const completeSession = async (id: string): Promise<ReviewSession> => {
  const response = await api.post(`/review/sessions/${id}/complete`);
  return response.data.data;
};

// Statistics
export const getStats = async (): Promise<ReviewStats> => {
  const response = await api.get('/review/stats');
  return response.data.data;
};

export const getHeatmap = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ date: string; count: number }[]> => {
  const response = await api.get('/review/heatmap', { params });
  return response.data.data;
};

export const getDashboard = async (): Promise<DashboardData> => {
  const response = await api.get('/review/dashboard');
  return response.data.data;
};
