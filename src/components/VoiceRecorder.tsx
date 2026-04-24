import { useState, useRef } from 'react';
import { Mic, Square, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  label?: string;
}

export default function VoiceRecorder({ onRecordingComplete, maxDuration = 30, label = "سجل صوتك" }: VoiceRecorderProps) {
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
    <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-primary/10 w-full max-w-md mx-auto">
      <h3 className="text-xl font-bold mb-4 text-center text-primary">{label}</h3>
      
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <AnimatePresence mode="wait">
            {!audioUrl ? (
              <motion.button
                key="mic"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isRecording ? 'bg-red-500 scale-110 voice-record-pulse' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isRecording ? <Square className="text-white fill-white" /> : <Mic className="text-white w-10 h-10" />}
              </motion.button>
            ) : (
              <motion.div
                key="player"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-4"
              >
                <button 
                  onClick={resetRecording}
                  className="p-3 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                >
                  <Trash2 size={24} />
                </button>
                <audio src={audioUrl} controls className="h-10 rounded-full bg-sand" />
                <button 
                  onClick={confirmRecording}
                  className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg transition-transform hover:scale-110"
                >
                  <CheckCircle size={24} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center">
          <span className={`text-2xl font-mono ${isRecording ? 'text-red-500 animate-pulse' : 'text-secondary'}`}>
            00:{duration.toString().padStart(2, '0')}
          </span>
          <span className="text-xs text-secondary/60 mt-1">الحد الأقصى {maxDuration} ثانية</span>
        </div>
      </div>
    </div>
  );
}
