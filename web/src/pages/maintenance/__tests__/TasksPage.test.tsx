import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the maintenance service
jest.mock('@/services/maintenance', () => ({
  getTasks: jest.fn(),
  approveTask: jest.fn(),
  rejectTask: jest.fn(),
  applyTask: jest.fn(),
  revertTask: jest.fn(),
}));

import TasksPage from '../TasksPage';
import * as maintenanceService from '@/services/maintenance';
import type { MaintenanceTask } from '@/services/maintenance';

const mockGetTasks = maintenanceService.getTasks as jest.MockedFunction<typeof maintenanceService.getTasks>;
const mockApproveTask = maintenanceService.approveTask as jest.MockedFunction<typeof maintenanceService.approveTask>;
const mockRejectTask = maintenanceService.rejectTask as jest.MockedFunction<typeof maintenanceService.rejectTask>;
const mockApplyTask = maintenanceService.applyTask as jest.MockedFunction<typeof maintenanceService.applyTask>;
const mockRevertTask = maintenanceService.revertTask as jest.MockedFunction<typeof maintenanceService.revertTask>;

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

const createMockTask = (overrides: Partial<MaintenanceTask> = {}): MaintenanceTask => ({
  id: `task_${Math.random().toString(36).substring(2, 7)}`,
  userId: 'user_test',
  taskType: 'ENTITY_MERGE',
  description: '测试任务描述',
  status: 'AWAITING_USER_REVIEW',
  confidence: 0.85,
  sourceEntityId: 'entity_1',
  targetEntityId: 'entity_2',
  relationId: undefined,
  changes: undefined,
  reviewedAt: undefined,
  reviewedBy: undefined,
  reviewComment: undefined,
  appliedAt: undefined,
  errorMessage: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('TasksPage Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('任务列表页面测试', () => {
    it('应该显示任务列表', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', description: '任务1' }),
        createMockTask({ id: 'task_2', description: '任务2', taskType: 'RELATION_DISCOVERY' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 2,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('任务1')).toBeInTheDocument();
        expect(screen.getByText('任务2')).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      mockGetTasks.mockImplementation(() => new Promise(() => {})); // 永不 resolve

      renderWithProviders(<TasksPage />);

      expect(screen.getByRole('status')).toBeInTheDocument(); // 加载 spinner
    });

    it('应该处理加载错误', async () => {
      mockGetTasks.mockRejectedValue(new Error('加载失败'));

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('加载任务列表失败')).toBeInTheDocument();
      });

      // 测试重试按钮
      const retryButton = screen.getByText('重试');
      expect(retryButton).toBeInTheDocument();
    });

    it('应该显示空状态', async () => {
      mockGetTasks.mockResolvedValue({
        tasks: [],
        total: 0,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无维护任务')).toBeInTheDocument();
      });
    });

    it('应该支持搜索过滤', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', description: 'React 相关任务' }),
        createMockTask({ id: 'task_2', description: 'Vue 相关任务' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 2,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('React 相关任务')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('搜索任务描述...');
      await userEvent.type(searchInput, 'React');

      // 搜索结果应该只显示匹配的任务
      await waitFor(() => {
        expect(screen.getByText('React 相关任务')).toBeInTheDocument();
        expect(screen.queryByText('Vue 相关任务')).not.toBeInTheDocument();
      });
    });

    it('应该支持状态筛选', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', status: 'AWAITING_USER_REVIEW' }),
        createMockTask({ id: 'task_2', status: 'APPROVED' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 2,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(mockGetTasks).toHaveBeenCalled();
      });
    });

    it('应该支持分页', async () => {
      const mockTasks = Array.from({ length: 15 }, (_, i) =>
        createMockTask({ id: `task_${i}`, description: `任务${i}` })
      );

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks.slice(0, 10),
        total: 15,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('显示 1 - 10 共 15 条')).toBeInTheDocument();
      });

      // 下一页按钮
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeInTheDocument();
    });
  });

  describe('任务详情页面测试', () => {
    it('应该导航到任务详情页', async () => {
      const mockTask = createMockTask({ id: 'task_1', description: '点击查看详情' });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        const taskLink = screen.getByText('点击查看详情');
        expect(taskLink).toBeInTheDocument();
      });

      // 点击任务描述应该导航到详情页
      const taskLink = screen.getByText('点击查看详情');
      fireEvent.click(taskLink);

      expect(mockNavigate).toHaveBeenCalledWith('/maintenance/tasks/task_1');
    });
  });

  describe('组件交互测试', () => {
    it('应该批准任务', async () => {
      const mockTask = createMockTask({
        id: 'task_approve',
        status: 'AWAITING_USER_REVIEW',
        description: '待批准任务',
      });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      mockApproveTask.mockResolvedValue({
        ...mockTask,
        status: 'APPROVED',
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('待批准任务')).toBeInTheDocument();
      });

      // 打开操作菜单
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);

      // 点击批准按钮
      const approveButton = await screen.findByText('批准');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockApproveTask).toHaveBeenCalledWith('task_approve', undefined);
      });
    });

    it('应该拒绝任务', async () => {
      const mockTask = createMockTask({
        id: 'task_reject',
        status: 'AWAITING_USER_REVIEW',
        description: '待拒绝任务',
      });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      mockRejectTask.mockResolvedValue({
        ...mockTask,
        status: 'REJECTED',
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('待拒绝任务')).toBeInTheDocument();
      });

      // 打开操作菜单
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);

      // 点击拒绝按钮
      const rejectButton = await screen.findByText('拒绝');
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(mockRejectTask).toHaveBeenCalledWith('task_reject', undefined);
      });
    });

    it('应该执行任务', async () => {
      const mockTask = createMockTask({
        id: 'task_apply',
        status: 'APPROVED',
        description: '待执行任务',
      });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      mockApplyTask.mockResolvedValue({
        ...mockTask,
        status: 'APPLIED',
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('待执行任务')).toBeInTheDocument();
      });

      // 打开操作菜单
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);

      // 点击执行按钮
      const applyButton = await screen.findByText('执行');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockApplyTask).toHaveBeenCalledWith('task_apply');
      });
    });

    it('应该回滚任务', async () => {
      const mockTask = createMockTask({
        id: 'task_revert',
        status: 'APPLIED',
        description: '待回滚任务',
      });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      mockRevertTask.mockResolvedValue({
        ...mockTask,
        status: 'REVERTED',
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('待回滚任务')).toBeInTheDocument();
      });

      // 打开操作菜单
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);

      // 点击回滚按钮
      const revertButton = await screen.findByText('回滚');
      fireEvent.click(revertButton);

      await waitFor(() => {
        expect(mockRevertTask).toHaveBeenCalledWith('task_revert');
      });
    });

    it('应该支持批量选择', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', description: '任务1' }),
        createMockTask({ id: 'task_2', description: '任务2' }),
        createMockTask({ id: 'task_3', description: '任务3' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 3,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('任务1')).toBeInTheDocument();
      });

      // 全选复选框
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      // 应该显示批量操作栏
      await waitFor(() => {
        expect(screen.getByText('已选择 3 个任务')).toBeInTheDocument();
      });
    });

    it('应该批量批准任务', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', status: 'AWAITING_USER_REVIEW', description: '任务1' }),
        createMockTask({ id: 'task_2', status: 'AWAITING_USER_REVIEW', description: '任务2' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 2,
      });

      mockApproveTask.mockResolvedValue({
        ...mockTasks[0],
        status: 'APPROVED',
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('任务1')).toBeInTheDocument();
      });

      // 全选
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      // 点击批量批准
      await waitFor(() => {
        const batchApproveButton = screen.getByText('批量批准');
        fireEvent.click(batchApproveButton);
      });

      await waitFor(() => {
        expect(mockApproveTask).toHaveBeenCalledTimes(2);
      });
    });

    it('应该根据状态显示正确的操作按钮', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', status: 'AWAITING_USER_REVIEW', description: '待审核' }),
        createMockTask({ id: 'task_2', status: 'APPROVED', description: '已批准' }),
        createMockTask({ id: 'task_3', status: 'APPLIED', description: '已应用' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 3,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('待审核')).toBeInTheDocument();
      });

      // 验证每个任务的操作菜单
      const menuButtons = screen.getAllByRole('button', { name: /more/i });
      expect(menuButtons).toHaveLength(3);
    });

    it('应该显示任务类型标签', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', taskType: 'ENTITY_MERGE', description: '实体合并' }),
        createMockTask({ id: 'task_2', taskType: 'RELATION_DISCOVERY', description: '关系发现' }),
        createMockTask({ id: 'task_3', taskType: 'TAG_OPTIMIZATION', description: '标签优化' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 3,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('实体合并')).toBeInTheDocument();
        expect(screen.getByText('关系发现')).toBeInTheDocument();
        expect(screen.getByText('标签优化')).toBeInTheDocument();
      });
    });

    it('应该显示置信度条', async () => {
      const mockTask = createMockTask({
        id: 'task_1',
        confidence: 0.85,
        description: '高置信度任务',
      });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        // 置信度条应该存在
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it('应该显示状态徽章', async () => {
      const mockTask = createMockTask({
        id: 'task_1',
        status: 'AWAITING_USER_REVIEW',
        description: '状态测试',
      });

      mockGetTasks.mockResolvedValue({
        tasks: [mockTask],
        total: 1,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('待审核')).toBeInTheDocument();
      });
    });
  });

  describe('筛选和排序测试', () => {
    it('应该按类型筛选任务', async () => {
      const mockTasks = [
        createMockTask({ id: 'task_1', taskType: 'ENTITY_MERGE' }),
        createMockTask({ id: 'task_2', taskType: 'RELATION_DISCOVERY' }),
      ];

      mockGetTasks.mockResolvedValue({
        tasks: mockTasks,
        total: 2,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(mockGetTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            status: undefined,
            taskType: undefined,
            limit: 10,
            offset: 0,
          })
        );
      });
    });

    it('应该按状态筛选任务', async () => {
      mockGetTasks.mockResolvedValue({
        tasks: [],
        total: 0,
      });

      renderWithProviders(<TasksPage />);

      await waitFor(() => {
        expect(mockGetTasks).toHaveBeenCalled();
      });
    });
  });
});
