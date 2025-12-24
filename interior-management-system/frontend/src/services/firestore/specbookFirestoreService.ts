import { db, storage } from '../../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

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
  },

  // 카테고리 목록 업데이트
  async updateCategories(categories: string[]): Promise<void> {
    const docRef = doc(db, 'specbook_settings', 'categories');
    await setDoc(docRef, {
      categories,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('✅ [Firestore] 카테고리 업데이트 성공');
  },

  // Base64 이미지 업로드 및 아이템 생성
  async createItemBase64(data: {
    name: string;
    category: string;
    brand: string;
    price: string;
    description: string;
    image?: string;
    sub_images?: string[];
    project_id?: number | null;
    is_library?: number;
    display_order?: number;
    grade?: string;
  }): Promise<SpecBookItem> {
    try {
      // 새 ID 생성 (기존 최대 ID + 1)
      const itemsRef = collection(db, 'specbook_items');
      const snapshot = await getDocs(itemsRef);
      let maxId = 0;
      snapshot.docs.forEach(doc => {
        const id = parseInt(doc.id);
        if (!isNaN(id) && id > maxId) maxId = id;
      });
      const newId = maxId + 1;

      let imageUrl: string | null = null;

      // Base64 이미지가 있으면 Firebase Storage에 업로드
      if (data.image && data.image.startsWith('data:')) {
        const base64Data = data.image.split(',')[1];
        const mimeMatch = data.image.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const extension = mimeType.split('/')[1] || 'jpg';

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        const filename = `specbook/${newId}-${Date.now()}.${extension}`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      const now = new Date().toISOString();
      const docRef = doc(db, 'specbook_items', String(newId));

      await setDoc(docRef, {
        name: data.name,
        category: data.category,
        brand: data.brand || '',
        price: data.price || '',
        description: data.description || '',
        image_url: imageUrl,
        sub_images: data.sub_images || [],
        project_id: data.project_id || null,
        is_library: data.is_library ?? 1,
        display_order: data.display_order || 0,
        grade: data.grade || null,
        created_at: now,
        updated_at: now
      });

      console.log('✅ [Firestore] 스펙북 아이템 생성 성공:', newId);

      return {
        id: newId,
        name: data.name,
        category: data.category,
        brand: data.brand || '',
        price: data.price || '',
        description: data.description || '',
        image_url: imageUrl,
        sub_images: data.sub_images || [],
        project_id: data.project_id || null,
        is_library: data.is_library ?? 1,
        display_order: data.display_order || 0,
        grade: data.grade,
        created_at: now,
        updated_at: now
      };
    } catch (error: any) {
      console.error('[Firestore] 스펙북 아이템 생성 실패:', error);
      throw new Error(`아이템 생성 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // Base64 이미지 업로드 및 아이템 수정
  async updateItemBase64(id: number, data: {
    name?: string;
    category?: string;
    brand?: string;
    price?: string;
    description?: string;
    image?: string;
    sub_images?: string[];
    project_id?: number | null;
    is_library?: number;
    display_order?: number;
    grade?: string;
  }): Promise<SpecBookItem> {
    try {
      const docRef = doc(db, 'specbook_items', String(id));
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('아이템을 찾을 수 없습니다.');
      }

      const existingData = docSnap.data();
      let imageUrl = existingData.image_url;

      // Base64 이미지가 있으면 Firebase Storage에 업로드
      if (data.image && data.image.startsWith('data:')) {
        const base64Data = data.image.split(',')[1];
        const mimeMatch = data.image.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const extension = mimeType.split('/')[1] || 'jpg';

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        const filename = `specbook/${id}-${Date.now()}.${extension}`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        updated_at: now
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.description !== undefined) updateData.description = data.description;
      if (imageUrl !== existingData.image_url) updateData.image_url = imageUrl;
      if (data.sub_images !== undefined) updateData.sub_images = data.sub_images;
      if (data.project_id !== undefined) updateData.project_id = data.project_id;
      if (data.is_library !== undefined) updateData.is_library = data.is_library;
      if (data.display_order !== undefined) updateData.display_order = data.display_order;
      if (data.grade !== undefined) updateData.grade = data.grade;

      await updateDoc(docRef, updateData);

      console.log('✅ [Firestore] 스펙북 아이템 수정 성공:', id);

      return parseSpecBookItem(String(id), {
        ...existingData,
        ...updateData,
        image_url: imageUrl
      });
    } catch (error: any) {
      console.error('[Firestore] 스펙북 아이템 수정 실패:', error);
      throw new Error(`아이템 수정 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 아이템 삭제
  async deleteItem(id: number): Promise<void> {
    try {
      const docRef = doc(db, 'specbook_items', String(id));
      await deleteDoc(docRef);
      console.log('✅ [Firestore] 스펙북 아이템 삭제 성공:', id);
    } catch (error: any) {
      console.error('[Firestore] 스펙북 아이템 삭제 실패:', error);
      throw new Error(`아이템 삭제 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 서브 이미지 업데이트
  async updateSubImages(id: number, subImages: string[]): Promise<void> {
    try {
      const docRef = doc(db, 'specbook_items', String(id));
      await updateDoc(docRef, {
        sub_images: subImages,
        updated_at: new Date().toISOString()
      });
      console.log('✅ [Firestore] 서브 이미지 업데이트 성공:', id);
    } catch (error: any) {
      console.error('[Firestore] 서브 이미지 업데이트 실패:', error);
      throw new Error(`서브 이미지 업데이트 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 아이템 순서 변경
  async reorderItems(items: Array<{ id: number; display_order: number }>): Promise<void> {
    try {
      const batch = writeBatch(db);

      items.forEach((item) => {
        const docRef = doc(db, 'specbook_items', String(item.id));
        batch.update(docRef, {
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        });
      });

      await batch.commit();
      console.log('✅ [Firestore] 아이템 순서 변경 성공');
    } catch (error: any) {
      console.error('[Firestore] 아이템 순서 변경 실패:', error);
      throw new Error(`순서 변경 실패: ${error.message || '알 수 없는 오류'}`);
    }
  }
};

export default specbookFirestoreService;
