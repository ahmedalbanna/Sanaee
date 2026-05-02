import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, getFirebaseMessaging } from './lib/firebase';
import { getToken } from 'firebase/messaging';
import { getWorkerProfile, markJobPremium, WorkerProfile, updateFcmToken } from './services/firebaseService';
import Navbar from './layout/Navbar';
import Landing from './screens/Landing';
import WorkerRegistration from './screens/WorkerRegistration';
import WorkerDashboard from './screens/WorkerDashboard';
import CustomerDashboard from './screens/CustomerDashboard';
import { Loader2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { LanguageProvider } from './lib/LanguageContext';

type Screen = 'landing' | 'worker-reg' | 'worker-dash' | 'customer-dash';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('landing');
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);

  useEffect(() => {
    // Check for Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const jobId = urlParams.get('job_id');
    
    if (sessionId && jobId) {
      // Mark job as premium
      markJobPremium(jobId)
        .then(() => {
          toast.success('تم تفعيل الطلب المميز بنجاح!');
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(() => {
          toast.error('حدث خطأ أثناء تفعيل الطلب المميز');
        });
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profile = await getWorkerProfile(u.uid);
        if (profile?.status === 'banned' && screen !== 'landing') {
          // Allow them to see the banned UI which is inside the dashboard components
          // or we could force a global banned screen here. 
          // For now, let's keep it in the dashboard since it's already implemented there.
        }
        setWorkerProfile(profile);
      } else {
        setWorkerProfile(null);
        setScreen('landing');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const setupMessaging = async () => {
      if (!user) return;
      try {
        const messaging = await getFirebaseMessaging();
        if (messaging) {
          const currentToken = await getToken(messaging, { 
            vapidKey: 'YOUR_VAPID_KEY_HERE' // This should be in env
          });
          if (currentToken) {
            await updateFcmToken(currentToken);
          }
        }
      } catch (err) {
        console.warn('Messaging setup failed:', err);
      }
    };
    setupMessaging();
  }, [user]);

  const navigate = (s: Screen) => setScreen(s);

  if (loading) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="font-serif text-2xl font-black text-secondary">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-sand">
        <Toaster position="top-center" toastOptions={{ style: { background: '#2D241E', color: '#fff', borderRadius: '20px' } }} />
        <Navbar user={user} onNavigate={(s) => navigate(s as Screen)} />
        
        <main className="max-w-7xl mx-auto">
          {screen === 'landing' && (
            <Landing 
              user={user} 
              onSelectRole={(role) => {
                if (role === 'worker') {
                  navigate(workerProfile ? 'worker-dash' : 'worker-reg');
                } else {
                  navigate('customer-dash');
                }
              }} 
            />
          )}

          {screen === 'worker-reg' && (
            <WorkerRegistration 
              onBack={() => navigate('landing')}
              onComplete={async () => {
                const profile = await getWorkerProfile(user!.uid);
                setWorkerProfile(profile);
                navigate('worker-dash');
              }} 
            />
          )}

          {screen === 'worker-dash' && workerProfile && (
            <WorkerDashboard profile={workerProfile} />
          )}

          {screen === 'customer-dash' && (
            <CustomerDashboard />
          )}
        </main>
      </div>
    </LanguageProvider>
  );
}
