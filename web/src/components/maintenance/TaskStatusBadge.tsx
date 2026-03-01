import { Badge } from '@/components/ui/badge';
import { type MaintenanceTask } from '@/services/maintenance';
import { cn } from '@/lib/utils';

interface TaskStatusBadgeProps {
  status: MaintenanceTask['status'];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}> = {
  PENDING: { 
    label: '待处理', 
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
  AUTO_APPROVED: { 
    label: '自动批准', 
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  AWAITING_USER_REVIEW: { 
    label: '待审核', 
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  },
  APPROVED: { 
    label: '已批准', 
    variant: 'default',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  REJECTED: { 
    label: '已拒绝', 
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  APPLIED: { 
    label: '已应用', 
    variant: 'default',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  FAILED: { 
    label: '失败', 
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  REVERTED: { 
    label: '已回滚', 
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
};

const sizeConfig = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-0.5',
  lg: 'text-sm px-3 py-1',
};

export function TaskStatusBadge({ status, size = 'md', className }: TaskStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        config.className,
        sizeConfig[size],
        'font-medium border',
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
