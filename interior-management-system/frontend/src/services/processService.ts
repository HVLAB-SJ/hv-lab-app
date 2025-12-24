import processFirestoreService, { ProcessItem } from './firestore/processFirestoreService';

// Re-export types
export type { ProcessItem };

// Firebase Firestore 전용 서비스
const processService = {
  getAllProcesses: (): Promise<ProcessItem[]> => {
    return processFirestoreService.getAllProcesses();
  },

  createProcess: (name: string, order: number): Promise<ProcessItem> => {
    return processFirestoreService.createProcess(name, order);
  },

  updateProcess: (id: number, data: Partial<ProcessItem>): Promise<ProcessItem> => {
    return processFirestoreService.updateProcess(id, data);
  },

  deleteProcess: (id: number): Promise<void> => {
    return processFirestoreService.deleteProcess(id);
  },

  reorderProcesses: (processIds: number[]): Promise<void> => {
    return processFirestoreService.reorderProcesses(processIds);
  },

  // Firestore 실시간 구독
  subscribeToProcesses: processFirestoreService.subscribeToProcesses,

  // 기본 공정 목록 반환
  getDefaultProcesses: processFirestoreService.getDefaultProcesses
};

export default processService;
