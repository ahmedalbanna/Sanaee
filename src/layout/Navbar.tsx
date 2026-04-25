import { LogOut, Globe } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../lib/LanguageContext';

interface NavbarProps {
  user: FirebaseUser | null;
  onNavigate: (screen: string) => void;
}

export default function Navbar({ user, onNavigate }: NavbarProps) {
  const { toggleLang, t } = useLanguage();

  return (
    <nav className="bg-white border-b-2 border-primary/10 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 
          onClick={() => onNavigate('landing')}
          className="text-3xl font-serif font-black text-primary cursor-pointer hover:opacity-80 transition-opacity"
        >
          {t('appName')}
        </h1>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLang}
            className="flex items-center gap-2 text-sm font-bold text-secondary/60 hover:text-primary transition-colors px-3 py-1.5 rounded-full bg-sand"
          >
            <Globe size={16} />
            {t('langToggle')}
          </button>
          
          {user ? (
            <>
              <div className="flex items-center gap-2 bg-sand px-3 py-1.5 rounded-full border border-primary/10">
                <span className="text-sm font-bold text-secondary hidden sm:inline">{user.displayName || "مستخدم"}</span>
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full" />
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-secondary/60 hover:text-red-500 transition-colors"
                title={t('logout')}
              >
                <LogOut size={20} />
              </button>
            </>
          ) : (
             null
          )}
        </div>
      </div>
    </nav>
  );
}
