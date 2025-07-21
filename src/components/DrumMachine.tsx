import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Settings, Plus, Minus, Mic, MicOff, RefreshCw } from "lucide-react";
import { DrumGrid } from "./DrumGrid";
import { useMicrophoneDetection } from "@/hooks/useMicrophoneDetection";

interface DrumPattern {
  [key: string]: boolean[];
}

interface ScheduledNote {
  time: number;
  instrument: string;
  step: number;
  hit: boolean;
  correct: boolean;
  wrongInstrument: boolean;
  slightlyOff: boolean;
}

interface DetectedHit {
  time: number;
  frequency: number;
  amplitude: number;
  isHiHat: boolean;
}

interface PerformanceSummary {
  hits: number;
  misses: number;
  mistakes: number;
  total: number;
}

// Generate extended 60-second hi-hat pattern - 1 note every 5 seconds
const generateExtendedPattern = () => {
  const totalDuration = 60; // 60 seconds
  const noteInterval = 5; // 5 seconds between notes
  const notes: ScheduledNote[] = [];
  
  let stepIndex = 0;
  
  for (let time = 0; time < totalDuration; time += noteInterval) {
    notes.push({
      time: time,
      instrument: "Hi-Hat",
      step: stepIndex,
      hit: false,
      correct: false,
      wrongInstrument: false,
      slightlyOff: false
    });
    stepIndex++;
  }
  
  return notes;
};

