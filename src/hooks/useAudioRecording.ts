
import { useState, useRef, useCallback } from 'react';

interface UseAudioRecordingProps {
  stream: MediaStream | null;
}

interface RecordingState {
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordingDuration: number;
  error: string | null;
}

export const useAudioRecording = ({ stream }: UseAudioRecordingProps) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    recordedBlob: null,
    recordingDuration: 0,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(() => {
    if (!stream) {
      setRecordingState(prev => ({ ...prev, error: 'No audio stream available' }));
      return;
    }

    try {
      // Clear previous recording
      chunksRef.current = [];
      setRecordingState(prev => ({ 
        ...prev, 
        recordedBlob: null, 
        error: null,
        recordingDuration: 0 
      }));

      // Create MediaRecorder with preferred format
      const options = { mimeType: 'audio/webm' };
      let mediaRecorder: MediaRecorder;
      
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback to default format if webm not supported
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setRecordingState(prev => ({ 
          ...prev, 
          isRecording: false,
          recordedBlob: blob 
        }));
        
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingState(prev => ({ 
          ...prev, 
          isRecording: false,
          error: 'Recording failed' 
        }));
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      
      setRecordingState(prev => ({ ...prev, isRecording: true }));

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setRecordingState(prev => ({ ...prev, recordingDuration: elapsed }));
      }, 100);

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Failed to start recording' 
      }));
    }
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
      console.log('Recording stopped');
    }
  }, [recordingState.isRecording]);

  const clearRecording = useCallback(() => {
    setRecordingState(prev => ({ 
      ...prev, 
      recordedBlob: null,
      recordingDuration: 0,
      error: null 
    }));
    chunksRef.current = [];
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordingState.recordedBlob) return;

    const url = URL.createObjectURL(recordingState.recordedBlob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-');
    const filename = `drum-practice-${timestamp}.webm`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [recordingState.recordedBlob]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEstimatedSize = (durationSeconds: number): string => {
    // Rough estimate: ~32kbps for compressed audio
    const estimatedBytes = durationSeconds * 4000; // 32000 bits / 8 = 4000 bytes per second
    if (estimatedBytes < 1024) return `${Math.round(estimatedBytes)} B`;
    if (estimatedBytes < 1024 * 1024) return `${Math.round(estimatedBytes / 1024)} KB`;
    return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    ...recordingState,
    startRecording,
    stopRecording,
    clearRecording,
    downloadRecording,
    formatDuration,
    getEstimatedSize,
    canRecord: !!stream
  };
};
