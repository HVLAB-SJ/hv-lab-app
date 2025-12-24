import { db } from '../../config/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export interface QuoteInquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  projectType?: string;
  budget?: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

// Firestore 타임스탬프를 ISO 문자열로 변환
const timestampToString = (timestamp: Timestamp | string | undefined): string => {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
};

const quoteInquiryFirestoreService = {
  // 모든 견적문의 조회
  async getAllQuoteInquiries(): Promise<QuoteInquiry[]> {
    const inquiriesRef = collection(db, 'quote_inquiries');
    const q = query(inquiriesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address,
        projectType: data.projectType,
        budget: data.budget,
        message: data.message || '',
        createdAt: timestampToString(data.createdAt),
        isRead: data.isRead || false
      };
    });
  },

  // 견적문의 ID로 조회
  async getQuoteInquiryById(id: string): Promise<QuoteInquiry | null> {
    const docRef = doc(db, 'quote_inquiries', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address,
      projectType: data.projectType,
      budget: data.budget,
      message: data.message || '',
      createdAt: timestampToString(data.createdAt),
      isRead: data.isRead || false
    };
  },

  // 견적문의 생성
  async createQuoteInquiry(data: Omit<QuoteInquiry, 'id' | 'createdAt' | 'isRead'>): Promise<QuoteInquiry> {
    const inquiriesRef = collection(db, 'quote_inquiries');

    const newInquiry = {
      ...data,
      isRead: false,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(inquiriesRef, newInquiry);

    return {
      id: docRef.id,
      ...data,
      createdAt: new Date().toISOString(),
      isRead: false
    };
  },

  // 읽음 처리
  async markAsRead(id: string): Promise<void> {
    const docRef = doc(db, 'quote_inquiries', id);
    await updateDoc(docRef, {
      isRead: true,
      updatedAt: serverTimestamp()
    });
  },

  // 견적문의 삭제
  async deleteQuoteInquiry(id: string): Promise<void> {
    const docRef = doc(db, 'quote_inquiries', id);
    await deleteDoc(docRef);
  },

  // 읽지 않은 견적문의 수 조회
  async getUnreadCount(): Promise<number> {
    const inquiries = await this.getAllQuoteInquiries();
    return inquiries.filter(inq => !inq.isRead).length;
  },

  // 실시간 구독
  subscribeToQuoteInquiries(callback: (inquiries: QuoteInquiry[]) => void): () => void {
    const inquiriesRef = collection(db, 'quote_inquiries');
    const q = query(inquiriesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inquiries = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address,
          projectType: data.projectType,
          budget: data.budget,
          message: data.message || '',
          createdAt: timestampToString(data.createdAt),
          isRead: data.isRead || false
        };
      });
      callback(inquiries);
    });

    return unsubscribe;
  }
};

export default quoteInquiryFirestoreService;
