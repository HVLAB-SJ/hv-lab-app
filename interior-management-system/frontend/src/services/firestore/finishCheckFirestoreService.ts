import { db } from '../../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { uploadImageToStorage, deleteImageFromStorage, isBase64Image } from './storageService';

export interface FinishCheckItemImage {
  id: string;
  item_id: string;
  image_data?: string;
  filename: string | null;
  created_at: string;
}

export interface FinishCheckItem {
  id: string;
  space_id: string;
  content: string;
  is_completed: number;
  is_priority?: number;
  completed_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  images: FinishCheckItemImage[];
}

export interface FinishCheckSpace {
  id: string;
  name: string;
  project_id: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  items: FinishCheckItem[];
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

const finishCheckFirestoreService = {
  // 모든 공간과 항목 조회
  async getSpaces(projectId?: number): Promise<FinishCheckSpace[]> {
    const spacesRef = collection(db, 'finish_check_spaces');
    let q;

    // orderBy 제거 - Firestore 인덱스 필요 없이 클라이언트에서 정렬
    if (projectId) {
      q = query(spacesRef, where('project_id', '==', projectId));
    } else {
      q = query(spacesRef);
    }

    const spacesSnapshot = await getDocs(q);
    // 클라이언트에서 display_order로 정렬
    const sortedSpaceDocs = spacesSnapshot.docs.sort((a, b) =>
      (a.data().display_order || 0) - (b.data().display_order || 0)
    );
    const spaces: FinishCheckSpace[] = [];

    for (const spaceDoc of sortedSpaceDocs) {
      const spaceData = spaceDoc.data();

      // 해당 공간의 항목들 조회 - orderBy 제거
      const itemsRef = collection(db, 'finish_check_items');
      const itemsQuery = query(itemsRef, where('space_id', '==', spaceDoc.id));
      const itemsSnapshot = await getDocs(itemsQuery);
      // 클라이언트에서 정렬
      const sortedItemDocs = itemsSnapshot.docs.sort((a, b) =>
        (a.data().display_order || 0) - (b.data().display_order || 0)
      );

      const items: FinishCheckItem[] = [];

      for (const itemDoc of sortedItemDocs) {
        const itemData = itemDoc.data();

        // 해당 항목의 이미지들 조회 (image_data 없이)
        const imagesRef = collection(db, 'finish_check_images');
        const imagesQuery = query(imagesRef, where('item_id', '==', itemDoc.id));
        const imagesSnapshot = await getDocs(imagesQuery);

        const images: FinishCheckItemImage[] = imagesSnapshot.docs.map(imgDoc => ({
          id: imgDoc.id,
          item_id: itemDoc.id,
          filename: imgDoc.data().filename || null,
          created_at: timestampToString(imgDoc.data().created_at)
        }));

        items.push({
          id: itemDoc.id,
          space_id: spaceDoc.id,
          content: itemData.content || '',
          is_completed: itemData.is_completed || 0,
          is_priority: itemData.is_priority || 0,
          completed_at: itemData.completed_at ? timestampToString(itemData.completed_at) : null,
          display_order: itemData.display_order || 0,
          created_at: timestampToString(itemData.created_at),
          updated_at: timestampToString(itemData.updated_at),
          images
        });
      }

      spaces.push({
        id: spaceDoc.id,
        name: spaceData.name || '',
        project_id: spaceData.project_id || null,
        display_order: spaceData.display_order || 0,
        created_at: timestampToString(spaceData.created_at),
        updated_at: timestampToString(spaceData.updated_at),
        items
      });
    }

    return spaces;
  },

  // 공간 추가
  async createSpace(name: string, projectId: number): Promise<FinishCheckSpace> {
    const spacesRef = collection(db, 'finish_check_spaces');

    // 최대 display_order 조회 - orderBy 제거, 클라이언트에서 계산
    const q = query(spacesRef, where('project_id', '==', projectId));
    const snapshot = await getDocs(q);
    const maxOrder = snapshot.docs.reduce((max, doc) =>
      Math.max(max, doc.data().display_order || 0), 0);

    const newSpace = {
      name,
      project_id: projectId,
      display_order: maxOrder + 1,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    const docRef = await addDoc(spacesRef, newSpace);

    return {
      id: docRef.id,
      name,
      project_id: projectId,
      display_order: maxOrder + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: []
    };
  },

  // 공간 수정
  async updateSpace(spaceId: string, name: string): Promise<void> {
    const spaceRef = doc(db, 'finish_check_spaces', spaceId);
    await updateDoc(spaceRef, {
      name,
      updated_at: serverTimestamp()
    });
  },

  // 공간 삭제
  async deleteSpace(spaceId: string): Promise<void> {
    // 먼저 해당 공간의 모든 항목과 이미지 삭제
    const itemsRef = collection(db, 'finish_check_items');
    const itemsQuery = query(itemsRef, where('space_id', '==', spaceId));
    const itemsSnapshot = await getDocs(itemsQuery);

    for (const itemDoc of itemsSnapshot.docs) {
      // 항목의 이미지 삭제
      const imagesRef = collection(db, 'finish_check_images');
      const imagesQuery = query(imagesRef, where('item_id', '==', itemDoc.id));
      const imagesSnapshot = await getDocs(imagesQuery);

      for (const imgDoc of imagesSnapshot.docs) {
        await deleteDoc(doc(db, 'finish_check_images', imgDoc.id));
      }

      // 항목 삭제
      await deleteDoc(doc(db, 'finish_check_items', itemDoc.id));
    }

    // 공간 삭제
    await deleteDoc(doc(db, 'finish_check_spaces', spaceId));
  },

  // 항목 추가
  async createItem(spaceId: string, content: string): Promise<FinishCheckItem> {
    const itemsRef = collection(db, 'finish_check_items');

    // 최대 display_order 조회 - orderBy 제거, 클라이언트에서 계산
    const q = query(itemsRef, where('space_id', '==', spaceId));
    const snapshot = await getDocs(q);
    const maxOrder = snapshot.docs.reduce((max, doc) =>
      Math.max(max, doc.data().display_order || 0), 0);

    const newItem = {
      space_id: spaceId,
      content,
      is_completed: 0,
      is_priority: 0,
      completed_at: null,
      display_order: maxOrder + 1,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    const docRef = await addDoc(itemsRef, newItem);

    return {
      id: docRef.id,
      space_id: spaceId,
      content,
      is_completed: 0,
      is_priority: 0,
      completed_at: null,
      display_order: maxOrder + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      images: []
    };
  },

  // 항목 수정
  async updateItem(itemId: string, content: string): Promise<void> {
    const itemRef = doc(db, 'finish_check_items', itemId);
    await updateDoc(itemRef, {
      content,
      updated_at: serverTimestamp()
    });
  },

  // 항목 삭제
  async deleteItem(itemId: string): Promise<void> {
    // 항목의 이미지 삭제
    const imagesRef = collection(db, 'finish_check_images');
    const imagesQuery = query(imagesRef, where('item_id', '==', itemId));
    const imagesSnapshot = await getDocs(imagesQuery);

    for (const imgDoc of imagesSnapshot.docs) {
      await deleteDoc(doc(db, 'finish_check_images', imgDoc.id));
    }

    // 항목 삭제
    await deleteDoc(doc(db, 'finish_check_items', itemId));
  },

  // 항목 완료 토글
  async toggleItem(itemId: string): Promise<FinishCheckItem> {
    const itemRef = doc(db, 'finish_check_items', itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) {
      throw new Error('항목을 찾을 수 없습니다.');
    }

    const currentData = itemDoc.data();
    const newIsCompleted = currentData.is_completed ? 0 : 1;

    await updateDoc(itemRef, {
      is_completed: newIsCompleted,
      completed_at: newIsCompleted ? serverTimestamp() : null,
      updated_at: serverTimestamp()
    });

    return {
      id: itemId,
      space_id: currentData.space_id,
      content: currentData.content,
      is_completed: newIsCompleted,
      is_priority: currentData.is_priority || 0,
      completed_at: newIsCompleted ? new Date().toISOString() : null,
      display_order: currentData.display_order || 0,
      created_at: timestampToString(currentData.created_at),
      updated_at: new Date().toISOString(),
      images: []
    };
  },

  // 우선순위 토글
  async togglePriority(itemId: string): Promise<{ is_priority: number }> {
    const itemRef = doc(db, 'finish_check_items', itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) {
      throw new Error('항목을 찾을 수 없습니다.');
    }

    const currentPriority = itemDoc.data().is_priority || 0;
    const newPriority = currentPriority ? 0 : 1;

    await updateDoc(itemRef, {
      is_priority: newPriority,
      updated_at: serverTimestamp()
    });

    return { is_priority: newPriority };
  },

  // 이미지 데이터 조회
  async getImageData(imageId: string): Promise<{ image_data: string } | null> {
    const imageRef = doc(db, 'finish_check_images', imageId);
    const imageDoc = await getDoc(imageRef);

    if (!imageDoc.exists()) {
      return null;
    }

    const data = imageDoc.data();
    // Storage URL이 있으면 그것을 사용, 없으면 기존 image_data 사용
    return { image_data: data.image_url || data.image_data || '' };
  },

  // 이미지 업로드
  async uploadImage(itemId: string, imageData: string, filename: string): Promise<FinishCheckItemImage> {
    const imagesRef = collection(db, 'finish_check_images');

    // 먼저 문서를 생성하여 ID를 얻음
    const tempImage = {
      item_id: itemId,
      image_data: '',
      image_url: '',
      filename,
      created_at: serverTimestamp()
    };

    const docRef = await addDoc(imagesRef, tempImage);

    // Base64 이미지를 Storage로 업로드
    let storedImageData = imageData;
    if (isBase64Image(imageData)) {
      const storageUrl = await uploadImageToStorage('finish_check', docRef.id, imageData);
      // Storage URL로 업데이트
      await updateDoc(docRef, { image_url: storageUrl, image_data: '' });
      storedImageData = storageUrl;
    } else {
      await updateDoc(docRef, { image_data: imageData });
    }

    return {
      id: docRef.id,
      item_id: itemId,
      image_data: storedImageData,
      filename,
      created_at: new Date().toISOString()
    };
  },

  // 이미지 삭제
  async deleteImage(imageId: string): Promise<void> {
    const imageRef = doc(db, 'finish_check_images', imageId);
    const imageDoc = await getDoc(imageRef);

    // Storage 이미지 삭제
    if (imageDoc.exists()) {
      const data = imageDoc.data();
      if (data.image_url) {
        await deleteImageFromStorage(data.image_url);
      }
    }

    await deleteDoc(imageRef);
  }
};

export default finishCheckFirestoreService;
