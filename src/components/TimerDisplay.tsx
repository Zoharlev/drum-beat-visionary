
import { Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimerDisplayProps {
  timeRemaining: number;
  formatTime: string;
  progress: number;
  isActive: boolean;
  currentLoop: number;
  currentNote: number;
}

export const TimerDisplay = ({ 
  timeRemaining, 
  formatTime, 
  progress, 
  isActive, 
  currentLoop, 
  currentNote 
}: TimerDisplayProps) => {
  const isWarning = timeRemaining <= 10;
  const isCritical = timeRemaining <= 5;

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-colors",
      isActive ? (
        isCritical ? "bg-red-500/20 border-red-500/40" :
        isWarning ? "bg-yellow-500/20 border-yellow-500/40" :
        "bg-primary/10 border-primary/20"
      ) : "bg-secondary border-border"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Timer className={cn(
            "h-5 w-5",
            isActive ? (
              isCritical ? "text-red-500" :
              isWarning ? "text-yellow-500" :
              "text-primary"
            ) : "text-muted-foreground"
          )} />
          <span className="font-medium">60-Second Practice</span>
        </div>
        <div className={cn(
          "text-2xl font-bold",
          isActive ? (
            isCritical ? "text-red-500" :
            isWarning ? "text-yellow-500" :
            "text-primary"
          ) : "text-muted-foreground"
        )}>
          {formatTime}
        </div>
      </div>
      
      {isActive && (
        <>
          <div className="w-full bg-secondary rounded-full h-2 mb-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-1000",
                isCritical ? "bg-red-500" :
                isWarning ? "bg-yellow-500" :
                "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Loop {currentLoop}</span>
            <span>Note {currentNote}/8</span>
          </div>
        </>
      )}
    </div>
  );
};
