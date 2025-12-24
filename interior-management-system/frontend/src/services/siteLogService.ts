import api from './api';
import siteLogFirestoreService from './firestore/siteLogFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

interface SiteLogData {
  project: string;
  date: Date;
  images: string[];
  notes?: string;
  createdBy: string;
}

// Railway API 서비스 (기존)
const railwaySiteLogService = {
  async getProjectLogs(projectName: string) {
    try {
      const response = await api.get(`/site-logs/project/${encodeURIComponent(projectName)}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get project logs:', error);
      return [];
    }
  },

  async getAllLogs() {
    try {
      const response = await api.get(`/site-logs`);
      return response.data;
    } catch (error) {
      console.error('Failed to get all logs:', error);
      return [];
    }
  },

  async createLog(logData: SiteLogData) {
    try {
      const response = await api.post(`/site-logs`, logData);
      return response.data;
    } catch (error) {
      console.error('Failed to create log:', error);
      throw error;
    }
  },

  async updateLog(id: string, logData: Partial<SiteLogData>) {
    try {
      const response = await api.put(`/site-logs/${id}`, logData);
      return response.data;
    } catch (error) {
      console.error('Failed to update log:', error);
      throw error;
    }
  },

  async deleteLog(id: string) {
    try {
      const response = await api.delete(`/site-logs/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete log:', error);
      throw error;
    }
  },

  async getLogsByDateRange(projectName: string, startDate: Date, endDate: Date) {
    try {
      const response = await api.get(`/site-logs/range`, {
        params: {
          project: projectName,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get logs by date range:', error);
      return [];
    }
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const siteLogService = {
  async getProjectLogs(projectName: string) {
    if (getDataSourceConfig()) {
      console.log('[siteLogService] Using Firestore');
      return siteLogFirestoreService.getProjectLogs(projectName);
    }
    console.log('[siteLogService] Using Railway API');
    return railwaySiteLogService.getProjectLogs(projectName);
  },

  async getAllLogs() {
    if (getDataSourceConfig()) {
      return siteLogFirestoreService.getAllLogs();
    }
    return railwaySiteLogService.getAllLogs();
  },

  async createLog(logData: SiteLogData) {
    if (getDataSourceConfig()) {
      return siteLogFirestoreService.createLog(logData);
    }
    return railwaySiteLogService.createLog(logData);
  },

  async updateLog(id: string, logData: Partial<SiteLogData>) {
    if (getDataSourceConfig()) {
      return siteLogFirestoreService.updateLog(id, logData);
    }
    return railwaySiteLogService.updateLog(id, logData);
  },

  async deleteLog(id: string) {
    if (getDataSourceConfig()) {
      return siteLogFirestoreService.deleteLog(id);
    }
    return railwaySiteLogService.deleteLog(id);
  },

  async getLogsByDateRange(projectName: string, startDate: Date, endDate: Date) {
    if (getDataSourceConfig()) {
      return siteLogFirestoreService.getLogsByDateRange(projectName, startDate, endDate);
    }
    return railwaySiteLogService.getLogsByDateRange(projectName, startDate, endDate);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToLogs: siteLogFirestoreService.subscribeToLogs
};

export default siteLogService;
