import { cn } from '@/lib/utils';

interface ConfidenceBarProps {
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    height: 'h-1.5',
    text: 'text-xs',
  },
  md: {
    height: 'h-2',
    text: 'text-sm',
  },
  lg: {
    height: 'h-3',
    text: 'text-base',
  },
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-500';
  if (confidence >= 0.8) return 'bg-yellow-500';
  if (confidence >= 0.6) return 'bg-orange-500';
  return 'bg-red-500';
}

function getConfidenceTextColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.8) return 'text-yellow-600 dark:text-yellow-400';
  if (confidence >= 0.6) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

export function ConfidenceBar({ 
  confidence, 
  size = 'md', 
  showLabel = false,
  className 
}: ConfidenceBarProps) {
  const percentage = Math.round(confidence * 100);
  const colorClass = getConfidenceColor(confidence);
  const textColorClass = getConfidenceTextColor(confidence);
  const { height, text } = sizeConfig[size];

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || size === 'lg') && (
        <div className={cn('flex items-center justify-between mb-1', text)}>
          {showLabel && <span className="text-muted-foreground">置信度</span>}
          <span className={cn('font-medium', textColorClass)}>
            {percentage}%
          </span>
        </div>
      )}
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', height)}>
        <div
          className={cn('h-full transition-all duration-300 ease-out', colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
