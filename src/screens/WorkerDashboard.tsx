import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hammer, MapPin, Clock, MessageSquare, Info, Heart, CheckCircle, Star } from 'lucide-react';
import { subscribeToJobsAll, updateWorkerBaraka, confirmJobCompletion, getWorkerReviews, assignWorkerToJob, Job, WorkerProfile } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function WorkerDashboard({ profile }: { profile: WorkerProfile }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reviews, setReviews] = useState<unknown[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'mine' | 'profile'>('feed');
  const [isBaraka, setIsBaraka] = useState(profile?.isBarakaActive || false);

  useEffect(() => {
    const unsub = subscribeToJobsAll((allJobs) => {
      const relevant = allJobs.filter(j => 
        (j.status === 'open' && j.craftId === profile.craftId) || 
        j.workerId === auth.currentUser?.uid
      );
      relevant.sort((a, b) => {
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        return 0;
      });
      setJobs(relevant);
    });

    if (auth.currentUser) {
      getWorkerReviews(auth.currentUser.uid).then(r => setReviews(r || []));
    }

    return () => unsub();
  }, [profile.craftId]);

  const feedJobs = jobs.filter(j => j.status === 'open');
  const myJobs = jobs.filter(j => j.workerId === auth.currentUser?.uid);

  const toggleBaraka = async () => {
    const newVal = !isBaraka;
    setIsBaraka(newVal);
    await updateWorkerBaraka(newVal);
    toast.success(newVal ? 'تم تفعيل نظام البركة! أنت الآن متطوع' : 'تم إيقاف نظام البركة');
  };

  const handleConfirmCompletion = async (jobId: string) => {
    await confirmJobCompletion(jobId, 'worker');
    toast.success('تم التأكيد!');
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!jobId) return;
    try {
      await assignWorkerToJob(jobId);
      toast.success('تم تخصيص الطلب لك بنجاح!');
      setActiveTab('mine');
    } catch {
      toast.error('حدث خطأ');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-[3rem] p-8 mb-12 flex flex-col md:flex-row justify-between items-center gap-6 border border-primary/10">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Hammer size={40} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-secondary">أهلاً يا معلم {profile.name}</h2>
            <p className="text-secondary/60 flex items-center gap-2">
              <span className="font-bold text-primary">{profile.craftId}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {profile.location?.city || 'صنعاء'}</span>
            </p>
          </div>
        </div>
        
        <div className="flex bg-sand p-2 rounded-full overflow-x-auto w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`px-4 sm:px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${activeTab === 'feed' ? 'bg-primary text-white shadow-lg' : 'text-secondary/50'}`}
          >
            طلبات جديدة {feedJobs.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full mr-2">{feedJobs.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('mine')}
            className={`px-4 sm:px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${activeTab === 'mine' ? 'bg-primary text-white shadow-lg' : 'text-secondary/50'}`}
          >
            أعمالي {myJobs.length > 0 && <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mr-2">{myJobs.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-4 sm:px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-primary text-white shadow-lg' : 'text-secondary/50'}`}
          >
            ملفي والتقييمات
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {activeTab === 'feed' && (
            feedJobs.length === 0 ? (
              <div className="col-span-full py-24 text-center">
                <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 text-primary/20">
                  <Info size={48} />
                </div>
                <h3 className="text-2xl font-black text-secondary/30">ما في طلبات لمهنتك حالياً</h3>
                <p className="text-secondary/20">خلك قريب، الطلبات توصل في أي لحظة!</p>
              </div>
            ) : (
              feedJobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`bg-white rounded-[2.5rem] p-8 border-2 ${job.isPremium ? 'border-gold shadow-gold/20' : 'border-primary/5 hover:border-primary/20'} transition-all flex flex-col relative overflow-hidden`}
                >
                  {job.isPremium && <div className="absolute top-0 right-0 bg-gold text-white text-xs px-8 py-1 transform rotate-45 translate-x-6 translate-y-3 font-bold">مميز</div>}
                  <div className="flex items-center justify-between mb-6 pt-2">
                    <div className="bg-sand px-4 py-2 rounded-full text-xs font-bold text-secondary/60 flex items-center gap-2">
                      <Clock size={14} />
                      <span>منذ 5 دقائق</span>
                    </div>
                    {job.urgency === 'emergency' && (
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
                        عاجل
                      </div>
                    )}
                  </div>

                  <div className="mb-8 flex-grow">
                    <p className="font-bold text-primary mb-4 flex items-center gap-2">
                      <MessageSquare size={18} />
                      اسمع الطلب:
                    </p>
                    <div className="bg-sand p-6 rounded-3xl border-2 border-primary/5">
                      <audio src={job.voiceRequestUrl} controls className="w-full" />
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-sand flex gap-4">
                    <button 
                      onClick={() => handleAcceptJob(job.id)}
                      className="flex-grow bg-primary text-white py-4 rounded-2xl font-black text-lg hover:bg-primary/90 transition-all shadow-md active:scale-95"
                    >
                      أنا جاهز
                    </button>
                  </div>
                </motion.div>
              ))
            )
          )}

          {activeTab === 'mine' && (
            myJobs.map((job) => (
              <motion.div
                  key={job.id}
                  className="bg-white rounded-[2.5rem] p-8 border-2 border-primary/10 flex flex-col"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-primary">{job.craftId}</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${job.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-primary/20 text-primary'}`}>
                      {job.status === 'completed' ? 'مكتمل' : 'قيد العمل'}
                    </span>
                  </div>
                  <audio src={job.voiceRequestUrl} controls className="w-full mb-6" />
                  
                  {job.status === 'assigned' && !job.workerConfirmedCompletion && (
                    <button onClick={() => handleConfirmCompletion(job.id)} className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors">
                      <CheckCircle size={20} />
                      أكد إنجاز العمل
                    </button>
                  )}
                  {job.workerConfirmedCompletion && job.status !== 'completed' && (
                    <div className="text-center font-bold text-primary">تنتظر تأكيد العميل</div>
                  )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white rounded-3xl p-8 border border-primary/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-secondary">نظام البركة</h3>
                <button 
                  onClick={toggleBaraka}
                  className={`w-16 h-8 rounded-full flex items-center transition-colors p-1 ${isBaraka ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-transform ${isBaraka ? '-translate-x-8' : 'translate-x-0'}`} />
                </button>
              </div>
              <p className="text-muted mb-6">تفعيل هذا النظام يبرز ملفك للعملاء المحتاجين للعمل التطوعي بأجر معدوم أو مخفض للحالات الإنسانية.</p>
              {isBaraka && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-800 font-bold">
                  <Heart className="fill-green-500 stroke-green-500" />
                  مفعل! يكتب الله أجرك.
                </div>
              )}
              
              <h3 className="text-2xl font-black text-secondary mt-12 mb-6">مقدمتك الصوتية</h3>
              <audio src={profile.voiceProfileUrl} controls className="w-full" />
           </div>

           <div className="bg-white rounded-3xl p-8 border border-primary/10">
              <h3 className="text-2xl font-black text-secondary mb-6 line-clamp-1">تقييمات عملائك ({reviews.length})</h3>
              <div className="flex items-center gap-2 mb-8">
                <span className="text-4xl font-black">{profile.rating?.toFixed(1) || 5.0}</span>
                <Star fill="#D4AF37" stroke="none" size={32} />
              </div>

              <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                {reviews.length === 0 ? (
                  <p className="text-muted text-center py-8">لا توجد تقييمات صوتية بعد</p>
                ) : reviews.map(r => (
                  <div key={r.id} className="bg-sand p-4 rounded-2xl">
                    <div className="flex items-center gap-1 text-gold mb-3">
                       {[...Array(5)].map((_, i) => (
                         <Star key={i} size={16} fill={i < r.rating ? 'currentColor' : 'none'} stroke={i < r.rating ? 'none' : 'currentColor'} />
                       ))}
                    </div>
                    {r.voiceReviewUrl && <audio src={r.voiceReviewUrl} controls className="w-full h-8" />}
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
