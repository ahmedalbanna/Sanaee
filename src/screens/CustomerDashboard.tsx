import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Disc, MapPin, Clock, Hammer, X } from 'lucide-react';
import VoiceRecorder from '../components/VoiceRecorder';
import CraftSelector from '../components/CraftSelector';
import { createJobRequest, uploadAudio, subscribeToJobs } from '../services/firebaseService';

export default function CustomerDashboard() {
  const [showPostModal, setShowPostModal] = useState(false);
  const [jobs, setJobs] = useState<unknown[]>([]);
  const [postData, setPostData] = useState({
    craftId: '',
    voiceUrl: '',
    urgency: 'normal'
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeToJobs((newJobs) => {
      setJobs(newJobs);
    });
    return () => unsub();
  }, []);

  const handlePost = async (blob: Blob) => {
    try {
      setLoading(true);
      const url = await uploadAudio(blob, 'job_requests');
      await createJobRequest({
        ...postData,
        voiceRequestUrl: url
      });
      setShowPostModal(false);
      setStep(1);
    } catch (error) {
      console.error(error);
      alert("فشل نشر الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-black text-secondary">طلباتك</h2>
          <p className="text-secondary/60">اطلب الحرفي اللي تحتاجه بصوتك الآن</p>
        </div>
        <button 
          onClick={() => setShowPostModal(true)}
          className="bg-primary text-white p-4 rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Plus size={32} />
          <span className="font-black text-xl ml-2">طلب جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {jobs.length === 0 ? (
            <div className="col-span-full text-center py-24 opacity-30">
              <Disc size={64} className="mx-auto mb-4 animate-spin-slow" />
              <p className="text-xl font-bold">لا توجد طلبات مفتوحة حالياً</p>
            </div>
          ) : (
            jobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-[2.5rem] border border-primary/10 shadow-sm"
              >
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Hammer size={20} />
                    <span>{job.craftId}</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-secondary/10 text-secondary'
                  }`}>
                    {job.status === 'open' ? 'مفتوح' : job.status}
                  </div>
                </div>
                
                <div className="bg-sand p-4 rounded-2xl mb-4">
                  <audio src={job.voiceRequestUrl} controls className="w-full h-8" />
                </div>

                <div className="flex items-center gap-4 text-xs text-secondary/60">
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    <span>منطقتك</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>منذ قليل</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Post Modal */}
      <AnimatePresence>
        {showPostModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPostModal(false)}
              className="absolute inset-0 bg-secondary/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-sand w-full max-w-2xl rounded-[3rem] p-8 md:p-12 relative z-10 shadow-2xl"
            >
              <button 
                onClick={() => setShowPostModal(false)}
                className="absolute left-8 top-8 p-2 bg-white rounded-full text-secondary/40 hover:text-red-500 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-12">
                <h3 className="text-3xl font-black text-secondary">اطلب صنايعي</h3>
                <p className="text-secondary/60">أخبرنا بما تحتاجه لنرسله للمهرة في منطقتك</p>
              </div>

              {step === 1 && (
                <div className="space-y-8">
                  <h4 className="text-xl font-bold text-primary">1. وش اللي تحتاجه؟</h4>
                  <CraftSelector 
                    selectedId={postData.craftId} 
                    onSelect={(id) => {
                      setPostData(prev => ({ ...prev, craftId: id }));
                      setStep(2);
                    }} 
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <h4 className="text-xl font-bold text-primary">2. سجل صرختك (طلبك بصوتك)</h4>
                  <p className="text-secondary/60">اشرح المشكلة باختصار، مثلاً: "عندي حنفية مكسورة في المطبخ تسرّب ماء، محتاج سباك الآن"</p>
                  <VoiceRecorder onRecordingComplete={handlePost} label="سجل تفاصيل الطلب" />
                  {loading && <p className="text-center text-primary font-black animate-pulse">جاري إرسال صرختك للعالم...</p>}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
