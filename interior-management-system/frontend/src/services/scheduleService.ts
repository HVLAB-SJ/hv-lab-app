import api from './api';
import scheduleFirestoreService from './firestore/scheduleFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

export interface ScheduleData {
  project: string;
  title: string;
  type?: 'construction' | 'material' | 'inspection' | 'meeting' | 'other';
  phase?: string;
  startDate: Date | string;
  endDate: Date | string;
  allDay?: boolean;
  assignedTo?: string[];
  description?: string;
  location?: string;
  priority?: 'low' | 'medium' | 'high';
  progress?: number;
  isCompleted?: boolean;
  asRequestId?: string;  // AS 요청 ID
  time?: string;  // 시간 (HH:mm 형식)
}

export interface ScheduleResponse {
  _id: string;
  project: {
    _id: string;
    name: string;
  };
  title: string;
  type: string;
  phase: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  assignedTo: Array<{
    _id: string;
    name: string;
    username: string;
  }>;
  assigneeNames?: string[];  // 담당자 이름 배열
  description?: string;
  location?: string;
  priority: string;
  progress: number;
  isCompleted: boolean;
  completedAt?: string;
  createdBy: {
    _id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  time?: string;  // 시간 (HH:mm 형식)
}

// Railway API 서비스 (기존)
const railwayScheduleService = {
  getAllSchedules: async (): Promise<ScheduleResponse[]> => {
    const response = await api.get('/schedules');
    return response.data;
  },

  getScheduleById: async (id: string): Promise<ScheduleResponse> => {
    const response = await api.get(`/schedules/${id}`);
    return response.data;
  },

  createSchedule: async (data: ScheduleData): Promise<ScheduleResponse> => {
    const response = await api.post('/schedules', {
      project: data.project,
      title: data.title,
      type: data.type || 'other',
      phase: data.phase || '기타',
      startDate: data.startDate,
      endDate: data.endDate,
      allDay: data.allDay !== undefined ? data.allDay : true,
      assignedTo: data.assignedTo || [],
      description: data.description,
      location: data.location,
      priority: data.priority || 'medium',
      progress: data.progress || 0,
      isCompleted: data.isCompleted || false,
      asRequestId: data.asRequestId,
      time: data.time
    });
    return response.data;
  },

  updateSchedule: async (id: string, data: Partial<ScheduleData>): Promise<ScheduleResponse> => {
    const response = await api.put(`/schedules/${id}`, data);
    return response.data;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    await api.delete(`/schedules/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const scheduleService = {
  getAllSchedules: async (): Promise<ScheduleResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[scheduleService] Using Firestore');
      return scheduleFirestoreService.getAllSchedules();
    }
    console.log('[scheduleService] Using Railway API');
    return railwayScheduleService.getAllSchedules();
  },

  getScheduleById: async (id: string): Promise<ScheduleResponse> => {
    if (getDataSourceConfig()) {
      const result = await scheduleFirestoreService.getScheduleById(id);
      if (!result) throw new Error('Schedule not found');
      return result;
    }
    return railwayScheduleService.getScheduleById(id);
  },

  createSchedule: async (data: ScheduleData): Promise<ScheduleResponse> => {
    if (getDataSourceConfig()) {
      return scheduleFirestoreService.createSchedule(data);
    }
    return railwayScheduleService.createSchedule(data);
  },

  updateSchedule: async (id: string, data: Partial<ScheduleData>): Promise<ScheduleResponse> => {
    if (getDataSourceConfig()) {
      return scheduleFirestoreService.updateSchedule(id, data);
    }
    return railwayScheduleService.updateSchedule(id, data);
  },

  deleteSchedule: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return scheduleFirestoreService.deleteSchedule(id);
    }
    return railwayScheduleService.deleteSchedule(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToSchedules: scheduleFirestoreService.subscribeToSchedules
};

export default scheduleService;
