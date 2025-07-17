
import { Button } from "@/components/ui/button";
import { Trash2, Volume2, VolumeX, Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledNote {
  time: number;
  instrument: string;
  step: number;
  hit: boolean;
  correct: boolean;
  wrongInstrument: boolean;
}

interface DrumGridProps {
  pattern: { [key: string]: boolean[] };
  currentStep: number;
  onStepToggle: (drum: string, step: number) => void;
  onClearPattern: () => void;
  metronomeEnabled: boolean;
  onMetronomeToggle: () => void;
  noteResults?: ScheduledNote[];
  isMicMode?: boolean;
}

const drumLabels: { [key: string]: { name: string; symbol: string } } = {
  kick: { name: "Kick", symbol: "●" },
  snare: { name: "Snare", symbol: "×" },
  hihat: { name: "Hi-Hat", symbol: "○" },
  openhat: { name: "Open Hat", symbol: "◎" },
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
}: DrumGridProps) => {
  
  const getStepFeedback = (drumKey: string, stepIndex: number) => {
    if (!isMicMode || drumKey !== 'hihat') return null;
    
    const result = noteResults.find(note => 
      note.step === stepIndex && 
      note.instrument === 'Hi-Hat'
    );
    
    return result;
  };

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
            {metronomeEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            Metronome
          </Button>
          
          {isMicMode && (
            <div className="text-sm text-muted-foreground">
              Practice Mode: Hit detection active
            </div>
          )}
        </div>
        
        <Button
          variant="outline"
          onClick={onClearPattern}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {/* Grid Container */}
      <div className="relative bg-card rounded-lg p-6 shadow-elevated">
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-playhead transition-all duration-75 z-10"
          style={{
            left: `${88 + (currentStep * (100 - 88 / 16)) / 16}%`,
            boxShadow: "0 0 20px hsl(var(--playhead) / 0.6)",
          }}
        />

        {/* Beat Numbers */}
        <div className="flex mb-4">
          <div className="w-20"></div>
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 text-center text-sm font-mono",
                i % 4 === 0 ? "text-primary font-bold" : "text-muted-foreground"
              )}
            >
              {i % 4 === 0 ? Math.floor(i / 4) + 1 : ""}
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
                {pattern[drumKey]?.map((active, stepIndex) => {
                  const feedback = getStepFeedback(drumKey, stepIndex);
                  
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
                        isMicMode && "cursor-default"
                      )}
                    >
                      {active && (
                        <div className="relative">
                          {/* Main purple dot with feedback overlay */}
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-background",
                              "shadow-note transition-transform duration-200 hover:scale-110",
                              stepIndex === currentStep && active && "animate-bounce",
                              // Base color
                              !feedback && "bg-gradient-to-br from-note-active to-accent",
                              // Feedback colors override the base
                              feedback && feedback.hit && feedback.correct && "bg-green-500",
                              feedback && feedback.hit && feedback.wrongInstrument && "bg-yellow-500",
                              feedback && feedback.hit && !feedback.correct && !feedback.wrongInstrument && "bg-red-500"
                            )}
                          >
                            {symbol}
                          </div>
                          
                          {/* Feedback icon overlay - smaller and positioned at top-right */}
                          {feedback && feedback.hit && (
                            <div className={cn(
                              "absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center",
                              "border border-background",
                              feedback.correct ? "bg-green-600" : 
                              feedback.wrongInstrument ? "bg-yellow-600" : "bg-red-600"
                            )}>
                              {feedback.correct ? (
                                <Check className="w-2 h-2 text-white" />
                              ) : feedback.wrongInstrument ? (
                                <AlertTriangle className="w-1.5 h-1.5 text-white" />
                              ) : (
                                <X className="w-1.5 h-1.5 text-white" />
                              )}
                            </div>
                          )}
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
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-primary/20"
              style={{ left: `${88 + (i * 25)}%` }}
            />
          ))}
        </div>
      </div>

      {/* Pattern Info */}
      <div className="text-center text-sm text-muted-foreground">
        {isMicMode ? (
          <span>
            🎤 Microphone active • Hit the Hi-Hat at the right time • 
            <span className="text-green-500 mx-2">✓ Correct</span>
            <span className="text-yellow-500 mx-2">⚠ Wrong instrument</span>
            <span className="text-red-500">✗ Missed</span>
          </span>
        ) : (
          "Click on the grid to add or remove notes • Yellow line shows current playback position"
        )}
      </div>
    </div>
  );
};
