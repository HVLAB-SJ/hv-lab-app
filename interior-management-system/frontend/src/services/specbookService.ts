import api from './api';
import specbookFirestoreService from './firestore/specbookFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

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

export interface ItemImageData {
  image_url: string | null;
  sub_images: string[];
}

export interface CreateItemData {
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
}

export interface UpdateItemData {
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
}

// Railway API 서비스 (기존)
const railwaySpecbookService = {
  getItemImage: async (itemId: number): Promise<ItemImageData> => {
    const response = await api.get(`/specbook/item/${itemId}/image`);
    return {
      image_url: response.data.image_url,
      sub_images: response.data.sub_images || []
    };
  },

  getLibraryMeta: async (): Promise<SpecBookItem[]> => {
    const response = await api.get('/specbook/library/meta');
    return response.data;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/specbook/categories');
    return response.data;
  },

  getProjectMeta: async (projectId: number): Promise<SpecBookItem[]> => {
    const response = await api.get(`/specbook/project/${projectId}/meta`);
    return response.data;
  },

  getItemById: async (id: number): Promise<SpecBookItem | null> => {
    try {
      const response = await api.get(`/specbook/item/${id}`);
      return response.data;
    } catch {
      return null;
    }
  },

  updateCategories: async (categories: string[]): Promise<void> => {
    await api.put('/specbook/categories', { categories });
  },

  createItemBase64: async (data: CreateItemData): Promise<SpecBookItem> => {
    const response = await api.post('/specbook/base64', data);
    return response.data;
  },

  updateItemBase64: async (id: number, data: UpdateItemData): Promise<SpecBookItem> => {
    const response = await api.put(`/specbook/base64/${id}`, data);
    return response.data;
  },

  deleteItem: async (id: number): Promise<void> => {
    await api.delete(`/specbook/${id}`);
  },

  updateSubImages: async (id: number, subImages: string[]): Promise<void> => {
    await api.put(`/specbook/${id}/sub-images`, { sub_images: subImages });
  },

  reorderItems: async (items: Array<{ id: number; display_order: number }>): Promise<void> => {
    await api.put('/specbook/reorder', { items });
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const specbookService = {
  getItemImage: async (itemId: number): Promise<ItemImageData> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for image');
      const result = await specbookFirestoreService.getItemImage(String(itemId));
      if (result) {
        return result;
      }
      return { image_url: null, sub_images: [] };
    }
    console.log('[specbookService] Using Railway API for image');
    return railwaySpecbookService.getItemImage(itemId);
  },

  getLibraryMeta: async (): Promise<SpecBookItem[]> => {
    if (getDataSourceConfig()) {
      return specbookFirestoreService.getLibraryMeta();
    }
    return railwaySpecbookService.getLibraryMeta();
  },

  getCategories: async (): Promise<string[]> => {
    if (getDataSourceConfig()) {
      return specbookFirestoreService.getCategories();
    }
    return railwaySpecbookService.getCategories();
  },

  getProjectMeta: async (projectId: number): Promise<SpecBookItem[]> => {
    if (getDataSourceConfig()) {
      return specbookFirestoreService.getProjectMeta(projectId);
    }
    return railwaySpecbookService.getProjectMeta(projectId);
  },

  getItemById: async (id: number): Promise<SpecBookItem | null> => {
    if (getDataSourceConfig()) {
      return specbookFirestoreService.getItemById(String(id));
    }
    return railwaySpecbookService.getItemById(id);
  },

  updateCategories: async (categories: string[]): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for updateCategories');
      return specbookFirestoreService.updateCategories(categories);
    }
    console.log('[specbookService] Using Railway API for updateCategories');
    return railwaySpecbookService.updateCategories(categories);
  },

  createItemBase64: async (data: CreateItemData): Promise<SpecBookItem> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for createItemBase64');
      return specbookFirestoreService.createItemBase64(data);
    }
    console.log('[specbookService] Using Railway API for createItemBase64');
    return railwaySpecbookService.createItemBase64(data);
  },

  updateItemBase64: async (id: number, data: UpdateItemData): Promise<SpecBookItem> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for updateItemBase64');
      return specbookFirestoreService.updateItemBase64(id, data);
    }
    console.log('[specbookService] Using Railway API for updateItemBase64');
    return railwaySpecbookService.updateItemBase64(id, data);
  },

  deleteItem: async (id: number): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for deleteItem');
      return specbookFirestoreService.deleteItem(id);
    }
    console.log('[specbookService] Using Railway API for deleteItem');
    return railwaySpecbookService.deleteItem(id);
  },

  updateSubImages: async (id: number, subImages: string[]): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for updateSubImages');
      return specbookFirestoreService.updateSubImages(id, subImages);
    }
    console.log('[specbookService] Using Railway API for updateSubImages');
    return railwaySpecbookService.updateSubImages(id, subImages);
  },

  reorderItems: async (items: Array<{ id: number; display_order: number }>): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[specbookService] Using Firestore for reorderItems');
      return specbookFirestoreService.reorderItems(items);
    }
    console.log('[specbookService] Using Railway API for reorderItems');
    return railwaySpecbookService.reorderItems(items);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToLibraryItems: specbookFirestoreService.subscribeToLibraryItems,
  subscribeToProjectItems: specbookFirestoreService.subscribeToProjectItems
};

export default specbookService;
