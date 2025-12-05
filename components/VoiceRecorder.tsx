
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  
  // Refs for State Control (Refs are instant, unlike state)
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef<boolean>(false); // 标记：是否处于15秒的录音窗口期
  const manuallyStoppedRef = useRef<boolean>(false); // 标记：是否是用户手动点击停止
  
  // Refs for Text Management
  const accumulatedTextRef = useRef<string>(''); // 存储之前片段已经确定的文字
  const currentChunkTextRef = useRef<string>(''); // 存储当前正在录制的片段文字
  
  // Refs for Timers
  const timerIntervalRef = useRef<any>(null);
  const maxDurationTimeoutRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("您的手机浏览器不支持语音识别功能，请尝试更新 Chrome 或 WebView。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // allow continuous speech
    recognition.interimResults = true; // show results as they come
    recognition.lang = 'zh-CN';

    // --- Event Handlers ---

    recognition.onstart = () => {
      // Clear error when successfully started
      if (isSessionActiveRef.current) {
        setError(null);
      }
    };

    recognition.onresult = (event: any) => {
      let finalStr = '';
      
      // We iterate through results to find the final text
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
            // Interim logic can be added here if needed for UI feedback
        }
      }

      // If continuous is true, the API might keep appending. 
      // To be safe against duplicates across restarts, we just grab the *entire* transcript of this session chunk.
      let fullChunkTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullChunkTranscript += event.results[i][0].transcript;
      }
      
      currentChunkTextRef.current = fullChunkTranscript;
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech Error:", event.error);
      
      // Ignore 'no-speech' (silence) as onend will handle the restart
      if (event.error === 'no-speech') return;

      // Handle fatal errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopLogic();
        setError("麦克风权限被拒绝，请在设置中允许。");
      } 
      // For network errors during active session, we basically ignore them and let onend restart it
    };

    recognition.onend = () => {
      // CRITICAL LOGIC: Auto-Restart
      // If the session is still active (time not up, user didn't click stop), we restart!
      
      if (isSessionActiveRef.current && !manuallyStoppedRef.current) {
        console.log("Browser stopped recording (silence/network). Auto-restarting...");
        
        // 1. Commit the text from the chunk that just ended
        accumulatedTextRef.current += currentChunkTextRef.current;
        currentChunkTextRef.current = ''; // Reset chunk buffer
        
        // 2. Restart immediately (with a tiny buffer to prevent browser choke)
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        
        restartTimeoutRef.current = setTimeout(() => {
            if (isSessionActiveRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Restart failed", e);
                }
            }
        }, 100); 

      } else {
        // Real Stop (Time up or User clicked stop)
        finalizeSession();
      }
    };

    recognitionRef.current = recognition;

    return () => {
       stopLogic();
    };
  }, [onTranscript]);

  // --- Logic Helpers ---

  const startLogic = () => {
    if (!recognitionRef.current) return;

    try {
        // Reset State
        setIsListening(true);
        setError(null);
        setTimeLeft(15);
        
        // Reset Refs
        isSessionActiveRef.current = true;
        manuallyStoppedRef.current = false;
        accumulatedTextRef.current = '';
        currentChunkTextRef.current = '';

        // Start Recognition
        recognitionRef.current.start();

        // Start 15s Countdown (Visual)
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);

        // Start 15s Hard Stop
        if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
        maxDurationTimeoutRef.current = setTimeout(() => {
            // Time is up!
            handleStopClick(); 
        }, 15000);

    } catch (e) {
        console.error("Start failed:", e);
        setError("无法启动录音，请刷新页面重试");
        setIsListening(false);
    }
  };

  const stopLogic = () => {
    // Cleanup timers
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    isSessionActiveRef.current = false;
    
    // Stop engine
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }
  };

  const finalizeSession = () => {
    setIsListening(false);
    
    // Combine committed text + any text from the very last chunk
    const totalText = accumulatedTextRef.current + currentChunkTextRef.current;
    const cleanText = totalText.trim();

    if (cleanText) {
        onTranscript(cleanText);
    } else {
        // Optional: show error if nothing was said
        // setError("未检测到有效语音");
    }
  };

  const handleToggleClick = useCallback(() => {
    if (isProcessing) return;

    if (isListening) {
      handleStopClick();
    } else {
      startLogic();
    }
  }, [isListening, isProcessing]);

  const handleStopClick = () => {
      manuallyStoppedRef.current = true; // Mark as manual stop so onend doesn't restart
      stopLogic(); // This triggers onend, which sees manuallyStoppedRef=true and calls finalizeSession
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      
      {/* Button Container - Enlarge Scale effect */}
      <div className={`relative flex items-center justify-center transition-all duration-300 ${isListening ? 'scale-105' : 'scale-100'}`}>
        {isListening && (
          <>
            <div className="absolute w-40 h-40 rounded-full animate-ping opacity-75 bg-red-100"></div>
            <div className="absolute w-36 h-36 rounded-full animate-pulse opacity-50 bg-red-200"></div>
            
            {/* Circular Progress Timer */}
            <svg className="absolute w-36 h-36 -rotate-90 pointer-events-none">
                <circle
                    cx="72"
                    cy="72"
                    r="70"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="4"
                />
                <circle
                    cx="72"
                    cy="72"
                    r="70"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="4"
                    strokeDasharray="440"
                    strokeDashoffset={440 - (440 * timeLeft) / 15}
                    className="transition-all duration-1000 ease-linear"
                />
            </svg>
          </>
        )}
        
        {/* Main Button */}
        <button
          onClick={handleToggleClick}
          disabled={isProcessing}
          className={`relative z-10 flex items-center justify-center w-32 h-32 rounded-full transition-all shadow-xl active:scale-95
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-primary hover:bg-teal-700'}
            text-white
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isProcessing ? (
            <Loader2 className="w-12 h-12 animate-spin" />
          ) : isListening ? (
            <div className="flex flex-col items-center">
                <Square className="w-10 h-10 fill-current mb-1" />
                <span className="text-xs font-bold">{timeLeft}s</span>
            </div>
          ) : (
            <Mic className="w-14 h-14" />
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="font-bold text-2xl text-gray-800">
          {isProcessing ? "AI 思考中..." : isListening ? "正在听..." : "点击说话"}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          {isListening ? "即使停止说话，录音也会持续15秒" : "在线语音引擎准备就绪"}
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm max-w-[280px] text-left border border-red-100">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
