
import { Check, X, Target, TrendingUp, Clock, Award, RotateCcw, Play, Repeat, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimingStats {
  perfectHits: number;
  goodHits: number;
  missedHits: number;
  totalHits: number;
  currentStreak: number;
  bestStreak: number;
}

interface SessionSummaryProps {
  stats: TimingStats;
  sessionDuration: number;
  isVisible: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  onReset: () => void;
  currentLoop?: number;
  totalNotesHit?: number;
  notesPerMinute?: number;
}

export const SessionSummary = ({
  stats,
  sessionDuration,
  isVisible,
  onClose,
  onPlayAgain,
  onReset,
  currentLoop = 0,
  totalNotesHit = 0,
  notesPerMinute = 0
}: SessionSummaryProps) => {
  if (!isVisible) return;

  const accuracyPercentage = stats.totalHits > 0 
    ? Math.round(((stats.perfectHits + stats.goodHits) / stats.totalHits) * 100)
    : 0;

  const getPerformanceGrade = (accuracy: number) => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-green-500', message: 'Excellent!' };
    if (accuracy >= 80) return { grade: 'B', color: 'text-blue-500', message: 'Great job!' };
    if (accuracy >= 70) return { grade: 'C', color: 'text-yellow-500', message: 'Good work!' };
    if (accuracy >= 60) return { grade: 'D', color: 'text-orange-500', message: 'Keep practicing!' };
    return { grade: 'F', color: 'text-red-500', message: 'Try again!' };
  };

  const performance = getPerformanceGrade(accuracyPercentage);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimerSession = sessionDuration >= 50; // Assume timer session if close to 60 seconds

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-6 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Award className={cn("h-8 w-8", performance.color)} />
            <div className={cn("text-4xl font-bold", performance.color)}>
              {performance.grade}
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {isTimerSession ? "60-Second Session Complete!" : "Session Complete!"}
          </h2>
          <p className="text-muted-foreground">{performance.message}</p>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 bg-secondary rounded-lg">
            <div className={cn(
              "text-3xl font-bold mb-1",
              accuracyPercentage >= 90 ? "text-green-500" :
              accuracyPercentage >= 70 ? "text-yellow-500" :
              "text-red-500"
            )}>
              {accuracyPercentage}%
            </div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>
          
          <div className="text-center p-4 bg-secondary rounded-lg">
            <div className="text-3xl font-bold mb-1 text-primary">
              {stats.bestStreak}
            </div>
            <div className="text-sm text-muted-foreground">Best Streak</div>
          </div>
        </div>

        {/* Timer Session Specific Stats */}
        {isTimerSession && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-purple-500/10 rounded-lg">
              <div className="text-3xl font-bold mb-1 text-purple-500">
                {currentLoop}
              </div>
              <div className="text-sm text-muted-foreground">Loops Completed</div>
            </div>
            
            <div className="text-center p-4 bg-blue-500/10 rounded-lg">
              <div className="text-3xl font-bold mb-1 text-blue-500">
                {notesPerMinute}
              </div>
              <div className="text-sm text-muted-foreground">Notes/Min</div>
            </div>
          </div>
        )}

        {/* Detailed Stats */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-green-500 font-medium">Perfect Hits</span>
            </div>
            <span className="text-green-500 font-bold">{stats.perfectHits}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-yellow-500" />
              <span className="text-yellow-500 font-medium">Good Hits</span>
            </div>
            <span className="text-yellow-500 font-bold">{stats.goodHits}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-500" />
              <span className="text-red-500 font-medium">Missed</span>
            </div>
            <span className="text-red-500 font-bold">{stats.missedHits}</span>
          </div>

          {isTimerSession && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-primary font-medium">Total Notes Hit</span>
              </div>
              <span className="text-primary font-bold">{totalNotesHit}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Duration</span>
            </div>
            <span className="font-bold">{formatDuration(sessionDuration)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={onPlayAgain} className="flex-1 flex items-center gap-2">
            {isTimerSession ? <Repeat className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isTimerSession ? "Another 60s" : "Practice Again"}
          </Button>
          
          <Button variant="outline" onClick={onReset} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            New Pattern
          </Button>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full mt-3">
          Close
        </Button>
      </div>
    </div>
  );
};
