import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Disc, MapPin, Hammer, X, Star, CheckCircle, Mic } from 'lucide-react';
import VoiceRecorder from '../components/VoiceRecorder';
import CraftSelector from '../components/CraftSelector';
import { createJobRequest, uploadAudio, subscribeToJobsAll, confirmJobCompletion, getWorkers, addReview, Job, WorkerProfile, addAdditionalVoiceToJob } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function CustomerDashboard() {
  const [showPostModal, setShowPostModal] = useState(false);
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [reviewWorkerId, setReviewWorkerId] = useState<string | null>(null);
  const [addVoiceJobId, setAddVoiceJobId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [postData, setPostData] = useState({
    craftId: '',
    voiceUrl: '',
    urgency: 'normal'
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Search Filters
  const [filters, setFilters] = useState({
    craftId: '',
    maxRate: 50000,
    availability: false,
    minRating: 0
  });

  useEffect(() => {
    getWorkers().then(ws => {
      if(ws) {
        setWorkers(ws);
      }
    });

    const unsub = subscribeToJobsAll((allJobs) => {
      // Filter jobs belonging to this customer
      const myJobs = allJobs.filter(j => j.customerId === auth.currentUser?.uid);
      setJobs(myJobs);
    });
    return () => unsub();
  }, []);

  let filteredWorkers = [...workers];
  if (filters.craftId) filteredWorkers = filteredWorkers.filter(w => w.craftId === filters.craftId);
  if (filters.availability) filteredWorkers = filteredWorkers.filter(w => w.isAvailable);
  if (filters.minRating > 0) filteredWorkers = filteredWorkers.filter(w => w.rating >= filters.minRating);
  filteredWorkers = filteredWorkers.filter(w => (w.dailyRate || 0) <= filters.maxRate);
  
  // Sort by baraka, rating
  filteredWorkers.sort((a, b) => {
    if (a.isBarakaActive && !b.isBarakaActive) return -1;
    if (!a.isBarakaActive && b.isBarakaActive) return 1;
    return b.rating - a.rating;
  });

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
      toast.success("تم إرسال طلبك بنجاح!");
    } catch (error) {
      console.error(error);
      alert("فشل نشر الطلب");
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

  const handleConfirmCompletion = async (jobId: string, workerId: string) => {
    await confirmJobCompletion(jobId, 'customer');
    toast.success('تم التأكيد!');
    // Trigger review immediately
    setReviewJobId(jobId);
    setReviewWorkerId(workerId);
  };

  const handleSubmitReview = async (blob: Blob) => {
    if (!reviewJobId || !reviewWorkerId) return;
    try {
      setLoading(true);
      const url = await uploadAudio(blob, 'reviews');
      await addReview(reviewWorkerId, reviewJobId, url, reviewRating);
      toast.success('تم إضافة التقييم!');
      setReviewJobId(null);
      setReviewWorkerId(null);
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleAppendedVoice = async (blob: Blob) => {
    if (!addVoiceJobId) return;
    try {
      setLoading(true);
      const url = await uploadAudio(blob, 'job_requests');
      await addAdditionalVoiceToJob(addVoiceJobId, url);
      toast.success('تمت إضافة الرسالة الصوتية بنجاح');
      setAddVoiceJobId(null);
    } catch {
      toast.error('حدث خطأ');
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

      <div className="flex border-b border-border mb-8 gap-8">
        <button className="pb-4 font-bold border-b-2 border-primary text-primary">أبحَث عن حرفي</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <div className="md:col-span-1 border border-border p-5 rounded-3xl h-fit bg-white">
          <h3 className="font-bold mb-4 font-serif">تصفية النتائج</h3>
          
          <div className="mb-4">
            <label className="text-sm font-bold block mb-2 text-muted">الحرفة</label>
            <select 
              value={filters.craftId}
              onChange={e => setFilters({...filters, craftId: e.target.value})}
              className="w-full bg-sand border-none rounded-xl p-3"
            >
              <option value="">الكل</option>
              <option value="سباك">سباك</option>
              <option value="كهربائي">كهربائي</option>
              <option value="نجار">نجار</option>
              <option value="بناء">بناء</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="text-sm font-bold block mb-2 text-muted">أقصى أجرة يومية (ريال)</label>
            <input 
              type="range" min="5000" max="100000" step="1000"
              value={filters.maxRate}
              onChange={e => setFilters({...filters, maxRate: parseInt(e.target.value)})}
              className="w-full accent-primary"
            />
            <div className="text-center text-xs mt-2 font-bold">{filters.maxRate}</div>
          </div>

          <div className="mb-4">
             <label className="text-sm font-bold block mb-2 text-muted">التقييم كحد أدنى</label>
             <select 
              value={filters.minRating}
              onChange={e => setFilters({...filters, minRating: parseFloat(e.target.value)})}
              className="w-full bg-sand border-none rounded-xl p-3"
            >
              <option value="0">الكل</option>
              <option value="4">4 نجوم فأكثر</option>
              <option value="4.5">4.5 نجوم فأكثر</option>
            </select>
          </div>

          <div className="flex justify-between items-center bg-[#F5EFE6] p-3 rounded-xl border border-border">
            <span className="font-bold text-sm">متاح الآن فقط</span>
            <input 
              type="checkbox" 
              checked={filters.availability}
              onChange={e => setFilters({...filters, availability: e.target.checked})}
              className="w-5 h-5 accent-primary rounded-md"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredWorkers.map(w => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-5 rounded-3xl border border-border shadow-sm flex items-center gap-5 hover:border-primary transition-colors"
                >
                  <div className="w-20 h-20 bg-sand rounded-2xl flex items-center justify-center text-4xl">
                    👨‍🔧
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="font-bold text-lg">{w.name}</h4>
                        {w.isBarakaActive && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold inline-block mb-1">نظام البركة الجاري</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-gold">
                        <span className="text-sm font-bold">{w.rating?.toFixed(1) || 5}</span>
                        <Star size={14} fill="currentColor" />
                      </div>
                    </div>
                    <p className="text-sm text-muted mb-2">{w.craftId} • {w.isAvailable ? 'متاح الآن' : 'غير متاح'} • أجر: {w.dailyRate || 0} ر.ي</p>
                    <div className="bg-[#FDFBF7] p-2 rounded-xl flex items-center">
                      <audio src={w.voiceProfileUrl} controls className="h-8 max-w-[150px]" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredWorkers.length === 0 && (
              <div className="col-span-2 text-center text-muted p-10">لا يوجد حرفيين مطابقين لبحثك</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex border-b border-border mb-8 gap-8 mt-12">
        <button className="pb-4 font-bold border-b-2 border-primary text-primary">طلباتي</button>
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
                className="bg-white p-6 rounded-[2.5rem] border border-primary/10 shadow-sm flex flex-col"
              >
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Hammer size={20} />
                    <span>{job.craftId}</span>
                    {job.isPremium && <span className="bg-gold text-white text-[10px] px-2 py-0.5 rounded-full ml-2">مميز 🌟</span>}
                    {job.urgency === 'emergency' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2 animate-pulse">عاجل 🚨</span>}
                  </div>
                </div>
                
                {/* Visual Timeline */}
                <div className="flex items-center justify-between mb-6 relative">
                  <div className="absolute left-0 right-0 h-1 bg-sand top-1/2 -translate-y-1/2 z-0 rounded-full overflow-hidden">
                    <div className={`h-full bg-primary transition-all duration-500`} style={{ width: job.status === 'open' ? '0%' : job.status === 'assigned' ? '50%' : '100%' }} />
                  </div>
                  
                  <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${job.status === 'open' || job.status === 'assigned' || job.status === 'completed' ? 'bg-primary text-white border-2 border-white' : 'bg-sand text-muted border-2 border-white'}`}>1</div>
                  <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${job.status === 'assigned' || job.status === 'completed' ? 'bg-primary text-white border-2 border-white' : 'bg-sand text-muted border-2 border-white'}`}>2</div>
                  <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${job.status === 'completed' ? 'bg-primary text-white border-2 border-white' : 'bg-sand text-muted border-2 border-white'}`}>3</div>
                </div>
                <div className="flex items-center justify-between mb-6 text-[10px] font-bold text-muted -mt-4">
                  <span>مفتوح</span>
                  <span>قيد العمل</span>
                  <span>مكتمل</span>
                </div>
                
                <div className="bg-sand p-4 rounded-2xl mb-4 space-y-4">
                  <audio src={job.voiceRequestUrl} controls className="w-full h-8" />
                  {job.additionalVoiceUrls?.map((url, i) => (
                    <div key={i} className="pt-2 border-t border-border/50">
                      <span className="text-xs text-muted font-bold block mb-1">إضافة #{i + 1}</span>
                      <audio src={url} controls className="w-full h-8" />
                    </div>
                  ))}
                  
                  {job.status === 'open' && (
                    <button 
                      onClick={() => setAddVoiceJobId(job.id!)}
                      className="w-full py-2 bg-white rounded-xl text-primary font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-colors"
                    >
                      <Mic size={14} /> إضافة تفاصيل للطلب
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-sand">
                  <div className="flex items-center gap-4 text-xs text-secondary/60">
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      <span>منطقتك</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {job.status === 'open' && !job.isPremium && (
                      <button onClick={() => promoteJob(job.id!, job.craftId!)} className="bg-gold/10 text-gold hover:bg-gold hover:text-white transition-colors px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Star size={14} />
                        تمييز الطلب
                      </button>
                    )}
                    
                    {job.status === 'assigned' && !job.customerConfirmedCompletion && (
                      <button onClick={() => handleConfirmCompletion(job.id!, job.workerId!)} className="bg-green-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={14} />
                        تأكيد الإنجاز
                      </button>
                    )}
                    {job.customerConfirmedCompletion && job.status !== 'completed' && (
                      <span className="text-xs text-primary font-bold">بانتظار تأكيد العامل</span>
                    )}
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
                  
                  <div className="flex gap-6 mb-4 bg-white p-4 rounded-xl border border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value="normal" checked={postData.urgency === 'normal'} onChange={e => setPostData({...postData, urgency: e.target.value})} className="accent-primary w-5 h-5" />
                      <span className="font-bold">عادي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value="emergency" checked={postData.urgency === 'emergency'} onChange={e => setPostData({...postData, urgency: e.target.value})} className="accent-red-500 w-5 h-5" />
                      <span className="font-bold text-red-500">حالة طارئة 🚨</span>
                    </label>
                  </div>

                  <p className="text-secondary/60">اشرح المشكلة باختصار، مثلاً: "عندي حنفية مكسورة في المطبخ تسرّب ماء، محتاج سباك الآن"</p>
                  <VoiceRecorder onRecordingComplete={handlePost} label="سجل تفاصيل الطلب" />
                  {loading && <p className="text-center text-primary font-black animate-pulse">جاري إرسال صرختك للعالم...</p>}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Additional Voice Modal */}
      <AnimatePresence>
        {addVoiceJobId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddVoiceJobId(null)}
              className="absolute inset-0 bg-secondary/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-sand w-full max-w-2xl rounded-[3rem] p-8 md:p-12 relative z-10 shadow-2xl"
            >
              <button 
                onClick={() => setAddVoiceJobId(null)}
                className="absolute left-8 top-8 p-2 bg-white rounded-full text-secondary/40 hover:text-red-500 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-12">
                <h3 className="text-3xl font-black text-secondary">إضافة تفاصيل لطلبك</h3>
                <p className="text-secondary/60">سجل رسالة صوتية إضافية للحرفيين حول هذا الطلب</p>
              </div>

              <div className="space-y-8 flex flex-col items-center">
                <VoiceRecorder onRecordingComplete={handleAppendedVoice} label="سجل التفاصيل بصوتك" />
                {loading && <p className="text-center text-primary font-black animate-pulse">جاري الاستمرار...</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Review Modal */}
      <AnimatePresence>
        {reviewJobId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setReviewJobId(null)}
               className="absolute inset-0 bg-secondary/80 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="bg-sand w-full max-w-2xl rounded-[3rem] p-8 md:p-12 relative z-10 shadow-2xl"
             >
               <div className="mb-12 text-center">
                 <h3 className="text-3xl font-black text-secondary">شكراً لثقتك!</h3>
                 <p className="text-secondary/60">تقييمك الصوتي يساهم في دعم الحرفي</p>
               </div>

               <div className="space-y-8 flex flex-col items-center">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setReviewRating(s)} className="p-2 transition-transform hover:scale-110">
                        <Star size={40} fill={s <= reviewRating ? '#D4AF37' : 'none'} stroke={s <= reviewRating ? 'none' : '#D4AF37'} />
                      </button>
                    ))}
                  </div>

                  <VoiceRecorder onRecordingComplete={handleSubmitReview} label="سجل تقييمك (مثال: الشغل ممتاز ونظيف!)" />
                  {loading && <p className="text-center text-primary font-black animate-pulse">جاري إرسال التقييم...</p>}
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
