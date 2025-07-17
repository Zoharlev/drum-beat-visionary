import { useRef, useEffect, useState } from 'react';

interface DetectedHit {
  time: number;
  frequency: number;
  amplitude: number;
  isHiHat: boolean;
}

interface UseMicrophoneDetectionProps {
  isListening: boolean;
  onHitDetected: (hit: DetectedHit) => void;
}

export const useMicrophoneDetection = ({ isListening, onHitDetected }: UseMicrophoneDetectionProps) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const lastHitTimeRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array | null>(null);
  const frequencyBufferRef = useRef<Uint8Array | null>(null);

  const initializeMicrophone = async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        } 
      });
      
      streamRef.current = stream;
      setHasPermission(true);
      
      // Create audio context and analyser
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // Configure analyser for percussion detection
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.1;
      
      // Create microphone source
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      microphoneRef.current.connect(analyserRef.current);
      
      // Initialize buffers
      bufferRef.current = new Float32Array(analyserRef.current.fftSize);
      frequencyBufferRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
    } catch (err) {
      console.error('Microphone access denied:', err);
      setError('Microphone access denied. Please allow microphone access to use this feature.');
      setHasPermission(false);
    }
  };

  const detectPercussiveHit = () => {
    if (!analyserRef.current || !bufferRef.current || !frequencyBufferRef.current) return;
    
    // Get time domain data for amplitude analysis
    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    
    // Get frequency domain data for hi-hat classification
    analyserRef.current.getByteFrequencyData(frequencyBufferRef.current);
    
    // Calculate RMS amplitude
    let sum = 0;
    for (let i = 0; i < bufferRef.current.length; i++) {
      sum += bufferRef.current[i] * bufferRef.current[i];
    }
    const rms = Math.sqrt(sum / bufferRef.current.length);
    
    // Detect percussive hit based on amplitude threshold
    const threshold = 0.02; // Adjust based on testing
    const currentTime = Date.now();
    
    if (rms > threshold && currentTime - lastHitTimeRef.current > 100) { // 100ms debounce
      lastHitTimeRef.current = currentTime;
      
      // Analyze frequency content for hi-hat classification
      const isHiHat = classifyAsHiHat(frequencyBufferRef.current);
      
      // Find dominant frequency (simple approximation)
      let maxBin = 0;
      let maxValue = 0;
      for (let i = 0; i < frequencyBufferRef.current.length; i++) {
        if (frequencyBufferRef.current[i] > maxValue) {
          maxValue = frequencyBufferRef.current[i];
          maxBin = i;
        }
      }
      
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const dominantFrequency = (maxBin * sampleRate) / (2 * frequencyBufferRef.current.length);
      
      onHitDetected({
        time: currentTime,
        frequency: dominantFrequency,
        amplitude: rms,
        isHiHat
      });
    }
  };

  const classifyAsHiHat = (frequencyData: Uint8Array): boolean => {
    // Hi-hat classification based on frequency characteristics
    // Hi-hats typically have strong high-frequency content (8kHz+)
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const binSize = sampleRate / (2 * frequencyData.length);
    
    let highFreqEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = i * binSize;
      const energy = frequencyData[i];
      
      totalEnergy += energy;
      
      // Count energy in high frequency range (6kHz - 15kHz) typical for hi-hats
      if (frequency >= 6000 && frequency <= 15000) {
        highFreqEnergy += energy;
      }
    }
    
    // If more than 40% of energy is in high frequencies, classify as hi-hat
    const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
    return highFreqRatio > 0.4;
  };

  const startListening = () => {
    if (!analyserRef.current) return;
    
    const analyze = () => {
      detectPercussiveHit();
      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    
    analyze();
  };

  const stopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  useEffect(() => {
    if (isListening && hasPermission) {
      startListening();
    } else {
      stopListening();
    }
    
    return () => stopListening();
  }, [isListening, hasPermission]);

  useEffect(() => {
    return () => {
      // Cleanup
      stopListening();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    hasPermission,
    error,
    initializeMicrophone
  };
};
