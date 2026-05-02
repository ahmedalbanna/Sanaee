import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Storage Services ---

export const uploadAudio = async (blob: Blob, folder: string) => {
  const formData = new FormData();
  formData.append('audio', blob, 'audio.webm');
  
  const response = await fetch('/api/upload-audio', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('فشل رفع الملف الصوتي');
  }
  
  const data = await response.json();
  return data.url;
};

export const getWorkers = async () => {
  const path = 'workers';
  try {
    const q = query(collection(db, 'workers'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export interface WorkerProfile {
  id?: string;
  userId?: string;
  name?: string;
  craftId?: string;
  isBarakaActive?: boolean;
  isAvailable?: boolean;
  dailyRate?: number;
  rating?: number;
  reviewsCount?: number;
  voiceProfileUrl?: string;
  location?: { city?: string };
}

export const saveWorkerProfile = async (profile: unknown) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `workers/${auth.currentUser.uid}`;
  try {
    const workerRef = doc(db, 'workers', auth.currentUser.uid);
    const workerSnap = await getDoc(workerRef);
    
    if (workerSnap.exists()) {
      await updateDoc(workerRef, {
        ...(profile as object)
      });
    } else {
      await setDoc(workerRef, {
        ...(profile as object),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        rating: 5.0,
        reviewsCount: 0,
        isBarakaActive: false
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateWorkerBaraka = async (isActive: boolean) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `workers/${auth.currentUser.uid}`;
  try {
    await updateDoc(doc(db, 'workers', auth.currentUser.uid), {
      isBarakaActive: isActive
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getWorkerProfile = async (uid: string) => {
  const path = `workers/${uid}`;
  try {
    const docRef = doc(db, 'workers', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

// --- Job Services ---

export const createJobRequest = async (job: unknown) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = 'jobs';
  try {
    const docRef = await addDoc(collection(db, 'jobs'), {
      ...(job as object),
      customerId: auth.currentUser.uid,
      status: 'open',
      createdAt: serverTimestamp(),
      isPremium: false,
      customerConfirmedCompletion: false,
      workerConfirmedCompletion: false
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const markJobPremium = async (jobId: string) => {
  const path = `jobs/${jobId}`;
  try {
    await updateDoc(doc(db, 'jobs', jobId), {
      isPremium: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const assignWorkerToJob = async (jobId: string) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `jobs/${jobId}`;
  try {
    await updateDoc(doc(db, 'jobs', jobId), {
      status: 'assigned',
      workerId: auth.currentUser.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const confirmJobCompletion = async (jobId: string, role: 'customer' | 'worker') => {
  const path = `jobs/${jobId}`;
  try {
    const jobSnap = await getDoc(doc(db, 'jobs', jobId));
    if (!jobSnap.exists()) return;
    const jobData = jobSnap.data();

    const updates: Record<string, unknown> = {};
    if (role === 'customer') {
      updates.customerConfirmedCompletion = true;
      if (jobData.workerConfirmedCompletion) updates.status = 'completed';
    } else {
      updates.workerConfirmedCompletion = true;
      if (jobData.customerConfirmedCompletion) updates.status = 'completed';
    }

    await updateDoc(doc(db, 'jobs', jobId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const addReview = async (workerId: string, jobId: string, voiceReviewUrl: string, rating: number) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `workers/${workerId}/reviews`;
  try {
    const docRef = await addDoc(collection(db, `workers/${workerId}/reviews`), {
      customerId: auth.currentUser.uid,
      jobId,
      voiceReviewUrl,
      rating,
      createdAt: serverTimestamp()
    });
    // We should also increment worker reviews count and avg rating, but for this demo, we'll keep it simple or do it via cloud function.
    // For now we will manually update the worker document
    const workerSnap = await getDoc(doc(db, 'workers', workerId));
    if (workerSnap.exists()) {
      const wData = workerSnap.data();
      const newCount = (wData.reviewsCount || 0) + 1;
      const newRating = ((wData.rating * (wData.reviewsCount || 0)) + rating) / newCount;
      await updateDoc(doc(db, 'workers', workerId), {
        reviewsCount: newCount,
        rating: newRating
      });
    }
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getWorkerReviews = async (workerId: string) => {
  const path = `workers/${workerId}/reviews`;
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const getOpenJobs = async (craftId?: string) => {
  const path = 'jobs';
  try {
    let q = query(
      collection(db, 'jobs'), 
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    if (craftId) {
      q = query(q, where('craftId', '==', craftId));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export interface Job {
  id?: string;
  customerId?: string;
  workerId?: string;
  craftId?: string;
  status?: string;
  isPremium?: boolean;
  urgency?: string;
  voiceRequestUrl?: string;
  additionalVoiceUrls?: string[];
  customerConfirmedCompletion?: boolean;
  workerConfirmedCompletion?: boolean;
  createdAt?: unknown;
}

export const addAdditionalVoiceToJob = async (jobId: string, url: string) => {
  const path = `jobs/${jobId}`;
  try {
    const jobRef = doc(db, 'jobs', jobId);
    const snap = await getDoc(jobRef);
    if (!snap.exists()) return;
    const currentUrls = snap.data().additionalVoiceUrls || [];
    await updateDoc(jobRef, {
      additionalVoiceUrls: [...currentUrls, url]
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const subscribeToJobsAll = (callback: (jobs: Job[]) => void) => {
  const path = 'jobs';
  const q = query(
    collection(db, 'jobs'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const subscribeToJobs = (callback: (jobs: unknown[]) => void, craftId?: string) => {
  const path = 'jobs';
  let q = query(
    collection(db, 'jobs'), 
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc')
  );
  if (craftId) {
    q = query(q, where('craftId', '==', craftId));
  }
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};
