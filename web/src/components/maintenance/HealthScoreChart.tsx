import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HealthScoreChartProps {
  currentScore: number;
  history?: number[];
  className?: string;
}

export function HealthScoreChart({ 
  currentScore, 
  history = [], 
  className 
}: HealthScoreChartProps) {
  // Generate mock history if not provided
  const scores = useMemo(() => {
    if (history.length > 0) return history;
    
    // Generate 7 days of mock data ending with current score
    const mockHistory: number[] = [];
    let score = currentScore;
    for (let i = 0; i < 6; i++) {
      mockHistory.unshift(score);
      score = Math.min(100, Math.max(0, score + (Math.random() - 0.5) * 10));
    }
    mockHistory.push(currentScore);
    return mockHistory;
  }, [currentScore, history]);

  const maxScore = 100;
  const minScore = 0;
  const range = maxScore - minScore;

  // Calculate SVG path
  const width = 100;
  const height = 50;
  const padding = 5;

  const points = scores.map((score, index) => {
    const x = padding + (index / (scores.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((score - minScore) / range) * (height - 2 * padding);
    return { x, y, score };
  });

  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    return `${path} L ${point.x} ${point.y}`;
  }, '');

  // Area path (for gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-32"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
          className="text-primary"
        />
        
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="1"
            fill="currentColor"
            className={cn(
              'transition-all',
              index === points.length - 1 ? 'text-primary r-1.5' : 'text-primary/50'
            )}
          />
        ))}
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        {scores.map((_, index) => (
          <span key={index}>
            {index === scores.length - 1 ? '今天' : `${scores.length - 1 - index}天前`}
          </span>
        ))}
      </div>
    </div>
  );
}

interface HealthScoreMiniChartProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function HealthScoreMiniChart({ 
  score, 
  size = 'md',
  className 
}: HealthScoreMiniChartProps) {
  const sizeConfig = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const strokeWidth = size === 'sm' ? 3 : size === 'md' ? 4 : 5;
  const radius = size === 'sm' ? 26 : size === 'md' ? 40 : 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorClass = score >= 90 
    ? 'text-green-500' 
    : score >= 70 
    ? 'text-yellow-500' 
    : score >= 50 
    ? 'text-orange-500' 
    : 'text-red-500';

  return (
    <div className={cn('relative', sizeConfig[size], className)}>
      <svg className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn('transition-all duration-500', colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-bold', 
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-xl' : 'text-2xl'
        )}>
          {score}
        </span>
      </div>
    </div>
  );
}
