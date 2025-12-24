import api from './api';
import projectFirestoreService from './firestore/projectFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

export interface ProjectData {
  name: string;
  client: string | {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  location: string | {
    address: string;
    detailAddress?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  startDate: Date | string;
  endDate: Date | string;
  status?: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  contractAmount: number;
  spent?: number;
  manager: string;
  team?: string[];
  progress?: number;
  description?: string;
  meetingNotes?: Array<{
    id: string;
    content: string;
    date: Date;
  }>;
  customerRequests?: Array<{
    id: string;
    content: string;
    completed: boolean;
    createdAt: Date;
  }>;
  entrancePassword?: string;
  sitePassword?: string;
}

export interface ProjectResponse {
  _id: string;
  id?: number;
  name: string;
  client: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  location: {
    address: string;
    detailAddress?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  startDate: string;
  endDate: string;
  status: 'planning' | 'inProgress' | 'completed' | 'onHold';
  budget: number;
  actualCost: number;
  manager: {
    _id: string;
    name: string;
    username: string;
  } | string;
  fieldManagers: Array<{
    _id: string;
    name: string;
    username: string;
  } | string>;
  workers: Array<{
    _id: string;
    name: string;
    username: string;
  } | string>;
  colorCode: string;
  progress: number;
  description?: string;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>;
  createdBy: {
    _id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  meetingNotes?: Array<{
    id: string;
    content: string;
    date: string | Date;
  }>;
  customerRequests?: Array<{
    id: string;
    content: string;
    completed: boolean;
    createdAt: string | Date;
  }>;
  entrancePassword?: string;
  sitePassword?: string;
}

// Railway API 서비스 (기존)
const railwayProjectService = {
  getAllProjects: async (): Promise<ProjectResponse[]> => {
    const response = await api.get('/projects');
    return response.data;
  },

  getProjectById: async (id: string): Promise<ProjectResponse> => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  createProject: async (data: ProjectData): Promise<ProjectResponse> => {
    const backendData: Record<string, unknown> = {
      name: data.name,
      client: typeof data.client === 'string' ? data.client : data.client.name,
      location: typeof data.location === 'string' ? data.location : data.location.address,
      status: data.status || 'planning',
      manager: data.manager,
      description: data.description || ''
    };

    if (data.startDate) {
      const dateObj = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
      backendData.startDate = dateObj.toISOString().split('T')[0];
    }
    if (data.endDate) {
      const dateObj = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
      backendData.endDate = dateObj.toISOString().split('T')[0];
    }

    console.log('[projectService.createProject] Sending to backend:', backendData);
    const response = await api.post('/projects', backendData);
    return response.data;
  },

  updateProject: async (id: string, data: Partial<ProjectData>): Promise<ProjectResponse> => {
    const backendData: Record<string, unknown> = {};

    if (data.name !== undefined) backendData.name = data.name;
    if (data.client !== undefined) {
      backendData.client = typeof data.client === 'string' ? data.client : data.client.name;
    }
    if (data.location !== undefined) {
      backendData.location = typeof data.location === 'string' ? data.location : data.location.address;
    }
    if (data.startDate !== undefined) {
      if (typeof data.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
        backendData.startDate = data.startDate;
      } else {
        const dateObj = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
        backendData.startDate = dateObj.toISOString().split('T')[0];
      }
    }
    if (data.endDate !== undefined) {
      if (typeof data.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.endDate)) {
        backendData.endDate = data.endDate;
      } else {
        const dateObj = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
        backendData.endDate = dateObj.toISOString().split('T')[0];
      }
    }
    if (data.status !== undefined) backendData.status = data.status;
    if (data.manager !== undefined) backendData.manager = data.manager;
    if (data.description !== undefined) backendData.description = data.description;
    if (data.meetingNotes !== undefined) backendData.meetingNotes = data.meetingNotes;
    if (data.customerRequests !== undefined) backendData.customerRequests = data.customerRequests;
    if (data.entrancePassword !== undefined) backendData.entrancePassword = data.entrancePassword;
    if (data.sitePassword !== undefined) backendData.sitePassword = data.sitePassword;

    console.log('[projectService.updateProject] Sending to backend:', backendData);

    try {
      const response = await api.put(`/projects/${id}`, backendData);
      return response.data;
    } catch (error) {
      const apiError = error as { response?: { data?: unknown } };
      console.error('[projectService.updateProject] Error:', error);
      console.error('[projectService.updateProject] Error response:', apiError.response?.data);
      throw error;
    }
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const projectService = {
  getAllProjects: async (): Promise<ProjectResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[projectService] Using Firestore');
      return projectFirestoreService.getAllProjects();
    }
    console.log('[projectService] Using Railway API');
    return railwayProjectService.getAllProjects();
  },

  getProjectById: async (id: string): Promise<ProjectResponse> => {
    if (getDataSourceConfig()) {
      const result = await projectFirestoreService.getProjectById(id);
      if (!result) throw new Error('Project not found');
      return result;
    }
    return railwayProjectService.getProjectById(id);
  },

  createProject: async (data: ProjectData): Promise<ProjectResponse> => {
    if (getDataSourceConfig()) {
      return projectFirestoreService.createProject(data as unknown as Record<string, unknown>);
    }
    return railwayProjectService.createProject(data);
  },

  updateProject: async (id: string, data: Partial<ProjectData>): Promise<ProjectResponse> => {
    if (getDataSourceConfig()) {
      return projectFirestoreService.updateProject(id, data as unknown as Record<string, unknown>);
    }
    return railwayProjectService.updateProject(id, data);
  },

  deleteProject: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return projectFirestoreService.deleteProject(id);
    }
    return railwayProjectService.deleteProject(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToProjects: projectFirestoreService.subscribeToProjects,
  subscribeToProject: projectFirestoreService.subscribeToProject
};

export default projectService;
