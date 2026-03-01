import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HealthScoreChart } from '@/components/maintenance/HealthScoreChart';
import { getHealthReport, runFullScan, scanDuplicates, scanOrphans, scanRelations, type HealthReport } from '@/services/maintenance';
import {
  RefreshCw,
  AlertCircle,
  GitMerge,
  Link as LinkIcon,
  Clock,
  CheckCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

export default function HealthReportPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: health, isLoading, error } = useQuery({
    queryKey: ['maintenance-health'],
    queryFn: getHealthReport,
  });

  const scanMutation = useMutation({
    mutationFn: runFullScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const scanDuplicatesMutation = useMutation({
    mutationFn: scanDuplicates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const scanOrphansMutation = useMutation({
    mutationFn: scanOrphans,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const scanRelationsMutation = useMutation({
    mutationFn: scanRelations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-health'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">加载健康报告失败</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['maintenance-health'] })}>
          重试
        </Button>
      </div>
    );
  }

  if (!health) {
    return null;
  }

  const healthLevel = getHealthLevel(health.score);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">健康报告</h1>
          <p className="text-muted-foreground mt-1">
            知识图谱健康状态监控与分析
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
            {scanMutation.isPending ? '扫描中...' : '完整扫描'}
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Score Display */}
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-muted/20"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(health.score / 100) * 351.86} 351.86`}
                      className={healthLevel.color}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className={`text-4xl font-bold ${healthLevel.color}`}>
                        {health.score}
                      </span>
                      <span className="text-sm text-muted-foreground block">/100</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{healthLevel.label}</h2>
                  <p className="text-muted-foreground">{healthLevel.description}</p>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{health.totalEntities} 实体</span>
                    <span>{health.totalRelations} 关系</span>
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="space-y-3">
                <ScoreBar
                  label="孤立节点"
                  value={health.orphanEntities}
                  max={Math.max(health.totalEntities * 0.1, 10)}
                  deduction={health.orphanEntities * 2}
                />
                <ScoreBar
                  label="潜在重复"
                  value={health.potentialDuplicates}
                  max={10}
                  deduction={health.potentialDuplicates * 5}
                />
                <ScoreBar
                  label="过时实体"
                  value={health.staleEntities}
                  max={10}
                  deduction={health.staleEntities * 3}
                />
                <ScoreBar
                  label="断裂关系"
                  value={health.brokenRelations}
                  max={10}
                  deduction={health.brokenRelations * 4}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="p-6 bg-muted/30">
              <h3 className="font-semibold mb-4">健康趋势</h3>
              <HealthScoreChart currentScore={health.score} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <IssueCard
          title="孤立节点"
          count={health.orphanEntities}
          description="无关系的实体"
          icon={AlertCircle}
          trend="stable"
          onScan={() => scanOrphansMutation.mutate()}
          isScanning={scanOrphansMutation.isPending}
        />
        <IssueCard
          title="潜在重复"
          count={health.potentialDuplicates}
          description="待审核合并"
          icon={GitMerge}
          trend="down"
          onScan={() => scanDuplicatesMutation.mutate()}
          isScanning={scanDuplicatesMutation.isPending}
        />
        <IssueCard
          title="过时实体"
          count={health.staleEntities}
          description="90天未更新"
          icon={Clock}
          trend="up"
          onScan={() => scanRelationsMutation.mutate()}
          isScanning={scanRelationsMutation.isPending}
        />
        <IssueCard
          title="断裂关系"
          count={health.brokenRelations}
          description="需要修复"
          icon={LinkIcon}
          trend="stable"
          onScan={() => scanRelationsMutation.mutate()}
          isScanning={scanRelationsMutation.isPending}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="orphans">孤立节点</TabsTrigger>
          <TabsTrigger value="duplicates">潜在重复</TabsTrigger>
          <TabsTrigger value="stale">过时实体</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>健康度分析</CardTitle>
              <CardDescription>知识图谱整体健康状态分析</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HealthMetric
                label="实体覆盖率"
                value={health.totalEntities > 0 
                  ? Math.round(((health.totalEntities - health.orphanEntities) / health.totalEntities) * 100) 
                  : 0}
                description="已建立关系的实体比例"
              />
              <HealthMetric
                label="数据新鲜度"
                value={health.totalEntities > 0 
                  ? Math.round(((health.totalEntities - health.staleEntities) / health.totalEntities) * 100) 
                  : 0}
                description="近期更新的实体比例"
              />
              <HealthMetric
                label="数据完整性"
                value={health.totalRelations > 0 
                  ? Math.round(((health.totalRelations - health.brokenRelations) / health.totalRelations) * 100) 
                  : 0}
                description="有效关系比例"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphans" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>孤立节点列表</CardTitle>
              <CardDescription>没有与其他实体建立关系的节点</CardDescription>
            </CardHeader>
            <CardContent>
              {health.details.orphanEntities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-muted-foreground">没有发现孤立节点</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {health.details.orphanEntities.map((entityId) => (
                    <div
                      key={entityId}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <span className="font-mono text-sm">{entityId}</span>
                      <Button variant="ghost" size="sm">
                        查看
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>潜在重复列表</CardTitle>
              <CardDescription>可能重复的实体对</CardDescription>
            </CardHeader>
            <CardContent>
              {health.details.potentialDuplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-muted-foreground">没有发现潜在重复</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {health.details.potentialDuplicates.map((dup, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm">{dup.entityAId}</span>
                        <GitMerge className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{dup.entityBId}</span>
                      </div>
                      <Badge variant="secondary">
                        {Math.round(dup.similarity * 100)}% 相似
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stale" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>过时实体列表</CardTitle>
              <CardDescription>超过90天未更新的实体</CardDescription>
            </CardHeader>
            <CardContent>
              {health.details.staleEntities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-muted-foreground">没有发现过时实体</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {health.details.staleEntities.map((entityId) => (
                    <div
                      key={entityId}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <span className="font-mono text-sm">{entityId}</span>
                      <Button variant="ghost" size="sm">
                        查看
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getHealthLevel(score: number) {
  if (score >= 90) {
    return {
      label: '优秀',
      color: 'text-green-500',
      description: '知识图谱健康状况良好，无需特别关注',
    };
  }
  if (score >= 70) {
    return {
      label: '良好',
      color: 'text-yellow-500',
      description: '知识图谱整体健康，建议定期维护',
    };
  }
  if (score >= 50) {
    return {
      label: '一般',
      color: 'text-orange-500',
      description: '知识图谱存在一些问题，建议尽快处理',
    };
  }
  return {
    label: '需关注',
    color: 'text-red-500',
    description: '知识图谱健康状况较差，需要立即处理',
  };
}

interface ScoreBarProps {
  label: string;
  value: number;
  max: number;
  deduction: number;
}

function ScoreBar({ label, value, max, deduction }: ScoreBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}</span>
          {deduction > 0 && (
            <span className="text-destructive text-xs">-{deduction}分</span>
          )}
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            percentage > 50 ? 'bg-destructive' : 'bg-yellow-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface IssueCardProps {
  title: string;
  count: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: 'up' | 'down' | 'stable';
  onScan: () => void;
  isScanning: boolean;
}

function IssueCard({ title, count, description, icon: Icon, trend, onScan, isScanning }: IssueCardProps) {
  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-red-500" />,
    down: <TrendingDown className="h-4 w-4 text-green-500" />,
    stable: <Minus className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-bold">{count}</p>
              {trendIcons[trend]}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          onClick={onScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          扫描
        </Button>
      </CardContent>
    </Card>
  );
}

interface HealthMetricProps {
  label: string;
  value: number;
  description: string;
}

function HealthMetric({ label, value, description }: HealthMetricProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
        <div className="text-right">
          <div className={`font-bold ${
            value >= 90 ? 'text-green-500' : 
            value >= 70 ? 'text-yellow-500' : 
            'text-red-500'
          }`}>
            {value}%
          </div>
        </div>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
