import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Settings, Plus, Minus, Mic, MicOff, RefreshCw, Circle, Square, Download, Trash2 } from "lucide-react";
import { DrumGrid } from "./DrumGrid";
import { useMicrophoneDetection } from "@/hooks/useMicrophoneDetection";
import { useAudioRecording } from "@/hooks/useAudioRecording";

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

// Generate a simpler song with notes starting from 8 seconds (after the guideline)
const generateFullSongPattern = () => {
  const totalDuration = 60; // 60 seconds
  const notes: ScheduledNote[] = [];
  let stepIndex = 0;

  // Song structure with 2 steps per second (120 total steps) - starting from 8 seconds
  const beatsPerSecond = 2;
  
  // Create drum patterns for different sections with 8th note intervals (0.5s)
  // Starting all patterns from 8 seconds (after the yellow guideline)
  const createPattern = (startTime: number, endTime: number, patternType: string) => {
    for (let time = startTime; time < endTime; time += 0.5) { // 8th note intervals instead of 16th
      const beat = ((time - startTime) % 2) * 2; // Beat within measure (0-2)
      const measure = Math.floor((time - startTime) / 2); // Which measure
      
      switch (patternType) {
        case 'verse': // Standard rock beat (8-24s, 40-56s)
          // Kick on 1 and 3
          if (beat === 0 || (beat === 1 && measure % 2 === 0)) {
            notes.push({ time, instrument: 'kick', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          // Snare on 2 and 4 (simplified)
          if (beat === 0.5 || beat === 1.5) {
            notes.push({ time, instrument: 'snare', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          // Hi-hat on every beat
          if (beat % 0.5 === 0) {
            notes.push({ time, instrument: 'hihat', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          break;
          
        case 'chorus': // More complex pattern (24-40s)
          // Kick with some variation
          if (beat === 0 || (beat === 1 && measure % 4 === 1)) {
            notes.push({ time, instrument: 'kick', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          // Snare on backbeat
          if (beat === 0.5 || beat === 1.5) {
            notes.push({ time, instrument: 'snare', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          // Hi-hat pattern
          if (beat % 0.5 === 0) {
            notes.push({ time, instrument: 'hihat', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          // Open hat accents occasionally
          if (measure % 4 === 2 && beat === 1) {
            notes.push({ time, instrument: 'openhat', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          break;
          
        case 'outro': // Simple ending (56-60s)
          // Just kick and hi-hat
          if (beat === 0) {
            notes.push({ time, instrument: 'kick', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          if (beat % 1 === 0) { // Every beat
            notes.push({ time, instrument: 'hihat', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
          }
          break;
      }
    }
  };

  // Build the song structure starting from 8 seconds (removed intro section)
  createPattern(8, 24, 'verse');     // 8-24s: Verse 1 (starts right at guideline)
  createPattern(24, 40, 'chorus');   // 24-40s: Chorus
  createPattern(40, 56, 'verse');    // 40-56s: Verse 2
  createPattern(56, 60, 'outro');    // 56-60s: Outro

  // Add simple fills at section transitions (starting from 8s)
  const fillTimes = [23.5, 39.5, 55.5]; // Removed the 7.5s fill since it's before the guideline
  fillTimes.forEach(time => {
    if (time < 60) {
      // Just a single snare hit
      notes.push({ time, instrument: 'snare', step: stepIndex++, hit: false, correct: false, wrongInstrument: false, slightlyOff: false });
    }
  });

  console.log(`Generated ${notes.length} notes for simplified song pattern (starting from 8s)`);
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

  // Generate the full song pattern
  const [scheduledNotes] = useState<ScheduledNote[]>(generateFullSongPattern());
  const [noteResults, setNoteResults] = useState<ScheduledNote[]>(scheduledNotes);

  // Generate pattern for grid display with all instruments
  const [pattern, setPattern] = useState<DrumPattern>(() => {
    const totalSteps = Math.ceil(60 * 4); // 4 steps per second for 60 seconds
    const kickPattern = new Array(totalSteps).fill(false);
    const snarePattern = new Array(totalSteps).fill(false);
    const hihatPattern = new Array(totalSteps).fill(false);
    const openhatPattern = new Array(totalSteps).fill(false);

    scheduledNotes.forEach(note => {
      const gridStep = Math.floor(note.time * 4); // Convert time to grid step
      if (gridStep < totalSteps) {
        switch (note.instrument) {
          case 'kick':
            kickPattern[gridStep] = true;
            break;
          case 'snare':
            snarePattern[gridStep] = true;
            break;
          case 'hihat':
            hihatPattern[gridStep] = true;
            break;
          case 'openhat':
            openhatPattern[gridStep] = true;
            break;
        }
      }
    });

    return {
      kick: kickPattern,
      snare: snarePattern,
      hihat: hihatPattern,
      openhat: openhatPattern
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

          // Base feedback purely on timing accuracy
          if (closestTimeDiff <= perfectWindow) {
            updatedNote.correct = true;
            updatedNote.wrongInstrument = false;
            updatedNote.slightlyOff = false;
            playDrumSound(note.instrument);
          } else {
            updatedNote.correct = false;
            updatedNote.wrongInstrument = false;
            updatedNote.slightlyOff = true;
            playDrumSound(note.instrument);
          }
          return updatedNote;
        }
        return note;
      });
      
      setNoteResults(updatedResults);
    } else {
      console.log('Hit detected but no matching scheduled note');
    }
  };

  const { hasPermission, error, initializeMicrophone, stream } = useMicrophoneDetection({
    isListening: isMicListening,
    onHitDetected
  });

  const {
    isRecording,
    duration: recordingDuration,
    recordedBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
    getFileSize,
    formatDuration,
    formatFileSize
  } = useAudioRecording({ stream });

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const stepDuration = 60 / bpm / 4 * 1000;
  const totalSteps = 240;
  const visibleSteps = 32;

  useEffect(() => {
    if (isPlaying) {
      setCurrentStep(0);
      setCurrentTimeInSeconds(0);
      setScrollPosition(0);
      
      intervalRef.current = setInterval(() => {
        const timeElapsed = (Date.now() - startTime) / 1000;
        setCurrentTimeInSeconds(timeElapsed);

        const newStep = Math.floor(timeElapsed * 4);
        setCurrentStep(newStep);

        const centerOffset = visibleSteps * 0.9;
        const targetScrollPosition = Math.max(0, newStep - centerOffset);
        const maxScrollPosition = Math.max(0, totalSteps - visibleSteps);
        setScrollPosition(Math.min(targetScrollPosition, maxScrollPosition));

        if (timeElapsed >= 60) {
          setIsPlaying(false);
          if (isMicListening) {
            setShowSummary(true);
          }
        }
      }, stepDuration / 4);
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

      const now = Date.now();
      setStartTime(now);
      setCurrentStep(0);
      setCurrentTimeInSeconds(0);
      setScrollPosition(0);
      setShowSummary(false);
      console.log('60-second full song started - timeline playhead at beginning');
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

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (recordedBlob) {
        clearRecording();
      }
      startRecording();
    }
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
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
    setCurrentStep(0);
    setCurrentTimeInSeconds(0);
    setScrollPosition(0);
    togglePlay();
  };

  const restartPractice = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setCurrentTimeInSeconds(0);
    setScrollPosition(0);
    setShowSummary(false);

    const resetNotes = scheduledNotes.map(note => ({
      ...note,
      hit: false,
      correct: false,
      wrongInstrument: false,
      slightlyOff: false
    }));
    setNoteResults(resetNotes);

    setTimeout(() => {
      const now = Date.now();
      setStartTime(now);
      setIsPlaying(true);
      console.log('Full song practice restarted - playhead at step 1');
    }, 50);
  };

  const changeBpm = (delta: number) => {
    setBpm(prev => Math.max(60, Math.min(200, prev + delta)));
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
      kick: new Array(240).fill(false),
      snare: new Array(240).fill(false),
      hihat: new Array(240).fill(false),
      openhat: new Array(240).fill(false)
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
            {/* Microphone Control */}
            <Button
              variant={isMicListening ? "default" : "outline"}
              onClick={toggleMicrophone}
              className="flex items-center gap-2"
            >
              {isMicListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {hasPermission === null ? "Setup Mic" : isMicListening ? "Listening" : "Click Mode"}
            </Button>

            {/* Recording Control */}
            {hasPermission && (
              <Button
                variant={isRecording ? "destructive" : "outline"}
                onClick={handleRecordToggle}
                className="flex items-center gap-2"
                disabled={!hasPermission}
              >
                {isRecording ? (
                  <>
                    <Square className="h-4 w-4" />
                    Stop Rec
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" />
                    Record
                  </>
                )}
              </Button>
            )}
            
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

        {/* Recording Status */}
        {isRecording && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
              <span className="text-destructive font-medium">Recording</span>
              <span className="text-muted-foreground">
                {formatDuration(recordingDuration)}
              </span>
              <span className="text-muted-foreground text-sm">
                ~{formatFileSize(recordingDuration * 8000)} {/* Estimate file size */}
              </span>
            </div>
          </div>
        )}

        {/* Download Section */}
        {recordedBlob && !isRecording && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-medium">Recording Complete</span>
                <span className="text-muted-foreground">
                  {formatDuration(recordingDuration)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {formatFileSize(getFileSize())}
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={downloadRecording} size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button onClick={clearRecording} variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {(error || recordingError) && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error || recordingError}
          </div>
        )}

        {/* Pattern Instructions */}
        <div className="text-center mb-6">
          <p className="text-muted-foreground text-lg">
            {isMicListening 
              ? "🎵 Full drum song loaded! Play any instrument at the right time!" 
              : "🥁 Complete 60-second drum song with all instruments - Kick, Snare, Hi-Hat & Open Hat"
            }
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Time: {currentTimeInSeconds.toFixed(1)}s / 60.0s • Notes: {scheduledNotes.length} total • Progress: {(currentStep / totalSteps * 100).toFixed(1)}%
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
                          {(performance.hits / performance.total * 100).toFixed(1)}%
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
                          {(performance.misses / performance.total * 100).toFixed(1)}%
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
                          {(performance.mistakes / performance.total * 100).toFixed(1)}%
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
                const accuracy = performance.hits / performance.total * 100;
                let message = "";
                if (accuracy >= 90) {
                  message = "🌟 Outstanding! You've mastered this drum song!";
                } else if (accuracy >= 75) {
                  message = "🎯 Great job! Your drumming skills are improving!";
                } else if (accuracy >= 50) {
                  message = "👍 Good effort! Keep practicing this song to get the feel!";
                } else {
                  message = "🎵 Every drummer starts somewhere! Keep practicing this song!";
                }
                return <p className="text-lg text-muted-foreground">{message}</p>;
              })()}
              
              <div className="flex gap-4 justify-center">
                <Button onClick={retryPractice} className="px-6">
                  🔄 Play Song Again
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
