import specbookFirestoreService from './firestore/specbookFirestoreService';

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

// Firebase Firestore 전용 서비스
const specbookService = {
  getItemImage: async (itemId: number): Promise<ItemImageData> => {
    const result = await specbookFirestoreService.getItemImage(String(itemId));
    return result || { image_url: null, sub_images: [] };
  },

  getLibraryMeta: () => specbookFirestoreService.getLibraryMeta(),
  getCategories: () => specbookFirestoreService.getCategories(),
  getProjectMeta: (projectId: number) => specbookFirestoreService.getProjectMeta(projectId),
  getItemById: (id: number) => specbookFirestoreService.getItemById(String(id)),
  updateCategories: (categories: string[]) => specbookFirestoreService.updateCategories(categories),
  createItemBase64: (data: CreateItemData) => specbookFirestoreService.createItemBase64(data),
  updateItemBase64: (id: number, data: UpdateItemData) => specbookFirestoreService.updateItemBase64(id, data),
  deleteItem: (id: number) => specbookFirestoreService.deleteItem(id),
  updateSubImages: (id: number, subImages: string[]) => specbookFirestoreService.updateSubImages(id, subImages),
  reorderItems: (items: Array<{ id: number; display_order: number }>) => specbookFirestoreService.reorderItems(items),
  subscribeToLibraryItems: specbookFirestoreService.subscribeToLibraryItems,
  subscribeToProjectItems: specbookFirestoreService.subscribeToProjectItems
};

export default specbookService;
