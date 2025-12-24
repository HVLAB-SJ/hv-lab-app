import { db } from '../../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';

export interface SpecBookItem {
  id: number;
  name: string;
  category: string;
  brand: string;
  price: string;
  image_url: string | null;
  sub_images?: string[];
  description: string;
  project_id: number | null;
  is_library: number;
  display_order?: number;
  grade?: string;
  created_at: string;
  updated_at: string;
}

// Firestore 데이터를 SpecBookItem으로 변환
const parseSpecBookItem = (docId: string, data: Record<string, unknown>): SpecBookItem => {
  return {
    id: parseInt(docId) || 0,
    name: (data.name as string) || '',
    category: (data.category as string) || '',
    brand: (data.brand as string) || '',
    price: (data.price as string) || '',
    image_url: (data.image_url as string) || null,
    sub_images: data.sub_images as string[] | undefined,
    description: (data.description as string) || '',
    project_id: (data.project_id as number) || null,
    is_library: (data.is_library as number) || 1,
    display_order: data.display_order as number | undefined,
    grade: data.grade as string | undefined,
    created_at: (data.created_at as string) || new Date().toISOString(),
    updated_at: (data.updated_at as string) || new Date().toISOString()
  };
};

const specbookFirestoreService = {
  // 라이브러리 아이템 전체 조회 (메타 정보만)
  async getLibraryMeta(): Promise<SpecBookItem[]> {
    const itemsRef = collection(db, 'specbook_items');
    const q = query(
      itemsRef,
      where('is_library', '==', 1),
      orderBy('category'),
      orderBy('name')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => parseSpecBookItem(doc.id, doc.data()));
  },

  // 카테고리 목록 조회
  async getCategories(): Promise<string[]> {
    const items = await this.getLibraryMeta();
    const categories = [...new Set(items.map(item => item.category))];
    return categories.sort();
  },

  // 프로젝트별 아이템 조회 (메타 정보만)
  async getProjectMeta(projectId: number): Promise<SpecBookItem[]> {
    const itemsRef = collection(db, 'specbook_items');
    const q = query(
      itemsRef,
      where('project_id', '==', projectId),
      orderBy('display_order')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => parseSpecBookItem(doc.id, doc.data()));
  },

  // 아이템 상세 조회
  async getItemById(id: string): Promise<SpecBookItem | null> {
    const docRef = doc(db, 'specbook_items', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return parseSpecBookItem(docSnap.id, docSnap.data());
  },

  // 아이템 이미지 정보 조회
  async getItemImage(id: string): Promise<{ image_url: string | null; sub_images: string[] } | null> {
    const docRef = doc(db, 'specbook_items', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      image_url: (data.image_url as string) || null,
      sub_images: (data.sub_images as string[]) || []
    };
  },

  // 라이브러리 아이템 실시간 구독
  subscribeToLibraryItems(callback: (items: SpecBookItem[]) => void): () => void {
    const itemsRef = collection(db, 'specbook_items');
    const q = query(
      itemsRef,
      where('is_library', '==', 1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => parseSpecBookItem(doc.id, doc.data()));
      // 클라이언트에서 정렬
      items.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
      callback(items);
    });

    return unsubscribe;
  },

  // 프로젝트 아이템 실시간 구독
  subscribeToProjectItems(projectId: number, callback: (items: SpecBookItem[]) => void): () => void {
    const itemsRef = collection(db, 'specbook_items');
    const q = query(
      itemsRef,
      where('project_id', '==', projectId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => parseSpecBookItem(doc.id, doc.data()));
      // 클라이언트에서 정렬
      items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      callback(items);
    });

    return unsubscribe;
  }
};

export default specbookFirestoreService;
