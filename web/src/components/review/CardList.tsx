// web/src/components/review/CardList.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { MoreHorizontal, Search, Trash2, Edit3, Pause, Play, RotateCcw } from 'lucide-react';
import { getCards, deleteCard, suspendCard, resumeCard, resetCard, type ReviewCard } from '@/services/review';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function CardList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cards', search, status],
    queryFn: () => getCards({ search, status, limit: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['review-dashboard'] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: suspendCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: resumeCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  });

  const resetMutation = useMutation({
    mutationFn: resetCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  });

  const cards = data?.cards || [];

  const getStatusBadge = (status: ReviewCard['status']) => {
    const variants: Record<string, { label: string; className: string }> = {
      NEW: { label: '新卡片', className: 'bg-gray-100 text-gray-700' },
      LEARNING: { label: '学习中', className: 'bg-red-100 text-red-700' },
      REVIEW: { label: '复习中', className: 'bg-yellow-100 text-yellow-700' },
      MASTERED: { label: '已掌握', className: 'bg-green-100 text-green-700' },
      SUSPENDED: { label: '已暂停', className: 'bg-gray-100 text-gray-500' },
    };
    const { label, className } = variants[status] || variants.NEW;
    return <Badge className={className}>{label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>卡片管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索卡片..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              <SelectItem value="NEW">新卡片</SelectItem>
              <SelectItem value="LEARNING">学习中</SelectItem>
              <SelectItem value="REVIEW">复习中</SelectItem>
              <SelectItem value="MASTERED">已掌握</SelectItem>
              <SelectItem value="SUSPENDED">已暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>正面</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>下次复习</TableHead>
                <TableHead>连续</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    暂无卡片
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {card.front}
                    </TableCell>
                    <TableCell>{getStatusBadge(card.status)}</TableCell>
                    <TableCell>
                      {format(new Date(card.nextReviewAt), 'MM月dd日', { locale: zhCN })}
                    </TableCell>
                    <TableCell>{card.streak} 天</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit3 className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          {card.status === 'SUSPENDED' ? (
                            <DropdownMenuItem onClick={() => resumeMutation.mutate(card.id)}>
                              <Play className="mr-2 h-4 w-4" />
                              恢复
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => suspendMutation.mutate(card.id)}>
                              <Pause className="mr-2 h-4 w-4" />
                              暂停
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => resetMutation.mutate(card.id)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重置
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteMutation.mutate(card.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
