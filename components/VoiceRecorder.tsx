import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle, WifiOff, Download } from 'lucide-react';
import { loadLocalModel, transcribeAudioLocally } from '../services/localAiService';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [modelLoadingProgress, setModelLoadingProgress] = useState<number | null>(null);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Native Recognition (for Online)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn("Native speech error:", event.error);
        setIsListening(false);
        
        if (event.error === 'network') {
          setIsOfflineMode(true); // Switch to offline mode automatically on network error
          setError("网络不稳定，已切换至离线模式。请重试。");
        } else if (event.error === 'not-allowed') {
          setError("请允许麦克风权限。");
        } else if (event.error !== 'no-speech') {
          setError("识别出错，请重试或手动输入。");
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
      };

      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const startLocalRecording = async () => {
    try {
      // 1. Ensure Model is Loaded
      setError(null);
      await loadLocalModel((progress) => {
        setModelLoadingProgress(Math.round(progress));
      });
      setModelLoadingProgress(null);

      // 2. Start MediaRecorder
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Transcribe
        try {
            // Note: Parent component handles 'isProcessing' state, but we trigger it implicitly via onTranscript? 
            // Actually usually onTranscript is called with string. 
            // We need to show processing state inside component or let parent handle.
            // But 'transcribeAudioLocally' is async.
            // We'll call onTranscript with a placeholder or handle it.
            // Let's modify behavior: pass result to onTranscript.
            
            // We can't set parent processing state easily if not exposed, 
            // but the parent sets isProcessing=true usually when onTranscript is called?
            // Wait, for online, onTranscript is called with final text.
            // For offline, we need to do the work first.
            const text = await transcribeAudioLocally(blob);
            if (text.trim()) {
                onTranscript(text);
            } else {
                setError("未检测到语音");
            }
        } catch (err) {
            console.error(err);
            setError("本地识别失败");
        }
        
        // Stop tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      mediaRecorderRef.current = mediaRecorder;

    } catch (err: any) {
      console.error("Local recording error:", err);
      setModelLoadingProgress(null);
      if (err.name === 'NotAllowedError') setError("麦克风权限被拒绝");
      else setError("无法启动离线录音");
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleRecording = useCallback(() => {
    if (isProcessing) return;

    if (isListening) {
      if (isOfflineMode) {
        stopLocalRecording();
      } else {
        recognitionRef.current?.stop();
      }
    } else {
      if (isOfflineMode) {
        startLocalRecording();
      } else {
        // Try online first
        try {
          recognitionRef.current?.start();
        } catch (e) {
          // If start fails (e.g. already started or other issue), fallback
          startLocalRecording();
        }
      }
    }
  }, [isListening, isOfflineMode, isProcessing]);

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-white rounded-xl shadow-sm border border-gray-100">
      
      {/* Offline Indicator */}
      {isOfflineMode && (
        <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium mb-2">
          <WifiOff className="w-3 h-3" />
          <span>离线模式 (本地AI)</span>
        </div>
      )}

      {/* Model Loading Progress */}
      {modelLoadingProgress !== null && (
        <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center rounded-xl">
           <Download className="w-8 h-8 text-primary animate-bounce mb-2" />
           <p className="text-primary font-bold">下载离线模型中...</p>
           <p className="text-gray-500 text-sm">{modelLoadingProgress}%</p>
           <div className="w-48 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${modelLoadingProgress}%` }}></div>
           </div>
        </div>
      )}

      <div className={`relative flex items-center justify-center transition-all duration-300 ${isListening ? 'scale-110' : 'scale-100'}`}>
        {isListening && (
          <>
            <div className={`absolute w-20 h-20 rounded-full animate-ping opacity-75 ${isOfflineMode ? 'bg-amber-100' : 'bg-red-100'}`}></div>
            <div className={`absolute w-16 h-16 rounded-full animate-pulse opacity-50 ${isOfflineMode ? 'bg-amber-200' : 'bg-red-200'}`}></div>
          </>
        )}
        
        <button
          onClick={toggleRecording}
          disabled={isProcessing || modelLoadingProgress !== null}
          className={`relative z-10 flex items-center justify-center w-16 h-16 rounded-full transition-colors shadow-lg
            ${isListening 
              ? (isOfflineMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600') 
              : 'bg-primary hover:bg-teal-800'}
            text-white
            ${(isProcessing || modelLoadingProgress !== null) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : isListening ? (
            <Square className="w-6 h-6 fill-current" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="font-medium text-lg text-gray-800">
          {isProcessing ? "处理中..." : isListening ? "正在听..." : "点击说话"}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {isListening ? "请说出商品名称和数量" : isOfflineMode ? "离线语音准备就绪" : "在线语音准备就绪"}
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm max-w-[280px] text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
