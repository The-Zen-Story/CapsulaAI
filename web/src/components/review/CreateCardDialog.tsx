// web/src/components/review/CreateCardDialog.tsx

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createCard } from '@/services/review';

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCardDialog({ open, onOpenChange }: CreateCardDialogProps) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [cardType, setCardType] = useState<'FLASHCARD' | 'QA' | 'FILL_BLANK' | 'CLOZE'>('FLASHCARD');
  const [tags, setTags] = useState('');

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['review-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setFront('');
    setBack('');
    setCardType('FLASHCARD');
    setTags('');
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    createMutation.mutate({
      front: front.trim(),
      back: back.trim(),
      cardType,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建复习卡片</DialogTitle>
            <DialogDescription>
              创建一个新的间隔重复卡片来巩固知识
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="front">正面 (问题/提示)</Label>
              <Textarea
                id="front"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="输入问题或提示..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="back">背面 (答案)</Label>
              <Textarea
                id="back"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="输入答案..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">卡片类型</Label>
              <Select value={cardType} onValueChange={(v) => setCardType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLASHCARD">闪卡</SelectItem>
                  <SelectItem value="QA">问答</SelectItem>
                  <SelectItem value="FILL_BLANK">填空</SelectItem>
                  <SelectItem value="CLOZE">完形填空</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签 (用逗号分隔)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如: 数学, 公式, 重要"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !front.trim() || !back.trim()}>
              {createMutation.isPending ? '创建中...' : '创建卡片'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
