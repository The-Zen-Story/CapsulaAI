import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TaskStatusBadge } from '@/components/maintenance/TaskStatusBadge';
import { ConfidenceBar } from '@/components/maintenance/ConfidenceBar';
import { getTask, approveTask, rejectTask, applyTask, revertTask, type MaintenanceTask } from '@/services/maintenance';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Play,
  RotateCcw,
  Loader2,
  AlertCircle,
  GitMerge,
  Link as LinkIcon,
  Clock,
  Tag,
  Trash2,
} from 'lucide-react';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['maintenance-task', id],
    queryFn: () => getTask(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTask(id!, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-task', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTask(id!, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-task', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => applyTask(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-task', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const revertMutation = useMutation({
    mutationFn: () => revertTask(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-task', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">加载任务详情失败</p>
        <Button onClick={() => navigate('/maintenance/tasks')}>
          返回任务列表
        </Button>
      </div>
    );
  }

  const canApprove = task.status === 'AWAITING_USER_REVIEW' || task.status === 'AUTO_APPROVED';
  const canApply = task.status === 'APPROVED';
  const canRevert = task.status === 'APPLIED' || task.status === 'FAILED';
  const isCompleted = task.status === 'APPLIED' || task.status === 'REJECTED' || task.status === 'REVERTED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/maintenance/tasks')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">任务详情</h1>
          <p className="text-muted-foreground text-sm">ID: {task.id}</p>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <>
              <Button
                variant="outline"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                拒绝
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                批准
              </Button>
            </>
          )}
          {canApply && (
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              执行
            </Button>
          )}
          {canRevert && (
            <Button
              variant="outline"
              onClick={() => revertMutation.mutate()}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              回滚
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{task.description}</CardTitle>
                  <CardDescription className="mt-2">
                    创建于 {format(new Date(task.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                  </CardDescription>
                </div>
                <TaskStatusBadge status={task.status} size="lg" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task Type */}
              <div className="flex items-center gap-4">
                <TaskTypeIcon type={task.taskType} />
                <div>
                  <p className="font-medium">{getTaskTypeLabel(task.taskType)}</p>
                  <p className="text-sm text-muted-foreground">任务类型</p>
                </div>
              </div>

              <Separator />

              {/* Confidence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">置信度</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(task.confidence * 100)}%
                  </span>
                </div>
                <ConfidenceBar confidence={task.confidence} size="lg" showLabel />
              </div>

              {/* Changes */}
              {task.changes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">变更详情</h4>
                    <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[400px]">
                      <pre className="text-sm font-mono">
                        {JSON.stringify(task.changes, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              )}

              {/* Error Message */}
              {task.errorMessage && (
                <>
                  <Separator />
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">错误信息</span>
                    </div>
                    <p className="text-sm text-destructive/80">{task.errorMessage}</p>
                  </div>
                </>
              )}

              {/* Review Comment */}
              {isCompleted && task.reviewComment && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">审核备注</h4>
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                      {task.reviewComment}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Review Input */}
          {canApprove && (
            <Card>
              <CardHeader>
                <CardTitle>审核备注</CardTitle>
                <CardDescription>添加备注说明（可选）</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="输入审核备注..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>执行时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem
                  icon={Clock}
                  title="任务创建"
                  time={task.createdAt}
                  isActive
                />
                {task.reviewedAt && (
                  <TimelineItem
                    icon={task.status === 'REJECTED' ? XCircle : CheckCircle}
                    title={task.status === 'REJECTED' ? '已拒绝' : '已批准'}
                    time={task.reviewedAt}
                    description={task.reviewedBy === 'SYSTEM' ? '系统自动' : '用户审核'}
                    isActive
                  />
                )}
                {task.appliedAt && (
                  <TimelineItem
                    icon={Play}
                    title="已执行"
                    time={task.appliedAt}
                    isActive={task.status === 'APPLIED'}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Related Entities */}
          {(task.sourceEntityId || task.targetEntityId) && (
            <Card>
              <CardHeader>
                <CardTitle>相关实体</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.sourceEntityId && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">源实体</span>
                    <Button variant="link" size="sm" className="h-auto p-0">
                      {task.sourceEntityId}
                    </Button>
                  </div>
                )}
                {task.targetEntityId && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">目标实体</span>
                    <Button variant="link" size="sm" className="h-auto p-0">
                      {task.targetEntityId}
                    </Button>
                  </div>
                )}
                {task.relationId && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">关系</span>
                    <span className="text-sm text-muted-foreground">{task.relationId}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskTypeIcon({ type }: { type: MaintenanceTask['taskType'] }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    ENTITY_MERGE: GitMerge,
    RELATION_DISCOVERY: LinkIcon,
    TAG_OPTIMIZATION: Tag,
    STALE_DETECTION: Clock,
    ORPHAN_CLEANUP: Trash2,
  };

  const colors: Record<string, string> = {
    ENTITY_MERGE: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
    RELATION_DISCOVERY: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    TAG_OPTIMIZATION: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
    STALE_DETECTION: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
    ORPHAN_CLEANUP: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
  };

  const Icon = icons[type] || AlertCircle;

  return (
    <div className={`p-3 rounded-lg ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

function getTaskTypeLabel(type: MaintenanceTask['taskType']): string {
  const labels: Record<string, string> = {
    ENTITY_MERGE: '实体合并',
    RELATION_DISCOVERY: '关系发现',
    TAG_OPTIMIZATION: '标签优化',
    STALE_DETECTION: '过时检测',
    ORPHAN_CLEANUP: '孤立节点清理',
  };
  return labels[type] || type;
}

interface TimelineItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  time: string;
  description?: string;
  isActive?: boolean;
}

function TimelineItem({ icon: Icon, title, time, description, isActive }: TimelineItemProps) {
  return (
    <div className="flex gap-3">
      <div className={`mt-1 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(time), 'MM月dd日 HH:mm', { locale: zhCN })}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
