import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskStatusBadge } from '@/components/maintenance/TaskStatusBadge';
import { ConfidenceBar } from '@/components/maintenance/ConfidenceBar';
import { getTasks, approveTask, rejectTask, applyTask, revertTask, type MaintenanceTask } from '@/services/maintenance';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

const TASK_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'ENTITY_MERGE', label: '实体合并' },
  { value: 'RELATION_DISCOVERY', label: '关系发现' },
  { value: 'TAG_OPTIMIZATION', label: '标签优化' },
  { value: 'STALE_DETECTION', label: '过时检测' },
  { value: 'ORPHAN_CLEANUP', label: '孤立节点' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'AWAITING_USER_REVIEW', label: '待审核' },
  { value: 'AUTO_APPROVED', label: '自动批准' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'APPLIED', label: '已应用' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'FAILED', label: '失败' },
  { value: 'REVERTED', label: '已回滚' },
];

export default function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const pageSize = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenance-tasks', statusFilter, typeFilter, page, pageSize],
    queryFn: () => getTasks({ 
      status: statusFilter || undefined, 
      taskType: typeFilter || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
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

  const applyMutation = useMutation<MaintenanceTask, Error, string>({
    mutationFn: applyTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const revertMutation = useMutation<MaintenanceTask, Error, string>({
    mutationFn: (id: string) => revertTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
    },
  });

  const tasks = data?.tasks || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const filteredTasks = tasks.filter(task =>
    searchQuery === '' || 
    task.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleBatchApprove = async () => {
    const promises = Array.from(selectedTasks).map(id => 
      approveMutation.mutateAsync({ id })
    );
    await Promise.all(promises);
    setSelectedTasks(new Set());
  };

  const handleBatchReject = async () => {
    const promises = Array.from(selectedTasks).map(id => 
      rejectMutation.mutateAsync({ id })
    );
    await Promise.all(promises);
    setSelectedTasks(new Set());
  };

  const canApprove = (status: MaintenanceTask['status']) => 
    status === 'AWAITING_USER_REVIEW' || status === 'AUTO_APPROVED';

  const canApply = (status: MaintenanceTask['status']) => 
    status === 'APPROVED';

  const canRevert = (status: MaintenanceTask['status']) => 
    status === 'APPLIED' || status === 'FAILED';

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-2">加载任务列表失败</p>
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
          <h1 className="text-3xl font-bold tracking-tight">维护任务</h1>
          <p className="text-muted-foreground mt-1">
            管理知识图谱的自动维护任务
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索任务描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="筛选状态" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="筛选类型" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions */}
      {selectedTasks.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            已选择 {selectedTasks.size} 个任务
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBatchApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              批量批准
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              批量拒绝
            </Button>
          </div>
        </div>
      )}

      {/* Task Table */}
      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={filteredTasks.length > 0 && selectedTasks.size === filteredTasks.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      暂无维护任务
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={(checked: boolean) => handleSelectTask(task.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <TaskTypeBadge type={task.taskType} />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => navigate(`/maintenance/tasks/${task.id}`)}
                          className="text-left hover:underline max-w-[300px] truncate block"
                        >
                          {task.description}
                        </button>
                      </TableCell>
                      <TableCell>
                        <ConfidenceBar confidence={task.confidence} size="sm" />
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(task.createdAt), 'MM月dd日 HH:mm', { locale: zhCN })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/maintenance/tasks/${task.id}`)}>
                              查看详情
                            </DropdownMenuItem>
                            {canApprove(task.status) && (
                              <DropdownMenuItem 
                                onClick={() => approveMutation.mutate({ id: task.id })}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                批准
                              </DropdownMenuItem>
                            )}
                            {canApprove(task.status) && (
                              <DropdownMenuItem 
                                onClick={() => rejectMutation.mutate({ id: task.id })}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                拒绝
                              </DropdownMenuItem>
                            )}
                            {canApply(task.status) && (
                              <DropdownMenuItem 
                                onClick={() => applyMutation.mutate(task.id)}
                                disabled={applyMutation.isPending}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                执行
                              </DropdownMenuItem>
                            )}
                            {canRevert(task.status) && (
                              <DropdownMenuItem
                                onClick={() => revertMutation.mutate(task.id)}
                                disabled={revertMutation.isPending}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                回滚
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 共 {total} 条
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center px-3 text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskTypeBadge({ type }: { type: MaintenanceTask['taskType'] }) {
  const labels: Record<string, string> = {
    ENTITY_MERGE: '实体合并',
    RELATION_DISCOVERY: '关系发现',
    TAG_OPTIMIZATION: '标签优化',
    STALE_DETECTION: '过时检测',
    ORPHAN_CLEANUP: '孤立节点',
  };

  const colors: Record<string, string> = {
    ENTITY_MERGE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    RELATION_DISCOVERY: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    TAG_OPTIMIZATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    STALE_DETECTION: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    ORPHAN_CLEANUP: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <Badge className={colors[type] || 'bg-gray-100 text-gray-700'} variant="secondary">
      {labels[type] || type}
    </Badge>
  );
}
