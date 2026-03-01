// web/src/components/maintenance/TaskList.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Play, GitMerge, Link as LinkIcon, Clock, AlertCircle } from 'lucide-react';
import { getTasks, approveTask, rejectTask, applyTask, type MaintenanceTask } from '@/services/maintenance';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function TaskList() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-tasks', status],
    queryFn: () => getTasks({ status, limit: 100 }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => approveTask(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => rejectTask(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: applyTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const tasks = data?.tasks || [];

  const getTaskIcon = (type: MaintenanceTask['taskType']) => {
    switch (type) {
      case 'ENTITY_MERGE':
        return <GitMerge className="h-4 w-4" />;
      case 'RELATION_DISCOVERY':
        return <LinkIcon className="h-4 w-4" />;
      case 'STALE_DETECTION':
        return <Clock className="h-4 w-4" />;
      case 'ORPHAN_CLEANUP':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: MaintenanceTask['status']) => {
    const variants: Record<string, { label: string; className: string }> = {
      PENDING: { label: '待处理', className: 'bg-gray-100 text-gray-700' },
      AUTO_APPROVED: { label: '自动批准', className: 'bg-blue-100 text-blue-700' },
      AWAITING_USER_REVIEW: { label: '待审核', className: 'bg-yellow-100 text-yellow-700' },
      APPROVED: { label: '已批准', className: 'bg-green-100 text-green-700' },
      REJECTED: { label: '已拒绝', className: 'bg-red-100 text-red-700' },
      APPLIED: { label: '已应用', className: 'bg-green-100 text-green-700' },
      FAILED: { label: '失败', className: 'bg-red-100 text-red-700' },
    };
    const { label, className } = variants[status] || variants.PENDING;
    return <Badge className={className}>{label}</Badge>;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.8) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const handleApprove = async (task: MaintenanceTask) => {
    await approveMutation.mutateAsync({ id: task.id });
    // Auto-apply if approved
    if (task.status === 'AWAITING_USER_REVIEW') {
      await applyMutation.mutateAsync(task.id);
    }
  };

  const handleReject = async (task: MaintenanceTask) => {
    await rejectMutation.mutateAsync({ id: task.id });
  };

  const openDetail = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>维护任务</CardTitle>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                <SelectItem value="PENDING">待处理</SelectItem>
                <SelectItem value="AWAITING_USER_REVIEW">待审核</SelectItem>
                <SelectItem value="AUTO_APPROVED">自动批准</SelectItem>
                <SelectItem value="APPROVED">已批准</SelectItem>
                <SelectItem value="APPLIED">已应用</SelectItem>
                <SelectItem value="REJECTED">已拒绝</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-[200px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无维护任务
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTaskIcon(task.taskType)}
                          <span className="text-sm">{getTaskTypeLabel(task.taskType)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        <button
                          onClick={() => openDetail(task)}
                          className="text-left hover:underline"
                        >
                          {task.description}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className={getConfidenceColor(task.confidence)}>
                          {Math.round(task.confidence * 100)}%
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        {format(new Date(task.createdAt), 'MM月dd日', { locale: zhCN })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {(task.status === 'AWAITING_USER_REVIEW' || task.status === 'AUTO_APPROVED') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(task)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                批准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(task)}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                拒绝
                              </Button>
                            </>
                          )}
                          {task.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              onClick={() => applyMutation.mutate(task.id)}
                              disabled={applyMutation.isPending}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              应用
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle>任务详情</DialogTitle>
                <DialogDescription>
                  {getTaskTypeLabel(selectedTask.taskType)} - {selectedTask.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">状态</label>
                    <div className="mt-1">{getStatusBadge(selectedTask.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">置信度</label>
                    <div className={`mt-1 ${getConfidenceColor(selectedTask.confidence)}`}>
                      {Math.round(selectedTask.confidence * 100)}%
                    </div>
                  </div>
                </div>

                {selectedTask.changes && (
                  <div>
                    <label className="text-sm font-medium">变更详情</label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-auto">
                      {JSON.stringify(selectedTask.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedTask.reviewComment && (
                  <div>
                    <label className="text-sm font-medium">审核备注</label>
                    <p className="mt-1 text-sm">{selectedTask.reviewComment}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                {(selectedTask.status === 'AWAITING_USER_REVIEW' || selectedTask.status === 'AUTO_APPROVED') && (
                  <>
                    <Button variant="outline" onClick={() => handleReject(selectedTask)}>
                      拒绝
                    </Button>
                    <Button onClick={() => handleApprove(selectedTask)}>
                      批准并应用
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function getTaskTypeLabel(type: MaintenanceTask['taskType']): string {
  const labels: Record<string, string> = {
    ENTITY_MERGE: '实体合并',
    RELATION_DISCOVERY: '关系发现',
    TAG_OPTIMIZATION: '标签优化',
    STALE_DETECTION: '过时检测',
    ORPHAN_CLEANUP: '孤立节点',
  };
  return labels[type] || type;
}
