import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Settings, Plus, Minus, Mic, MicOff, Circle, Square, Download, Trash2, Volume2, Clock8, Target } from "lucide-react";
import { DrumGrid } from "./DrumGrid";
import { TimingFeedback } from "./TimingFeedback";
import { TimerDisplay } from "./TimerDisplay";
import { useToast } from "@/hooks/use-toast";
import { useMicrophoneDetection } from "@/hooks/useMicrophoneDetection";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { SessionSummary } from "./SessionSummary";

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

interface TimingStats {
  perfectHits: number;
  goodHits: number;
  missedHits: number;
  totalHits: number;
  currentStreak: number;
  bestStreak: number;
}

export const DrumMachine = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [previewStep, setPreviewStep] = useState(0);
  const [bpm, setBpm] = useState(60);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);

  // Timer mode state
  const [isTimerMode, setIsTimerMode] = useState(false);
  const [currentLoop, setCurrentLoop] = useState(1);
  const [currentSequenceNote, setCurrentSequenceNote] = useState(1);

  const [startTime, setStartTime] = useState<number>(0);
  const [currentTimeInSeconds, setCurrentTimeInSeconds] = useState<number>(0);
  const [completedNotesCount, setCompletedNotesCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Timing feedback states
  const [lastHitTiming, setLastHitTiming] = useState<number | null>(null);
  const [lastHitAccuracy, setLastHitAccuracy] = useState<'perfect' | 'good' | 'slightly-off' | 'miss' | null>(null);
  const [timingStats, setTimingStats] = useState<TimingStats>({
    perfectHits: 0,
    goodHits: 0,
    missedHits: 0,
    totalHits: 0,
    currentStreak: 0,
    bestStreak: 0
  });

  const [scheduledNotes, setScheduledNotes] = useState<ScheduledNote[]>([]);
  const [noteResults, setNoteResults] = useState<ScheduledNote[]>([]);
  const [pattern, setPattern] = useState<DrumPattern>(() => {
    const hihatPattern = new Array(16).fill(false);
    // Add 8 hi-hat notes evenly distributed (every 2 steps)
    hihatPattern[0] = true;   // Beat 1
    hihatPattern[2] = true;   // Beat 1 &
    hihatPattern[4] = true;   // Beat 2
    hihatPattern[6] = true;   // Beat 2 &
    hihatPattern[8] = true;   // Beat 3
    hihatPattern[10] = true;  // Beat 3 &
    hihatPattern[12] = true;  // Beat 4
    hihatPattern[14] = true;  // Beat 4 &

    return {
      kick: new Array(16).fill(false),
      snare: new Array(16).fill(false),
      hihat: hihatPattern,
      openhat: new Array(16).fill(false)
    };
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const missedBeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  // Add new session-related state
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);

  // Timer hook
  const timer = useSessionTimer({
    duration: 60,
    onComplete: () => {
      setSessionCompleted(true);
      setIsPlaying(false);
      if (isRecording) {
        stopRecording();
      }
      const duration = (Date.now() - sessionStartTime) / 1000;
      setSessionDuration(duration);
      setShowSessionSummary(true);
      toast({
        title: "60-Second Session Complete! 🎉",
        description: `Completed ${currentLoop} loops with ${timingStats.totalHits} total hits!`
      });
    },
    isActive: isTimerMode && isPlaying
  });

  // Generate scheduled notes from pattern
  const generateScheduledNotes = (pattern: DrumPattern, bpm: number) => {
    const stepDuration = 60 / bpm / 4; // Duration of each 16th note in seconds
    const notes: ScheduledNote[] = [];
    
    Object.entries(pattern).forEach(([instrument, steps]) => {
      steps.forEach((active, stepIndex) => {
        if (active) {
          notes.push({
            time: stepIndex * stepDuration,
            instrument,
            step: stepIndex,
            hit: false,
            correct: false,
            wrongInstrument: false,
            slightlyOff: false
          });
        }
      });
    });
    
    return notes.sort((a, b) => a.time - b.time);
  };

  // Update scheduled notes when pattern or BPM changes
  useEffect(() => {
    const newScheduledNotes = generateScheduledNotes(pattern, bpm);
    setScheduledNotes(newScheduledNotes);
    setNoteResults(newScheduledNotes.map(note => ({ ...note })));
  }, [pattern, bpm]);

  // Modified auto-stop logic for timer mode
  const checkAutoStop = (currentCount: number) => {
    if (isTimerMode) {
      // In timer mode, reset after 8 notes and continue
      if (currentCount >= 8) {
        setCurrentLoop(prev => prev + 1);
        setCompletedNotesCount(0);
        setCurrentSequenceNote(1);
        
        // Reset note results for next loop
        const resetNotes = generateScheduledNotes(pattern, bpm);
        setNoteResults(resetNotes);
        setScheduledNotes(resetNotes);
        
        toast({
          title: `Loop ${currentLoop} Complete! 🔄`,
          description: "Starting next loop..."
        });
      }
    } else {
      // Original 8-note mode logic
      if (currentCount >= 8 && !sessionCompleted) {
        setSessionCompleted(true);
        setIsPlaying(false);
        
        if (isRecording) {
          stopRecording();
        }
        
        const duration = (Date.now() - sessionStartTime) / 1000;
        setSessionDuration(duration);
        setShowSessionSummary(true);
        
        toast({
          title: "Session Complete! 🎉",
          description: "Completed 8 notes - check your results!"
        });
      }
    }
  };

  const updateTimingStats = (accuracy: 'perfect' | 'good' | 'slightly-off' | 'miss') => {
    setTimingStats(prev => {
      const newStats = { ...prev };
      newStats.totalHits++;
      
      if (accuracy === 'perfect') {
        newStats.perfectHits++;
        newStats.currentStreak++;
        newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
      } else if (accuracy === 'good') {
        newStats.goodHits++;
        newStats.currentStreak++;
        newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
      } else {
        newStats.missedHits++;
        newStats.currentStreak = 0;
      }
      
      return newStats;
    });
    
    // Update sequence note counter
    setCurrentSequenceNote(prev => {
      const newNote = prev < 8 ? prev + 1 : prev;
      return newNote;
    });
    
    // Increment completed notes and check for auto-stop with new count
    setCompletedNotesCount(prev => {
      const newCount = prev + 1;
      checkAutoStop(newCount);
      return newCount;
    });
  };

  const playFeedbackSound = (accuracy: 'perfect' | 'good' | 'slightly-off' | 'miss') => {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Different tones for different accuracy levels
    switch (accuracy) {
      case 'perfect':
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        break;
      case 'good':
        oscillator.frequency.setValueAtTime(600, context.currentTime);
        gainNode.gain.setValueAtTime(0.25, context.currentTime);
        break;
      case 'slightly-off':
        oscillator.frequency.setValueAtTime(400, context.currentTime);
        gainNode.gain.setValueAtTime(0.2, context.currentTime);
        break;
      case 'miss':
        oscillator.frequency.setValueAtTime(200, context.currentTime);
        gainNode.gain.setValueAtTime(0.15, context.currentTime);
        break;
    }
    
    oscillator.type = 'sine';
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.3);
  };

  const detectInstrumentFromHit = (hit: DetectedHit): string => {
    const { frequency, amplitude, isHiHat } = hit;
    
    // Enhanced instrument detection logic
    if (isHiHat) {
      return frequency > 8000 ? 'openhat' : 'hihat';
    } else if (frequency < 100 && amplitude > 0.5) {
      return 'kick';
    } else if (frequency > 100 && frequency < 1000) {
      return 'snare';
    }
    
    return 'unknown';
  };

  const onHitDetected = (hit: DetectedHit) => {
    // Remove mode restrictions - work during both recording and playback
    if (!isPlaying) {
      console.log('Hit detected but not playing');
      return;
    }

    const currentTime = (Date.now() - startTime) / 1000;
    setCurrentTimeInSeconds(currentTime);
    
    const perfectWindow = 0.025; // ±25ms for perfect timing
    const goodWindow = 0.05; // ±50ms for good timing
    const acceptableWindow = 0.1; // ±100ms for acceptable timing

    console.log(`Hit at ${currentTime.toFixed(2)}s, looking for matches...`);

    const detectedInstrument = detectInstrumentFromHit(hit);
    let matchingNote = null;
    let closestTimeDiff = Infinity;

    for (const note of noteResults) {
      const timeDiff = Math.abs(currentTime - note.time);
      if (timeDiff <= acceptableWindow && !note.hit && timeDiff < closestTimeDiff) {
        matchingNote = note;
        closestTimeDiff = timeDiff;
      }
    }

    if (matchingNote) {
      const actualTimeDiff = currentTime - matchingNote.time;
      setLastHitTiming(actualTimeDiff);
      
      console.log(`Match found for note at ${matchingNote.time}s (diff: ${closestTimeDiff.toFixed(3)}s)`);

      const updatedResults = noteResults.map(note => {
        if (note === matchingNote) {
          const updatedNote = { ...note };
          updatedNote.hit = true;
          
          const isCorrectInstrument = detectedInstrument === matchingNote.instrument;
          
          if (isCorrectInstrument) {
            if (closestTimeDiff <= perfectWindow) {
              updatedNote.correct = true;
              updatedNote.wrongInstrument = false;
              updatedNote.slightlyOff = false;
              setLastHitAccuracy('perfect');
              updateTimingStats('perfect');
              playFeedbackSound('perfect');
              playDrumSound(matchingNote.instrument);
              toast({
                title: `Perfect hit! 🟢 (${completedNotesCount + 1}/8)`,
                description: `${matchingNote.instrument} (${Math.round(actualTimeDiff * 1000)}ms ${actualTimeDiff < 0 ? 'early' : 'late'})`
              });
            } else if (closestTimeDiff <= goodWindow) {
              updatedNote.correct = false;
              updatedNote.wrongInstrument = false;
              updatedNote.slightlyOff = true;
              setLastHitAccuracy('good');
              updateTimingStats('good');
              playFeedbackSound('good');
              playDrumSound(matchingNote.instrument);
              toast({
                title: `Good hit! 🟡 (${completedNotesCount + 1}/8)`,
                description: `${matchingNote.instrument} (${Math.round(actualTimeDiff * 1000)}ms ${actualTimeDiff < 0 ? 'early' : 'late'})`
              });
            } else {
              updatedNote.correct = false;
              updatedNote.wrongInstrument = false;
              updatedNote.slightlyOff = true;
              setLastHitAccuracy('slightly-off');
              updateTimingStats('slightly-off');
              playFeedbackSound('slightly-off');
              playDrumSound(matchingNote.instrument);
              toast({
                title: `Close! 🟠 (${completedNotesCount + 1}/8)`,
                description: `${matchingNote.instrument} (${Math.round(actualTimeDiff * 1000)}ms ${actualTimeDiff < 0 ? 'early' : 'late'})`
              });
            }
          } else {
            updatedNote.correct = false;
            updatedNote.wrongInstrument = true;
            updatedNote.slightlyOff = false;
            setLastHitAccuracy('miss');
            updateTimingStats('miss');
            playFeedbackSound('miss');
            toast({
              title: `Wrong instrument 🔴 (${completedNotesCount + 1}/8)`,
              description: `Hit ${detectedInstrument} but expected ${matchingNote.instrument}`,
              variant: "destructive"
            });
          }
          return updatedNote;
        }
        return note;
      });
      setNoteResults(updatedResults);
    } else {
      console.log('Hit detected but no matching scheduled note');
      setLastHitAccuracy('miss');
      updateTimingStats('miss');
      playFeedbackSound('miss');
      
      toast({
        title: "Timing off",
        description: "No matching beat found - focus on the highlighted beats"
      });
    }
  };

  // Monitor for missed beats
  useEffect(() => {
    if (isPlaying && !sessionCompleted) {
      missedBeatIntervalRef.current = setInterval(() => {
        const currentTime = (Date.now() - startTime) / 1000;
        
        // Check for missed beats
        const missedNotes = noteResults.filter(note => 
          !note.hit && 
          currentTime > note.time + 0.1 && // 100ms grace period
          currentTime < note.time + 0.5 // Don't mark very old notes as missed
        );
        
        if (missedNotes.length > 0) {
          const updatedResults = noteResults.map(note => {
            if (missedNotes.includes(note)) {
              const updatedNote = { ...note };
              updatedNote.hit = true; // Mark as processed
              updatedNote.correct = false;
              updatedNote.wrongInstrument = false;
              updatedNote.slightlyOff = false;
              return updatedNote;
            }
            return note;
          });
          
          setNoteResults(updatedResults);
          
          // Update stats for missed beats - each missed note counts toward completion
          missedNotes.forEach(() => {
            updateTimingStats('miss');
          });
          
          setLastHitAccuracy('miss');
          playFeedbackSound('miss');
        }
      }, 50); // Check every 50ms
    } else {
      if (missedBeatIntervalRef.current) {
        clearInterval(missedBeatIntervalRef.current);
        missedBeatIntervalRef.current = null;
      }
    }
    
    return () => {
      if (missedBeatIntervalRef.current) {
        clearInterval(missedBeatIntervalRef.current);
      }
    };
  }, [isPlaying, noteResults, startTime, sessionCompleted]);

  const {
    hasPermission,
    error,
    initializeMicrophone,
    audioStream
  } = useMicrophoneDetection({
    isListening: isMicListening,
    onHitDetected
  });

  const {
    isRecording,
    recordedBlob,
    recordingDuration,
    error: recordingError,
    startRecording,
    stopRecording,
    clearRecording,
    downloadRecording,
    formatDuration,
    getEstimatedSize,
    canRecord
  } = useAudioRecording({ 
    stream: audioStream 
  });

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const stepDuration = 60 / bpm / 4 * 1000; // 16th notes

  // Main playback interval
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const nextStep = (prev + 1) % 16;
          const timeElapsed = (Date.now() - startTime) / 1000;
          setCurrentTimeInSeconds(timeElapsed);
          return nextStep;
        });
      }, stepDuration);
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
  }, [isPlaying, stepDuration, startTime]);

  // Preview playback interval
  useEffect(() => {
    if (isPreviewPlaying) {
      previewIntervalRef.current = setInterval(() => {
        setPreviewStep(prev => {
          const nextStep = (prev + 1) % 16;
          
          // Play sounds for the next step
          if (pattern.kick[nextStep]) {
            playDrumSound('kick');
          }
          if (pattern.snare[nextStep]) {
            playDrumSound('snare');
          }
          if (pattern.hihat[nextStep]) {
            playDrumSound('hihat');
          }
          if (pattern.openhat[nextStep]) {
            playDrumSound('openhat');
          }
          
          return nextStep;
        });
      }, stepDuration);
    } else {
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;
      }
    }
    return () => {
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
      }
    };
  }, [isPreviewPlaying, stepDuration, pattern]);

  // Metronome for main playback
  useEffect(() => {
    if (isPlaying && metronomeEnabled && currentStep % 4 === 0) {
      playMetronome();
    }
  }, [currentStep, isPlaying, metronomeEnabled]);

  const playDrumSound = (drum: string) => {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    
    if (drum === 'hihat' || drum === 'openhat') {
      const bufferSize = context.sampleRate * 0.1;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      
      if (drum === 'openhat') {
        const highpassFilter = context.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.setValueAtTime(6000, context.currentTime);
        highpassFilter.Q.setValueAtTime(0.5, context.currentTime);

        const resonantFilter = context.createBiquadFilter();
        resonantFilter.type = 'bandpass';
        resonantFilter.frequency.setValueAtTime(9000, context.currentTime);
        resonantFilter.Q.setValueAtTime(4, context.currentTime);

        const shelfFilter = context.createBiquadFilter();
        shelfFilter.type = 'highshelf';
        shelfFilter.frequency.setValueAtTime(10000, context.currentTime);
        shelfFilter.gain.setValueAtTime(6, context.currentTime);
        const gainNode = context.createGain();

        noise.connect(highpassFilter);
        highpassFilter.connect(resonantFilter);
        resonantFilter.connect(shelfFilter);
        shelfFilter.connect(gainNode);
        gainNode.connect(context.destination);

        const duration = 0.4;
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.35, context.currentTime + 0.002);
        gainNode.gain.linearRampToValueAtTime(0.15, context.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        noise.start(context.currentTime);
        noise.stop(context.currentTime + duration);
      } else {
        const highpassFilter = context.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.setValueAtTime(8000, context.currentTime);
        highpassFilter.Q.setValueAtTime(1, context.currentTime);
        const bandpassFilter = context.createBiquadFilter();
        bandpassFilter.type = 'bandpass';
        bandpassFilter.frequency.setValueAtTime(12000, context.currentTime);
        bandpassFilter.Q.setValueAtTime(2, context.currentTime);
        const gainNode = context.createGain();

        noise.connect(highpassFilter);
        highpassFilter.connect(bandpassFilter);
        bandpassFilter.connect(gainNode);
        gainNode.connect(context.destination);

        const duration = 0.08;
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        noise.start(context.currentTime);
        noise.stop(context.currentTime + duration);
      }
    } else if (drum === 'snare') {
      const oscillator1 = context.createOscillator();
      const oscillator2 = context.createOscillator();
      const toneGain = context.createGain();
      oscillator1.frequency.setValueAtTime(200, context.currentTime);
      oscillator2.frequency.setValueAtTime(150, context.currentTime);
      oscillator1.type = 'triangle';
      oscillator2.type = 'sine';

      oscillator1.frequency.exponentialRampToValueAtTime(80, context.currentTime + 0.02);
      oscillator2.frequency.exponentialRampToValueAtTime(60, context.currentTime + 0.02);
      oscillator1.connect(toneGain);
      oscillator2.connect(toneGain);

      const noiseBufferSize = context.sampleRate * 0.1;
      const noiseBuffer = context.createBuffer(1, noiseBufferSize, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = noiseBuffer;

      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3000, context.currentTime);
      noiseFilter.Q.setValueAtTime(0.5, context.currentTime);
      const noiseGain = context.createGain();
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);

      const mixGain = context.createGain();
      toneGain.connect(mixGain);
      noiseGain.connect(mixGain);
      mixGain.connect(context.destination);

      const duration = 0.15;
      mixGain.gain.setValueAtTime(0, context.currentTime);
      mixGain.gain.linearRampToValueAtTime(0.4, context.currentTime + 0.002);
      mixGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

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
      const kickOsc = context.createOscillator();
      const kickGain = context.createGain();
      kickOsc.frequency.setValueAtTime(60, context.currentTime);
      kickOsc.frequency.exponentialRampToValueAtTime(35, context.currentTime + 0.05);
      kickOsc.type = 'sine';

      const subOsc = context.createOscillator();
      const subGain = context.createGain();
      subOsc.frequency.setValueAtTime(30, context.currentTime);
      subOsc.frequency.exponentialRampToValueAtTime(20, context.currentTime + 0.08);
      subOsc.type = 'sine';

      const clickOsc = context.createOscillator();
      const clickGain = context.createGain();
      clickOsc.frequency.setValueAtTime(1000, context.currentTime);
      clickOsc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.005);
      clickOsc.type = 'square';

      const lowPassFilter = context.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(120, context.currentTime);
      lowPassFilter.Q.setValueAtTime(1, context.currentTime);

      const mixGain = context.createGain();
      kickOsc.connect(kickGain);
      subOsc.connect(subGain);
      clickOsc.connect(clickGain);
      kickGain.connect(lowPassFilter);
      subGain.connect(lowPassFilter);
      clickGain.connect(mixGain);
      lowPassFilter.connect(mixGain);
      mixGain.connect(context.destination);

      const duration = 0.3;
      kickGain.gain.setValueAtTime(0.6, context.currentTime);
      kickGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

      subGain.gain.setValueAtTime(0.4, context.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration * 0.8);

      clickGain.gain.setValueAtTime(0.3, context.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.01);

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

  const togglePreview = () => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      setPreviewStep(0);
    } else {
      setIsPreviewPlaying(true);
      setPreviewStep(0);
      toast({
        title: "Preview started",
        description: "Playing the programmed rhythm"
      });
    }
  };

  const togglePlay = () => {
    if (!isPlaying) {
      if (isPreviewPlaying) {
        setIsPreviewPlaying(false);
        setPreviewStep(0);
      }
      
      // Reset timing feedback and results
      const resetNotes = generateScheduledNotes(pattern, bpm);
      setNoteResults(resetNotes);
      setScheduledNotes(resetNotes);
      const currentTime = Date.now();
      setStartTime(currentTime);
      setSessionStartTime(currentTime);
      setCurrentStep(0);
      setCurrentTimeInSeconds(0);
      setLastHitTiming(null);
      setLastHitAccuracy(null);
      setCompletedNotesCount(0);
      setCurrentSequenceNote(1);
      setCurrentLoop(1);
      setSessionCompleted(false);
      setTimingStats({
        perfectHits: 0,
        goodHits: 0,
        missedHits: 0,
        totalHits: 0,
        currentStreak: 0,
        bestStreak: 0
      });
      
      // Start timer if in timer mode
      if (isTimerMode) {
        timer.resetTimer();
        timer.startTimer();
      }
      
      console.log('Practice started, timer reset');
    } else {
      // Stop timer if running
      if (isTimerMode) {
        timer.stopTimer();
      }
      
      // Calculate session duration when stopping
      const duration = (Date.now() - sessionStartTime) / 1000;
      setSessionDuration(duration);
      
      // Show summary if session was meaningful (more than 10 seconds and had some hits)
      if (duration > 10 && timingStats.totalHits > 0) {
        setShowSessionSummary(true);
      }
    }
    setIsPlaying(!isPlaying);
    
    if (!isPlaying) {
      toast({
        title: "Practice started",
        description: isTimerMode ? "60-second timer started!" : "Hit 8 notes to complete the session!"
      });
    }
  };

  const toggleTimerMode = () => {
    if (isPlaying || isRecording) {
      toast({
        title: "Cannot change mode",
        description: "Stop current session first",
        variant: "destructive"
      });
      return;
    }
    
    setIsTimerMode(!isTimerMode);
    // Reset everything when switching modes
    reset();
    
    toast({
      title: isTimerMode ? "Switched to 8-Note Mode" : "Switched to 60-Second Mode",
      description: isTimerMode ? "Complete 8 notes to finish" : "Practice for 60 seconds with continuous loops"
    });
  };

  const toggleMicrophone = async () => {
    if (!hasPermission) {
      await initializeMicrophone();
    }
    if (hasPermission) {
      setIsMicListening(!isMicListening);
      toast({
        title: isMicListening ? "Microphone disabled" : "Microphone enabled",
        description: isMicListening ? "Click mode active" : "Ready to detect hits"
      });
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      
      // Calculate session duration and show summary
      const duration = (Date.now() - sessionStartTime) / 1000;
      setSessionDuration(duration);
      
      if (duration > 10 && timingStats.totalHits > 0) {
        setShowSessionSummary(true);
      }
      
      toast({
        title: "Recording stopped",
        description: "Audio saved - ready to download"
      });
    } else {
      if (canRecord) {
        // Auto-start playback when recording begins
        if (!isPlaying) {
          // Reset timing feedback and results for fresh session
          const resetNotes = generateScheduledNotes(pattern, bpm);
          setNoteResults(resetNotes);
          setScheduledNotes(resetNotes);
          const currentTime = Date.now();
          setStartTime(currentTime);
          setSessionStartTime(currentTime);
          setCurrentStep(0);
          setCurrentTimeInSeconds(0);
          setLastHitTiming(null);
          setLastHitAccuracy(null);
          setCompletedNotesCount(0);
          setCurrentSequenceNote(1);
          setCurrentLoop(1);
          setSessionCompleted(false);
          setTimingStats({
            perfectHits: 0,
            goodHits: 0,
            missedHits: 0,
            totalHits: 0,
            currentStreak: 0,
            bestStreak: 0
          });
          setIsPlaying(true);
        }
        
        startRecording();
        toast({
          title: "Recording started",
          description: "Auto-started playback - hit 8 notes to complete!"
        });
      } else {
        toast({
          title: "Cannot record",
          description: "Enable microphone access first",
          variant: "destructive"
        });
      }
    }
  };

  const reset = () => {
    // Don't interrupt active recording
    if (isRecording) {
      toast({
        title: "Cannot reset",
        description: "Stop recording first",
        variant: "destructive"
      });
      return;
    }

    // Comprehensive reset
    setIsPlaying(false);
    setIsPreviewPlaying(false);
    setCurrentStep(0);
    setPreviewStep(0);
    setShowSessionSummary(false);
    setSessionCompleted(false);
    setCurrentLoop(1);
    setCurrentSequenceNote(1);
    
    // Reset timer
    timer.resetTimer();
    
    // Reset all timing data
    const resetNotes = generateScheduledNotes(pattern, bpm);
    setNoteResults(resetNotes);
    setScheduledNotes(resetNotes);
    setLastHitTiming(null);
    setLastHitAccuracy(null);
    setCompletedNotesCount(0);
    setTimingStats({
      perfectHits: 0,
      goodHits: 0,
      missedHits: 0,
      totalHits: 0,
      currentStreak: 0,
      bestStreak: 0
    });
    setSessionDuration(0);
    
    toast({
      title: "Reset complete",
      description: "All progress and feedback cleared"
    });
  };

  const changeBpm = (delta: number) => {
    setBpm(prev => Math.max(40, Math.min(120, prev + delta)));
  };

  const toggleStep = (drum: string, step: number) => {
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
    
    // Reset timing feedback
    setLastHitTiming(null);
    setLastHitAccuracy(null);
    setCompletedNotesCount(0);
    setTimingStats({
      perfectHits: 0,
      goodHits: 0,
      missedHits: 0,
      totalHits: 0,
      currentStreak: 0,
      bestStreak: 0
    });
    
    toast({
      title: "Cleared",
      description: "All patterns cleared"
    });
  };

  // Session summary handlers
  const handlePlayAgain = () => {
    setShowSessionSummary(false);
    // Reset for new session but keep the pattern
    const resetNotes = generateScheduledNotes(pattern, bpm);
    setNoteResults(resetNotes);
    setScheduledNotes(resetNotes);
    setLastHitTiming(null);
    setLastHitAccuracy(null);
    setCompletedNotesCount(0);
    setCurrentSequenceNote(1);
    setCurrentLoop(1);
    setSessionCompleted(false);
    setTimingStats({
      perfectHits: 0,
      goodHits: 0,
      missedHits: 0,
      totalHits: 0,
      currentStreak: 0,
      bestStreak: 0
    });
    
    // Auto-start playback
    const currentTime = Date.now();
    setStartTime(currentTime);
    setSessionStartTime(currentTime);
    setCurrentStep(0);
    setCurrentTimeInSeconds(0);
    setIsPlaying(true);
    
    toast({
      title: "New session started",
      description: "Practice the same pattern again!"
    });
  };

  const handleNewPattern = () => {
    setShowSessionSummary(false);
    reset(); // Use the comprehensive reset
  };

  // Calculate next beat time for anticipation
  const getNextBeatTime = () => {
    if (!isPlaying) return null;
    
    const nextNote = noteResults.find(note => 
      note.time > currentTimeInSeconds && !note.hit
    );
    
    return nextNote ? nextNote.time : null;
  };

  // Calculate accuracy percentage for recording status
  const getAccuracyPercentage = () => {
    if (timingStats.totalHits === 0) return 100;
    return Math.round(((timingStats.perfectHits + timingStats.goodHits) / timingStats.totalHits) * 100);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Controls */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* Mode Toggle */}
            <Button 
              variant={isTimerMode ? "default" : "outline"} 
              onClick={toggleTimerMode}
              className="flex items-center gap-2"
              disabled={isPlaying || isRecording}
            >
              {isTimerMode ? <Clock8 className="h-4 w-4" /> : <Target className="h-4 w-4" />}
              {isTimerMode ? "60s Mode" : "8-Note Mode"}
            </Button>
            
            {/* Recording Control */}
            <Button 
              variant={isRecording ? "destructive" : "outline"} 
              onClick={toggleRecording}
              className="flex items-center gap-2"
            >
              {isRecording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {isRecording ? "Stop" : "Record"}
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
              <Button variant="ghost" size="icon" onClick={() => changeBpm(-2)} className="h-8 w-8">
                <Minus className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2 px-3">
                <div className="w-3 h-3 rounded-full bg-tempo-accent"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-2xl font-bold text-foreground mx-3">
                  {bpm}
                </span>
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => changeBpm(2)} className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Preview Control */}
            <Button 
              variant="outline" 
              onClick={togglePreview}
              disabled={isPlaying || isRecording}
              className="flex items-center gap-2"
            >
              {isPreviewPlaying ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isPreviewPlaying ? "Stop Preview" : "Preview"}
            </Button>

            {/* Play Controls */}
            <Button variant="ghost" size="icon" onClick={togglePlay} className="h-12 w-12 bg-primary/10 hover:bg-primary/20">
              {isPlaying ? <Pause className="h-6 w-6 text-primary" /> : <Play className="h-6 w-6 text-primary" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={reset} className="h-12 w-12">
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Timer Display */}
        {isTimerMode && (
          <div className="mb-6">
            <TimerDisplay
              timeRemaining={timer.timeRemaining}
              formatTime={timer.formatTime()}
              progress={timer.progress}
              isActive={isPlaying}
              currentLoop={currentLoop}
              currentNote={currentSequenceNote}
            />
          </div>
        )}

        {/* Progress Display - Updated for both modes */}
        {isPlaying && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                <span className="text-primary font-medium">
                  {isTimerMode ? "Timer Session Progress" : "Session Progress"}
                </span>
                <span className="text-muted-foreground">
                  {isTimerMode ? 
                    `Loop ${currentLoop} • Note ${currentSequenceNote}/8` : 
                    `${completedNotesCount}/8 notes completed`
                  }
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {isTimerMode ? 
                  `${timer.timeRemaining}s remaining` : 
                  `${8 - completedNotesCount} notes remaining`
                }
              </div>
            </div>
          </div>
        )}

        {/* Recording Status with Timing Info */}
        {isRecording && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
              <span className="text-destructive font-medium">Recording</span>
              <span className="text-muted-foreground">
                {formatDuration(recordingDuration)} • {getEstimatedSize(recordingDuration)}
              </span>
              {isPlaying && (
                <span className="text-muted-foreground">
                  • Accuracy: {getAccuracyPercentage()}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Download Section */}
        {recordedBlob && !isRecording && (
          <div className="mb-4 p-4 bg-secondary rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium">Recording Complete</span>
                <span className="text-muted-foreground">
                  {formatDuration(recordingDuration)} • {getEstimatedSize(recordingDuration)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={downloadRecording} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button variant="outline" onClick={clearRecording} size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {recordingError && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            Recording Error: {recordingError}
          </div>
        )}

        {/* Timing Feedback */}
        <div className="mb-6">
          <TimingFeedback 
            lastHitTiming={lastHitTiming}
            lastHitAccuracy={lastHitAccuracy}
            stats={timingStats}
            isListening={isPlaying} // Show feedback when playing (not just mic listening)
            nextBeatTime={getNextBeatTime()}
            currentTime={currentTimeInSeconds}
          />
        </div>

        {/* Pattern Instructions - Updated */}
        <div className="text-center mb-6">
          <p className="text-muted-foreground text-lg">
            {isPreviewPlaying ? "Preview playing - listen to the rhythm" : 
             isPlaying ? (isTimerMode ? "Hit the drums for 60 seconds - loops automatically!" : "Hit the drums at the highlighted times - complete 8 notes!") : 
             "Click on the grid to add or remove notes"}
          </p>
          {isPlaying && (
            <p className="text-sm text-muted-foreground mt-2">
              {isRecording ? "Recording with live timing feedback" : "Practice mode - perfect your timing"}
            </p>
          )}
        </div>

        {/* Drum Grid */}
        <DrumGrid 
          pattern={pattern} 
          currentStep={isPreviewPlaying ? previewStep : currentStep} 
          onStepToggle={toggleStep} 
          onClearPattern={clearPattern} 
          metronomeEnabled={metronomeEnabled} 
          onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)} 
          noteResults={noteResults} 
          isMicMode={isMicListening} 
          currentTimeInSeconds={currentTimeInSeconds} 
        />

        {/* Session Summary Modal */}
        <SessionSummary
          stats={timingStats}
          sessionDuration={sessionDuration}
          isVisible={showSessionSummary}
          onClose={() => setShowSessionSummary(false)}
          onPlayAgain={handlePlayAgain}
          onReset={handleNewPattern}
        />
      </div>
    </div>
  );
};
