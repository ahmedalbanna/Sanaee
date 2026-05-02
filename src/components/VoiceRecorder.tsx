import { useState, useRef } from 'react';
import { Mic, Square, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  label?: string;
  variant?: 'default' | 'minimal' | 'huge';
}

export default function VoiceRecorder({ 
  onRecordingComplete, 
  maxDuration = 30, 
  label = "سجل صوتك",
  variant = 'default' 
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = window.setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  const confirmRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-4 w-full ${variant === 'huge' ? '' : 'bg-white p-6 rounded-3xl shadow-sm border-2 border-primary/10 max-w-md mx-auto'}`}>
      {variant !== 'huge' && label && <h3 className="text-xl font-bold mb-2 text-center text-primary">{label}</h3>}
      
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="relative">
          <AnimatePresence mode="wait">
            {!audioUrl ? (
              <motion.button
                key="mic"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={isRecording ? stopRecording : startRecording}
                className={`rounded-full flex items-center justify-center transition-all ${
                  variant === 'huge' ? 'w-48 h-48 sm:w-64 sm:h-64' : 'w-24 h-24'
                } ${
                  isRecording ? 'bg-red-500 scale-110 voice-record-pulse' : 'bg-primary hover:bg-primary/90 shadow-xl'
                }`}
              >
                {isRecording ? (
                  <Square className={`${variant === 'huge' ? 'w-16 h-16' : 'w-8 h-8'} text-white fill-white`} />
                ) : (
                  <Mic className={`${variant === 'huge' ? 'w-24 h-24' : 'w-10 h-10'} text-white`} />
                )}
              </motion.button>
            ) : (
              <motion.div
                key="player"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col sm:flex-row items-center gap-4 bg-sand p-4 rounded-[2rem]"
              >
                <div className="flex items-center gap-2">
                  <button 
                    onClick={resetRecording}
                    className="p-3 bg-white text-red-600 rounded-full hover:bg-red-50 shadow-sm transition-colors"
                  >
                    <Trash2 size={24} />
                  </button>
                  <audio src={audioUrl} controls className="h-10 rounded-full" />
                </div>
                <button 
                  onClick={confirmRecording}
                  className="w-full sm:w-auto p-4 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2 font-bold"
                >
                  <CheckCircle size={24} />
                  إرسال الآن
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center">
          <span className={`font-mono ${variant === 'huge' ? 'text-4xl' : 'text-2xl'} ${isRecording ? 'text-red-500 animate-pulse' : 'text-secondary'}`}>
            00:{duration.toString().padStart(2, '0')}
          </span>
          {variant !== 'huge' && <span className="text-xs text-secondary/60 mt-1">الحد الأقصى {maxDuration} ثانية</span>}
          {variant === 'huge' && !isRecording && !audioUrl && (
            <p className="mt-4 text-xl font-black text-secondary text-center">اضغط وسجل طلبك بصوتك</p>
          )}
        </div>
      </div>
    </div>
  );
}
