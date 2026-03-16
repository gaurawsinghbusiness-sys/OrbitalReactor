import { useRef, useState, useCallback } from 'react';

export function useAudioStreamer() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const initAudio = useCallback(() => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } else if (playbackContextRef.current.state === 'suspended') {
      playbackContextRef.current.resume();
    }
    nextPlayTimeRef.current = playbackContextRef.current.currentTime;
  }, []);

  const startRecording = useCallback(async (onAudioData: (base64: string) => void) => {
    try {
      // Ensure audio is initialized
      initAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      streamRef.current = stream;
      
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = context;
      
      const source = context.createMediaStreamSource(stream);
      // Using ScriptProcessorNode for broad compatibility and simplicity in capturing raw PCM
      const processor = context.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Convert Int16 to Base64
        const buffer = new ArrayBuffer(pcm16.byteLength);
        new Int16Array(buffer).set(pcm16);
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        onAudioData(base64);
      };
      
      // Prevent microphone echo by routing through a silent GainNode
      const gainNode = context.createGain();
      gainNode.gain.value = 0;
      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(context.destination);
      
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      alert("Microphone access is required for the AI communication link.");
    }
  }, [initAudio]);

  const stopRecording = useCallback(() => {
    if (processorRef.current && audioContextRef.current) {
      processorRef.current.disconnect();
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
  }, []);

  const playAudioChunk = useCallback((base64: string) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;
    }
    const context = playbackContextRef.current;
    
    if (context.state === 'suspended') {
      context.resume();
    }
    
    setIsPlaying(true);

    try {
      // Decode base64 to Int16
      const normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(normalizedBase64);
      const length = binary.length - (binary.length % 2); // Ensure even length
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      
      // Convert Int16 to Float32
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }
      
      const audioBuffer = context.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      
      // Schedule playback to ensure gapless audio
      const startTime = Math.max(nextPlayTimeRef.current, context.currentTime);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
      
      source.onended = () => {
        // If this was the last chunk in the queue, set isPlaying to false
        if (context.currentTime >= nextPlayTimeRef.current - 0.1) {
          setIsPlaying(false);
        }
      };
    } catch (err) {
      console.error("Failed to play audio chunk", err);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    isRecording,
    isPlaying,
    initAudio,
    startRecording,
    stopRecording,
    playAudioChunk,
    stopPlayback
  };
}
