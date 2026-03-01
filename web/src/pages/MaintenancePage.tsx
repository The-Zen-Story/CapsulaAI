// web/src/pages/MaintenancePage.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  GitMerge,
  Link as LinkIcon,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { getHealthReport, runFullScan } from '@/services/maintenance';
import { TaskList } from '@/components/maintenance/TaskList';
import { HealthScore } from '@/components/maintenance/HealthScore';

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: health, isLoading: isHealthLoading } = useQuery({
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

  const getHealthLevel = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'text-green-500', bg: 'bg-green-500' };
    if (score >= 70) return { label: '良好', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    if (score >= 50) return { label: '一般', color: 'text-orange-500', bg: 'bg-orange-500' };
    return { label: '需关注', color: 'text-red-500', bg: 'bg-red-500' };
  };

  const healthLevel = health ? getHealthLevel(health.score) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">图谱维护中心</h1>
          <p className="text-muted-foreground">自动发现和修复知识图谱中的问题</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
            {scanMutation.isPending ? '扫描中...' : '立即扫描'}
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            设置
          </Button>
        </div>
      </div>

      {/* Health Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">知识图谱健康度</h3>
              {isHealthLoading ? (
                <div className="h-4 bg-muted rounded animate-pulse" />
              ) : health ? (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-bold">
                      <span className={healthLevel?.color}>{health.score}</span>
                      <span className="text-lg text-muted-foreground">/100</span>
                    </div>
                    <Badge className={healthLevel?.bg}>{healthLevel?.label}</Badge>
                  </div>
                  <Progress value={health.score} className="h-2" />
                  <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                    <span>{health.totalEntities} 个实体</span>
                    <span>{health.totalRelations} 条关系</span>
                    <span>上次扫描: 今天</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {health && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">孤立节点</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.orphanEntities}</div>
              <div className="text-xs text-muted-foreground">
                无关系的实体
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">潜在重复</CardTitle>
              <GitMerge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.potentialDuplicates}</div>
              <div className="text-xs text-muted-foreground">
                待审核合并
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">过时实体</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.staleEntities}</div>
              <div className="text-xs text-muted-foreground">
                90天未更新
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">断裂关系</CardTitle>
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.brokenRelations}</div>
              <div className="text-xs text-muted-foreground">
                需要修复
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="tasks">维护任务</TabsTrigger>
          <TabsTrigger value="history">历史记录</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {health && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>健康度详情</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <HealthMetric
                    label="孤立节点"
                    value={health.orphanEntities}
                    max={health.totalEntities}
                    deduction={health.orphanEntities * 2}
                    description="没有与其他实体建立关系的节点"
                  />
                  <HealthMetric
                    label="潜在重复"
                    value={health.potentialDuplicates}
                    max={10}
                    deduction={health.potentialDuplicates * 5}
                    description="可能重复的实体对"
                  />
                  <HealthMetric
                    label="过时实体"
                    value={health.staleEntities}
                    max={10}
                    deduction={health.staleEntities * 3}
                    description="超过90天未更新的实体"
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <TaskList />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>维护历史</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">暂无历史记录</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface HealthMetricProps {
  label: string;
  value: number;
  max: number;
  deduction: number;
  description: string;
}

function HealthMetric({ label, value, max, deduction, description }: HealthMetricProps) {
  const percentage = Math.min(100, (value / max) * 100);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
        <div className="text-right">
          <div className="font-medium">{value} 个</div>
          {deduction > 0 && (
            <div className="text-sm text-red-500">扣分: -{deduction}</div>
          )}
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
