import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Save, Info } from 'lucide-react';
import CraftSelector from '../components/CraftSelector';
import VoiceRecorder from '../components/VoiceRecorder';
import { saveWorkerProfile, uploadAudio } from '../services/firebaseService';

interface WorkerRegistrationProps {
  onComplete: () => void;
  onBack: () => void;
}

export default function WorkerRegistration({ onComplete, onBack }: WorkerRegistrationProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    craftId: '',
    dailyRate: 5000,
    voiceProfileUrl: '',
    location: { city: 'صنعاء', district: '' }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVoiceComplete = async (blob: Blob) => {
    try {
      setIsSubmitting(true);
      const url = await uploadAudio(blob, 'worker_profiles');
      setFormData(prev => ({ ...prev, voiceProfileUrl: url }));
      setStep(3);
    } catch (error) {
      console.error(error);
      alert("فشل رفع الملف الصوتي، حاول مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.craftId || !formData.voiceProfileUrl) {
      alert("يرجى إكمال جميع البيانات");
      return;
    }
    
    try {
      setIsSubmitting(true);
      await saveWorkerProfile(formData);
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <button onClick={onBack} className="flex items-center gap-2 text-secondary/60 hover:text-primary mb-8 transition-colors">
        <ArrowRight className="rotate-0" />
        <span>رجوع</span>
      </button>

      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-primary/10">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-4xl font-black text-secondary">سجل كصنايعي ماهر</h2>
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full ${i === step ? 'bg-primary' : 'bg-primary/20'}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h3 className="text-xl font-bold mb-6 text-primary flex items-center gap-2">
              <Info size={20} />
              شو مهنتك؟
            </h3>
            <CraftSelector 
              selectedId={formData.craftId} 
              onSelect={(id) => {
                setFormData(prev => ({ ...prev, craftId: id }));
                setStep(2);
              }} 
            />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h3 className="text-xl font-bold mb-6 text-primary">بطاقتك التعريفية بصوتك</h3>
            <p className="text-secondary/60 mb-8">سجل مقطع بسيط عرف فيه عن نفسك وخبرتك (بأقل من 30 ثانية).</p>
            <VoiceRecorder onRecordingComplete={handleVoiceComplete} label="سجل تعريفك المهني" />
            {isSubmitting && <p className="text-center mt-4 text-primary animate-pulse font-bold">جاري الرفع...</p>}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h3 className="text-xl font-bold mb-6 text-primary">باقي شوية ونخلص!</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">اسمك الكامل</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-sand p-4 rounded-2xl border-2 border-transparent focus:border-primary outline-none transition-all"
                  placeholder="محمد أحمد اليماني"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">رقم الهاتف</label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-sand p-4 rounded-2xl border-2 border-transparent focus:border-primary outline-none transition-all"
                  placeholder="777 XXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">الأجرة اليومية التقريبية (ريال يمني)</label>
                <input 
                  type="number" 
                  value={formData.dailyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyRate: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-sand p-4 rounded-2xl border-2 border-transparent focus:border-primary outline-none transition-all"
                />
              </div>
              
              <button 
                onClick={handleSave}
                disabled={isSubmitting}
                className="w-full bg-primary text-white p-5 rounded-2xl font-black text-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Save />
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ البطاقة وبدء العمل'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