export const DrumMachine = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [startTime, setStartTime] = useState<number>(0);
  const [currentTimeInSeconds, setCurrentTimeInSeconds] = useState<number>(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Extended pattern for 60 seconds
  const [scheduledNotes] = useState<ScheduledNote[]>(generateExtendedPattern());
  const [noteResults, setNoteResults] = useState<ScheduledNote[]>(scheduledNotes);
  
  // Generate pattern for grid display (show notes every 20 steps = 5 seconds)
  const [pattern, setPattern] = useState<DrumPattern>(() => {
    const hihatPattern = new Array(Math.ceil(60 * 4)).fill(false); // 4 steps per second for 60 seconds
    
    scheduledNotes.forEach(note => {
      const gridStep = Math.floor(note.time * 4); // Convert time to grid step (every 20 steps)
      if (gridStep < hihatPattern.length) {
        hihatPattern[gridStep] = true;
      }
    });

    return {
      kick: new Array(hihatPattern.length).fill(false),
      snare: new Array(hihatPattern.length).fill(false),
      hihat: hihatPattern,
      openhat: new Array(hihatPattern.length).fill(false)
    };
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const calculatePerformance = (): PerformanceSummary => {
    const hits = noteResults.filter(note => note.correct).length;
    const mistakes = noteResults.filter(note => note.hit && (note.wrongInstrument || note.slightlyOff)).length;
    const misses = noteResults.filter(note => !note.hit).length;
    const total = noteResults.length;

    return { hits, misses, mistakes, total };
  };

  const onHitDetected = (hit: DetectedHit) => {
    if (!isPlaying || !isMicListening) {
      console.log('Hit detected but not in listening mode');
      return;
    }

    const currentTime = (Date.now() - startTime) / 1000;
    setCurrentTimeInSeconds(currentTime);
    
    const perfectWindow = 0.05; // ±0.05 seconds for perfect timing
    const goodWindow = 0.1; // ±0.1 seconds for acceptable timing

    console.log(`Hit at ${currentTime.toFixed(2)}s, looking for matches...`);

    // Find the closest scheduled note within timing window
    let matchingNote = null;
    let closestTimeDiff = Infinity;

    for (const note of noteResults) {
      const timeDiff = Math.abs(currentTime - note.time);
      if (timeDiff <= goodWindow && !note.hit && timeDiff < closestTimeDiff) {
        matchingNote = note;
        closestTimeDiff = timeDiff;
      }
    }

    if (matchingNote) {
      console.log(`Match found for note at ${matchingNote.time}s (diff: ${closestTimeDiff.toFixed(3)}s)`);

      const updatedResults = noteResults.map(note => {
        if (note === matchingNote) {
          const updatedNote = { ...note };
          updatedNote.hit = true;
          
          // Base feedback purely on timing accuracy, not sound type
          if (closestTimeDiff <= perfectWindow) {
            updatedNote.correct = true;
            updatedNote.wrongInstrument = false;
            updatedNote.slightlyOff = false;
            playDrumSound('hihat');
          } else {
            updatedNote.correct = false;
            updatedNote.wrongInstrument = false;
            updatedNote.slightlyOff = true;
            playDrumSound('hihat');
          }
          return updatedNote;
        }
        return note;
      });
      
      setNoteResults(updatedResults);
    } else {
      // Hit detected but no matching note - no notification needed
      console.log('Hit detected but no matching scheduled note');
    }
  };

  const { hasPermission, error, initializeMicrophone } = useMicrophoneDetection({
    isListening: isMicListening,
    onHitDetected
  });

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Timeline and scroll management - Updated for smooth timeline behavior
  const stepDuration = 60 / bpm / 4 * 1000; // 16th notes
  const totalSteps = 240; // 60 seconds * 4 steps per second
  const visibleSteps = 32; // Steps visible at once

  useEffect(() => {
    if (isPlaying) {
      // Immediately set the first step and time when starting
      setCurrentStep(0);
      setCurrentTimeInSeconds(0);
      setScrollPosition(0);
      
      intervalRef.current = setInterval(() => {
        const timeElapsed = (Date.now() - startTime) / 1000;
        setCurrentTimeInSeconds(timeElapsed);
        
        // Calculate current step based on time - ensure it starts from 0
        const newStep = Math.floor(timeElapsed * 4); // 4 steps per second
        setCurrentStep(newStep);
        
        // Timeline-style scrolling: scroll to keep playhead in center-right of viewport
        const centerOffset = visibleSteps * 0.9; // Keep playhead at 90% of visible area (right side)
        const targetScrollPosition = Math.max(0, newStep - centerOffset);
        const maxScrollPosition = Math.max(0, totalSteps - visibleSteps);
        setScrollPosition(Math.min(targetScrollPosition, maxScrollPosition));
        
        // Stop at 60 seconds and show summary
        if (timeElapsed >= 60) {
          setIsPlaying(false);
          if (isMicListening) {
            setShowSummary(true);
          }
        }
      }, stepDuration / 4); // Update more frequently for smooth movement
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, stepDuration, startTime, isMicListening, visibleSteps, totalSteps]);

  // Play metronome
  useEffect(() => {
    if (isPlaying && metronomeEnabled && currentStep % 4 === 0) {
      playMetronome();
    }
  }, [currentStep, isPlaying, metronomeEnabled]);

  const playDrumSound = (drum: string) => {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    if (drum === 'hihat' || drum === 'openhat') {
      // Create white noise for hi-hat sounds
      const bufferSize = context.sampleRate * 0.1; // 100ms of noise
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      if (drum === 'openhat') {
        // Open hat: Lower frequency, more resonant, longer decay
        const highpassFilter = context.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.setValueAtTime(6000, context.currentTime);
        highpassFilter.Q.setValueAtTime(0.5, context.currentTime);

        // Resonant bandpass for more metallic ring
        const resonantFilter = context.createBiquadFilter();
        resonantFilter.type = 'bandpass';
        resonantFilter.frequency.setValueAtTime(9000, context.currentTime);
        resonantFilter.Q.setValueAtTime(4, context.currentTime);

        // Additional high shelf for brightness
        const shelfFilter = context.createBiquadFilter();
        shelfFilter.type = 'highshelf';
        shelfFilter.frequency.setValueAtTime(10000, context.currentTime);
        shelfFilter.gain.setValueAtTime(6, context.currentTime);
        const gainNode = context.createGain();

        // Connect the chain for open hat
        noise.connect(highpassFilter);
        highpassFilter.connect(resonantFilter);
        resonantFilter.connect(shelfFilter);
        shelfFilter.connect(gainNode);
        gainNode.connect(context.destination);

        // Open hat envelope: quick attack, slower decay with sustain
        const duration = 0.4;
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.35, context.currentTime + 0.002);
        gainNode.gain.linearRampToValueAtTime(0.15, context.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        noise.start(context.currentTime);
        noise.stop(context.currentTime + duration);
      } else {
        // Closed hi-hat: Original tighter sound
        const highpassFilter = context.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.setValueAtTime(8000, context.currentTime);
        highpassFilter.Q.setValueAtTime(1, context.currentTime);
        const bandpassFilter = context.createBiquadFilter();
        bandpassFilter.type = 'bandpass';
        bandpassFilter.frequency.setValueAtTime(12000, context.currentTime);
        bandpassFilter.Q.setValueAtTime(2, context.currentTime);
        const gainNode = context.createGain();

        // Connect the chain for closed hi-hat
        noise.connect(highpassFilter);
        highpassFilter.connect(bandpassFilter);
        bandpassFilter.connect(gainNode);
        gainNode.connect(context.destination);

        // Closed hi-hat envelope: tight and short
        const duration = 0.08;
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        noise.start(context.currentTime);
        noise.stop(context.currentTime + duration);
      }
    } else if (drum === 'snare') {
      // Complex snare sound with tonal and noise components

      // Tonal component (drum body)
      const oscillator1 = context.createOscillator();
      const oscillator2 = context.createOscillator();
      const toneGain = context.createGain();
      oscillator1.frequency.setValueAtTime(200, context.currentTime);
      oscillator2.frequency.setValueAtTime(150, context.currentTime);
      oscillator1.type = 'triangle';
      oscillator2.type = 'sine';

      // Pitch envelope for snare crack
      oscillator1.frequency.exponentialRampToValueAtTime(80, context.currentTime + 0.02);
      oscillator2.frequency.exponentialRampToValueAtTime(60, context.currentTime + 0.02);
      oscillator1.connect(toneGain);
      oscillator2.connect(toneGain);

      // Noise component (snares)
      const noiseBufferSize = context.sampleRate * 0.1;
      const noiseBuffer = context.createBuffer(1, noiseBufferSize, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = noiseBuffer;

      // Shape the noise for snare character
      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3000, context.currentTime);
      noiseFilter.Q.setValueAtTime(0.5, context.currentTime);
      const noiseGain = context.createGain();
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);

      // Mix tonal and noise components
      const mixGain = context.createGain();
      toneGain.connect(mixGain);
      noiseGain.connect(mixGain);
      mixGain.connect(context.destination);

      // Envelope for overall snare
      const duration = 0.15;
      mixGain.gain.setValueAtTime(0, context.currentTime);
      mixGain.gain.linearRampToValueAtTime(0.4, context.currentTime + 0.002);
      mixGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

      // Individual component envelopes
      toneGain.gain.setValueAtTime(0.7, context.currentTime);
      toneGain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.03);
      noiseGain.gain.setValueAtTime(0.4, context.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator1.start(context.currentTime);
      oscillator1.stop(context.currentTime + 0.03);
      oscillator2.start(context.currentTime);
      oscillator2.stop(context.currentTime + 0.03);
      noise.start(context.currentTime);
      noise.stop(context.currentTime + duration);
    } else {
      // Improved kick drum with sub-bass and attack click

      // Main kick oscillator (fundamental)
      const kickOsc = context.createOscillator();
      const kickGain = context.createGain();
      kickOsc.frequency.setValueAtTime(60, context.currentTime);
      kickOsc.frequency.exponentialRampToValueAtTime(35, context.currentTime + 0.05);
      kickOsc.type = 'sine';

      // Sub-bass oscillator for weight
      const subOsc = context.createOscillator();
      const subGain = context.createGain();
      subOsc.frequency.setValueAtTime(30, context.currentTime);
      subOsc.frequency.exponentialRampToValueAtTime(20, context.currentTime + 0.08);
      subOsc.type = 'sine';

      // Attack click for punch
      const clickOsc = context.createOscillator();
      const clickGain = context.createGain();
      clickOsc.frequency.setValueAtTime(1000, context.currentTime);
      clickOsc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.005);
      clickOsc.type = 'square';

      // Low-pass filter for warmth
      const lowPassFilter = context.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(120, context.currentTime);
      lowPassFilter.Q.setValueAtTime(1, context.currentTime);

      // Mix all components
      const mixGain = context.createGain();
      kickOsc.connect(kickGain);
      subOsc.connect(subGain);
      clickOsc.connect(clickGain);
      kickGain.connect(lowPassFilter);
      subGain.connect(lowPassFilter);
      clickGain.connect(mixGain);
      lowPassFilter.connect(mixGain);
      mixGain.connect(context.destination);

      // Envelope for main kick
      const duration = 0.3;
      kickGain.gain.setValueAtTime(0.6, context.currentTime);
      kickGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

      // Sub-bass envelope
      subGain.gain.setValueAtTime(0.4, context.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration * 0.8);

      // Click envelope (very short)
      clickGain.gain.setValueAtTime(0.3, context.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.01);

      // Overall mix envelope
      mixGain.gain.setValueAtTime(0.5, context.currentTime);
      mixGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      kickOsc.start(context.currentTime);
      kickOsc.stop(context.currentTime + duration);
      subOsc.start(context.currentTime);
      subOsc.stop(context.currentTime + duration);
      clickOsc.start(context.currentTime);
      clickOsc.stop(context.currentTime + 0.01);
    }
  };

  const playMetronome = () => {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.frequency.setValueAtTime(1000, context.currentTime);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.05);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.05);
  };

  const togglePlay = () => {
    if (!isPlaying) {
      const resetNotes = scheduledNotes.map(note => ({
        ...note,
        hit: false,
        correct: false,
        wrongInstrument: false,
        slightlyOff: false
      }));
      setNoteResults(resetNotes);
      
      // Set timing immediately and precisely
      const now = Date.now();
      setStartTime(now);
      setCurrentStep(0); // Start immediately at step 1 (index 0)
      setCurrentTimeInSeconds(0);
      setScrollPosition(0);
      setShowSummary(false);
      console.log('60-second practice started - timeline playhead at beginning');
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMicrophone = async () => {
    if (!hasPermission) {
      await initializeMicrophone();
    }
    if (hasPermission) {
      setIsMicListening(!isMicListening);
    }
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentStep(0); // Reset to step 1 (index 0)
    setCurrentTimeInSeconds(0);
    setScrollPosition(0);
    setShowSummary(false);
    setNoteResults(scheduledNotes.map(note => ({
      ...note,
      hit: false,
      correct: false,
      wrongInstrument: false,
      slightlyOff: false
    })));
  };

  const retryPractice = () => {
    setShowSummary(false);
    // Reset timing variables before starting again
    setCurrentStep(0);
    setCurrentTimeInSeconds(0);
    setScrollPosition(0);
    togglePlay();
  };

  const restartPractice = () => {
    // Stop current practice and reset everything
    setIsPlaying(false);
    setCurrentStep(0);
    setCurrentTimeInSeconds(0);
    setScrollPosition(0);
    setShowSummary(false);
    
    // Reset note results
    const resetNotes = scheduledNotes.map(note => ({
      ...note,
      hit: false,
      correct: false,
      wrongInstrument: false,
      slightlyOff: false
    }));
    setNoteResults(resetNotes);
    
    // Start immediately
    setTimeout(() => {
      const now = Date.now();
      setStartTime(now);
      setIsPlaying(true);
      console.log('Practice restarted - playhead at step 1');
    }, 50); // Small delay to ensure state is updated
  };

  const changeBpm = (delta: number) => {
    setBpm(prev => Math.max(60, Math.min(200, prev + delta)));
  };

  const toggleStep = (drum: string, step: number) => {
    // Only allow toggling if microphone is not listening (fallback click mode)
    if (!isMicListening) {
      setPattern(prev => ({
        ...prev,
        [drum]: prev[drum].map((active, index) => index === step ? !active : active)
      }));
    }
  };

  const clearPattern = () => {
    setPattern({
      kick: new Array(16).fill(false),
      snare: new Array(16).fill(false),
      hihat: new Array(16).fill(false),
      openhat: new Array(16).fill(false)
    });
    setNoteResults(scheduledNotes.map(note => ({
      ...note,
      hit: false,
      correct: false,
      wrongInstrument: false,
      slightlyOff: false
    })));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Controls */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <RotateCcw className="h-5 w-5" />
            </Button>
            
            {/* Microphone Control */}
            <Button
              variant={isMicListening ? "default" : "outline"}
              onClick={toggleMicrophone}
              className="flex items-center gap-2"
            >
              {isMicListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {hasPermission === null ? "Setup Mic" : isMicListening ? "Listening" : "Click Mode"}
            </Button>
            
            {/* Tempo Controls */}
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
              <Button variant="ghost" size="icon" onClick={() => changeBpm(-5)} className="h-8 w-8">
                <Minus className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2 px-3">
                <div className="w-3 h-3 rounded-full bg-tempo-accent"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-2xl font-bold text-foreground mx-3">
                  {bpm}
                </span>
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => changeBpm(5)} className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Play Controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-12 w-12 bg-primary/10 hover:bg-primary/20"
            >
              {isPlaying ? <Pause className="h-6 w-6 text-primary" /> : <Play className="h-6 w-6 text-primary" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={reset} className="h-12 w-12">
              <RotateCcw className="h-5 w-5" />
            </Button>

            {/* Retry Button */}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={restartPractice} 
              className="h-12 w-12"
              title="Restart Practice"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {/* Pattern Instructions */}
        <div className="text-center mb-6">
          <p className="text-muted-foreground text-lg">
            {isMicListening 
              ? "Make any sound every 5 seconds - timing is all that matters!" 
              : "60-second practice pattern loaded - 1 note every 5 seconds"
            }
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Time: {currentTimeInSeconds.toFixed(1)}s / 60.0s • Timeline Progress: {((currentStep / totalSteps) * 100).toFixed(1)}%
          </p>
        </div>

        {/* Drum Grid */}
        <DrumGrid
          pattern={pattern}
          currentStep={currentStep}
          onStepToggle={toggleStep}
          onClearPattern={clearPattern}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
          noteResults={noteResults}
          isMicMode={isMicListening}
          currentTimeInSeconds={currentTimeInSeconds}
          scrollPosition={scrollPosition}
        />

        {/* Performance Summary */}
        {showSummary && (
          <div className="mt-8 bg-card rounded-lg p-6 shadow-elevated">
            <h3 className="text-2xl font-bold text-center mb-6 text-foreground">
              🎵 Your Performance Summary
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {(() => {
                const performance = calculatePerformance();
                return (
                  <>
                    <div className="flex items-center gap-4 bg-green-500/10 rounded-lg p-4">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">✓</span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{performance.hits}</div>
                        <div className="text-sm text-muted-foreground">Perfect Timing</div>
                        <div className="text-xs text-muted-foreground">
                          {((performance.hits / performance.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-red-500/10 rounded-lg p-4">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">✗</span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{performance.misses}</div>
                        <div className="text-sm text-muted-foreground">Missed Notes</div>
                        <div className="text-xs text-muted-foreground">
                          {((performance.misses / performance.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-yellow-500/10 rounded-lg p-4">
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">~</span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">{performance.mistakes}</div>
                        <div className="text-sm text-muted-foreground">Late/Early</div>
                        <div className="text-xs text-muted-foreground">
                          {((performance.mistakes / performance.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="text-center space-y-4">
              {(() => {
                const performance = calculatePerformance();
                const accuracy = (performance.hits / performance.total) * 100;
                
                let message = "";
                if (accuracy >= 90) {
                  message = "🌟 Outstanding! Your timing is excellent!";
                } else if (accuracy >= 75) {
                  message = "🎯 Great job! Keep practicing to perfect your timing!";
                } else if (accuracy >= 50) {
                  message = "👍 Good effort! Focus on listening to the beat!";
                } else {
                  message = "🎵 Keep practicing! Every drummer started somewhere!";
                }
                
                return (
                  <p className="text-lg text-muted-foreground">{message}</p>
                );
              })()}
              
              <div className="flex gap-4 justify-center">
                <Button onClick={retryPractice} className="px-6">
                  🔄 Try Again
                </Button>
                <Button variant="outline" onClick={reset} className="px-6">
                  📝 New Session
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
