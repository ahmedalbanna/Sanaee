import { motion } from 'motion/react';
import { Hammer, UserSearch, LogIn } from 'lucide-react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { useLanguage } from '../lib/LanguageContext';

interface LandingProps {
  onSelectRole: (role: 'worker' | 'customer') => void;
  user: User | null;
}

export default function Landing({ onSelectRole, user }: LandingProps) {
  const { t } = useLanguage();
  
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-16"
      >
        <h2 className="text-5xl md:text-7xl font-serif font-black text-secondary mb-6 leading-tight">
          كل اللي تحتاجه <br />
          <span className="text-primary italic">في دقيقة وحدة بصوتك</span>
        </h2>
        <p className="text-xl text-secondary/70 max-w-lg mx-auto">
          المنصة الأولى في اليمن للبحث عن أفضل الصنايعية والحرفيين المهرة والقريبين منك.
        </p>
      </motion.div>

      {!user ? (
        <button 
          onClick={handleLogin}
          className="flex items-center gap-3 bg-secondary text-white px-8 py-5 rounded-full text-xl font-bold hover:bg-secondary/90 transition-all shadow-xl hover:scale-105 active:scale-95"
        >
          <LogIn />
          {t('login')}
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <motion.button
            whileHover={{ y: -10 }}
            onClick={() => onSelectRole('worker')}
            className="group bg-white p-10 rounded-[3rem] border-2 border-primary/10 hover:border-primary shadow-sm hover:shadow-2xl transition-all text-center flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Hammer size={48} />
            </div>
            <h3 className="text-3xl font-black mb-3">{t('workerBtn')}</h3>
            <p className="text-secondary/60">سجل مهاراتك، استمتع بطلبات منطقتك، وابني سمعتك المسموعة.</p>
          </motion.button>

          <motion.button
            whileHover={{ y: -10 }}
            onClick={() => onSelectRole('customer')}
            className="group bg-white p-10 rounded-[3rem] border-2 border-secondary/10 hover:border-secondary shadow-sm hover:shadow-2xl transition-all text-center flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-secondary/10 rounded-full flex items-center justify-center mb-6 text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
              <UserSearch size={48} />
            </div>
            <h3 className="text-3xl font-black mb-3">{t('customerBtn')}</h3>
            <p className="text-secondary/60">اطلب الحرفي اللي تحتاجه بصوتك، واستلم ردود فورية في منطقتك.</p>
          </motion.button>
        </div>
      )}

      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-50">
        <div className="text-center font-bold">بناء</div>
        <div className="text-center font-bold">سباكة</div>
        <div className="text-center font-bold">كهرباء</div>
        <div className="text-center font-bold">نجارة</div>
      </div>
    </div>
  );
}
