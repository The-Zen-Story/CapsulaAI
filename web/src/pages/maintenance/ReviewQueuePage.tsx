import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskStatusBadge } from '@/components/maintenance/TaskStatusBadge';
import { ConfidenceBar } from '@/components/maintenance/ConfidenceBar';
import { getTasks, approveTask, rejectTask, applyTask, type MaintenanceTask } from '@/services/maintenance';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CheckCircle,
  XCircle,
  Play,
  Eye,
  Loader2,
  AlertCircle,
  GitMerge,
  Link as LinkIcon,
  Clock,
  Tag,
  Trash2,
  Filter,
} from 'lucide-react';

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);

  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenance-tasks', 'review-queue'],
    queryFn: () => getTasks({ status: 'AWAITING_USER_REVIEW', limit: 50 }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await approveTask(id);
      return applyTask(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const tasks = data?.tasks || [];
  const total = data?.total || 0;

  // Filter by confidence threshold
  const filteredTasks = tasks.filter(task => task.confidence >= confidenceThreshold);
  const highConfidenceTasks = filteredTasks.filter(task => task.confidence >= 0.9);
  const mediumConfidenceTasks = filteredTasks.filter(task => task.confidence >= 0.8 && task.confidence < 0.9);
  const lowConfidenceTasks = filteredTasks.filter(task => task.confidence < 0.8);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-2">加载审查队列失败</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">审查队列</h1>
          <p className="text-muted-foreground mt-1">
            待审核的维护任务队列
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">置信度筛选:</span>
          <div className="flex gap-1">
            {[0.7, 0.8, 0.9].map(threshold => (
              <Button
                key={threshold}
                size="sm"
                variant={confidenceThreshold === threshold ? 'default' : 'outline'}
                onClick={() => setConfidenceThreshold(threshold)}
              >
                ≥{Math.round(threshold * 100)}%
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="待审查总数"
          value={total}
          description="需要用户确认"
          icon={AlertCircle}
          color="text-yellow-500"
        />
        <StatCard
          title="高置信度"
          value={highConfidenceTasks.length}
          description="≥90% 置信度"
          icon={CheckCircle}
          color="text-green-500"
        />
        <StatCard
          title="中等置信度"
          value={mediumConfidenceTasks.length}
          description="80-90% 置信度"
          icon={Clock}
          color="text-yellow-500"
        />
        <StatCard
          title="低置信度"
          value={lowConfidenceTasks.length}
          description="<80% 置信度"
          icon={AlertCircle}
          color="text-orange-500"
        />
      </div>

      {/* Quick Actions */}
      {filteredTasks.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                批量操作 ({filteredTasks.length} 个任务)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const promises = highConfidenceTasks.map(t =>
                        rejectMutation.mutateAsync(t.id)
                      );
                      await Promise.all(promises);
                      console.log(`已拒绝 ${highConfidenceTasks.length} 个高置信度任务`);
                    } catch (error) {
                      console.error('批量拒绝失败:', error);
                      alert('批量拒绝失败: ' + (error as Error).message);
                    }
                  }}
                  disabled={rejectMutation.isPending || highConfidenceTasks.length === 0}
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  拒绝高置信度
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const promises = highConfidenceTasks.map(t =>
                        approveMutation.mutateAsync(t.id)
                      );
                      await Promise.all(promises);
                      console.log(`已批准 ${highConfidenceTasks.length} 个高置信度任务`);
                    } catch (error) {
                      console.error('批量批准失败:', error);
                      alert('批量批准失败: ' + (error as Error).message);
                    }
                  }}
                  disabled={approveMutation.isPending || highConfidenceTasks.length === 0}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  批准高置信度
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Queue */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">队列已清空</h3>
              <p className="text-muted-foreground text-center max-w-md">
                当前没有待审查的维护任务。系统会在发现新的维护需求时自动添加任务到队列。
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <ReviewTaskCard
              key={task.id}
              task={task}
              onApprove={() => approveMutation.mutate(task.id)}
              onReject={() => rejectMutation.mutate(task.id)}
              onView={() => navigate(`/maintenance/tasks/${task.id}`)}
              isApproving={approveMutation.isPending && approveMutation.variables === task.id}
              isRejecting={rejectMutation.isPending && rejectMutation.variables === task.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ReviewTaskCardProps {
  task: MaintenanceTask;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function ReviewTaskCard({
  task,
  onApprove,
  onReject,
  onView,
  isApproving,
  isRejecting,
}: ReviewTaskCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Task Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3">
              <TaskTypeIcon type={task.taskType} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{task.description}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <TaskStatusBadge status={task.status} />
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(task.createdAt), 'MM月dd日 HH:mm', { locale: zhCN })}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">置信度</span>
                <ConfidenceBadge confidence={task.confidence} />
              </div>
              <ConfidenceBar confidence={task.confidence} />
            </div>

            {/* Changes Preview */}
            {task.changes && (
              <div className="bg-muted rounded-lg p-3 overflow-hidden">
                <p className="text-xs text-muted-foreground mb-2">变更预览:</p>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-[100px]">
                  {JSON.stringify(task.changes, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex lg:flex-col gap-2 lg:min-w-[120px]">
            <Button
              onClick={onApprove}
              disabled={isApproving || isRejecting}
              className="flex-1 lg:flex-none"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              批准
            </Button>
            <Button
              variant="outline"
              onClick={onReject}
              disabled={isApproving || isRejecting}
              className="flex-1 lg:flex-none"
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              拒绝
            </Button>
            <Button
              variant="ghost"
              onClick={onView}
              className="flex-1 lg:flex-none"
            >
              <Eye className="h-4 w-4 mr-2" />
              详情
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className={`p-2 rounded-lg ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.9) {
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">高</Badge>;
  }
  if (confidence >= 0.8) {
    return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">中</Badge>;
  }
  return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">低</Badge>;
}

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function StatCard({ title, value, description, icon: Icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
