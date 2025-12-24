import api from './api';
import processFirestoreService, { ProcessItem } from './firestore/processFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

// Re-export types
export type { ProcessItem };

// Railway API 서비스 (기존)
const railwayProcessService = {
  getAllProcesses: async (): Promise<ProcessItem[]> => {
    try {
      const response = await api.get('/processes');
      return response.data;
    } catch {
      // 실패시 기본 목록 반환
      return processFirestoreService.getDefaultProcesses();
    }
  },

  createProcess: async (name: string, order: number): Promise<ProcessItem> => {
    const response = await api.post('/processes', { name, order });
    return response.data;
  },

  updateProcess: async (id: number, data: Partial<ProcessItem>): Promise<ProcessItem> => {
    const response = await api.put(`/processes/${id}`, data);
    return response.data;
  },

  deleteProcess: async (id: number): Promise<void> => {
    await api.delete(`/processes/${id}`);
  },

  reorderProcesses: async (processIds: number[]): Promise<void> => {
    await api.put('/processes/reorder', { processIds });
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const processService = {
  getAllProcesses: async (): Promise<ProcessItem[]> => {
    if (getDataSourceConfig()) {
      console.log('[processService] Using Firestore');
      return processFirestoreService.getAllProcesses();
    }
    console.log('[processService] Using Railway API');
    return railwayProcessService.getAllProcesses();
  },

  createProcess: async (name: string, order: number): Promise<ProcessItem> => {
    if (getDataSourceConfig()) {
      console.log('[processService] Using Firestore for create');
      return processFirestoreService.createProcess(name, order);
    }
    console.log('[processService] Using Railway API for create');
    return railwayProcessService.createProcess(name, order);
  },

  updateProcess: async (id: number, data: Partial<ProcessItem>): Promise<ProcessItem> => {
    if (getDataSourceConfig()) {
      console.log('[processService] Using Firestore for update');
      return processFirestoreService.updateProcess(id, data);
    }
    console.log('[processService] Using Railway API for update');
    return railwayProcessService.updateProcess(id, data);
  },

  deleteProcess: async (id: number): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[processService] Using Firestore for delete');
      return processFirestoreService.deleteProcess(id);
    }
    console.log('[processService] Using Railway API for delete');
    return railwayProcessService.deleteProcess(id);
  },

  reorderProcesses: async (processIds: number[]): Promise<void> => {
    if (getDataSourceConfig()) {
      console.log('[processService] Using Firestore for reorder');
      return processFirestoreService.reorderProcesses(processIds);
    }
    console.log('[processService] Using Railway API for reorder');
    return railwayProcessService.reorderProcesses(processIds);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToProcesses: processFirestoreService.subscribeToProcesses,

  // 기본 공정 목록 반환 (공통)
  getDefaultProcesses: processFirestoreService.getDefaultProcesses
};

export default processService;
