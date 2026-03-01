// web/src/pages/ReviewSession.tsx

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, RotateCcw, SkipForward, Edit3 } from 'lucide-react';
import { startSession, submitReview, completeSession, type ReviewCard } from '@/services/review';

interface ReviewSessionProps {
  onComplete: () => void;
  onExit: () => void;
}

export function ReviewSession({ onComplete, onExit }: ReviewSessionProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    totalTime: 0,
  });

  const queryClient = useQueryClient();

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const result = await startSession();
        setSessionId(result.session.id);
        setCards(result.cards);
        setStartTime(Date.now());
      } catch (error) {
        console.error('Failed to start session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  const submitReviewMutation = useMutation({
    mutationFn: (input: { cardId: string; rating: 0 | 1 | 2 | 3 | 4 | 5; responseTime: number }) =>
      submitReview(sessionId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: () => completeSession(sessionId!),
    onSuccess: () => {
      onComplete();
    },
  });

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleRate = async (rating: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!sessionId || !cards[currentIndex]) return;

    const responseTime = Math.floor((Date.now() - startTime) / 1000);
    const card = cards[currentIndex];

    await submitReviewMutation.mutateAsync({
      cardId: card.id,
      rating,
      responseTime,
    });

    // Update stats
    setSessionStats((prev) => ({
      ...prev,
      correct: rating >= 3 ? prev.correct + 1 : prev.correct,
      incorrect: rating < 3 ? prev.incorrect + 1 : prev.incorrect,
      totalTime: prev.totalTime + responseTime,
    }));

    // Move to next card or complete
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setStartTime(Date.now());
    } else {
      setIsComplete(true);
      await completeSessionMutation.mutateAsync();
    }
  };

  const handleSkip = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setStartTime(Date.now());
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isComplete) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        }
      } else if (isFlipped) {
        const rating = parseInt(e.key);
        if (rating >= 0 && rating <= 5) {
          handleRate(rating as 0 | 1 | 2 | 3 | 4 | 5);
        }
      }
    },
    [isFlipped, isComplete, currentIndex]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="text-center p-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">🎉 复习完成！</h2>
            <p className="text-muted-foreground">您已完成今日所有待复习卡片</p>

            <div className="grid grid-cols-3 gap-4 py-6">
              <div className="p-4 rounded-lg bg-green-50">
                <div className="text-2xl font-bold text-green-600">{sessionStats.correct}</div>
                <div className="text-sm text-green-700">正确</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50">
                <div className="text-2xl font-bold text-red-600">{sessionStats.incorrect}</div>
                <div className="text-sm text-red-700">需复习</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.floor(sessionStats.totalTime / 60)}:{(sessionStats.totalTime % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-blue-700">用时</div>
              </div>
            </div>

            <Button onClick={onComplete} size="lg">返回复习中心</Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          退出
        </Button>
        <div className="text-sm text-muted-foreground">
          {currentIndex + 1} / {cards.length}
        </div>
        <div className="text-sm text-muted-foreground">
          ⏱️ {Math.floor((Date.now() - startTime) / 1000)}s
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      {/* Card */}
      <Card
        className="min-h-[400px] cursor-pointer transition-all duration-300 hover:shadow-lg"
        onClick={!isFlipped ? handleFlip : undefined}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[400px]">
          {!isFlipped ? (
            <div className="text-center space-y-4">
              <h3 className="text-xl font-medium text-muted-foreground">问题</h3>
              <p className="text-2xl font-semibold">{currentCard?.front}</p>
              <p className="text-sm text-muted-foreground mt-8">点击或按空格翻转</p>
            </div>
          ) : (
            <div className="text-center space-y-6 w-full">
              <div className="space-y-4">
                <h3 className="text-xl font-medium text-muted-foreground">答案</h3>
                <p className="text-2xl font-semibold">{currentCard?.back}</p>
              </div>

              <div className="pt-8 border-t">
                <p className="text-sm text-muted-foreground mb-4">您记得如何？</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {[0, 1, 2, 3, 4, 5].map((rating) => (
                    <Button
                      key={rating}
                      variant={rating < 3 ? 'destructive' : rating < 5 ? 'default' : 'default'}
                      size="sm"
                      onClick={() => handleRate(rating as 0 | 1 | 2 | 3 | 4 | 5)}
                      className={`
                        ${rating < 3 ? 'bg-red-500 hover:bg-red-600' : ''}
                        ${rating === 3 ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                        ${rating === 4 ? 'bg-green-500 hover:bg-green-600' : ''}
                        ${rating === 5 ? 'bg-green-600 hover:bg-green-700' : ''}
                      `}
                    >
                      {rating}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span>0: 完全忘记</span>
                  <span>3: 正确但困难</span>
                  <span>5: 完美回答</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit3 className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button variant="outline" size="sm" onClick={handleSkip}>
            <SkipForward className="mr-2 h-4 w-4" />
            跳过
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          快捷键: 空格翻转 | 0-5 评分
        </div>
      </div>
    </div>
  );
}
