import scheduleFirestoreService from './firestore/scheduleFirestoreService';

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
  asRequestId?: string;
  time?: string;
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
  assigneeNames?: string[];
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
  time?: string;
}

// Firebase Firestore 전용 서비스
const scheduleService = {
  getAllSchedules: (): Promise<ScheduleResponse[]> => {
    return scheduleFirestoreService.getAllSchedules();
  },

  getScheduleById: async (id: string): Promise<ScheduleResponse> => {
    const result = await scheduleFirestoreService.getScheduleById(id);
    if (!result) throw new Error('Schedule not found');
    return result;
  },

  createSchedule: (data: ScheduleData): Promise<ScheduleResponse> => {
    return scheduleFirestoreService.createSchedule(data);
  },

  updateSchedule: (id: string, data: Partial<ScheduleData>): Promise<ScheduleResponse> => {
    return scheduleFirestoreService.updateSchedule(id, data);
  },

  deleteSchedule: (id: string): Promise<void> => {
    return scheduleFirestoreService.deleteSchedule(id);
  },

  // Firestore 실시간 구독
  subscribeToSchedules: scheduleFirestoreService.subscribeToSchedules
};

export default scheduleService;
