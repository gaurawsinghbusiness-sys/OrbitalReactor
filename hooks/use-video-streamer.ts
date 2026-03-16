import { useRef, useState, useCallback, useEffect } from 'react';
import { toJpeg } from 'html-to-image';

export function useVideoStreamer(targetRef: React.RefObject<HTMLElement | null>) {
  const [isStreamingVideo, setIsStreamingVideo] = useState(false);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startVideoStreaming = useCallback((onVideoFrame: (base64: string) => void) => {
    if (!targetRef.current) return;
    setIsStreamingVideo(true);

    // Capture a frame every 3000ms to save bandwidth and prevent blocking
    streamIntervalRef.current = setInterval(async () => {
      if (!targetRef.current) return;
      
      try {
        const dataUrl = await toJpeg(targetRef.current, {
          quality: 0.3,
          backgroundColor: '#09090b', // zinc-950
          pixelRatio: 1, // Keep scale 1 to reduce image size
        });
        
        // Convert to base64 JPEG (smaller than PNG)
        // The Gemini API expects the raw base64 string without the data URI prefix
        const base64 = dataUrl.split(',')[1];
        
        onVideoFrame(base64);
      } catch (err) {
        console.error("Failed to capture video frame", err);
      }
    }, 3000);
  }, [targetRef]);

  const stopVideoStreaming = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    setIsStreamingVideo(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  return {
    isStreamingVideo,
    startVideoStreaming,
    stopVideoStreaming
  };
}
