
import { useRef, useState, useCallback } from 'react';

interface AudioRecordingState {
  isRecording: boolean;
  duration: number;
  recordedBlob: Blob | null;
  error: string | null;
}

interface UseAudioRecordingProps {
  stream: MediaStream | null;
}

export const useAudioRecording = ({ stream }: UseAudioRecordingProps) => {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    duration: 0,
    recordedBlob: null,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    if (!stream) {
      setState(prev => ({ ...prev, error: 'No microphone stream available' }));
      return;
    }

    try {
      chunksRef.current = [];
      
      // Create MediaRecorder with the microphone stream
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setState(prev => ({
          ...prev,
          isRecording: false,
          recordedBlob: blob
        }));
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        duration: 0,
        recordedBlob: null,
        error: null
      }));

      // Update duration every second
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setState(prev => ({ ...prev, duration: elapsed }));
      }, 1000);

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start recording. Please check microphone permissions.' 
      }));
    }
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      console.log('Recording stopped');
    }
  }, [state.isRecording]);

  const downloadRecording = useCallback(() => {
    if (!state.recordedBlob) return;

    const url = URL.createObjectURL(state.recordedBlob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
    
    a.style.display = 'none';
    a.href = url;
    a.download = `drum-session-${timestamp}.webm`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    console.log('Recording downloaded');
  }, [state.recordedBlob]);

  const clearRecording = useCallback(() => {
    setState(prev => ({
      ...prev,
      recordedBlob: null,
      duration: 0,
      error: null
    }));
  }, []);

  const getFileSize = useCallback(() => {
    if (!state.recordedBlob) return 0;
    return state.recordedBlob.size;
  }, [state.recordedBlob]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  return {
    isRecording: state.isRecording,
    duration: state.duration,
    recordedBlob: state.recordedBlob,
    error: state.error,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
    getFileSize,
    formatDuration,
    formatFileSize
  };
};
