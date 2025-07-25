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
  currentTimeInSeconds = 0
}: DrumGridProps) => {
  const getDotFeedback = (drumKey: string, stepIndex: number) => {
    if (!isMicMode || drumKey !== 'hihat') return null;

    // Find the scheduled note for this step
    const scheduledNote = noteResults.find(note => note.step === stepIndex);
    if (!scheduledNote || !scheduledNote.hit) return null;
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
    } else {
      return {
        color: "bg-red-500",
        icon: <X className="w-3 h-3 text-white" />
      };
    }
  };
  const getCurrentActiveNote = (drumKey: string, stepIndex: number) => {
    if (!isMicMode || drumKey !== 'hihat') return null;

    // Find the scheduled note for this step
    const scheduledNote = noteResults.find(note => note.step === stepIndex);
    if (!scheduledNote) return null;

    // Check if this note is currently active (within timing window)
    const timingWindow = 0.15; // ±0.15 seconds
    const timeDiff = Math.abs(currentTimeInSeconds - scheduledNote.time);

    // Only return active state if this note is currently in the active timing window
    if (timeDiff <= timingWindow) {
      return scheduledNote;
    }
    return null;
  };
  return <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant={metronomeEnabled ? "default" : "outline"} onClick={onMetronomeToggle} className="flex items-center gap-2">
            {metronomeEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Metronome
          </Button>
          
          {isMicMode}
        </div>
        
        
      </div>

      {/* Grid Container */}
      <div className="relative bg-card rounded-lg p-6 shadow-elevated">
        {/* Playhead */}
        

        {/* Beat Numbers */}
        <div className="flex mb-4">
          <div className="w-20"></div>
          {Array.from({
          length: 16
        }, (_, i) => <div key={i} className={cn("flex-1 text-center text-sm font-mono", i % 4 === 0 ? "text-primary font-bold" : "text-muted-foreground")}>
              {i % 4 === 0 ? Math.floor(i / 4) + 1 : ""}
            </div>)}
        </div>

        {/* Drum Rows */}
        {Object.entries(drumLabels).map(([drumKey, {
        name,
        symbol
      }]) => <div key={drumKey} className="flex items-center mb-3 group">
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
              const feedback = getDotFeedback(drumKey, stepIndex);
              const isCurrentlyActive = getCurrentActiveNote(drumKey, stepIndex) !== null;
              return <button key={stepIndex} onClick={() => onStepToggle(drumKey, stepIndex)} disabled={isMicMode} className={cn("flex-1 h-12 border-r border-grid-line last:border-r-0 transition-all duration-200", "flex items-center justify-center group-hover:bg-muted/20", stepIndex === currentStep && "bg-playhead/10", stepIndex % 4 === 0 && "border-r-2 border-primary/30", isMicMode && "cursor-default", isCurrentlyActive && "bg-playhead/20 ring-2 ring-playhead/50")}>
                      {active && <div className="relative">
                          <div className={cn("w-6 h-6 rounded-full transition-all duration-200 hover:scale-110", "shadow-note flex items-center justify-center text-xs font-bold", stepIndex === currentStep && active && "animate-bounce",
                  // Use feedback color if available, otherwise default purple gradient
                  feedback ? feedback.color : "bg-gradient-to-br from-note-active to-accent text-background")}>
                            {feedback ? feedback.icon : symbol}
                          </div>
                        </div>}
                    </button>;
            })}
              </div>
            </div>
          </div>)}

        {/* Grid Enhancement */}
        <div className="absolute inset-6 pointer-events-none">
          {/* Vertical beat lines */}
          {Array.from({
          length: 4
        }, (_, i) => <div key={i} className="absolute top-0 bottom-0 border-l border-primary/20" style={{
          left: `${88 + i * 25}%`
        }} />)}
        </div>
      </div>

      {/* Pattern Info */}
      <div className="text-center text-sm text-muted-foreground">
        {isMicMode ? <span>
            🎤 Microphone active • Hit the Hi-Hat at the right time • 
            <span className="text-green-500 mx-2">🟢 Perfect timing</span>
            <span className="text-yellow-500 mx-2">🟡 Slightly off</span>
            <span className="text-red-500">🔴 Wrong/Missed</span>
          </span> : "Click on the grid to add or remove notes • Yellow line shows current playback position"}
      </div>
    </div>;
};