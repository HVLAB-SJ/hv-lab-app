import estimatePreviewFirestoreService, {
  EstimateForm,
  EstimateResult,
  SavedEstimate,
  PriceSettings
} from './firestore/estimatePreviewFirestoreService';

// Re-export types
export type { EstimateForm, EstimateResult, SavedEstimate, PriceSettings };

// Firebase Firestore 전용 서비스
const estimatePreviewService = {
  getList: (): Promise<SavedEstimate[]> => {
    return estimatePreviewFirestoreService.getList();
  },

  getById: (id: number): Promise<SavedEstimate | null> => {
    return estimatePreviewFirestoreService.getById(id);
  },

  create: async (formData: EstimateForm, createdByName?: string): Promise<SavedEstimate> => {
    // Firestore에서는 먼저 계산을 수행한 후 저장
    const result = await estimatePreviewFirestoreService.calculate(formData);
    return estimatePreviewFirestoreService.create(formData, result, createdByName);
  },

  delete: (id: number): Promise<void> => {
    return estimatePreviewFirestoreService.delete(id);
  },

  getPriceSettings: (): Promise<{ settings: PriceSettings }> => {
    return estimatePreviewFirestoreService.getPriceSettings();
  },

  savePriceSettings: (settings: PriceSettings): Promise<void> => {
    return estimatePreviewFirestoreService.savePriceSettings(settings);
  },

  calculate: (formData: EstimateForm): Promise<EstimateResult> => {
    return estimatePreviewFirestoreService.calculate(formData);
  }
};

export default estimatePreviewService;
