import { LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { User as FirebaseUser } from 'firebase/auth';

interface NavbarProps {
  user: FirebaseUser | null;
  onNavigate: (screen: string) => void;
}

export default function Navbar({ user, onNavigate }: NavbarProps) {
  return (
    <nav className="bg-white border-b-2 border-primary/10 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 
          onClick={() => onNavigate('landing')}
          className="text-3xl font-serif font-black text-primary cursor-pointer hover:opacity-80 transition-opacity"
        >
          صنايعي
        </h1>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-2 bg-sand px-3 py-1.5 rounded-full border border-primary/10">
                <span className="text-sm font-bold text-secondary hidden sm:inline">{user.displayName || "مستخدم"}</span>
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-secondary/60 hover:text-red-500 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <span className="text-sm font-bold text-primary">أهلاً بك</span>
          )}
        </div>
      </div>
    </nav>
  );
}
