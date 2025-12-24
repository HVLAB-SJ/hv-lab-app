import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyAkeHQVa-AH_SFFqxmau_UPWAR1oPOSDl0",
  authDomain: "hv-lab-app.firebaseapp.com",
  projectId: "hv-lab-app",
  storageBucket: "hv-lab-app.firebasestorage.app",
  messagingSenderId: "268116248842",
  appId: "1:268116248842:web:3415b6668e854e99ab92f3"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firestore 인스턴스
export const db = getFirestore(app);

// Storage 인스턴스
export const storage = getStorage(app);

// 오프라인 지원 활성화 (선택적)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('오프라인 지원: 여러 탭이 열려 있어 비활성화됨');
  } else if (err.code === 'unimplemented') {
    console.warn('오프라인 지원: 브라우저에서 지원되지 않음');
  }
});

export default app;
