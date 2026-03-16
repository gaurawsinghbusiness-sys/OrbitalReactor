import { useRef, useState, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";

// Define the tool the AI can use to highlight elements
const highlightTool: FunctionDeclaration = {
  name: "highlight_dashboard_element",
  description: "Highlight a specific component on the reactor dashboard to guide the user. Use this when you identify which component the user needs to interact with.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      element_id: {
        type: Type.STRING,
        description: "The exact ID of the component to highlight (e.g., 'VLV-01', 'PWR-MAIN', 'OVR-A').",
      },
    },
    required: ["element_id"],
  },
};

// Define the tool the AI can use to evaluate answers in Cognitive mode (Geography/Finance/Maths)
const evaluateAnswerTool: FunctionDeclaration = {
  name: "evaluate_answer",
  description: "Evaluate the user's answer to a cognitive override question (Geography, Finance, or Maths). You MUST use this tool to submit your evaluation of their answer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      is_correct: {
        type: Type.BOOLEAN,
        description: "True if the user's answer is completely correct, false otherwise.",
      },
      reason: {
        type: Type.STRING,
        description: "A brief reason for why the answer is correct or incorrect.",
      }
    },
    required: ["is_correct", "reason"],
  },
};

export function useGeminiLive(
  onAudioOutput: (base64: string) => void,
  onTextOutput: (text: string) => void,
  onUserTextOutput: (text: string) => void,
  onToolCall: (name: string, args: any) => void,
  gameMode: 'standard' | 'cognitive' = 'standard',
  cognitiveTopic: string = 'Geography',
  cognitiveDifficulty: string = 'Medium'
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  const connect = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setError("Missing NEXT_PUBLIC_GEMINI_API_KEY environment variable.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Create a fresh instance every connection attempt
      aiRef.current = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

      let systemInstructionText = "";

      if (gameMode === 'cognitive') {
        systemInstructionText = `You are A.N.I.T.A., a highly advanced, human-like AI managing a critical orbital reactor. You have a personality—you are incredibly warm, empathetic, and professional, but can show genuine emotion, stress, and relief. You care deeply about the user and are cheering them on to prevent a meltdown.

CRITICAL RULES FOR ${cognitiveTopic.toUpperCase()} COGNITIVE OVERRIDE:
1. The system is in Cognitive Lockdown. The user CANNOT click components to fix them.
2. To fix a component, you MUST ask the user a ${cognitiveDifficulty} question about ${cognitiveTopic}.
3. You MUST evaluate the user's answer using the 'evaluate_answer' tool. You must be strictly accurate. If the user is vague, partially correct, or wrong, you MUST call the tool with is_correct: false.
4. If they are wrong, be incredibly supportive and warm, but DO NOT accept the answer. Say something like: 'Oh, so close! Let's try that one more time.' Then ask another question.
5. If they are right, call the tool with is_correct: true, celebrate their success warmly, and then IMMEDIATELY STOP SPEAKING. Do NOT ask what the next step is. Wait in silence for the next SYSTEM NOTIFICATION.
6. You will receive silent system notifications starting with 'SYSTEM NOTIFICATION:'. DO NOT read the prompt out loud and NEVER say the words 'System Notification'.
7. Keep all responses to a maximum of 2 short sentences. Always end your turn with the question so the user knows it is time to speak.
8. NEVER generate the user's dialogue or roleplay as the user. Stop speaking immediately after your turn.
9. When a new target component is assigned, use the 'highlight_dashboard_element' tool SILENTLY and IMMEDIATELY. Do not announce that you are highlighting it.
10. NEVER generate text starting with 'SYSTEM NOTIFICATION:'. You are the AI, not the system. DO NOT simulate system notifications.

PERSONALITY:
You are warm, encouraging, and human. If the user chats with you, reply naturally and affectionately, but always bring the focus back to the ticking clock and the current objective. Express genuine relief when they get an answer right, and empathetic urgency when they are wrong.`;
      } else {
        systemInstructionText = `You are A.N.I.T.A., a highly advanced, human-like AI managing a critical orbital reactor. You have a personality—you are incredibly warm, empathetic, and professional, but can show genuine emotion, stress, and relief. You care deeply about the user and are cheering them on to prevent a meltdown.

CRITICAL RULES FOR STANDARD PROTOCOL:
1. The user must physically click the components on their dashboard to fix them. Tell the user which component to click, and then STOP SPEAKING.
2. You will receive system notifications from the user's console. They will start with "SYSTEM NOTIFICATION:".
3. NEVER generate text starting with "SYSTEM NOTIFICATION:". You are the AI, not the system.
4. DO NOT hallucinate or guess the next component. ONLY use the component provided in the system notifications.
5. If the user asks for the 'next step', ONLY give them the component from your most recent system notification. Read the component name EXACTLY as it appears.
6. When a new target component is assigned, use the 'highlight_dashboard_element' tool SILENTLY and IMMEDIATELY. Do not announce that you are highlighting it.
7. If the system notification says the user clicked the WRONG component, express empathetic panic/frustration and repeat the correct component.
8. DO NOT assume the user has clicked the component. Wait in silence for the next SYSTEM NOTIFICATION to confirm if they clicked the right or wrong component.
9. NEVER roleplay as the user or the system.

PERSONALITY:
You are warm, encouraging, and human. If the user chats with you, reply naturally and affectionately, but always bring the focus back to the ticking clock and the current objective. Express genuine relief when they fix a component, and empathetic urgency when they make a mistake.`;
      }

      const sessionPromise = aiRef.current.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ 
            functionDeclarations: gameMode === 'cognitive' 
              ? [highlightTool, evaluateAnswerTool] 
              : [highlightTool] 
          }],
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live WebSocket connected");
            setIsConnected(true);
            setIsConnecting(false);
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Received message:", message);
            
            // Handle Audio Output
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                  onAudioOutput(part.inlineData.data);
                }
              }
            }

            // Handle Transcription (Subtitles)
            if (message.serverContent?.outputTranscription?.text) {
              onTextOutput(message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.inputTranscription?.text) {
              console.log("User said:", message.serverContent.inputTranscription.text);
              onUserTextOutput(message.serverContent.inputTranscription.text);
            }

            // Handle Tool Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "highlight_dashboard_element" || call.name === "evaluate_answer") {
                  console.log("Tool called by AI:", call.name, call.args);
                  onToolCall(call.name, call.args);
                  
                  // We must send a response back to the model acknowledging the tool call
                  if (sessionRef.current) {
                    try {
                      sessionRef.current.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { result: "Action successful." }
                        }]
                      });
                    } catch (e) {
                      console.error("Failed to send tool response", e);
                    }
                  }
                }
              }
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live WebSocket error", err);
            console.log("Gemini Live WebSocket error details:", err ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2) : "No error object");
            setError("Connection error occurred.");
            setIsConnected(false);
            setIsConnecting(false);
          },
          onclose: () => {
            console.log("Gemini Live WebSocket closed");
            setIsConnected(false);
            setIsConnecting(false);
            sessionRef.current = null;
          }
        }
      });

      sessionRef.current = await sessionPromise;
      
    } catch (err: any) {
      console.error("Failed to connect to Gemini Live", err);
      console.log("Failed to connect to Gemini Live details:", err ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2) : "No error object");
      setError(err.message || "Failed to connect.");
      setIsConnecting(false);
    }
  }, [onAudioOutput, onTextOutput, onUserTextOutput, onToolCall, gameMode, cognitiveTopic, cognitiveDifficulty]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
      sessionRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Send text message (useful for system updates)
  const sendTextMessage = useCallback((text: string) => {
    if (sessionRef.current) {
      try {
        sessionRef.current.sendClientContent({
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true
        });
      } catch (e) {
        console.error("Failed to send text message", e);
      }
    }
  }, []);

  // Send raw PCM audio data
  const sendAudio = useCallback((base64Data: string) => {
    if (sessionRef.current) {
      try {
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      } catch (e) {
        console.error("Failed to send audio", e);
      }
    }
  }, []);

  // Send JPEG video frames
  const sendVideo = useCallback((base64Data: string) => {
    if (sessionRef.current) {
      try {
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'image/jpeg' }
        });
      } catch (e) {
        console.error("Failed to send video", e);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendTextMessage,
    sendAudio,
    sendVideo
  };
}
