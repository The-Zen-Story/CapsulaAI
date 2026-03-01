// web/src/components/maintenance/HealthScore.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface HealthScoreProps {
  score: number;
  totalEntities: number;
  totalRelations: number;
}

export function HealthScore({ score, totalEntities, totalRelations }: HealthScoreProps) {
  const getHealthLevel = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'text-green-500', bg: 'bg-green-500' };
    if (score >= 70) return { label: '良好', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    if (score >= 50) return { label: '一般', color: 'text-orange-500', bg: 'bg-orange-500' };
    return { label: '需关注', color: 'text-red-500', bg: 'bg-red-500' };
  };

  const healthLevel = getHealthLevel(score);

  return (
    <Card>
      <CardHeader>
        <CardTitle>知识图谱健康度</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl font-bold">
            <span className={healthLevel.color}>{score}</span>
            <span className="text-xl text-muted-foreground">/100</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-white text-sm ${healthLevel.bg}`}>
            {healthLevel.label}
          </div>
        </div>

        <Progress value={score} className="h-3" />

        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{totalEntities} 个实体</span>
          <span>{totalRelations} 条关系</span>
        </div>
      </CardContent>
    </Card>
  );
}
