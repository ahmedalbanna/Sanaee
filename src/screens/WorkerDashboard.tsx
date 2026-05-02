import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hammer, MessageSquare, Star, Mic, Play, Trophy, User, CheckCircle, MapPin, AlertOctagon } from 'lucide-react';
import { subscribeToJobsAll, updateWorkerBaraka, confirmJobCompletion, addJobBid, uploadAudio, getWorkerReviews, Job, WorkerProfile } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import { distanceBetween } from 'geofire-common';
import VoiceRecorder from '../components/VoiceRecorder';
import toast from 'react-hot-toast';

interface Review {
  id: string;
  rating: number;
  voiceReviewUrl?: string;
  createdAt: { seconds: number; nanoseconds: number } | string | Date;
}

export default function WorkerDashboard({ profile }: { profile: WorkerProfile }) {
  const [jobs, setJobs] = useState<(Job & { distance?: number })[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'mine' | 'profile'>('feed');
  const [isBaraka, setIsBaraka] = useState(profile?.isBarakaActive || false);
  const [recordingJobId, setRecordingJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const seenJobsRef = useRef<Set<string>>(new Set());

  const playAlertSound = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const playBeep = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, startTime);
      osc.frequency.exponentialRampToValueAtTime(1200, startTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.5, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    };

    const now = ctx.currentTime;
    playBeep(now);
    playBeep(now + 0.4);
    playBeep(now + 0.8);
  };

  useEffect(() => {
    const unsub = subscribeToJobsAll((allJobs) => {
      const relevant: (Job & { distance?: number })[] = allJobs.filter(j => 
        (j.status === 'open' && j.craftId === profile.craftId) || 
        j.workerId === auth.currentUser?.uid
      ).map(j => {
        if (j.lat && j.lng && profile.lat && profile.lng) {
          const dist = distanceBetween([j.lat, j.lng], [profile.lat, profile.lng]);
          return { ...j, distance: dist } as (Job & { distance: number });
        }
        return j as (Job & { distance?: number });
      });
      
      let hasNewEmergency = false;
      relevant.forEach(job => {
        if (!seenJobsRef.current.has(job.id!)) {
           seenJobsRef.current.add(job.id!);
           if (job.urgency === 'emergency' && job.status === 'open') {
             hasNewEmergency = true;
           }
        }
      });
      
      if (hasNewEmergency) {
        playAlertSound();
        toast('🚨 طلب عاجل جديد!', {
          duration: 5000,
          style: { borderRadius: '10px', background: '#EF4444', color: '#fff', fontWeight: 'bold' },
        });
      }

      relevant.sort((a, b) => {
        // Emergency and Premium first
        if (a.urgency === 'emergency' && b.urgency !== 'emergency') return -1;
        if (a.urgency !== 'emergency' && b.urgency === 'emergency') return 1;
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        
        // Then by distance
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        return 0;
      });
      setJobs(relevant);
    });

    if (auth.currentUser) {
      getWorkerReviews(auth.currentUser.uid).then(r => setReviews(r || []));
    }

    return () => unsub();
  }, [profile.craftId, profile.lat, profile.lng]);

  if (profile.status === 'banned') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center bg-sand">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6"
        >
          <AlertOctagon size={48} />
        </motion.div>
        <h1 className="text-3xl font-black text-secondary mb-4">هذا الحساب محظور ⛔</h1>
        <p className="text-lg text-secondary/60 max-w-md font-bold">
          لقد تلقينا عدة بلاغات بشأن هذا الحساب لمخالفة شروط الخدمة. تم تعليق حسابك نهائياً.
        </p>
      </div>
    );
  }

  const feedJobs = jobs.filter(j => j.status === 'open');
  const myJobs = jobs.filter(j => j.workerId === auth.currentUser?.uid);

  const handleSendBid = async (blob: Blob) => {
    if (!recordingJobId) return;
    try {
      setLoading(true);
      const url = await uploadAudio(blob);
      await addJobBid(recordingJobId, url, profile);
      toast.success('تم إرسال ردك الصوتي بنجاح!');
      setRecordingJobId(null);
    } catch {
      toast.error('حدث خطأ أثناء الإرسال');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="p-4 md:p-8 flex flex-col gap-8">
      {/* Worker Branding Header */}
      <div className="bg-white rounded-[3rem] p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-primary/10 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center text-white text-4xl shadow-inner">
              👨‍🔧
            </div>
            <div className="absolute -bottom-2 -right-2 bg-gold text-white p-2 rounded-full shadow-lg border-4 border-white">
              <Trophy size={20} />
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-black text-secondary">المعلم {profile.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-sand px-4 py-1 rounded-full font-black text-primary border border-primary/10">{profile.craftId}</span>
              <div className="flex items-center gap-1 text-gold font-black">
                <Star size={18} fill="currentColor" />
                <span>{profile.rating?.toFixed(1) || 5.0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex bg-sand p-2 rounded-[2rem] border border-primary/5">
          {[
            { id: 'feed', label: 'الطلبات', count: feedJobs.length, icon: MessageSquare },
            { id: 'mine', label: 'أعمالي', count: myJobs.length, icon: Hammer },
            { id: 'profile', label: 'ملفي', count: 0, icon: User }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'feed' | 'mine' | 'profile')}
              className={`px-8 py-3 rounded-full font-black text-lg transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-secondary/50 hover:text-secondary'}`}
            >
              <tab.icon size={20} />
              {tab.label}
              {tab.count > 0 && <span className="bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'feed' && (
          <motion.div 
            key="feed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {feedJobs.length === 0 ? (
              <div className="col-span-full py-32 text-center bg-white/30 rounded-[3rem] border border-dashed border-primary/20">
                <p className="text-3xl font-black text-secondary/30">ما في طلبات لمهنتك حالياً</p>
                <p className="text-lg text-secondary/20 mt-2">خلك قريب، الطلبات توصل في أي لحظة!</p>
              </div>
            ) : (
              feedJobs.map((job) => (
                <motion.div
                  key={job.id}
                  className={`bg-white rounded-[3rem] p-8 border-2 ${job.isPremium ? 'border-gold shadow-gold/10' : 'border-primary/5'} flex flex-col relative overflow-hidden`}
                >
                  {job.isPremium && <div className="absolute top-4 right-4 bg-gold text-white px-4 py-1 rounded-full text-xs font-black shadow-lg">مميز 🔥</div>}
                  
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-sand rounded-2xl flex items-center justify-center text-primary">
                      <MapPin size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-secondary/60">
                        {job.distance !== undefined 
                          ? `على بعد ${(job.distance * 1000).toFixed(0)} متر` 
                          : 'منطقتك الآن'}
                      </span>
                      <span className="text-xs text-secondary/40">صنعاء، اليمن</span>
                    </div>
                  </div>

                  <div className="bg-sand p-6 rounded-[2rem] mb-8 border border-primary/5">
                    <p className="font-black text-primary mb-3 flex items-center gap-2">
                       <Play size={18} fill="currentColor" /> اسمع العميل:
                    </p>
                    <audio src={job.voiceRequestUrl} controls className="w-full" />
                  </div>

                  <button 
                    onClick={() => setRecordingJobId(job.id!)}
                    className="w-full bg-primary text-white py-6 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    <Mic size={28} />
                    تسجيل الرد
                  </button>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'mine' && (
          <motion.div key="mine" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {myJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-[3rem] p-8 border border-primary/10 shadow-md">
                <h3 className="font-black text-2xl mb-4">{job.status === 'completed' ? 'عمل مكتمل ✅' : 'عمل جاري 🛠️'}</h3>
                <audio src={job.voiceRequestUrl} controls className="w-full mb-6" />
                {job.status === 'assigned' && !job.workerConfirmedCompletion && (
                  <button onClick={() => handleConfirmCompletion(job.id!)} className="w-full bg-green-500 text-white py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-2">
                    <CheckCircle size={24} /> تم الإنجاز
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div key="profile" className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto w-full">
            <div className="bg-white rounded-[3rem] p-10 border border-primary/10 shadow-lg">
              <h3 className="text-3xl font-black text-secondary mb-8">إعدادات الملف</h3>
              
              <div className="space-y-8">
                <div className="p-6 bg-sand rounded-3xl border border-primary/5">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-xl">نظام البركة الحساوي</h4>
                    <button onClick={toggleBaraka} className={`w-16 h-8 rounded-full p-1 transition-colors ${isBaraka ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-6 h-6 bg-white rounded-full transition-transform ${isBaraka ? 'translate-x-8' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-secondary/60 font-bold italic">"عند تفعيل هذا الخيار، سيظهر للعملاء المحتاجين أنك مستعد للمساعدة التطوعية."</p>
                </div>

                <div className="p-6 border-2 border-gold/20 rounded-3xl bg-gold/5">
                  <h4 className="font-black text-xl text-gold mb-2">باقة "المُبرز" (نجم الحارة)</h4>
                  <p className="text-sm text-secondary/60 mb-6">يتم تمييز ملفك ببرواز ذهبي وتظهر في مقدمة النتائج لجميع العملاء.</p>
                  <button className="w-full bg-gold text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
                    <Trophy size={20} /> ترقية الآن (1000 ريال)
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-primary/10 shadow-lg">
              <h3 className="text-3xl font-black text-secondary mb-8">معرض المهارة (أصواتك)</h3>
              <div className="space-y-6">
                <div className="bg-sand p-4 rounded-2xl">
                  <span className="text-xs font-black text-primary block mb-2">مقدمتك للعملاء</span>
                  <audio src={profile.voiceProfileUrl} controls className="w-full" />
                </div>
                
                <h4 className="font-black text-xl mt-8 mb-4 flex items-center gap-2">
                  <Star fill="#D4AF37" stroke="none" /> تقييمات المطارق الذهبية
                </h4>
                <div className="space-y-4 max-h-[300px] overflow-y-auto px-2">
                  {reviews.length === 0 ? (
                    <p className="text-center text-secondary/30 italic py-8">لا توجد تقييمات بعد</p>
                  ) : reviews.map(r => (
                    <div key={r.id} className="bg-sand p-4 rounded-[1.5rem] border border-primary/5">
                      <div className="flex gap-1 text-gold mb-2">
                         {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} />)}
                      </div>
                      <audio src={r.voiceReviewUrl} controls className="w-full h-8" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Modal */}
      <AnimatePresence>
        {recordingJobId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRecordingJobId(null)} className="absolute inset-0 bg-secondary/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-sand p-10 rounded-[4rem] w-full max-w-2xl relative shadow-2xl">
              <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-secondary">قدم عرضك للمعلم</h3>
                <p className="text-lg text-secondary/60">سجل رسالة صوتية تخبره بخبرتك وكيف تقدر تساعده</p>
              </div>
              <VoiceRecorder onRecordingComplete={handleSendBid} variant="default" label="سجل عرضك الصوتي" />
              {loading && <p className="text-center mt-6 font-black text-primary animate-pulse">جاري إرسال ردك...</p>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
