// web/src/services/maintenance.ts

import { api } from '@/lib/api';

export interface HealthReport {
  score: number;
  totalEntities: number;
  totalRelations: number;
  orphanEntities: number;
  potentialDuplicates: number;
  staleEntities: number;
  brokenRelations: number;
  details: {
    orphanEntities: string[];
    potentialDuplicates: Array<{
      entityAId: string;
      entityBId: string;
      similarity: number;
    }>;
    staleEntities: string[];
    brokenRelations: string[];
  };
}

export interface MaintenanceTask {
  id: string;
  userId: string;
  taskType: 'ENTITY_MERGE' | 'RELATION_DISCOVERY' | 'TAG_OPTIMIZATION' | 'STALE_DETECTION' | 'ORPHAN_CLEANUP';
  description: string;
  status: 'PENDING' | 'AUTO_APPROVED' | 'AWAITING_USER_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'FAILED' | 'REVERTED';
  confidence: number;
  sourceEntityId?: string;
  targetEntityId?: string;
  relationId?: string;
  changes?: any;
  reviewedAt?: string;
  reviewedBy?: 'USER' | 'SYSTEM';
  reviewComment?: string;
  appliedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanResult {
  duplicates: number;
  relations: number;
  stale: number;
  orphans: number;
}

// Health Report
export const getHealthReport = async (): Promise<HealthReport> => {
  const response = await api.get('/maintenance/health');
  return response.data.data;
};

// Tasks
export const getTasks = async (params?: {
  status?: string;
  taskType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: MaintenanceTask[]; total: number }> => {
  const response = await api.get('/maintenance/tasks', { params });
  return {
    tasks: response.data.data,
    total: response.data.meta.pagination.total,
  };
};

export const getTask = async (id: string): Promise<MaintenanceTask> => {
  const response = await api.get(`/maintenance/tasks/${id}`);
  return response.data.data;
};

export const approveTask = async (id: string, comment?: string): Promise<MaintenanceTask> => {
  const response = await api.post(`/maintenance/tasks/${id}/approve`, { comment });
  return response.data.data;
};

export const rejectTask = async (id: string, comment?: string): Promise<MaintenanceTask> => {
  const response = await api.post(`/maintenance/tasks/${id}/reject`, { comment });
  return response.data.data;
};

export const applyTask = async (id: string): Promise<MaintenanceTask> => {
  const response = await api.post(`/maintenance/tasks/${id}/apply`);
  return response.data.data;
};

// Scan
export const runFullScan = async (): Promise<ScanResult> => {
  const response = await api.post('/maintenance/scan');
  return response.data.data;
};

export const scanDuplicates = async (): Promise<{ count: number; tasks: MaintenanceTask[] }> => {
  const response = await api.post('/maintenance/scan/duplicates');
  return response.data.data;
};

export const scanRelations = async (): Promise<{ count: number; tasks: MaintenanceTask[] }> => {
  const response = await api.post('/maintenance/scan/relations');
  return response.data.data;
};

// Stats
export const getMaintenanceStats = async (): Promise<{
  totalTasks: number;
  pendingTasks: number;
  approvedTasks: number;
  appliedTasks: number;
  rejectedTasks: number;
}> => {
  const response = await api.get('/maintenance/stats');
  return response.data.data;
};

// Scan orphans
export const scanOrphans = async (): Promise<{ count: number; tasks: MaintenanceTask[] }> => {
  const response = await api.post('/maintenance/scan/orphans');
  return response.data.data;
};

// Revert task
export const revertTask = async (id: string, comment?: string): Promise<MaintenanceTask> => {
  const response = await api.post(`/maintenance/tasks/${id}/revert`, { comment });
  return response.data.data;
};
