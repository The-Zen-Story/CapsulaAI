// web/src/pages/ReviewPage.tsx

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Flame,
  Trophy,
  Calendar,
  Play,
  Plus,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { getDashboard, getStats, type ReviewCard } from '@/services/review';
import { ReviewSession } from './ReviewSession';
import { CardList } from '@/components/review/CardList';
import { CreateCardDialog } from '@/components/review/CreateCardDialog';
import { Heatmap } from '@/components/review/Heatmap';

export default function ReviewPage() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['review-dashboard'],
    queryFn: getDashboard,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['review-stats'],
    queryFn: getStats,
  });

  const handleSessionComplete = () => {
    setIsSessionActive(false);
    queryClient.invalidateQueries({ queryKey: ['review-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['review-stats'] });
  };

  if (isSessionActive) {
    return <ReviewSession onComplete={handleSessionComplete} onExit={() => setIsSessionActive(false)} />;
  }

  const isLoading = isDashboardLoading || isStatsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const stats_data = stats || {
    totalCards: 0,
    dueToday: 0,
    newCards: 0,
    learningCards: 0,
    reviewCards: 0,
    masteredCards: 0,
    streak: 0,
    totalReviews: 0,
    averageAccuracy: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">复习中心</h1>
          <p className="text-muted-foreground">基于间隔重复算法的高效记忆系统</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建卡片
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日待复习</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats_data.dueToday}</div>
            <div className="text-xs text-muted-foreground">
              {stats_data.dueToday > 0 ? '还有知识等待巩固' : '今日复习已完成！'}
            </div>
            {stats_data.dueToday > 0 && (
              <Progress
                value={((stats_data.totalCards - stats_data.dueToday) / stats_data.totalCards) * 100}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">学习连续</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats_data.streak} 天</div>
            <div className="text-xs text-muted-foreground">
              {stats_data.streak > 0 ? '继续保持！🔥' : '开始你的学习 streak'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已掌握</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats_data.masteredCards} 张</div>
            <div className="text-xs text-muted-foreground">
              {stats_data.totalCards > 0
                ? `${Math.round((stats_data.masteredCards / stats_data.totalCards) * 100)}% 的卡片已掌握`
                : '还没有掌握任何卡片'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总卡片数</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats_data.totalCards}</div>
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span className="text-red-500">{stats_data.learningCards} 学习中</span>
              <span className="text-yellow-500">{stats_data.reviewCards} 复习中</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">仪表盘</TabsTrigger>
          <TabsTrigger value="cards">卡片管理</TabsTrigger>
          <TabsTrigger value="stats">统计</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Start Review Button */}
          {stats_data.dueToday > 0 && (
            <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">开始今日复习</h3>
                    <p className="text-blue-100 mt-1">
                      预计用时 {Math.ceil(stats_data.dueToday * 0.5)} 分钟 | 剩余 {stats_data.dueToday} 张卡片
                    </p>
                  </div>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setIsSessionActive(true)}
                    className="bg-white text-blue-600 hover:bg-blue-50"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    开始复习
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stats_data.dueToday === 0 && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <Trophy className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">🎉 今日复习已完成！</h3>
                    <p className="text-green-600 mt-1">
                      您已完成所有待复习卡片。明天再来继续巩固知识吧。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                学习热力图
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Heatmap />
            </CardContent>
          </Card>

          {/* Recent Cards */}
          {dashboard?.recentCards && dashboard.recentCards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>最近添加的卡片</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboard.recentCards.slice(0, 5).map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{card.front}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(card.createdAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <StatusBadge status={card.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cards">
          <CardList />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                学习统计
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">总复习次数</div>
                  <div className="text-2xl font-bold">{stats_data.totalReviews}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">平均正确率</div>
                  <div className="text-2xl font-bold">{stats_data.averageAccuracy.toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateCardDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewCard['status'] }) {
  const variants: Record<string, { label: string; className: string }> = {
    NEW: { label: '新卡片', className: 'bg-gray-100 text-gray-700' },
    LEARNING: { label: '学习中', className: 'bg-red-100 text-red-700' },
    REVIEW: { label: '复习中', className: 'bg-yellow-100 text-yellow-700' },
    MASTERED: { label: '已掌握', className: 'bg-green-100 text-green-700' },
    SUSPENDED: { label: '已暂停', className: 'bg-gray-100 text-gray-500' },
  };

  const { label, className } = variants[status] || variants.NEW;

  return <Badge className={className}>{label}</Badge>;
}
