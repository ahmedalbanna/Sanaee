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
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';

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
  const fileName = `${Date.now()}-${auth.currentUser?.uid}.webm`;
  const storageRef = ref(storage, `${folder}/${fileName}`);
  try {
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
};

// --- Worker Services ---

export const saveWorkerProfile = async (profile: unknown) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const path = `workers/${auth.currentUser.uid}`;
  try {
    await setDoc(doc(db, 'workers', auth.currentUser.uid), {
      ...profile,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      rating: 5.0,
      reviewsCount: 0,
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
      ...job,
      customerId: auth.currentUser.uid,
      status: 'open',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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
