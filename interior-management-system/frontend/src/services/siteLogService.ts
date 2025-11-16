import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

interface SiteLogData {
  project: string;
  date: Date;
  images: string[];
  notes?: string;
  weather?: string;
  workers?: number;
  createdBy: string;
}

const siteLogService = {
  // 프로젝트별 일지 조회
  async getProjectLogs(projectName: string) {
    try {
      const response = await axios.get(`${API_URL}/api/site-logs/project/${encodeURIComponent(projectName)}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get project logs:', error);
      return [];
    }
  },

  // 모든 일지 조회
  async getAllLogs() {
    try {
      const response = await axios.get(`${API_URL}/api/site-logs`);
      return response.data;
    } catch (error) {
      console.error('Failed to get all logs:', error);
      return [];
    }
  },

  // 일지 생성
  async createLog(logData: SiteLogData) {
    try {
      const response = await axios.post(`${API_URL}/api/site-logs`, logData);
      return response.data;
    } catch (error) {
      console.error('Failed to create log:', error);
      throw error;
    }
  },

  // 일지 수정
  async updateLog(id: string, logData: Partial<SiteLogData>) {
    try {
      const response = await axios.put(`${API_URL}/api/site-logs/${id}`, logData);
      return response.data;
    } catch (error) {
      console.error('Failed to update log:', error);
      throw error;
    }
  },

  // 일지 삭제
  async deleteLog(id: string) {
    try {
      const response = await axios.delete(`${API_URL}/api/site-logs/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete log:', error);
      throw error;
    }
  },

  // 날짜 범위로 조회
  async getLogsByDateRange(projectName: string, startDate: Date, endDate: Date) {
    try {
      const response = await axios.get(`${API_URL}/api/site-logs/range`, {
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

export default siteLogService;