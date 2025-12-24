import finishCheckFirestoreService, {
  type FinishCheckSpace,
  type FinishCheckItem,
  type FinishCheckItemImage
} from './firestore/finishCheckFirestoreService';

export type { FinishCheckSpace, FinishCheckItem, FinishCheckItemImage };

// Firebase Firestore 전용 서비스
const finishCheckService = {
  getSpaces: (projectId?: number): Promise<FinishCheckSpace[]> => {
    return finishCheckFirestoreService.getSpaces(projectId);
  },

  createSpace: (name: string, projectId: number): Promise<FinishCheckSpace> => {
    return finishCheckFirestoreService.createSpace(name, projectId);
  },

  updateSpace: (spaceId: string | number, name: string): Promise<void> => {
    return finishCheckFirestoreService.updateSpace(String(spaceId), name);
  },

  deleteSpace: (spaceId: string | number): Promise<void> => {
    return finishCheckFirestoreService.deleteSpace(String(spaceId));
  },

  createItem: (spaceId: string | number, content: string): Promise<FinishCheckItem> => {
    return finishCheckFirestoreService.createItem(String(spaceId), content);
  },

  updateItem: (itemId: string | number, content: string): Promise<void> => {
    return finishCheckFirestoreService.updateItem(String(itemId), content);
  },

  deleteItem: (itemId: string | number): Promise<void> => {
    return finishCheckFirestoreService.deleteItem(String(itemId));
  },

  toggleItem: (itemId: string | number): Promise<FinishCheckItem> => {
    return finishCheckFirestoreService.toggleItem(String(itemId));
  },

  togglePriority: (itemId: string | number): Promise<{ is_priority: number }> => {
    return finishCheckFirestoreService.togglePriority(String(itemId));
  },

  getImageData: (imageId: string | number): Promise<{ image_data: string } | null> => {
    return finishCheckFirestoreService.getImageData(String(imageId));
  },

  uploadImage: (itemId: string | number, imageData: string, filename: string): Promise<FinishCheckItemImage> => {
    return finishCheckFirestoreService.uploadImage(String(itemId), imageData, filename);
  },

  deleteImage: (imageId: string | number): Promise<void> => {
    return finishCheckFirestoreService.deleteImage(String(imageId));
  }
};

export default finishCheckService;
