import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledNote {
  time: number;
  instrument: string;
  step: number;
  hit: boolean;
  correct: boolean;
  wrongInstrument: boolean;
  slightlyOff: boolean;
}

interface DrumGridProps {
  pattern: {
    [key: string]: boolean[];
  };
  currentStep: number;
  onStepToggle: (drum: string, step: number) => void;
  onClearPattern: () => void;
  metronomeEnabled: boolean;
  onMetronomeToggle: () => void;
  noteResults?: ScheduledNote[];
  isMicMode?: boolean;
  currentTimeInSeconds?: number;
  scrollPosition?: number;
}

const drumLabels: {
  [key: string]: {
    name: string;
    symbol: string;
  };
} = {
  kick: {
    name: "Kick",
    symbol: "●"
  },
  snare: {
    name: "Snare",
    symbol: "×"
  },
  hihat: {
    name: "Hi-Hat",
    symbol: "○"
  },
  openhat: {
    name: "Open Hat",
    symbol: "◎"
  }
};

export const DrumGrid = ({
  pattern,
  currentStep,
  onStepToggle,
  onClearPattern,
  metronomeEnabled,
  onMetronomeToggle,
  noteResults = [],
  isMicMode = false,
  currentTimeInSeconds = 0,
  scrollPosition = 0
}: DrumGridProps) => {
  
  const getDotFeedback = (drumKey: string, stepIndex: number) => {
    if (!isMicMode || drumKey !== 'hihat') return null;

    // Find the scheduled note that corresponds to this grid step
    const noteTime = stepIndex / 4; // Convert step to time (4 steps per second)
    const scheduledNote = noteResults.find(note => 
      Math.abs(note.time - noteTime) < 0.125 // Within 1/8 second tolerance for matching
    );
    
    if (!scheduledNote) return null;

    // Define timing windows
    const timingWindow = 0.15; // ±0.15 seconds for acceptable timing
    const missedWindow = 0.2; // Consider note "missed" if 0.2 seconds past its time
    const timePastNote = currentTimeInSeconds - noteTime;

    // If note was hit by microphone, show feedback based on accuracy
    if (scheduledNote.hit) {
      if (scheduledNote.correct) {
        return {
          color: "bg-green-500",
          icon: <Check className="w-3 h-3 text-white" />
        };
      } else if (scheduledNote.slightlyOff) {
        return {
          color: "bg-yellow-500",
          icon: <AlertTriangle className="w-3 h-3 text-white" />
        };
      } else if (scheduledNote.wrongInstrument) {
        return {
          color: "bg-red-500",
          icon: <X className="w-3 h-3 text-white" />
        };
      }
    }
    
    // If note was not hit and time has passed the missed window, show as missed
    if (!scheduledNote.hit && timePastNote > missedWindow) {
      return {
        color: "bg-red-500",
        icon: <X className="w-3 h-3 text-white" />
      };
    }

    // For future notes or notes still within timing window, return null (keep purple)
    return null;
  };

  const getCurrentActiveNote = (drumKey: string, stepIndex: number) => {
    if (!isMicMode || drumKey !== 'hihat') return null;

    // Check if this note is currently active (within timing window)
    const noteTime = stepIndex / 4;
    const timingWindow = 0.15; // ±0.15 seconds
    const timeDiff = Math.abs(currentTimeInSeconds - noteTime);

    // Find if there's a scheduled note at this time
    const scheduledNote = noteResults.find(note => 
      Math.abs(note.time - noteTime) < 0.125 // Within 1/8 second tolerance
    );

    if (scheduledNote && timeDiff <= timingWindow) {
      return scheduledNote;
    }
    return null;
  };

  // Calculate visible range based on scroll position
  const visibleSteps = 32; // Show 32 steps at a time (8 seconds at 4 steps/second)
  const startStep = Math.max(0, scrollPosition);
  const endStep = Math.min(pattern.hihat?.length || 0, startStep + visibleSteps);
  const visibleStepIndices = Array.from(
    { length: endStep - startStep }, 
    (_, i) => i + startStep
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant={metronomeEnabled ? "default" : "outline"}
            onClick={onMetronomeToggle}
            className="flex items-center gap-2"
          >
            {metronomeEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Metronome
          </Button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="relative bg-card rounded-lg p-6 shadow-elevated overflow-hidden">
        {/* Scrollable Grid */}
        <div 
          className="transition-transform duration-200 ease-out"
          style={{
            transform: `translateX(-${(scrollPosition - startStep) * (100 / visibleSteps)}%)`
          }}
        >
          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-playhead transition-all duration-75 z-10"
            style={{
              left: `${88 + ((currentStep - startStep) * (100 - 88 / visibleSteps) / visibleSteps)}%`,
              boxShadow: "0 0 20px hsl(var(--playhead) / 0.6)"
            }}
          />

          {/* Beat Numbers */}
          <div className="flex mb-4">
            <div className="w-20"></div>
            {visibleStepIndices.map((stepIndex) => (
              <div
                key={stepIndex}
                className={cn(
                  "flex-1 text-center text-sm font-mono",
                  stepIndex % 4 === 0 ? "text-primary font-bold" : "text-muted-foreground"
                )}
              >
                {stepIndex % 4 === 0 ? Math.floor(stepIndex / 4) : ""}
              </div>
            ))}
          </div>

          {/* Drum Rows */}
          {Object.entries(drumLabels).map(([drumKey, { name, symbol }]) => (
            <div key={drumKey} className="flex items-center mb-3 group">
              {/* Drum Label */}
              <div className="w-20 flex items-center gap-2 pr-4">
                <span className="text-lg font-mono text-accent">{symbol}</span>
                <span className="text-sm font-medium text-foreground">{name}</span>
              </div>

              {/* Grid Line */}
              <div className="flex-1 relative">
                <div className="absolute inset-0 border-t border-grid-line"></div>
                
                {/* Step Buttons */}
                <div className="flex relative z-10">
                  {visibleStepIndices.map((stepIndex) => {
                    const active = pattern[drumKey]?.[stepIndex] || false;
                    const feedback = getDotFeedback(drumKey, stepIndex);
                    const isCurrentlyActive = getCurrentActiveNote(drumKey, stepIndex) !== null;
                    
                    return (
                      <button
                        key={stepIndex}
                        onClick={() => onStepToggle(drumKey, stepIndex)}
                        disabled={isMicMode}
                        className={cn(
                          "flex-1 h-12 border-r border-grid-line last:border-r-0 transition-all duration-200",
                          "flex items-center justify-center group-hover:bg-muted/20",
                          stepIndex === currentStep && "bg-playhead/10",
                          stepIndex % 4 === 0 && "border-r-2 border-primary/30",
                          isMicMode && "cursor-default",
                          isCurrentlyActive && "bg-playhead/20 ring-2 ring-playhead/50"
                        )}
                      >
                        {active && (
                          <div className="relative">
                            <div
                              className={cn(
                                "w-6 h-6 rounded-full transition-all duration-200 hover:scale-110",
                                "shadow-note flex items-center justify-center text-xs font-bold",
                                stepIndex === currentStep && active && "animate-bounce",
                                // Use feedback color if available, otherwise default purple gradient
                                feedback ? feedback.color : "bg-gradient-to-br from-note-active to-accent text-background"
                              )}
                            >
                              {feedback ? feedback.icon : symbol}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Grid Enhancement */}
          <div className="absolute inset-6 pointer-events-none">
            {/* Vertical beat lines */}
            {visibleStepIndices
              .filter((_, i) => i % 4 === 0)
              .map((stepIndex, i) => (
                <div
                  key={stepIndex}
                  className="absolute top-0 bottom-0 border-l border-primary/20"
                  style={{
                    left: `${88 + i * (100 - 88 / visibleSteps) / (visibleSteps / 4)}%`
                  }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Pattern Info */}
      <div className="text-center text-sm text-muted-foreground">
        {isMicMode ? (
          <span>
            🎤 Microphone active • Hit the Hi-Hat at the right time • 
            <span className="text-green-500 mx-2">🟢 Perfect timing</span>
            <span className="text-yellow-500 mx-2">🟡 Slightly off</span>
            <span className="text-red-500">🔴 Wrong/Missed</span>
          </span>
        ) : (
          "60-second Hi-Hat practice pattern • Yellow line shows current playback position"
        )}
      </div>
    </div>
  );
};
