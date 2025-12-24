import projectFirestoreService from './firestore/projectFirestoreService';

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

// Firebase Firestore 전용 서비스
const projectService = {
  getAllProjects: (): Promise<ProjectResponse[]> => {
    return projectFirestoreService.getAllProjects();
  },

  getProjectById: async (id: string): Promise<ProjectResponse> => {
    const result = await projectFirestoreService.getProjectById(id);
    if (!result) throw new Error('Project not found');
    return result;
  },

  createProject: (data: ProjectData): Promise<ProjectResponse> => {
    return projectFirestoreService.createProject(data as unknown as Record<string, unknown>);
  },

  updateProject: (id: string, data: Partial<ProjectData>): Promise<ProjectResponse> => {
    return projectFirestoreService.updateProject(id, data as unknown as Record<string, unknown>);
  },

  deleteProject: (id: string): Promise<void> => {
    return projectFirestoreService.deleteProject(id);
  },

  // Firestore 실시간 구독
  subscribeToProjects: projectFirestoreService.subscribeToProjects,
  subscribeToProject: projectFirestoreService.subscribeToProject
};

export default projectService;
