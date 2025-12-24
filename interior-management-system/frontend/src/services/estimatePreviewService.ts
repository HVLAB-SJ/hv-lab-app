import api from './api';
import estimatePreviewFirestoreService, {
  EstimateForm,
  EstimateResult,
  SavedEstimate,
  PriceSettings
} from './firestore/estimatePreviewFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

// Re-export types
export type { EstimateForm, EstimateResult, SavedEstimate, PriceSettings };

// Railway API 서비스 (기존)
const railwayEstimatePreviewService = {
  getList: async (): Promise<SavedEstimate[]> => {
    const response = await api.get('/estimate-preview/list');
    return response.data;
  },

  getById: async (id: number): Promise<SavedEstimate | null> => {
    try {
      const response = await api.get(`/estimate-preview/${id}`);
      return response.data;
    } catch {
      return null;
    }
  },

  create: async (formData: EstimateForm): Promise<SavedEstimate> => {
    const response = await api.post('/estimate-preview/create', formData);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/estimate-preview/${id}`);
  },

  getPriceSettings: async (): Promise<{ settings: PriceSettings }> => {
    const response = await api.get('/estimate-preview/settings/prices');
    return response.data;
  },

  savePriceSettings: async (settings: PriceSettings): Promise<void> => {
    await api.post('/estimate-preview/settings/prices', { settings });
  },

  calculate: async (formData: EstimateForm): Promise<EstimateResult> => {
    const response = await api.post('/estimate-preview/calculate', formData);
    return response.data;
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const estimatePreviewService = {
  getList: async (): Promise<SavedEstimate[]> => {
    if (getDataSourceConfig()) {
      console.log('[estimatePreviewService] Using Firestore');
      return estimatePreviewFirestoreService.getList();
    }
    console.log('[estimatePreviewService] Using Railway API');
    return railwayEstimatePreviewService.getList();
  },

  getById: async (id: number): Promise<SavedEstimate | null> => {
    if (getDataSourceConfig()) {
      return estimatePreviewFirestoreService.getById(id);
    }
    return railwayEstimatePreviewService.getById(id);
  },

  create: async (formData: EstimateForm, createdByName?: string): Promise<SavedEstimate> => {
    if (getDataSourceConfig()) {
      console.log('[estimatePreviewService] Using Firestore for create');
      // Firestore에서는 먼저 계산을 수행한 후 저장
      const result = await estimatePreviewFirestoreService.calculate(formData);
      return estimatePreviewFirestoreService.create(formData, result, createdByName);
    }
    console.log('[estimatePreviewService] Using Railway API for create');
    return railwayEstimatePreviewService.create(formData);
  },

  delete: async (id: number): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[estimatePreviewService] Using Firestore for delete');
      return estimatePreviewFirestoreService.delete(id);
    }
    console.log('[estimatePreviewService] Using Railway API for delete');
    return railwayEstimatePreviewService.delete(id);
  },

  getPriceSettings: async (): Promise<{ settings: PriceSettings }> => {
    if (getDataSourceConfig()) {
      return estimatePreviewFirestoreService.getPriceSettings();
    }
    return railwayEstimatePreviewService.getPriceSettings();
  },

  savePriceSettings: async (settings: PriceSettings): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[estimatePreviewService] Using Firestore for savePriceSettings');
      return estimatePreviewFirestoreService.savePriceSettings(settings);
    }
    console.log('[estimatePreviewService] Using Railway API for savePriceSettings');
    return railwayEstimatePreviewService.savePriceSettings(settings);
  },

  calculate: async (formData: EstimateForm): Promise<EstimateResult> => {
    if (getDataSourceConfig()) {
      console.log('[estimatePreviewService] Using Firestore for calculate');
      return estimatePreviewFirestoreService.calculate(formData);
    }
    console.log('[estimatePreviewService] Using Railway API for calculate');
    return railwayEstimatePreviewService.calculate(formData);
  }
};

export default estimatePreviewService;
