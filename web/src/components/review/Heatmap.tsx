// web/src/components/review/Heatmap.tsx

import { useQuery } from '@tanstack/react-query';
import { getHeatmap } from '@/services/review';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function Heatmap() {
  const { data: heatmapData } = useQuery({
    queryKey: ['review-heatmap'],
    queryFn: () => getHeatmap(),
  });

  // Generate last 365 days
  const days: { date: Date; count: number }[] = [];
  const today = new Date();
  const dataMap = new Map(heatmapData?.map((d) => [d.date, d.count]) || []);

  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    days.push({
      date,
      count: dataMap.get(dateStr) || 0,
    });
  }

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count <= 5) return 'bg-green-200 dark:bg-green-900';
    if (count <= 10) return 'bg-green-300 dark:bg-green-800';
    if (count <= 20) return 'bg-green-400 dark:bg-green-700';
    return 'bg-green-500 dark:bg-green-600';
  };

  // Group by weeks
  const weeks: { date: Date; count: number }[][] = [];
  let currentWeek: { date: Date; count: number }[] = [];

  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => (
                <Tooltip key={dayIndex}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-3 h-3 rounded-sm ${getColor(day.count)} cursor-pointer hover:ring-2 hover:ring-primary`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{formatDate(day.date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {day.count > 0 ? `${day.count} 次复习` : '无复习'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>少</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
            <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-800" />
            <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
            <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600" />
          </div>
          <span>多</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
