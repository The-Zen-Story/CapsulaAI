import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskStatusBadge } from './TaskStatusBadge';
import { ConfidenceBar } from './ConfidenceBar';
import { type MaintenanceTask } from '@/services/maintenance';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  GitMerge,
  Link as LinkIcon,
  Clock,
  AlertCircle,
  Tag,
  Trash2,
  CheckCircle,
  XCircle,
  Play,
  Eye,
  Loader2,
} from 'lucide-react';

interface TaskCardProps {
  task: MaintenanceTask;
  onApprove?: () => void;
  onReject?: () => void;
  onApply?: () => void;
  onView?: () => void;
  onRevert?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isApplying?: boolean;
  isReverting?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export function TaskCard({
  task,
  onApprove,
  onReject,
  onApply,
  onView,
  onRevert,
  isApproving,
  isRejecting,
  isApplying,
  isReverting,
  showActions = true,
  compact = false,
}: TaskCardProps) {
  const canApprove = task.status === 'AWAITING_USER_REVIEW' || task.status === 'AUTO_APPROVED';
  const canApply = task.status === 'APPROVED';
  const canRevert = task.status === 'APPLIED' || task.status === 'FAILED';

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
        <TaskTypeIcon type={task.taskType} />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{task.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <TaskStatusBadge status={task.status} size="sm" />
            <span className="text-xs text-muted-foreground">
              {format(new Date(task.createdAt), 'MM/dd', { locale: zhCN })}
            </span>
          </div>
        </div>
        <ConfidenceBar confidence={task.confidence} size="sm" className="w-20" />
      </div>
    );
  }

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
                <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                <span className="text-sm text-muted-foreground">
                  {Math.round(task.confidence * 100)}%
                </span>
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

            {/* Error Message */}
            {task.errorMessage && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
                <p className="text-sm text-destructive">{task.errorMessage}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex lg:flex-col gap-2 lg:min-w-[120px]">
              {canApprove && onApprove && (
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
              )}
              {canApprove && onReject && (
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
              )}
              {canApply && onApply && (
                <Button
                  onClick={onApply}
                  disabled={isApplying}
                  className="flex-1 lg:flex-none"
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  执行
                </Button>
              )}
              {canRevert && onRevert && (
                <Button
                  variant="outline"
                  onClick={onRevert}
                  disabled={isReverting}
                  className="flex-1 lg:flex-none"
                >
                  {isReverting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  回滚
                </Button>
              )}
              {onView && (
                <Button
                  variant="ghost"
                  onClick={onView}
                  className="flex-1 lg:flex-none"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  详情
                </Button>
              )}
            </div>
          )}
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
