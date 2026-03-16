'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Power, Settings, Activity, Cpu, Zap, Thermometer, ShieldAlert, Play, RotateCcw, Mic, MicOff, Volume2, Eye, Loader2, CheckCircle, Download } from 'lucide-react';
import { useAudioStreamer } from '@/hooks/use-audio-streamer';
import { useVideoStreamer } from '@/hooks/use-video-streamer';
import { useGeminiLive } from '@/hooks/use-gemini-live';
import { useSoundEffects } from '@/hooks/use-sound-effects';

type GameState = 'idle' | 'playing' | 'won' | 'lost';

type LogEntry = {
  id: string;
  timestamp: string;
  source: 'AI' | 'User' | 'System' | 'Action';
  message: string;
};

const ALL_COMPONENTS = [
  'PWR-MAIN', 'PWR-AUX', 'PWR-LIFE', 'PWR-SHLD',
  'VLV-01', 'VLV-02', 'VLV-03',
  'OVR-A', 'OVR-B', 'OVR-C'
];

export default function ReactorCore() {
  const [mounted, setMounted] = useState(false);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isShaking, setIsShaking] = useState(false);
  const { playClick, playError, playSuccess } = useSoundEffects();
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [targetSequence, setTargetSequence] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  const [successElement, setSuccessElement] = useState<string | null>(null);
  const [componentStates, setComponentStates] = useState<Record<string, any>>({
    'PWR-MAIN': true, 'PWR-AUX': false, 'PWR-LIFE': true, 'PWR-SHLD': false,
    'VLV-01': { value: 85, status: 'warning' },
    'VLV-02': { value: 12, status: 'critical' },
    'VLV-03': { value: 45, status: 'normal' },
  });

  const [gameMode, setGameMode] = useState<'standard' | 'cognitive'>('standard');
  const [cognitiveTopic, setCognitiveTopic] = useState<'Maths' | 'Geography' | 'Finance'>('Geography');
  const [cognitiveDifficulty, setCognitiveDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  const currentIndexRef = useRef(currentIndex);
  const targetSequenceRef = useRef(targetSequence);
  const fixComponentRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { targetSequenceRef.current = targetSequence; }, [targetSequence]);

  const [aiSubtitle, setAiSubtitle] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((source: LogEntry['source'], message: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      source,
      message
    }]);
  }, []);

  const mainRef = useRef<HTMLElement>(null);
  const { isRecording, isPlaying, initAudio, startRecording, stopRecording, playAudioChunk } = useAudioStreamer();
  const { isStreamingVideo, startVideoStreaming, stopVideoStreaming } = useVideoStreamer(mainRef);

  const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle incoming tool calls from Gemini
  const handleToolCall = useCallback((name: string, args: any) => {
    if (name === 'highlight_dashboard_element' && args.element_id) {
      setHighlightedElement(args.element_id);
      
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      // Remove highlight after 8 seconds (longer duration)
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedElement(null);
      }, 8000);
    } else if (name === 'evaluate_answer' && args.is_correct !== undefined) {
      if (args.is_correct === true) {
        const currentTarget = targetSequenceRef.current[currentIndexRef.current];
        if (currentTarget && fixComponentRef.current) {
          fixComponentRef.current(currentTarget);
        }
      }
    }
  }, []);

  const handleTextOutput = useCallback((text: string) => {
    setAiSubtitle(text);
    addLog('AI', text);
    
    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current);
    }
    
    // Clear subtitle after a few seconds
    subtitleTimeoutRef.current = setTimeout(() => {
      setAiSubtitle(null);
    }, 8000);
  }, [addLog]);

  const sendTextMessageRef = useRef<((text: string) => void) | null>(null);

  const userTextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserTextOutput = useCallback((text: string) => {
    addLog('User', text);
  }, [addLog]);

  const { isConnected, isConnecting, error, connect, disconnect, sendTextMessage, sendAudio, sendVideo } = useGeminiLive(
    playAudioChunk,
    handleTextOutput,
    handleUserTextOutput,
    handleToolCall,
    gameMode,
    cognitiveTopic,
    cognitiveDifficulty
  );

  useEffect(() => {
    sendTextMessageRef.current = sendTextMessage;
  }, [sendTextMessage]);

  // Tell A.N.I.T.A. the current objective when the game starts or she connects
  useEffect(() => {
    if (isConnected && gameState === 'playing' && targetSequence.length > 0) {
      const currentTarget = targetSequence[currentIndex];
      if (currentTarget) {
        const msg = currentIndex === 0 
          ? `SYSTEM NOTIFICATION: Game started. New target component: ${currentTarget}.`
          : `SYSTEM NOTIFICATION: Comm link re-established. Current target component: ${currentTarget}.`;
        sendTextMessage(msg);
        addLog('System', msg);
      }
    }
  // We intentionally omit currentIndex from the dependency array so this only fires on connect or game start
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, gameState, targetSequence, sendTextMessage, addLog, gameMode, cognitiveTopic]);

  const toggleCommLink = async () => {
    if (isConnected || isConnecting) {
      disconnect();
      stopRecording();
      stopVideoStreaming();
    } else {
      initAudio(); // Initialize audio context synchronously on user click
      await connect();
      startRecording((base64) => {
        sendAudio(base64);
      });
      startVideoStreaming((base64) => {
        sendVideo(base64);
      });
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('lost');
            if (isConnected) {
              const msg = `SYSTEM NOTIFICATION: Timer expired. Core breached. Station destroyed. Express disappointment.`;
              sendTextMessage(msg);
              addLog('System', msg);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isConnected, sendTextMessage, addLog]);

  const startGame = () => {
    // Generate a random sequence of 5 components to fix
    const shuffled = [...ALL_COMPONENTS].sort(() => 0.5 - Math.random());
    const sequence = shuffled.slice(0, 5);
    
    setTargetSequence(sequence);
    setCurrentIndex(0);
    setTimeLeft(120); // 2 minutes for the meltdown
    setGameState('playing');

    const newComponentStates: Record<string, any> = {};
    
    // Initialize all as normal
    ALL_COMPONENTS.forEach(id => {
      if (id.startsWith('PWR-')) newComponentStates[id] = true;
      if (id.startsWith('VLV-')) newComponentStates[id] = { value: 50, status: 'normal' };
      if (id.startsWith('OVR-')) newComponentStates[id] = false; // false = normal, true = broken
    });

    // Make ONLY the first target component look broken
    const firstTarget = sequence[0];
    if (firstTarget) {
      if (firstTarget.startsWith('PWR-')) newComponentStates[firstTarget] = false;
      if (firstTarget.startsWith('VLV-')) newComponentStates[firstTarget] = { value: 85 + Math.floor(Math.random() * 15), status: 'critical' };
      if (firstTarget.startsWith('OVR-')) newComponentStates[firstTarget] = true;
    }

    setComponentStates(newComponentStates);
  };

  const fixComponent = useCallback((id: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    setSuccessElement(id);
    setTimeout(() => setSuccessElement(null), 1000);

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    
    // Update visual state to look "fixed" for the current one, and "broken" for the NEXT one
    setComponentStates(prev => {
      const newState = { ...prev };
      // Fix the current one
      if (id.startsWith('PWR-')) newState[id] = true;
      if (id.startsWith('VLV-')) newState[id] = { value: 50, status: 'normal' };
      if (id.startsWith('OVR-')) newState[id] = false;
      
      // Break the next one
      const nextTarget = targetSequence[nextIndex];
      if (nextTarget) {
        if (nextTarget.startsWith('PWR-')) newState[nextTarget] = false;
        if (nextTarget.startsWith('VLV-')) newState[nextTarget] = { value: 85 + Math.floor(Math.random() * 15), status: 'critical' };
        if (nextTarget.startsWith('OVR-')) newState[nextTarget] = true;
      }
      
      return newState;
    });

    if (nextIndex >= targetSequence.length) {
      playSuccess();
      setGameState('won');
      if (isConnected) {
        const msg = `SYSTEM NOTIFICATION: All components fixed! Meltdown averted. Congratulate the user.`;
        sendTextMessage(msg);
        addLog('System', msg);
      }
    } else {
      playClick();
      if (isConnected) {
        const msg = `SYSTEM NOTIFICATION: Component ${id} fixed. NEW target component: ${targetSequence[nextIndex]}.`;
        sendTextMessage(msg);
        addLog('System', msg);
      }
    }
  }, [currentIndex, targetSequence, playSuccess, playClick, isConnected, sendTextMessage, addLog, gameMode, cognitiveTopic]);

  useEffect(() => {
    fixComponentRef.current = fixComponent;
  }, [fixComponent]);

  const handleComponentClick = useCallback((id: string) => {
    if (gameState !== 'playing') return;

    addLog('Action', `Clicked component [${id}]`);

    if (id === targetSequence[currentIndex]) {
      if (gameMode === 'cognitive') {
        playClick();
        if (isConnected) {
          const msg = `SYSTEM NOTIFICATION: User illegally clicked locked component ${id}. Remind them to use voice to answer the question for ${targetSequence[currentIndex]}.`;
          sendTextMessage(msg);
          addLog('System', msg);
        } else {
          addLog('System', `Component ${id} is locked. Connect COMM LINK to unlock.`);
        }
      } else {
        if (fixComponentRef.current) {
          fixComponentRef.current(id);
        }
      }
    } else {
      // Wrong click - penalty!
      playError();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      setTimeLeft(prev => Math.max(0, prev - 15));
      if (isConnected) {
        const msg = `SYSTEM NOTIFICATION: User clicked WRONG component (${id}). Target is still ${targetSequence[currentIndex]}. React with panic/frustration.`;
        sendTextMessage(msg);
        addLog('System', msg);
      }
    }
  }, [gameState, targetSequence, currentIndex, playClick, playError, isConnected, sendTextMessage, addLog, gameMode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const ms = gameState === 'playing' ? (seconds % 100).toString().padStart(2, '0') : '00'; // Fake ms for tension
    return `${m}:${s}:${gameState === 'playing' ? ms : '00'}`;
  };

  const downloadLogs = useCallback(() => {
    const logText = logs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.source}: ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reactor-log-${new Date().toISOString().replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  if (!mounted) return null;

  return (
    <motion.main 
      ref={mainRef} 
      animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen w-full p-4 md:p-8 flex flex-col gap-6 overflow-hidden relative selection:bg-cyan-900 selection:text-cyan-100"
    >
      
      {/* BACKGROUND GRID & SCANLINES */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] opacity-20 z-50" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-40" />

      {/* GAME OVERLAYS */}
      <AnimatePresence>
        {gameState === 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md"
          >
            <div className="text-left flex flex-col gap-6 p-8 border border-zinc-800 bg-zinc-900/80 rounded-xl max-w-2xl shadow-2xl">
              <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
                <div>
                  <h2 className="text-3xl font-black text-zinc-100 tracking-widest">REACTOR STANDBY</h2>
                  <p className="text-amber-500 font-mono text-sm">SIMULATION PROTOCOL: OMEGA-7</p>
                </div>
              </div>
              
              <div className="space-y-4 text-zinc-300">
                <p className="text-lg font-bold text-white">OBJECTIVE: PREVENT CORE MELTDOWN</p>
                <p>A catastrophic failure is imminent. You have 2 minutes to repair 5 critical components in the exact correct sequence.</p>
                
                {/* GAME MODE SELECTION */}
                <div className="bg-zinc-950 p-4 rounded border border-zinc-800 space-y-4">
                  <div>
                    <p className="text-cyan-400 font-bold font-mono text-sm mb-2">PROTOCOL OVERRIDE MODE:</p>
                    <div className="flex gap-2">
                      <button 
                        onPointerDown={() => setGameMode('standard')}
                        className={`flex-1 py-2 px-4 rounded border font-bold text-sm transition-colors ${gameMode === 'standard' ? 'bg-cyan-900 border-cyan-500 text-cyan-100' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                      >
                        STANDARD
                      </button>
                      <button 
                        onPointerDown={() => setGameMode('cognitive')}
                        className={`flex-1 py-2 px-4 rounded border font-bold text-sm transition-colors ${gameMode === 'cognitive' ? 'bg-purple-900 border-purple-500 text-purple-100' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                      >
                        COGNITIVE
                      </button>
                    </div>
                  </div>

                  {gameMode === 'cognitive' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-2 border-t border-zinc-800"
                    >
                      <div>
                        <p className="text-purple-400 font-bold font-mono text-xs mb-2">COGNITIVE TOPIC:</p>
                        <div className="flex gap-2">
                          {['Maths', 'Geography', 'Finance'].map(topic => (
                            <button 
                              key={topic}
                              onPointerDown={() => setCognitiveTopic(topic as any)}
                              className={`flex-1 py-1.5 px-2 rounded border font-bold text-xs transition-colors ${cognitiveTopic === topic ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                            >
                              {topic.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-purple-400 font-bold font-mono text-xs mb-2">THREAT LEVEL:</p>
                        <div className="flex gap-2">
                          {['Easy', 'Medium', 'Hard'].map(diff => (
                            <button 
                              key={diff}
                              onPointerDown={() => setCognitiveDifficulty(diff as any)}
                              className={`flex-1 py-1.5 px-2 rounded border font-bold text-xs transition-colors ${cognitiveDifficulty === diff ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                            >
                              {diff.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="bg-zinc-950 p-4 rounded border border-zinc-800 font-mono text-sm space-y-2">
                  <p className="text-cyan-400 font-bold">HOW TO PLAY:</p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Click <span className="text-white font-bold">START SIMULATION</span> to begin the countdown.</li>
                    <li>Click the <span className="text-white font-bold">COMM LINK</span> button (microphone icon) in the top right to connect to A.N.I.T.A., the station&apos;s AI.</li>
                    {gameMode === 'standard' ? (
                      <>
                        <li><span className="text-amber-400 font-bold">SPEAK INTO YOUR MICROPHONE:</span> Ask A.N.I.T.A. for the repair sequence.</li>
                        <li>Click the components on the dashboard in the exact order she tells you.</li>
                      </>
                    ) : (
                      <>
                        <li><span className="text-purple-400 font-bold">COGNITIVE LOCKDOWN:</span> Components are locked! A.N.I.T.A. will ask you a question.</li>
                        <li><span className="text-amber-400 font-bold">SPEAK THE ANSWER:</span> Answer correctly via voice to unlock the component.</li>
                      </>
                    )}
                    <li><span className="text-red-400 font-bold">WARNING:</span> Mistakes will cause a power surge and deduct 15 seconds from your timer!</li>
                  </ol>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button onPointerDown={startGame} className="flex items-center gap-2 px-8 py-4 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 rounded font-black tracking-wider transition-colors shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(8,145,178,0.6)]">
                  <Play className="w-5 h-5" /> START SIMULATION
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'won' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-emerald-950/90 backdrop-blur-md"
          >
            <div className="text-center flex flex-col items-center gap-6 p-8 border border-emerald-800 bg-emerald-900/20 rounded-xl">
              <ShieldAlert className="w-20 h-20 text-emerald-400" />
              <div>
                <h2 className="text-4xl font-black text-emerald-400 mb-2 tracking-widest">MELTDOWN AVERTED</h2>
                <p className="text-emerald-200/70">Core temperatures stabilizing. Good work, Captain.</p>
              </div>
              <button onPointerDown={startGame} className="flex items-center gap-2 px-6 py-3 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded font-bold transition-colors mt-4">
                <RotateCcw className="w-4 h-4" /> RESTART SIMULATION
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'lost' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/90 backdrop-blur-md"
          >
            <div className="text-center flex flex-col items-center gap-6 p-8 border border-red-800 bg-red-900/20 rounded-xl">
              <AlertTriangle className="w-24 h-24 text-red-500 animate-pulse" />
              <div>
                <h2 className="text-5xl font-black text-red-500 mb-2 tracking-widest">CORE BREACH</h2>
                <p className="text-red-200/70">Catastrophic failure. Station destroyed.</p>
              </div>
              <button onPointerDown={startGame} className="flex items-center gap-2 px-6 py-3 bg-red-900 hover:bg-red-800 text-red-100 rounded font-bold transition-colors mt-4">
                <RotateCcw className="w-4 h-4" /> RETRY SIMULATION
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="flex justify-between items-end border-b-2 border-zinc-800 pb-4 relative z-10">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-zinc-100 mb-1">
            ORBITAL <span className="text-red-500">MELTDOWN</span>
          </h1>
          <p className="text-xs md:text-sm tracking-[0.2em] text-zinc-500 uppercase">
            System ID: OMEGA-7 // Status: <span className={`font-bold ${gameState === 'playing' ? 'text-red-500 animate-pulse' : 'text-cyan-500'}`}>{gameState === 'playing' ? 'CRITICAL' : 'STABLE'}</span>
          </p>
        </div>
        <div className="flex items-end gap-6">
          {/* LOGS WIDGET */}
          <div className="hidden md:flex flex-col items-end">
            <button 
              onPointerDown={downloadLogs}
              disabled={logs.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${
                logs.length > 0
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="text-xs font-bold tracking-widest">
                DOWNLOAD LOGS
              </span>
            </button>
            <div className="text-[9px] uppercase tracking-widest text-zinc-600 mt-1">
              {logs.length} ENTRIES RECORDED
            </div>
          </div>

          {/* COMM LINK WIDGET */}
          <div className="hidden md:flex flex-col items-end">
            <button 
              onPointerDown={toggleCommLink}
              disabled={isConnecting}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${
                isConnected 
                  ? 'bg-red-950/50 border-red-500 text-red-400' 
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isConnected ? (
                <Mic className="w-4 h-4 animate-pulse" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
              {isStreamingVideo && <Eye className="w-4 h-4 text-cyan-400 animate-pulse" />}
              <span className="text-xs font-bold tracking-widest">
                {isConnecting ? 'CONNECTING...' : isConnected ? 'COMM LINK ACTIVE' : 'COMM LINK OFFLINE'}
              </span>
              {isPlaying && <Volume2 className="w-4 h-4 ml-2 text-cyan-400 animate-pulse" />}
            </button>
            <div className="text-[9px] uppercase tracking-widest text-zinc-600 mt-1">
              {error ? <span className="text-red-500">{error}</span> : 'A.N.I.T.A. Voice & Vision Channel'}
            </div>
          </div>

          <div className="text-right hidden md:block">
            <div className={`text-3xl font-bold ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Time to Core Failure</div>
          </div>
        </div>
      </header>

      {gameState === 'playing' && (
        <div className="bg-amber-950/50 border border-amber-500/50 p-4 rounded-lg flex items-center gap-4 z-10 relative">
          <AlertTriangle className="w-8 h-8 text-amber-500 animate-pulse" />
          <div>
            <h3 className="text-amber-400 font-bold tracking-widest">URGENT ACTION REQUIRED</h3>
            <p className="text-amber-200/80 text-sm">
              {!isConnected 
                ? "1. Click the COMM LINK button (top right) to connect to A.N.I.T.A." 
                : "2. Speak into your microphone: Ask A.N.I.T.A. for the repair sequence, then click the components she names."}
            </p>
          </div>
        </div>
      )}

      {/* MAIN DASHBOARD GRID */}
      <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 relative z-10 transition-opacity duration-1000 ${gameState !== 'playing' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        
        {/* LEFT COLUMN: POWER ROUTING */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <DashboardPanel title="POWER ROUTING" icon={<Zap className="w-4 h-4" />}>
            <div className="flex flex-col gap-3">
              <ToggleSwitch id="PWR-MAIN" label="MAIN REACTOR" active={componentStates['PWR-MAIN']} onPointerDown={() => handleComponentClick('PWR-MAIN')} isHighlighted={highlightedElement === 'PWR-MAIN'} isSuccess={successElement === 'PWR-MAIN'} />
              <ToggleSwitch id="PWR-AUX" label="AUXILIARY" active={componentStates['PWR-AUX']} onPointerDown={() => handleComponentClick('PWR-AUX')} isHighlighted={highlightedElement === 'PWR-AUX'} isSuccess={successElement === 'PWR-AUX'} />
              <ToggleSwitch id="PWR-LIFE" label="LIFE SUPPORT" active={componentStates['PWR-LIFE']} onPointerDown={() => handleComponentClick('PWR-LIFE')} isHighlighted={highlightedElement === 'PWR-LIFE'} isSuccess={successElement === 'PWR-LIFE'} />
              <ToggleSwitch id="PWR-SHLD" label="DEFLECTOR SHIELDS" active={componentStates['PWR-SHLD']} onPointerDown={() => handleComponentClick('PWR-SHLD')} isHighlighted={highlightedElement === 'PWR-SHLD'} isSuccess={successElement === 'PWR-SHLD'} />
            </div>
          </DashboardPanel>
          
          <DashboardPanel title="SYSTEM LOAD" icon={<Activity className="w-4 h-4" />} className="flex-1">
            <div className="flex items-end gap-2 h-full pt-4">
              {[40, 65, 90, 30, 85, 100, 50].map((val, i) => {
                // Randomize load if playing
                const load = gameState === 'playing' ? Math.min(100, val + (i % 3) * 10 - 5) : val;
                return (
                  <div key={i} className="flex-1 bg-zinc-900 relative h-full rounded-t-sm overflow-hidden">
                    <motion.div 
                      animate={{ height: `${load}%` }}
                      transition={{ duration: 0.5 }}
                      className={`absolute bottom-0 w-full ${load > 80 ? 'bg-red-500' : 'bg-cyan-500'}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-zinc-500">
              <span>CPU-1</span>
              <span>CPU-7</span>
            </div>
          </DashboardPanel>
        </div>

        {/* CENTER COLUMN: CORE VISUALIZATION & VALVES */}
        <div className="md:col-span-6 flex flex-col gap-4">
          <DashboardPanel title="REACTOR CORE" icon={<Cpu className="w-4 h-4" />} className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Core Graphic */}
            <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: gameState === 'playing' ? 5 : 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-dashed border-zinc-800 rounded-full"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: gameState === 'playing' ? 3 : 15, repeat: Infinity, ease: "linear" }}
                className={`absolute inset-4 border-2 border-dashed rounded-full ${gameState === 'playing' ? 'border-red-500' : 'border-cyan-900/50'}`}
              />
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: gameState === 'playing' ? 0.5 : 2, repeat: Infinity }}
                className={`w-24 h-24 md:w-32 md:h-32 rounded-full blur-xl absolute ${gameState === 'playing' ? 'bg-red-500/40' : 'bg-cyan-500/10'}`}
              />
              <div className={`w-16 h-16 md:w-24 md:h-24 bg-zinc-950 border-2 rounded-full flex items-center justify-center z-10 ${gameState === 'playing' ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'border-cyan-900'}`}>
                <AlertTriangle className={`w-8 h-8 ${gameState === 'playing' ? 'text-red-500 animate-pulse' : 'text-cyan-900'}`} />
              </div>
            </div>
            <div className="mt-8 text-center">
              <div className={`text-2xl font-bold ${gameState === 'playing' ? 'text-red-500' : 'text-cyan-500'}`}>
                {gameState === 'playing' ? 'CRITICAL TEMP' : 'NOMINAL'}
              </div>
              <div className="text-sm text-zinc-500">
                {gameState === 'playing' ? 'CORE INTEGRITY COMPROMISED' : 'ALL SYSTEMS STABLE'}
              </div>
            </div>

            {/* Subtitles Overlay */}
            <AnimatePresence>
              {aiSubtitle && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-4 left-4 right-4 bg-zinc-950/90 border border-cyan-500/50 p-4 rounded text-center backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)] z-50"
                >
                  <p className="text-cyan-300 font-mono text-sm tracking-wide">
                    <span className="font-bold text-cyan-400">A.N.I.T.A:</span> &quot;{aiSubtitle}&quot;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </DashboardPanel>

          <div className="grid grid-cols-3 gap-4">
            <ValveControl id="VLV-01" label="COOLANT A" value={componentStates['VLV-01']?.value || 50} status={componentStates['VLV-01']?.status || 'normal'} onPointerDown={() => handleComponentClick('VLV-01')} isHighlighted={highlightedElement === 'VLV-01'} isSuccess={successElement === 'VLV-01'} />
            <ValveControl id="VLV-02" label="COOLANT B" value={componentStates['VLV-02']?.value || 50} status={componentStates['VLV-02']?.status || 'normal'} onPointerDown={() => handleComponentClick('VLV-02')} isHighlighted={highlightedElement === 'VLV-02'} isSuccess={successElement === 'VLV-02'} />
            <ValveControl id="VLV-03" label="VENTING" value={componentStates['VLV-03']?.value || 50} status={componentStates['VLV-03']?.status || 'normal'} onPointerDown={() => handleComponentClick('VLV-03')} isHighlighted={highlightedElement === 'VLV-03'} isSuccess={successElement === 'VLV-03'} />
          </div>
        </div>

        {/* RIGHT COLUMN: OVERRIDES & PRESSURE */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <DashboardPanel title="PRESSURE GAUGES" icon={<Thermometer className="w-4 h-4" />}>
            <div className="flex flex-col gap-6">
              <PressureGauge id="PRS-ALPHA" label="ALPHA CHAMBER" value={gameState === 'playing' ? 92 : 45} />
              <PressureGauge id="PRS-BETA" label="BETA CHAMBER" value={gameState === 'playing' ? 88 : 30} />
              <PressureGauge id="PRS-GAMMA" label="GAMMA CHAMBER" value={gameState === 'playing' ? 95 : 50} />
            </div>
          </DashboardPanel>

          <DashboardPanel title="MANUAL OVERRIDES" icon={<ShieldAlert className="w-4 h-4" />} className={`flex-1 ${gameState === 'playing' ? 'border-red-900/50 bg-red-950/10' : ''}`}>
            <div className="flex flex-col gap-4 h-full justify-center">
              <OverrideButton id="OVR-A" label="EMERGENCY FLUSH" onPointerDown={() => handleComponentClick('OVR-A')} isHighlighted={highlightedElement === 'OVR-A'} isSuccess={successElement === 'OVR-A'} isBroken={componentStates['OVR-A']} />
              <OverrideButton id="OVR-B" label="SCRAM CORE" onPointerDown={() => handleComponentClick('OVR-B')} isHighlighted={highlightedElement === 'OVR-B'} isSuccess={successElement === 'OVR-B'} isBroken={componentStates['OVR-B']} />
              <OverrideButton id="OVR-C" label="EJECT PODS" onPointerDown={() => handleComponentClick('OVR-C')} isHighlighted={highlightedElement === 'OVR-C'} isSuccess={successElement === 'OVR-C'} isBroken={componentStates['OVR-C']} />
            </div>
          </DashboardPanel>
        </div>

      </div>
      
      {/* DEBUG INFO (Hidden in production, useful for testing) */}
      {process.env.NODE_ENV === 'development' && gameState === 'playing' && (
        <div className="absolute bottom-2 left-2 text-[10px] text-zinc-600 font-mono z-50">
          TARGET SEQUENCE: {targetSequence.join(' -> ')} (Current: {currentIndex})
        </div>
      )}
    </motion.main>
  );
}

// --- UI COMPONENTS ---

function DashboardPanel({ title, icon, children, className = "" }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <div className={`border border-zinc-800 bg-zinc-950/80 backdrop-blur p-4 rounded-lg flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-4 text-zinc-400 border-b border-zinc-800/50 pb-2">
        {icon}
        <span className="text-xs font-bold tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ id, label, active, onPointerDown, isHighlighted, isSuccess }: { id: string, label: string, active: boolean, onPointerDown?: () => void, isHighlighted?: boolean, isSuccess?: boolean }) {
  return (
    <div onPointerDown={onPointerDown} className={`flex items-center justify-between p-2 bg-zinc-900/50 border rounded transition-colors cursor-pointer group relative ${isHighlighted ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] z-20' : 'border-zinc-800 hover:border-zinc-700'}`}>
      {isSuccess && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm z-30 rounded"
        >
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </motion.div>
      )}
      {isHighlighted && (
        <motion.div 
          className="absolute -inset-1 border-2 border-amber-400 rounded-lg pointer-events-none"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      <div className="flex flex-col">
        <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">[{id}]</span>
        <span className="text-sm font-medium text-zinc-300">{label}</span>
      </div>
      <div className={`w-12 h-6 rounded-full p-1 transition-colors ${active ? 'bg-cyan-900' : 'bg-zinc-800'}`}>
        <motion.div 
          className={`w-4 h-4 rounded-full ${active ? 'bg-cyan-400' : 'bg-zinc-600'}`}
          animate={{ x: active ? 24 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
    </div>
  );
}

function ValveControl({ id, label, value, status, onPointerDown, isHighlighted, isSuccess }: { id: string, label: string, value: number, status: 'normal' | 'warning' | 'critical', onPointerDown?: () => void, isHighlighted?: boolean, isSuccess?: boolean }) {
  const colors = {
    normal: 'text-cyan-400 border-cyan-900/50',
    warning: 'text-amber-500 border-amber-900/50',
    critical: 'text-red-500 border-red-900/50 animate-pulse'
  };

  return (
    <div onPointerDown={onPointerDown} className={`border bg-zinc-900/50 rounded-lg p-3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors relative ${colors[status]} ${isHighlighted ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] z-20' : ''}`}>
      {isSuccess && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm z-30 rounded-lg"
        >
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </motion.div>
      )}
      {isHighlighted && (
        <motion.div 
          className="absolute -inset-1 border-2 border-amber-400 rounded-xl pointer-events-none"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      <span className="text-[10px] text-zinc-500">[{id}]</span>
      <Settings className={`w-8 h-8 ${status === 'critical' ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
      <div className="text-center">
        <div className="text-lg font-bold">{value}%</div>
        <div className="text-[9px] uppercase tracking-wider text-zinc-400">{label}</div>
      </div>
    </div>
  );
}

function PressureGauge({ id, label, value }: { id: string, label: string, value: number }) {
  const isHigh = value > 80;
  return (
    <div className="flex flex-col gap-1 cursor-pointer group">
      <div className="flex justify-between items-end">
        <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">[{id}] {label}</span>
        <span className={`text-xs font-bold ${isHigh ? 'text-red-500' : 'text-cyan-400'}`}>{value} PSI</span>
      </div>
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${isHigh ? 'bg-red-500' : 'bg-cyan-500'}`}
        />
      </div>
    </div>
  );
}

function OverrideButton({ id, label, onPointerDown, isHighlighted, isSuccess, isBroken }: { id: string, label: string, onPointerDown?: () => void, isHighlighted?: boolean, isSuccess?: boolean, isBroken?: boolean }) {
  return (
    <button onPointerDown={onPointerDown} className={`w-full py-3 px-4 bg-zinc-900 border-2 rounded text-left hover:bg-red-950/30 transition-all group flex items-center justify-between relative ${isHighlighted ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] z-20' : isBroken ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse' : 'border-zinc-800 hover:border-zinc-600'}`}>
      {isSuccess && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm z-30 rounded"
        >
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </motion.div>
      )}
      {isHighlighted && (
        <motion.div 
          className="absolute -inset-1 border-2 border-amber-400 rounded-lg pointer-events-none"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      <div className="flex flex-col">
        <span className={`text-[10px] transition-colors ${isBroken ? 'text-red-400' : 'text-zinc-500 group-hover:text-zinc-400'}`}>[{id}]</span>
        <span className={`text-sm font-bold transition-colors ${isBroken ? 'text-red-100' : 'text-zinc-300 group-hover:text-zinc-100'}`}>{label}</span>
      </div>
      <Power className={`w-5 h-5 transition-colors ${isBroken ? 'text-red-500' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
    </button>
  );
}
