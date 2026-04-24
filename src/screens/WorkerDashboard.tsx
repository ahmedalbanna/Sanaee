import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hammer, MapPin, Clock, MessageSquare, Play, Info } from 'lucide-react';
import { subscribeToJobs } from '../services/firebaseService';

interface WorkerDashboardProps {
  profile: unknown;
}

export default function WorkerDashboard({ profile }: { profile: any }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'mine'>('feed');

  useEffect(() => {
    // Only listen to jobs matching worker's craft
    const unsub = subscribeToJobs((newJobs) => {
      setJobs(newJobs);
    }, profile.craftId);
    return () => unsub();
  }, [profile.craftId]);

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
        
        <div className="flex bg-sand p-2 rounded-full">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'feed' ? 'bg-primary text-white shadow-lg' : 'text-secondary/50'}`}
          >
            طلبات جديدة
          </button>
          <button 
            onClick={() => setActiveTab('mine')}
            className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'mine' ? 'bg-primary text-white shadow-lg' : 'text-secondary/50'}`}
          >
            أعمالي
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {jobs.length === 0 ? (
            <div className="col-span-full py-24 text-center">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 text-primary/20">
                <Info size={48} />
              </div>
              <h3 className="text-2xl font-black text-secondary/30">ما في طلبات لمهنتك حالياً</h3>
              <p className="text-secondary/20">خلك قريب، الطلبات توصل في أي لحظة!</p>
            </div>
          ) : (
            jobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] p-8 border-2 border-primary/5 hover:border-primary/20 transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-6">
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
                  <button className="flex-grow bg-primary text-white py-4 rounded-2xl font-black text-lg hover:bg-primary/90 transition-all shadow-md active:scale-95">
                    أنا جاهز
                  </button>
                  <button className="p-4 bg-sand text-secondary rounded-2xl hover:bg-primary/10 transition-colors">
                    <Play size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
