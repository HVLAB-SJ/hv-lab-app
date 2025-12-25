import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

// Firebase 앱 초기화 (이미 초기화된 경우 기존 앱 사용)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firestore 인스턴스 - 기본 설정 사용 (멀티탭 자동 지원)
export const db = getFirestore(app);

// Storage 인스턴스
export const storage = getStorage(app);

export default app;
