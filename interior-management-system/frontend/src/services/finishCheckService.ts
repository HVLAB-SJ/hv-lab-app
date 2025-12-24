import api from './api';
import finishCheckFirestoreService, {
  type FinishCheckSpace,
  type FinishCheckItem,
  type FinishCheckItemImage
} from './firestore/finishCheckFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

export type { FinishCheckSpace, FinishCheckItem, FinishCheckItemImage };

// Railway API 서비스 (기존)
const railwayFinishCheckService = {
  getSpaces: async (projectId?: number): Promise<FinishCheckSpace[]> => {
    const url = projectId
      ? `/finish-check/spaces?project_id=${projectId}`
      : '/finish-check/spaces';
    const response = await api.get(url);
    return response.data;
  },

  createSpace: async (name: string, projectId: number): Promise<FinishCheckSpace> => {
    const response = await api.post('/finish-check/spaces', {
      name,
      project_id: projectId
    });
    return response.data;
  },

  updateSpace: async (spaceId: number, name: string): Promise<void> => {
    await api.put(`/finish-check/spaces/${spaceId}`, { name });
  },

  deleteSpace: async (spaceId: number): Promise<void> => {
    await api.delete(`/finish-check/spaces/${spaceId}`);
  },

  createItem: async (spaceId: number, content: string): Promise<FinishCheckItem> => {
    const response = await api.post('/finish-check/items', {
      space_id: spaceId,
      content
    });
    return response.data;
  },

  updateItem: async (itemId: number, content: string): Promise<void> => {
    await api.put(`/finish-check/items/${itemId}`, { content });
  },

  deleteItem: async (itemId: number): Promise<void> => {
    await api.delete(`/finish-check/items/${itemId}`);
  },

  toggleItem: async (itemId: number): Promise<FinishCheckItem> => {
    const response = await api.put(`/finish-check/items/${itemId}/toggle`);
    return response.data;
  },

  togglePriority: async (itemId: number): Promise<{ is_priority: number }> => {
    const response = await api.put(`/finish-check/items/${itemId}/toggle-priority`);
    return response.data;
  },

  getImageData: async (imageId: number): Promise<{ image_data: string }> => {
    const response = await api.get(`/finish-check/images/${imageId}`);
    return response.data;
  },

  uploadImage: async (itemId: number, imageData: string, filename: string): Promise<FinishCheckItemImage> => {
    const response = await api.post(`/finish-check/items/${itemId}/images`, {
      image_data: imageData,
      filename
    });
    return response.data;
  },

  deleteImage: async (imageId: number): Promise<void> => {
    await api.delete(`/finish-check/images/${imageId}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const finishCheckService = {
  getSpaces: async (projectId?: number): Promise<FinishCheckSpace[]> => {
    if (getDataSourceConfig()) {
      console.log('[finishCheckService] Using Firestore');
      return finishCheckFirestoreService.getSpaces(projectId);
    }
    console.log('[finishCheckService] Using Railway API');
    return railwayFinishCheckService.getSpaces(projectId);
  },

  createSpace: async (name: string, projectId: number): Promise<FinishCheckSpace> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.createSpace(name, projectId);
    }
    return railwayFinishCheckService.createSpace(name, projectId);
  },

  updateSpace: async (spaceId: string | number, name: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.updateSpace(String(spaceId), name);
    }
    return railwayFinishCheckService.updateSpace(Number(spaceId), name);
  },

  deleteSpace: async (spaceId: string | number): Promise<void> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.deleteSpace(String(spaceId));
    }
    return railwayFinishCheckService.deleteSpace(Number(spaceId));
  },

  createItem: async (spaceId: string | number, content: string): Promise<FinishCheckItem> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.createItem(String(spaceId), content);
    }
    return railwayFinishCheckService.createItem(Number(spaceId), content);
  },

  updateItem: async (itemId: string | number, content: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.updateItem(String(itemId), content);
    }
    return railwayFinishCheckService.updateItem(Number(itemId), content);
  },

  deleteItem: async (itemId: string | number): Promise<void> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.deleteItem(String(itemId));
    }
    return railwayFinishCheckService.deleteItem(Number(itemId));
  },

  toggleItem: async (itemId: string | number): Promise<FinishCheckItem> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.toggleItem(String(itemId));
    }
    return railwayFinishCheckService.toggleItem(Number(itemId));
  },

  togglePriority: async (itemId: string | number): Promise<{ is_priority: number }> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.togglePriority(String(itemId));
    }
    return railwayFinishCheckService.togglePriority(Number(itemId));
  },

  getImageData: async (imageId: string | number): Promise<{ image_data: string } | null> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.getImageData(String(imageId));
    }
    return railwayFinishCheckService.getImageData(Number(imageId));
  },

  uploadImage: async (itemId: string | number, imageData: string, filename: string): Promise<FinishCheckItemImage> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.uploadImage(String(itemId), imageData, filename);
    }
    return railwayFinishCheckService.uploadImage(Number(itemId), imageData, filename);
  },

  deleteImage: async (imageId: string | number): Promise<void> => {
    if (getDataSourceConfig()) {
      return finishCheckFirestoreService.deleteImage(String(imageId));
    }
    return railwayFinishCheckService.deleteImage(Number(imageId));
  }
};

export default finishCheckService;
