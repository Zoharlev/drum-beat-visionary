
import { Check, X, AlertTriangle, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimingStats {
  perfectHits: number;
  goodHits: number;
  missedHits: number;
  totalHits: number;
  currentStreak: number;
  bestStreak: number;
}

interface TimingFeedbackProps {
  lastHitTiming: number | null;
  lastHitAccuracy: 'perfect' | 'good' | 'slightly-off' | 'miss' | null;
  stats: TimingStats;
  isListening: boolean;
  nextBeatTime: number | null;
  currentTime: number;
}

export const TimingFeedback = ({
  lastHitTiming,
  lastHitAccuracy,
  stats,
  isListening,
  nextBeatTime,
  currentTime
}: TimingFeedbackProps) => {
  const getAccuracyColor = (accuracy: string | null) => {
    switch (accuracy) {
      case 'perfect': return 'text-green-500 bg-green-500/10';
      case 'good': return 'text-yellow-500 bg-yellow-500/10';
      case 'slightly-off': return 'text-orange-500 bg-orange-500/10';
      case 'miss': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted/10';
    }
  };

  const getAccuracyIcon = (accuracy: string | null) => {
    switch (accuracy) {
      case 'perfect': return <Check className="h-5 w-5" />;
      case 'good': return <Target className="h-5 w-5" />;
      case 'slightly-off': return <AlertTriangle className="h-5 w-5" />;
      case 'miss': return <X className="h-5 w-5" />;
      default: return null;
    }
  };

  const getAccuracyMessage = (accuracy: string | null, timing: number | null) => {
    if (!accuracy || timing === null) return 'Ready to practice';
    
    const timingMs = Math.round(timing * 1000);
    const early = timing < 0;
    const timingText = `${Math.abs(timingMs)}ms ${early ? 'early' : 'late'}`;
    
    switch (accuracy) {
      case 'perfect': return timingMs === 0 ? 'Perfect timing!' : `Perfect! (${timingText})`;
      case 'good': return `Good timing! (${timingText})`;
      case 'slightly-off': return `Close! (${timingText})`;
      case 'miss': return 'Try again - focus on timing';
      default: return 'Ready to practice';
    }
  };

  const accuracyPercentage = stats.totalHits > 0 
    ? Math.round(((stats.perfectHits + stats.goodHits) / stats.totalHits) * 100)
    : 0;

  const nextBeatIn = nextBeatTime ? Math.max(0, nextBeatTime - currentTime) : null;

  return (
    <div className="space-y-4">
      {/* Main Timing Display */}
      <div className={cn(
        "flex items-center justify-center p-6 rounded-lg border-2 transition-all duration-300",
        isListening ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/30",
        getAccuracyColor(lastHitAccuracy)
      )}>
        <div className="flex items-center gap-3">
          {getAccuracyIcon(lastHitAccuracy)}
          <div className="text-center">
            <div className="text-lg font-semibold">
              {getAccuracyMessage(lastHitAccuracy, lastHitTiming)}
            </div>
            {nextBeatIn !== null && nextBeatIn < 0.2 && (
              <div className="text-sm text-muted-foreground animate-pulse">
                Next beat in {Math.round(nextBeatIn * 1000)}ms
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Display */}
      {isListening && stats.totalHits > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-secondary rounded-lg">
            <div className="text-2xl font-bold text-green-500">{stats.perfectHits}</div>
            <div className="text-sm text-muted-foreground">Perfect</div>
          </div>
          <div className="text-center p-3 bg-secondary rounded-lg">
            <div className="text-2xl font-bold text-yellow-500">{stats.goodHits}</div>
            <div className="text-sm text-muted-foreground">Good</div>
          </div>
          <div className="text-center p-3 bg-secondary rounded-lg">
            <div className="text-2xl font-bold text-red-500">{stats.missedHits}</div>
            <div className="text-sm text-muted-foreground">Missed</div>
          </div>
          <div className="text-center p-3 bg-secondary rounded-lg">
            <div className="text-2xl font-bold text-primary">{accuracyPercentage}%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>
        </div>
      )}

      {/* Streak Display */}
      {isListening && stats.currentStreak > 0 && (
        <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">
            {stats.currentStreak} hit streak!
          </span>
          {stats.bestStreak > stats.currentStreak && (
            <span className="text-muted-foreground text-sm">
              (Best: {stats.bestStreak})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
