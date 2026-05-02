import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc, Hammer, Star } from 'lucide-react';
import VoiceRecorder from '../components/VoiceRecorder';
import CraftSelector from '../components/CraftSelector';
import { createJobRequest, uploadAudio, subscribeToJobsAll, assignWorkerToJob, Job } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function CustomerDashboard() {
  const [view, setView] = useState<'request' | 'list'>('request');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCraft, setSelectedCraft] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToJobsAll((allJobs) => {
      const myJobs = allJobs.filter(j => j.customerId === auth.currentUser?.uid);
      setJobs(myJobs);
    });
    return () => unsub();
  }, []);

  const handlePost = async (blob: Blob) => {
    if (!selectedCraft) {
      toast.error("فضلاً اختر التخصص أولاً");
      return;
    }
    try {
      setLoading(true);
      const url = await uploadAudio(blob);
      await createJobRequest({
        craftId: selectedCraft,
        voiceRequestUrl: url,
        urgency: 'normal'
      });
      toast.success("تم إرسال طلبك بنجاح! انتظر ردود الحرفيين");
      setSelectedCraft(null);
      setView('list');
    } catch (error) {
      console.error(error);
      toast.error("فشل إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  const promoteJob = async (jobId: string, craftId: string) => {
    try {
      const resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, craftId })
      });
      const data = await resp.json();
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      toast.error('حدث خطأ أثناء الاتصال بالدفع');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col p-4 md:p-8">
      {/* Navigation Tabs */}
      <div className="flex bg-white/50 backdrop-blur-md p-2 rounded-full self-center mb-8 border border-primary/10 shadow-sm">
        <button 
          onClick={() => setView('request')}
          className={`px-8 py-3 rounded-full font-black text-xl transition-all ${view === 'request' ? 'bg-primary text-white shadow-lg scale-105' : 'text-secondary/50'}`}
        >
          طلب جديد
        </button>
        <button 
          onClick={() => setView('list')}
          className={`px-8 py-3 rounded-full font-black text-xl transition-all flex items-center gap-2 ${view === 'list' ? 'bg-primary text-white shadow-lg scale-105' : 'text-secondary/50'}`}
        >
          طلباتي الحالية
          {jobs.filter(j => j.status !== 'completed').length > 0 && (
            <span className="bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center animate-pulse">
              {jobs.filter(j => j.status !== 'completed').length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'request' ? (
          <motion.div 
            key="request-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center gap-12 max-w-4xl mx-auto w-full"
          >
            <div className="text-center">
              <h2 className="text-4xl md:text-6xl font-black text-secondary mb-4">ايش اللي تحتاجه؟</h2>
              <p className="text-xl text-secondary/60">اختر المهنة ثم اضغط وسجل طلبك بصوتك</p>
            </div>

            <CraftSelector selectedId={selectedCraft || undefined} onSelect={setSelectedCraft} />

            <div className={`transition-all duration-500 transform ${selectedCraft ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-20 pointer-events-none translate-y-10'}`}>
              <VoiceRecorder 
                variant="huge" 
                onRecordingComplete={handlePost} 
                label="سجل طلبك الآن" 
              />
            </div>
            
            {loading && (
              <div className="fixed inset-0 bg-secondary/20 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-2xl font-black text-primary">جاري إرسال صرختك للمهرة...</p>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="list-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 w-full max-w-5xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {jobs.length === 0 ? (
                <div className="col-span-full py-24 text-center opacity-30">
                  <Disc size={120} className="mx-auto mb-8 animate-spin-slow" />
                  <p className="text-3xl font-black">ما عندك أي طلبات حالياً</p>
                </div>
              ) : (
                jobs.map((job) => (
                  <motion.div 
                    key={job.id}
                    layout
                    className="bg-white rounded-[3rem] p-8 border border-primary/10 shadow-xl flex flex-col relative"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-sand rounded-2xl flex items-center justify-center text-primary">
                          <Hammer size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-2xl text-secondary">{job.craftId}</h3>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {job.status === 'open' ? 'بانتظار الحرفيين' : 'تم اختيار معلم'}
                          </span>
                        </div>
                      </div>
                      
                      {!job.isPremium && job.status === 'open' && (
                        <button 
                          onClick={() => promoteJob(job.id!, job.craftId!)}
                          className="bg-gold/10 text-gold text-sm font-black py-3 px-6 rounded-full hover:bg-gold hover:text-white transition-all flex items-center gap-2 border border-gold/20"
                        >
                          <Star size={18} fill="currentColor" />
                          الطلب المميز (500 ريال)
                        </button>
                      )}
                    </div>

                    <div className="bg-sand p-6 rounded-3xl mb-8 border border-primary/5">
                      <p className="font-bold text-secondary/60 mb-2">طلبك الصوتي:</p>
                      <audio src={job.voiceRequestUrl} controls className="w-full" />
                    </div>

                    {/* Bids Section */}
                    <div className="space-y-4">
                      <h4 className="font-black text-xl text-primary flex items-center gap-2">
                        <Disc size={20} className={job.bids?.length ? 'animate-spin-slow' : ''} />
                        رُدود الحرفيين المتاحة ({job.bids?.length || 0})
                      </h4>
                      
                      {(!job.bids || job.bids.length === 0) ? (
                        <p className="text-secondary/40 font-bold p-4 bg-sand/50 rounded-2xl text-center italic">
                          جاري البحث عن أفضل الحرفيين حولك...
                        </p>
                      ) : (
                        <div className="grid gap-4">
                          {job.bids.map((bid, idx) => (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="bg-white border-2 border-primary/10 p-5 rounded-[2.5rem] flex flex-col sm:flex-row items-center gap-6 hover:border-primary transition-colors"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl">
                                  👨‍🔧
                                </div>
                                <div className="flex items-center gap-1 text-gold">
                                  <span className="font-black">{bid.workerRating.toFixed(1)}</span>
                                  <Hammer size={14} fill="currentColor" />
                                </div>
                              </div>
                              
                              <div className="flex-1 text-center sm:text-right">
                                <h5 className="font-black text-lg mb-2">{bid.workerName}</h5>
                                <div className="bg-sand p-2 rounded-2xl inline-flex items-center gap-4">
                                  <audio src={bid.voiceBidUrl} controls className="h-10 w-48" />
                                </div>
                              </div>

                              <button 
                                onClick={() => assignWorkerToJob(job.id!)}
                                className="bg-primary text-white font-black py-4 px-8 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all text-xl"
                              >
                                قبول واتصال
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
