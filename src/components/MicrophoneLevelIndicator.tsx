
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MicrophoneLevelIndicatorProps {
  isListening: boolean;
  audioLevel: number;
}

export const MicrophoneLevelIndicator = ({ isListening, audioLevel }: MicrophoneLevelIndicatorProps) => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (isListening) {
      setLevel(audioLevel);
    } else {
      setLevel(0);
    }
  }, [isListening, audioLevel]);

  const bars = Array.from({ length: 10 }, (_, i) => {
    const threshold = (i + 1) / 10;
    const isActive = level > threshold;
    
    return (
      <div
        key={i}
        className={cn(
          "w-2 h-4 rounded-sm transition-colors duration-75",
          isActive 
            ? i < 6 
              ? "bg-green-500" 
              : i < 8 
                ? "bg-yellow-500" 
                : "bg-red-500"
            : "bg-muted"
        )}
      />
    );
  });

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border">
      <div className="text-sm text-muted-foreground">Mic:</div>
      <div className="flex items-end gap-1 h-6">
        {bars}
      </div>
      <div className="text-xs text-muted-foreground min-w-[60px]">
        {isListening ? `${Math.round(level * 100)}%` : 'Off'}
      </div>
    </div>
  );
};
