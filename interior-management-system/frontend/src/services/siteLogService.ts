import siteLogFirestoreService from './firestore/siteLogFirestoreService';

interface SiteLogData {
  project: string;
  date: Date;
  images: string[];
  notes?: string;
  createdBy: string;
}

// Firebase Firestore 전용 서비스
const siteLogService = {
  getProjectLogs: (projectName: string) => {
    return siteLogFirestoreService.getProjectLogs(projectName);
  },

  getAllLogs: () => {
    return siteLogFirestoreService.getAllLogs();
  },

  createLog: (logData: SiteLogData) => {
    return siteLogFirestoreService.createLog(logData);
  },

  updateLog: (id: string, logData: Partial<SiteLogData>) => {
    return siteLogFirestoreService.updateLog(id, logData);
  },

  deleteLog: (id: string) => {
    return siteLogFirestoreService.deleteLog(id);
  },

  getLogsByDateRange: (projectName: string, startDate: Date, endDate: Date) => {
    return siteLogFirestoreService.getLogsByDateRange(projectName, startDate, endDate);
  },

  // Firestore 실시간 구독
  subscribeToLogs: siteLogFirestoreService.subscribeToLogs
};

export default siteLogService;
