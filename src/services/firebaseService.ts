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
  onSnapshot,
  startAt,
  endAt
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

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
  throw new Error(JSON.stringify(errInfo), { cause: error });
}

// --- Storage Services ---

export const uploadAudio = async (blob: Blob) => {

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

// --- User Profile Services ---

export interface UserProfile {
  uid: string;
  name: string;
  phone?: string;
  role: 'customer' | 'worker';
  location?: { city: string; district?: string };
  lat?: number;
  lng?: number;
  geohash?: string;
  rating?: number;
  reviewsCount?: number;
  status: 'active' | 'suspended' | 'banned';
  isPremium?: boolean;
  voiceFingerprintId?: string;
  voiceProfileUrl?: string;
  craftId?: string;
  isBarakaActive?: boolean;
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null;
  fcmToken?: string;
  reportsCount?: number;
}

// Alias for backwards compatibility with UI
export type WorkerProfile = UserProfile;

export const saveUserProfile = async (profile: Partial<UserProfile>) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `users/${auth.currentUser.uid}`;
  
  let geoHashData = {};
  if (profile.lat && profile.lng) {
    geoHashData = {
      geohash: geohashForLocation([profile.lat, profile.lng]),
      lat: profile.lat,
      lng: profile.lng
    };
  }

  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    const baseData = {
      ...profile,
      ...geoHashData
    };

    if (userSnap.exists()) {
      await updateDoc(userRef, baseData);
    } else {
      await setDoc(userRef, {
        ...baseData,
        uid: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        rating: 5.0,
        reviewsCount: 0,
        reportsCount: 0,
        status: 'active',
        isBarakaActive: false,
        isPremium: false
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateFcmToken = async (token: string) => {
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      fcmToken: token
    });
  } catch (error) {
    console.warn('Failed to save FCM token:', error);
  }
};

// --- Report System ---

export const reportUser = async (targetUserId: string, reason: string, requestId?: string) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = 'reports';
  try {
    await addDoc(collection(db, 'reports'), {
      reporterId: auth.currentUser.uid,
      targetUserId,
      reason,
      requestId,
      createdAt: serverTimestamp()
    });

    // Auto-ban logic simulation (In production this should be a Cloud Function)
    const targetRef = doc(db, 'users', targetUserId);
    const targetSnap = await getDoc(targetRef);
    if (targetSnap.exists()) {
      const data = targetSnap.data();
      const newReportsCount = (data.reportsCount || 0) + 1;
      
      const updates: Record<string, string | number> = {
        reportsCount: newReportsCount
      };

      if (newReportsCount >= 3) {
        updates.status = 'banned';
      }

      await updateDoc(targetRef, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Alias for backwards compatibility
export const saveWorkerProfile = saveUserProfile;

export const getUserProfile = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as UserProfile : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

// Alias for backwards compatibility
export const getWorkerProfile = getUserProfile;

export const updateWorkerBaraka = async (isActive: boolean) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `users/${auth.currentUser.uid}`;
  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      isBarakaActive: isActive
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// --- Request (Job) Services ---

export interface JobRequest {
  id?: string;
  customerId: string;
  voiceRequestUrl: string;
  craftId: string;
  location?: { city: string; district?: string };
  lat?: number;
  lng?: number;
  geohash?: string;
  status: 'open' | 'assigned' | 'completed' | 'cancelled';
  isPremium: boolean;
  urgency: 'normal' | 'emergency';
  workerId?: string;
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null;
}

// Alias for backwards compatibility
export type Job = JobRequest;

export const createJobRequest = async (request: Partial<JobRequest>) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = 'requests';
  
  let geoHashData = {};
  if (request.lat && request.lng) {
    geoHashData = {
      geohash: geohashForLocation([request.lat, request.lng]),
      lat: request.lat,
      lng: request.lng
    };
  }

  try {
    const baseData: Record<string, unknown> = {
      ...request,
      ...geoHashData,
      customerId: auth.currentUser.uid,
      status: 'open',
      createdAt: serverTimestamp(),
      isPremium: false
    };

    // Remove undefined values to prevent Firestore errors
    const cleanedData = Object.fromEntries(
      Object.entries(baseData).filter(([, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, 'requests'), cleanedData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const markJobPremium = async (requestId: string) => {
  const path = `requests/${requestId}`;
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      isPremium: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const assignWorkerToJob = async (requestId: string) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `requests/${requestId}`;
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      status: 'assigned',
      workerId: auth.currentUser.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const confirmJobCompletion = async (requestId: string, role: 'customer' | 'worker') => {
  const path = `requests/${requestId}`;
  try {
    const docRef = doc(db, 'requests', requestId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();

    const updates: Record<string, unknown> = {};
    if (role === 'customer') {
      updates.customerConfirmedCompletion = true;
      if (data.workerConfirmedCompletion) updates.status = 'completed';
    } else {
      updates.workerConfirmedCompletion = true;
      if (data.customerConfirmedCompletion) updates.status = 'completed';
    }

    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --- Response (Bid) Services ---

export interface JobResponse {
  id?: string;
  requestId: string;
  workerId: string;
  voiceResponseUrl: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null;
  // Extra fields for UI convenience
  workerName?: string;
  workerRating?: number;
}

// Alias
export type JobBid = JobResponse;

export const addJobBid = async (requestId: string, voiceResponseUrl: string, profile: WorkerProfile) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = 'responses';
  try {
    const docRef = await addDoc(collection(db, 'responses'), {
      requestId,
      workerId: auth.currentUser.uid,
      voiceResponseUrl,
      status: 'pending',
      createdAt: serverTimestamp(),
      // Denormalized for convenience
      workerName: profile.name,
      workerRating: profile.rating
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const subscribeToResponses = (requestId: string, callback: (responses: JobResponse[]) => void) => {
  const path = 'responses';
  const q = query(
    collection(db, 'responses'),
    where('requestId', '==', requestId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobResponse)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export interface VoiceMessage {
  id?: string;
  jobId: string;
  senderId: string;
  audioUrl: string;
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null;
}

export const subscribeToJobMessages = (jobId: string, callback: (messages: VoiceMessage[]) => void) => {
  const path = 'messages';
  const q = query(
    collection(db, 'messages'),
    where('jobId', '==', jobId),
    orderBy('createdAt', 'asc') // chronological
  );
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceMessage)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const addVoiceMessage = async (jobId: string, audioUrl: string) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = 'messages';
  try {
    const docRef = await addDoc(collection(db, 'messages'), {
      jobId,
      senderId: auth.currentUser.uid,
      audioUrl,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// --- Review Services ---

export interface Review {
  id?: string;
  reviewerId: string;
  revieweeId: string;
  requestId: string;
  rating: number;
  voiceReviewUrl: string;
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null;
}

export const addReview = async (revieweeId: string, requestId: string, voiceReviewUrl: string, rating: number) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  let docRefId = '';
  try {
    const docRef = await addDoc(collection(db, 'reviews'), {
      reviewerId: auth.currentUser.uid,
      revieweeId,
      requestId,
      voiceReviewUrl,
      rating,
      createdAt: serverTimestamp()
    });
    docRefId = docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'reviews - addDoc');
  }
  
  try {
    // Update reviewee rating denormalized
    const userRef = doc(db, 'users', revieweeId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      const newCount = (data.reviewsCount || 0) + 1;
      const newRating = ((data.rating || 5.0) * (data.reviewsCount || 0) + rating) / newCount;
      await updateDoc(userRef, {
        reviewsCount: newCount,
        rating: newRating
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users - updateDoc');
  }

  return docRefId;
};

export const getWorkerReviews = async (workerId: string) => {
  const path = 'reviews';
  try {
    const q = query(
      collection(db, 'reviews'),
      where('revieweeId', '==', workerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// --- Real-time Subscriptions ---

export const subscribeToJobsAll = (callback: (jobs: JobRequest[]) => void) => {
  const path = 'requests';
  const q = query(
    collection(db, 'requests'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobRequest)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const getJobsNearby = async (center: [number, number], radiusInM: number, craftId?: string) => {
  const bounds = geohashQueryBounds(center, radiusInM);
  const promises = [];
  for (const b of bounds) {
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'open'),
      orderBy('geohash'),
      startAt(b[0]),
      endAt(b[1])
    );
    promises.push(getDocs(q));
  }

  const snapshots = await Promise.all(promises);
  const matchingDocs: (JobRequest & { distance: number })[] = [];

  for (const snap of snapshots) {
    for (const d of snap.docs) {
      const lat = d.get('lat');
      const lng = d.get('lng');
      if (lat && lng) {
        const distance = distanceBetween([lat, lng], center) * 1000;
        if (distance <= radiusInM) {
          if (!craftId || d.get('craftId') === craftId) {
            matchingDocs.push({ id: d.id, ...d.data() as JobRequest, distance });
          }
        }
      }
    }
  }
  return matchingDocs.sort((a, b) => (a.distance || 0) - (b.distance || 0));
};
