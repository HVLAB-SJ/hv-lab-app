import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import paymentService, { type PaymentResponse } from '../services/paymentService';
import scheduleService, { type ScheduleResponse } from '../services/scheduleService';
import projectService, { type ProjectResponse } from '../services/projectService';
import contractorService, { type ContractorResponse } from '../services/contractorService';
import asRequestService from '../services/asRequestService';
import constructionPaymentService from '../services/constructionPaymentService';
// import workRequestService from '../services/workRequestService';

export interface MeetingNote {
  id: string;
  content: string;
  date: Date;
  createdAt?: Date;
}

export interface CustomerRequest {
  id: string;
  content: string;
  completed: boolean;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  progress: number;
  startDate?: Date;
  endDate?: Date;
  contractAmount: number;
  spent: number;
  manager: string;
  team: string[];
  description?: string;
  meetingNotes?: MeetingNote[];
  customerRequests?: CustomerRequest[];
  entrancePassword?: string;
  sitePassword?: string;
}

export interface Schedule {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'construction' | 'material' | 'inspection' | 'meeting' | 'other';
  project?: string;
  location?: string;
  attendees?: string[];
  description?: string;
  asRequestId?: string;
  time?: string;
}

export interface Payment {
  id: string;
  project: string;
  purpose: string;
  process?: string; // 공정
  itemName?: string; // 항목명
  amount: number;
  materialAmount?: number;
  laborAmount?: number;
  originalMaterialAmount?: number;
  originalLaborAmount?: number;
  applyTaxDeduction?: boolean;
  includesVAT?: boolean;
  category: 'material' | 'labor' | 'equipment' | 'transport' | 'other';
  status: 'pending' | 'reviewing' | 'approved' | 'on-hold' | 'rejected' | 'completed';
  urgency: 'normal' | 'urgent' | 'emergency';
  requestedBy: string;
  requestDate: Date;
  approvalDate?: Date;
  bankInfo?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
  };
  attachments: string[];
  notes?: string;
}

export interface Contractor {
  id: string;
  rank?: string; // 평가 순위
  companyName?: string; // 협력업체 이름
  name: string; // 이름 (개인명)
  position?: string; // 직책
  process: string; // 공정
  contact?: string; // 연락처
  accountNumber: string; // 계좌번호
  notes?: string; // 비고
  createdAt: Date;
  updatedAt: Date;
}

export interface ConstructionPaymentRecord {
  id: string;
  project: string;
  client: string;
  totalAmount: number; // 순수 공사금액
  vatType: 'percentage' | 'amount'; // 부가세 입력 방식
  vatPercentage: number; // 부가세 발행 비율 (0-100%)
  vatAmount: number; // 부가세 직접 입력 금액
  expectedPaymentDates?: {
    contract?: Date; // 계약금
    start?: Date; // 착수금
    middle?: Date; // 중도금
    final?: Date; // 잔금
  };
  payments: {
    type: string; // 쉼표로 구분된 타입들 ('계약금', '계약금, 착수금' 등)
    amount: number;
    date: Date;
    method: string;
    notes?: string;
  }[];
}

export interface ASRequest {
  id: string;
  project: string;
  client: string;
  requestDate: Date;
  siteAddress: string;
  entrancePassword: string;
  description: string;
  scheduledVisitDate?: Date;
  scheduledVisitTime?: string;  // 방문 시간 (HH:mm 형식)
  assignedTo?: string[];
  completionDate?: Date;
  notes?: string;
  status?: 'pending' | 'completed' | 'revisit'; // AS 상태: 대기중, 완료, 재방문
}

export interface ExecutionRecord {
  id: string;
  project: string;
  author?: string; // 작성자
  date: Date;
  process?: string;
  itemName: string;
  materialCost: number;
  laborCost: number;
  vatAmount: number;
  totalAmount: number;
  images?: string[];
  notes?: string;
  paymentId?: string; // 연결된 결제요청 ID
  createdAt: Date;
  updatedAt: Date;
}

interface DataStore {
  projects: Project[];
  schedules: Schedule[];
  payments: Payment[];
  contractors: Contractor[];
  constructionPayments: ConstructionPaymentRecord[];
  asRequests: ASRequest[];
  executionRecords: ExecutionRecord[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, project: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setSchedules: (schedules: Schedule[]) => void;
  addSchedule: (schedule: Schedule) => void;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (id: string, payment: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  setContractors: (contractors: Contractor[]) => void;
  addContractor: (contractor: Contractor) => void;
  updateContractor: (id: string, contractor: Partial<Contractor>) => void;
  deleteContractor: (id: string) => void;
  setConstructionPayments: (constructionPayments: ConstructionPaymentRecord[]) => void;
  addConstructionPayment: (payment: ConstructionPaymentRecord) => void;
  updateConstructionPayment: (id: string, payment: Partial<ConstructionPaymentRecord>) => void;
  deleteConstructionPayment: (id: string) => void;
  setASRequests: (asRequests: ASRequest[]) => void;
  addASRequest: (asRequest: ASRequest) => void;
  updateASRequest: (id: string, asRequest: Partial<ASRequest>) => void;
  deleteASRequest: (id: string) => void;
  setExecutionRecords: (executionRecords: ExecutionRecord[]) => void;
  addExecutionRecord: (executionRecord: ExecutionRecord) => void;
  updateExecutionRecord: (id: string, executionRecord: Partial<ExecutionRecord>) => void;
  deleteExecutionRecord: (id: string) => void;
  // API integration methods
  loadPaymentsFromAPI: () => Promise<void>;
  addPaymentToAPI: (payment: Payment) => Promise<void>;
  updatePaymentInAPI: (id: string, payment: Partial<Payment>) => Promise<void>;
  deletePaymentFromAPI: (id: string) => Promise<void>;
  loadSchedulesFromAPI: () => Promise<void>;
  addScheduleToAPI: (schedule: Schedule) => Promise<void>;
  updateScheduleInAPI: (id: string, schedule: Partial<Schedule>) => Promise<void>;
  deleteScheduleFromAPI: (id: string) => Promise<void>;
  loadProjectsFromAPI: () => Promise<void>;
  addProjectToAPI: (project: Project) => Promise<void>;
  updateProjectInAPI: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProjectFromAPI: (id: string) => Promise<void>;
  loadContractorsFromAPI: () => Promise<void>;
  addContractorToAPI: (contractor: Contractor) => Promise<void>;
  updateContractorInAPI: (id: string, contractor: Partial<Contractor>) => Promise<void>;
  deleteContractorFromAPI: (id: string) => Promise<void>;
  loadConstructionPaymentsFromAPI: () => Promise<void>;
  addConstructionPaymentToAPI: (payment: ConstructionPaymentRecord) => Promise<void>;
  updateConstructionPaymentInAPI: (id: string, payment: Partial<ConstructionPaymentRecord>) => Promise<void>;
  deleteConstructionPaymentFromAPI: (id: string) => Promise<void>;
  loadASRequestsFromAPI: () => Promise<void>;
  addASRequestToAPI: (asRequest: ASRequest) => Promise<ASRequest>;
  updateASRequestInAPI: (id: string, asRequest: Partial<ASRequest>) => Promise<void>;
  deleteASRequestFromAPI: (id: string) => Promise<void>;
}

export const useDataStore = create<DataStore>()(
  persist(
    (set) => ({
  projects: [],

  schedules: [],

  payments: [],

  contractors: [],

  constructionPayments: [],

  asRequests: [],

  executionRecords: [],

  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => {
    // 프로젝트 추가 시 공사대금에도 자동 추가
    const newPaymentRecord: ConstructionPaymentRecord = {
      id: project.id,
      project: project.name,
      client: project.client,
      totalAmount: project.contractAmount,
      vatType: 'percentage',
      vatPercentage: 100,
      vatAmount: 0,
      payments: []
    };
    return {
      projects: [project, ...state.projects],
      constructionPayments: [newPaymentRecord, ...state.constructionPayments]
    };
  }),
  updateProject: (id, updatedProject) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updatedProject } : p))
    })),
  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
    constructionPayments: state.constructionPayments.filter((cp) => cp.id !== id)
  })),

  setSchedules: (schedules) => set({ schedules }),
  addSchedule: (schedule) => set((state) => ({ schedules: [schedule, ...state.schedules] })),
  updateSchedule: (id, updatedSchedule) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? { ...s, ...updatedSchedule } : s))
    })),
  deleteSchedule: (id) => set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) })),

  setPayments: (payments) => set({ payments }),
  addPayment: (payment) => set((state) => ({ payments: [payment, ...state.payments] })),
  updatePayment: (id, updatedPayment) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, ...updatedPayment } : p))
    })),
  deletePayment: (id) => set((state) => ({ payments: state.payments.filter((p) => p.id !== id) })),

  setContractors: (contractors) => set({ contractors }),
  addContractor: (contractor) => set((state) => ({ contractors: [contractor, ...state.contractors] })),
  updateContractor: (id, updatedContractor) =>
    set((state) => ({
      contractors: state.contractors.map((c) => (c.id === id ? { ...c, ...updatedContractor } : c))
    })),
  deleteContractor: (id) => set((state) => ({ contractors: state.contractors.filter((c) => c.id !== id) })),
  setConstructionPayments: (constructionPayments: ConstructionPaymentRecord[]) => set({ constructionPayments }),
  addConstructionPayment: (payment: ConstructionPaymentRecord) => set((state) => ({ constructionPayments: [payment, ...state.constructionPayments] })),
  updateConstructionPayment: (id: string, updatedPayment: Partial<ConstructionPaymentRecord>) =>
    set((state) => ({
      constructionPayments: state.constructionPayments.map((p) => (p.id === id ? { ...p, ...updatedPayment } : p))
    })),
  deleteConstructionPayment: (id: string) => set((state) => ({ constructionPayments: state.constructionPayments.filter((p) => p.id !== id) })),

  setASRequests: (asRequests) => set({ asRequests }),
  addASRequest: (asRequest) => set((state) => ({ asRequests: [asRequest, ...state.asRequests] })),
  updateASRequest: (id, updatedASRequest) =>
    set((state) => ({
      asRequests: state.asRequests.map((req) => (req.id === id ? { ...req, ...updatedASRequest } : req))
    })),
  deleteASRequest: (id) => set((state) => ({ asRequests: state.asRequests.filter((req) => req.id !== id) })),

  setExecutionRecords: (executionRecords) => set({ executionRecords }),
  addExecutionRecord: (executionRecord) => set((state) => ({ executionRecords: [executionRecord, ...state.executionRecords] })),
  updateExecutionRecord: (id, updatedExecutionRecord) =>
    set((state) => ({
      executionRecords: state.executionRecords.map((record) => (record.id === id ? { ...record, ...updatedExecutionRecord } : record))
    })),
  deleteExecutionRecord: (id) => set((state) => ({ executionRecords: state.executionRecords.filter((record) => record.id !== id) })),

  // API integration methods
  loadPaymentsFromAPI: async () => {
    try {
      const apiPayments = await paymentService.getAllPayments();
      const payments: Payment[] = apiPayments.map((p: PaymentResponse) => ({
        id: String(p.id),
        project: p.project_name,
        purpose: p.description,
        process: p.vendor_name,
        itemName: p.item_name || '',
        amount: p.amount,
        materialAmount: p.material_amount || 0,
        laborAmount: p.labor_amount || 0,
        originalLaborAmount: p.original_labor_amount || 0,
        applyTaxDeduction: p.apply_tax_deduction === 1,
        includesVAT: p.includes_vat === 1,
        category: p.request_type as Payment['category'],
        status: p.status,
        urgency: 'normal' as Payment['urgency'],
        requestedBy: p.requester_name,
        requestDate: new Date(p.created_at),
        approvalDate: p.approved_at ? new Date(p.approved_at) : undefined,
        bankInfo: {
          accountHolder: p.account_holder || '',
          bankName: p.bank_name || '',
          accountNumber: p.account_number || ''
        },
        attachments: [],
        notes: p.notes || ''
      }));
      set({ payments });
    } catch (error) {
      console.error('Failed to load payments from API:', error);
      throw error;
    }
  },

  addPaymentToAPI: async (payment: Payment) => {
    try {
      const paymentData = {
        projectId: payment.project,
        purpose: payment.purpose,
        process: payment.process,
        itemName: payment.itemName,
        amount: payment.amount,
        category: payment.category,
        urgency: payment.urgency,
        requestedBy: payment.requestedBy,
        bankInfo: payment.bankInfo,
        notes: payment.notes,
        attachments: [],
        materialAmount: payment.materialAmount || 0,
        laborAmount: payment.laborAmount || 0,
        originalLaborAmount: payment.originalLaborAmount || 0,
        applyTaxDeduction: payment.applyTaxDeduction || false,
        includesVAT: payment.includesVAT || false
      };
      console.log('[addPaymentToAPI] Sending payment data:', paymentData);
      await paymentService.createPayment(paymentData);

      // Reload all payments from API to get the updated list
      const apiPayments = await paymentService.getAllPayments();
      const payments: Payment[] = apiPayments.map((p: PaymentResponse) => ({
        id: String(p.id),
        project: p.project_name,
        purpose: p.description,
        process: p.vendor_name,
        itemName: p.item_name || '',
        amount: p.amount,
        materialAmount: p.material_amount || 0,
        laborAmount: p.labor_amount || 0,
        originalLaborAmount: p.original_labor_amount || 0,
        applyTaxDeduction: p.apply_tax_deduction === 1,
        includesVAT: p.includes_vat === 1,
        category: p.request_type as Payment['category'],
        status: p.status,
        urgency: 'normal' as Payment['urgency'],
        requestedBy: p.requester_name,
        requestDate: new Date(p.created_at),
        approvalDate: p.approved_at ? new Date(p.approved_at) : undefined,
        bankInfo: {
          accountHolder: p.account_holder || '',
          bankName: p.bank_name || '',
          accountNumber: p.account_number || ''
        },
        attachments: [],
        notes: p.notes || ''
      }));
      set({ payments });
    } catch (error) {
      console.error('Failed to add payment to API:', error);
      throw error;
    }
  },

  updatePaymentInAPI: async (id: string, updatedPayment: Partial<Payment>) => {
    try {
      // If only status is being updated, use the status endpoint
      if (updatedPayment.status && Object.keys(updatedPayment).length === 1) {
        await paymentService.updatePaymentStatus(id, updatedPayment.status);
      } else {
        await paymentService.updatePayment(id, {
          projectId: updatedPayment.project,
          purpose: updatedPayment.purpose,
          process: updatedPayment.process,
          itemName: updatedPayment.itemName,
          amount: updatedPayment.amount,
          category: updatedPayment.category,
          urgency: updatedPayment.urgency,
          bankInfo: updatedPayment.bankInfo,
          notes: updatedPayment.notes
        });
      }

      // Reload all payments from API to get the updated list
      const apiPayments = await paymentService.getAllPayments();
      const payments: Payment[] = apiPayments.map((p: PaymentResponse) => ({
        id: String(p.id),
        project: p.project_name,
        purpose: p.description,
        process: p.vendor_name,
        itemName: p.item_name || '',
        amount: p.amount,
        materialAmount: p.material_amount || 0,
        laborAmount: p.labor_amount || 0,
        originalLaborAmount: p.original_labor_amount || 0,
        applyTaxDeduction: p.apply_tax_deduction === 1,
        includesVAT: p.includes_vat === 1,
        category: p.request_type as Payment['category'],
        status: p.status,
        urgency: 'normal' as Payment['urgency'],
        requestedBy: p.requester_name,
        requestDate: new Date(p.created_at),
        approvalDate: p.approved_at ? new Date(p.approved_at) : undefined,
        bankInfo: {
          accountHolder: p.account_holder || '',
          bankName: p.bank_name || '',
          accountNumber: p.account_number || ''
        },
        attachments: [],
        notes: p.notes || ''
      }));
      set({ payments });
    } catch (error) {
      console.error('Failed to update payment in API:', error);
      throw error;
    }
  },

  deletePaymentFromAPI: async (id: string) => {
    try {
      await paymentService.deletePayment(id);
      set((state) => ({ payments: state.payments.filter((p) => p.id !== id) }));
    } catch (error) {
      console.error('Failed to delete payment from API:', error);
      throw error;
    }
  },

  // Schedule API integration methods
  loadSchedulesFromAPI: async () => {
    try {
      const apiSchedules = await scheduleService.getAllSchedules();
      console.log('🟣 LOAD SCHEDULES - Raw API response sample:', apiSchedules[0]);
      const schedules: Schedule[] = apiSchedules.map((s: ScheduleResponse) => {
        console.log('🟣 Processing schedule:', {
          id: s._id,
          title: s.title,
          assigneeNames: s.assigneeNames,
          assignedTo: s.assignedTo,
          assignedToType: typeof s.assignedTo,
          assignedToLength: Array.isArray(s.assignedTo) ? s.assignedTo.length : 'not array'
        });

        const attendees = s.assigneeNames || s.assignedTo?.map(a => typeof a === 'object' ? a.name : a) || [];
        console.log('🟣 Final attendees:', attendees);

        return {
          id: s._id,
          title: s.title,
          start: new Date(s.startDate),
          end: new Date(s.endDate),
          type: s.type as Schedule['type'],
          project: typeof s.project === 'object' ? s.project.name : s.project,
          location: s.location,
          attendees,
          description: s.description,
          time: s.time
        };
      });
      set({ schedules });
    } catch (error) {
      console.error('Failed to load schedules from API:', error);
      throw error;
    }
  },

  addScheduleToAPI: async (schedule: Schedule & { asRequestId?: string }) => {
    try {
      const apiSchedule = await scheduleService.createSchedule({
        project: schedule.project || '',
        title: schedule.title,
        type: schedule.type,
        startDate: schedule.start,
        endDate: schedule.end,
        allDay: !schedule.time || schedule.time === '-',
        location: schedule.location,
        assignedTo: schedule.attendees || [],
        description: schedule.description,
        asRequestId: schedule.asRequestId,
        time: schedule.time
      });

      const newSchedule: Schedule = {
        id: apiSchedule._id,
        title: apiSchedule.title,
        start: new Date(apiSchedule.startDate),
        end: new Date(apiSchedule.endDate),
        type: apiSchedule.type as Schedule['type'],
        project: typeof apiSchedule.project === 'object' ? apiSchedule.project.name : apiSchedule.project,
        location: apiSchedule.location,
        attendees: apiSchedule.assigneeNames || apiSchedule.assignedTo?.map(a => typeof a === 'object' ? a.name : a) || [],
        description: apiSchedule.description,
        time: apiSchedule.time
      };

      set((state) => ({ schedules: [newSchedule, ...state.schedules] }));
    } catch (error) {
      console.error('Failed to add schedule to API:', error);
      throw error;
    }
  },

  updateScheduleInAPI: async (id: string, updatedSchedule: Partial<Schedule>) => {
    try {
      console.log('📤 updateScheduleInAPI called with:', { id, updatedSchedule });
      const apiSchedule = await scheduleService.updateSchedule(id, {
        project: updatedSchedule.project,
        title: updatedSchedule.title,
        type: updatedSchedule.type,
        startDate: updatedSchedule.start,
        endDate: updatedSchedule.end,
        location: updatedSchedule.location,
        description: updatedSchedule.description,
        assignedTo: updatedSchedule.attendees || [],
        time: updatedSchedule.time
      });
      console.log('✅ updateScheduleInAPI response:', apiSchedule);

      const schedule: Schedule = {
        id: apiSchedule._id,
        title: apiSchedule.title,
        start: new Date(apiSchedule.startDate),
        end: new Date(apiSchedule.endDate),
        type: apiSchedule.type as Schedule['type'],
        project: typeof apiSchedule.project === 'object' ? apiSchedule.project.name : apiSchedule.project,
        location: apiSchedule.location,
        attendees: apiSchedule.assigneeNames || apiSchedule.assignedTo?.map(a => typeof a === 'object' ? a.name : a) || [],
        description: apiSchedule.description,
        time: apiSchedule.time
      };

      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s))
      }));
    } catch (error) {
      console.error('Failed to update schedule in API:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        response: error && typeof error === 'object' && 'response' in error ? (error as { response?: { data?: unknown } }).response?.data : undefined,
        status: error && typeof error === 'object' && 'response' in error ? (error as { response?: { status?: number } }).response?.status : undefined
      });
      throw error;
    }
  },

  deleteScheduleFromAPI: async (id: string) => {
    try {
      await scheduleService.deleteSchedule(id);
      set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) }));
    } catch (error) {
      console.error('Failed to delete schedule from API:', error);
      throw error;
    }
  },

  // Project API integration methods
  loadProjectsFromAPI: async () => {
    try {
      const apiProjects = await projectService.getAllProjects();
      const projects: Project[] = apiProjects.map((p: ProjectResponse) => ({
        id: p._id || p.id,
        name: p.name,
        // Backend returns 'client' as string, 'location' or 'address' for address
        client: typeof p.client === 'object' ? p.client.name : (p.client || '미등록'),
        location: typeof p.location === 'object' ? p.location.address : (p.location || p.address || '미등록'),
        status: p.status === 'inProgress' ? 'in-progress' : (p.status === 'onHold' ? 'on-hold' : p.status) as Project['status'],
        progress: p.progress || 0,
        // Backend returns 'start_date', 'end_date' (snake_case) or 'startDate', 'endDate' (camelCase)
        startDate: (p.startDate || p.start_date) ? new Date(p.startDate || p.start_date) : undefined,
        endDate: (p.endDate || p.end_date) ? new Date(p.endDate || p.end_date) : undefined,
        contractAmount: p.budget || p.contractAmount || 0,
        spent: p.actualCost || p.spent || 0,
        // Backend returns 'manager' field with manager name(s)
        manager: p.manager || '미지정',
        // team: p.fieldManagers?.map(fm => typeof fm === 'object' ? fm.name : fm) || [],
        team: [], // 팀 정보를 항상 빈 배열로 설정하여 자동 할당 방지
        description: p.description || '',
        meetingNotes: (p.meetingNotes as unknown[])?.map((note: { id: string; content: string; date: string }) => ({
          id: note.id,
          content: note.content,
          date: new Date(note.date)
        })) || [],
        customerRequests: (p.customerRequests as unknown[])?.map((req: { id: string; content: string; completed: boolean; createdAt: string }) => ({
          id: req.id,
          content: req.content,
          completed: req.completed,
          createdAt: new Date(req.createdAt)
        })) || [],
        entrancePassword: (p.entrancePassword as string | undefined) || '',
        sitePassword: (p.sitePassword as string | undefined) || ''
      }));
      set({ projects });
    } catch (error) {
      console.error('Failed to load projects from API:', error);
      throw error;
    }
  },

  addProjectToAPI: async (project: Project) => {
    try {
      const apiProject = await projectService.createProject({
        name: project.name,
        client: project.client,
        location: project.location,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
        contractAmount: project.contractAmount,
        spent: project.spent,
        manager: project.manager,
        team: project.team,
        progress: project.progress,
        description: project.description
      });

      const newProject: Project = {
        id: apiProject._id || apiProject.id,
        name: apiProject.name,
        // Backend returns 'client' as string, 'location' or 'address' for address
        client: typeof apiProject.client === 'object' ? apiProject.client.name : (apiProject.client || '미등록'),
        location: typeof apiProject.location === 'object' ? apiProject.location.address : (apiProject.location || apiProject.address || '미등록'),
        status: apiProject.status === 'inProgress' ? 'in-progress' : (apiProject.status === 'onHold' ? 'on-hold' : apiProject.status) as Project['status'],
        progress: apiProject.progress || 0,
        // Backend returns 'start_date', 'end_date' (snake_case) or 'startDate', 'endDate' (camelCase)
        startDate: (apiProject.startDate || apiProject.start_date) ? new Date(apiProject.startDate || apiProject.start_date) : undefined,
        endDate: (apiProject.endDate || apiProject.end_date) ? new Date(apiProject.endDate || apiProject.end_date) : undefined,
        contractAmount: apiProject.budget || apiProject.contractAmount || 0,
        spent: apiProject.actualCost || apiProject.spent || 0,
        // Backend returns 'manager' field with manager name(s)
        manager: apiProject.manager || '미지정',
        team: [], // 팀 정보를 항상 빈 배열로 설정하여 자동 할당 방지
        description: apiProject.description || '',
        meetingNotes: (apiProject as { meetingNotes?: Array<{ id: string; content: string; date: string | Date }> }).meetingNotes?.map((note) => ({
          id: note.id,
          content: note.content,
          date: new Date(note.date)
        })) || [],
        customerRequests: (apiProject as { customerRequests?: Array<{ id: string; content: string; completed: boolean; createdAt: string | Date }> }).customerRequests?.map((req) => ({
          id: req.id,
          content: req.content,
          completed: req.completed,
          createdAt: new Date(req.createdAt)
        })) || [],
        entrancePassword: (apiProject.entrancePassword as string | undefined) || '',
        sitePassword: (apiProject.sitePassword as string | undefined) || ''
      };

      set((state) => ({ projects: [newProject, ...state.projects] }));
    } catch (error) {
      console.error('Failed to add project to API:', error);
      throw error;
    }
  },

  updateProjectInAPI: async (id: string, updatedProject: Partial<Project>) => {
    try {
      const apiProject = await projectService.updateProject(id, updatedProject);

      const project: Project = {
        id: apiProject._id || apiProject.id,
        name: apiProject.name,
        // Backend returns 'client' as string, 'location' or 'address' for address
        client: typeof apiProject.client === 'object' ? apiProject.client.name : (apiProject.client || '미등록'),
        location: typeof apiProject.location === 'object' ? apiProject.location.address : (apiProject.location || apiProject.address || '미등록'),
        status: apiProject.status === 'inProgress' ? 'in-progress' : (apiProject.status === 'onHold' ? 'on-hold' : apiProject.status) as Project['status'],
        progress: apiProject.progress || 0,
        // Backend returns 'start_date', 'end_date' (snake_case) or 'startDate', 'endDate' (camelCase)
        startDate: (apiProject.startDate || apiProject.start_date) ? new Date(apiProject.startDate || apiProject.start_date) : undefined,
        endDate: (apiProject.endDate || apiProject.end_date) ? new Date(apiProject.endDate || apiProject.end_date) : undefined,
        contractAmount: apiProject.budget || apiProject.contractAmount || 0,
        spent: apiProject.actualCost || apiProject.spent || 0,
        // Backend returns 'manager' field with manager name(s)
        manager: apiProject.manager || '미지정',
        team: [], // 팀 정보를 항상 빈 배열로 설정하여 자동 할당 방지
        description: apiProject.description || '',
        meetingNotes: (apiProject as { meetingNotes?: Array<{ id: string; content: string; date: string | Date }> }).meetingNotes?.map((note) => ({
          id: note.id,
          content: note.content,
          date: new Date(note.date)
        })) || [],
        customerRequests: (apiProject as { customerRequests?: Array<{ id: string; content: string; completed: boolean; createdAt: string | Date }> }).customerRequests?.map((req) => ({
          id: req.id,
          content: req.content,
          completed: req.completed,
          createdAt: new Date(req.createdAt)
        })) || [],
        entrancePassword: (apiProject.entrancePassword as string | undefined) || '',
        sitePassword: (apiProject.sitePassword as string | undefined) || ''
      };

      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? project : p))
      }));
    } catch (error) {
      console.error('Failed to update project in API:', error);
      throw error;
    }
  },

  deleteProjectFromAPI: async (id: string) => {
    try {
      await projectService.deleteProject(id);
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
    } catch (error) {
      console.error('Failed to delete project from API:', error);
      throw error;
    }
  },

  // Contractor API integration methods
  loadContractorsFromAPI: async () => {
    try {
      const apiContractors = await contractorService.getAllContractors();
      const contractors: Contractor[] = apiContractors.map((c: ContractorResponse) => ({
        id: c._id,
        rank: c.rank,
        companyName: c.companyName,
        name: c.name,
        process: c.process,
        contact: c.contact,
        accountNumber: c.accountNumber,
        notes: c.notes,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
      }));
      set({ contractors });
    } catch (error) {
      console.error('Failed to load contractors from API:', error);
      throw error;
    }
  },

  addContractorToAPI: async (contractor: Contractor) => {
    try {
      const apiContractor = await contractorService.createContractor({
        rank: contractor.rank,
        companyName: contractor.companyName,
        name: contractor.name,
        process: contractor.process,
        contact: contractor.contact,
        accountNumber: contractor.accountNumber,
        notes: contractor.notes
      });

      const newContractor: Contractor = {
        id: apiContractor._id,
        rank: apiContractor.rank,
        companyName: apiContractor.companyName,
        name: apiContractor.name,
        process: apiContractor.process,
        contact: apiContractor.contact,
        accountNumber: apiContractor.accountNumber,
        notes: apiContractor.notes,
        createdAt: new Date(apiContractor.createdAt),
        updatedAt: new Date(apiContractor.updatedAt)
      };

      set((state) => ({ contractors: [newContractor, ...state.contractors] }));
    } catch (error) {
      console.error('Failed to add contractor to API:', error);
      throw error;
    }
  },

  updateContractorInAPI: async (id: string, updatedContractor: Partial<Contractor>) => {
    try {
      const apiContractor = await contractorService.updateContractor(id, {
        rank: updatedContractor.rank,
        companyName: updatedContractor.companyName,
        name: updatedContractor.name,
        process: updatedContractor.process,
        contact: updatedContractor.contact,
        accountNumber: updatedContractor.accountNumber,
        notes: updatedContractor.notes
      });

      const contractor: Contractor = {
        id: apiContractor._id,
        rank: apiContractor.rank,
        companyName: apiContractor.companyName,
        name: apiContractor.name,
        process: apiContractor.process,
        contact: apiContractor.contact,
        accountNumber: apiContractor.accountNumber,
        notes: apiContractor.notes,
        createdAt: new Date(apiContractor.createdAt),
        updatedAt: new Date(apiContractor.updatedAt)
      };

      set((state) => ({
        contractors: state.contractors.map((c) => (c.id === id ? contractor : c))
      }));
    } catch (error) {
      console.error('Failed to update contractor in API:', error);
      throw error;
    }
  },

  deleteContractorFromAPI: async (id: string) => {
    try {
      await contractorService.deleteContractor(id);
      set((state) => ({ contractors: state.contractors.filter((c) => c.id !== id) }));
    } catch (error) {
      console.error('Failed to delete contractor from API:', error);
      throw error;
    }
  },

  // Construction Payment API integration methods
  loadConstructionPaymentsFromAPI: async () => {
    try {
      const apiConstructionPayments = await constructionPaymentService.getAllConstructionPayments();
      const constructionPayments: ConstructionPaymentRecord[] = apiConstructionPayments.map((cp) => {
        // Convert expectedPaymentDates from strings to Date objects
        let expectedPaymentDates = undefined;
        if (cp.expectedPaymentDates) {
          expectedPaymentDates = {
            contract: cp.expectedPaymentDates.contract ? new Date(cp.expectedPaymentDates.contract) : undefined,
            start: cp.expectedPaymentDates.start ? new Date(cp.expectedPaymentDates.start) : undefined,
            middle: cp.expectedPaymentDates.middle ? new Date(cp.expectedPaymentDates.middle) : undefined,
            final: cp.expectedPaymentDates.final ? new Date(cp.expectedPaymentDates.final) : undefined,
          };
        }

        return {
          id: cp._id,
          project: cp.project,
          client: cp.client,
          totalAmount: cp.totalAmount,
          vatType: cp.vatType,
          vatPercentage: cp.vatPercentage,
          vatAmount: cp.vatAmount,
          expectedPaymentDates,
          payments: cp.payments?.map((p) => {
            // Safe date conversion - fallback to current date if invalid
            const dateValue = p.date ? new Date(p.date) : new Date();
            const validDate = isNaN(dateValue.getTime()) ? new Date() : dateValue;

            return {
              type: p.type || p.types?.[0] || '계약금',
              amount: p.amount,
              date: validDate,
              method: p.method,
              notes: p.notes
            };
          }) || []
        };
      });
      set({ constructionPayments });
    } catch (error) {
      console.error('Failed to load construction payments from API:', error);
      throw error;
    }
  },

  addConstructionPaymentToAPI: async (payment: ConstructionPaymentRecord) => {
    try {
      const apiPayment = await constructionPaymentService.createConstructionPayment(payment);

      const newPayment: ConstructionPaymentRecord = {
        id: apiPayment._id,
        project: apiPayment.project,
        client: apiPayment.client,
        totalAmount: apiPayment.totalAmount,
        vatType: apiPayment.vatType,
        vatPercentage: apiPayment.vatPercentage,
        vatAmount: apiPayment.vatAmount,
        payments: apiPayment.payments?.map((p) => {
          // Safe date conversion - fallback to current date if invalid
          const dateValue = p.date ? new Date(p.date) : new Date();
          const validDate = isNaN(dateValue.getTime()) ? new Date() : dateValue;

          return {
            type: p.type || p.types?.[0] || '계약금',
            amount: p.amount,
            date: validDate,
            method: p.method,
            notes: p.notes
          };
        }) || []
      };

      set((state) => ({ constructionPayments: [newPayment, ...state.constructionPayments] }));
    } catch (error) {
      console.error('Failed to add construction payment to API:', error);
      throw error;
    }
  },

  updateConstructionPaymentInAPI: async (id: string, updatedPayment: Partial<ConstructionPaymentRecord>) => {
    try {
      const apiPayment = await constructionPaymentService.updateConstructionPayment(id, updatedPayment);

      // Convert expectedPaymentDates from strings to Date objects
      let expectedPaymentDates = undefined;
      if (apiPayment.expectedPaymentDates) {
        expectedPaymentDates = {
          contract: apiPayment.expectedPaymentDates.contract ? new Date(apiPayment.expectedPaymentDates.contract) : undefined,
          start: apiPayment.expectedPaymentDates.start ? new Date(apiPayment.expectedPaymentDates.start) : undefined,
          middle: apiPayment.expectedPaymentDates.middle ? new Date(apiPayment.expectedPaymentDates.middle) : undefined,
          final: apiPayment.expectedPaymentDates.final ? new Date(apiPayment.expectedPaymentDates.final) : undefined,
        };
      }

      const payment: ConstructionPaymentRecord = {
        id: apiPayment._id,
        project: apiPayment.project,
        client: apiPayment.client,
        totalAmount: apiPayment.totalAmount,
        vatType: apiPayment.vatType,
        vatPercentage: apiPayment.vatPercentage,
        vatAmount: apiPayment.vatAmount,
        expectedPaymentDates,
        payments: apiPayment.payments?.map((p) => ({
          type: p.type || p.types?.[0] || '계약금',
          amount: p.amount,
          date: new Date(p.date),
          method: p.method,
          notes: p.notes
        })) || []
      };

      set((state) => ({
        constructionPayments: state.constructionPayments.map((p) => (p.id === id ? payment : p))
      }));
    } catch (error) {
      console.error('Failed to update construction payment in API:', error);
      throw error;
    }
  },

  deleteConstructionPaymentFromAPI: async (id: string) => {
    try {
      await constructionPaymentService.deleteConstructionPayment(id);
      set((state) => ({ constructionPayments: state.constructionPayments.filter((p) => p.id !== id) }));
    } catch (error) {
      console.error('Failed to delete construction payment from API:', error);
      throw error;
    }
  },

  // AS Request API integration methods
  loadASRequestsFromAPI: async () => {
    try {
      const apiASRequests = await asRequestService.getAllASRequests();
      const asRequests: ASRequest[] = apiASRequests.map((req) => ({
        id: req._id,
        project: req.project,
        client: req.client,
        requestDate: new Date(req.requestDate),
        siteAddress: req.siteAddress,
        entrancePassword: req.entrancePassword,
        description: req.description,
        scheduledVisitDate: req.scheduledVisitDate ? new Date(req.scheduledVisitDate) : undefined,
        scheduledVisitTime: req.scheduledVisitTime,
        assignedTo: req.assignedTo || [],
        completionDate: req.completionDate ? new Date(req.completionDate) : undefined,
        notes: req.notes,
        status: req.status || 'pending'
      }));
      set({ asRequests });
    } catch (error) {
      console.error('Failed to load AS requests from API:', error);
      throw error;
    }
  },

  addASRequestToAPI: async (asRequest: ASRequest) => {
    try {
      const apiASRequest = await asRequestService.createASRequest(asRequest);

      const newASRequest: ASRequest = {
        id: apiASRequest._id,
        project: apiASRequest.project,
        client: apiASRequest.client,
        requestDate: new Date(apiASRequest.requestDate),
        siteAddress: apiASRequest.siteAddress,
        entrancePassword: apiASRequest.entrancePassword,
        description: apiASRequest.description,
        scheduledVisitDate: apiASRequest.scheduledVisitDate ? new Date(apiASRequest.scheduledVisitDate) : undefined,
        scheduledVisitTime: apiASRequest.scheduledVisitTime,
        assignedTo: Array.isArray(apiASRequest.assignedTo) ? apiASRequest.assignedTo : [],
        completionDate: apiASRequest.completionDate ? new Date(apiASRequest.completionDate) : undefined,
        notes: apiASRequest.notes
      };

      set((state) => ({ asRequests: [newASRequest, ...state.asRequests] }));
      return newASRequest;
    } catch (error) {
      console.error('Failed to add AS request to API:', error);
      throw error;
    }
  },

  updateASRequestInAPI: async (id: string, updatedASRequest: Partial<ASRequest>) => {
    try {
      const apiASRequest = await asRequestService.updateASRequest(id, updatedASRequest);

      const asRequest: ASRequest = {
        id: apiASRequest._id,
        project: apiASRequest.project,
        client: apiASRequest.client,
        requestDate: new Date(apiASRequest.requestDate),
        siteAddress: apiASRequest.siteAddress,
        entrancePassword: apiASRequest.entrancePassword,
        description: apiASRequest.description,
        scheduledVisitDate: apiASRequest.scheduledVisitDate ? new Date(apiASRequest.scheduledVisitDate) : undefined,
        scheduledVisitTime: apiASRequest.scheduledVisitTime,
        assignedTo: Array.isArray(apiASRequest.assignedTo) ? apiASRequest.assignedTo : [],
        completionDate: apiASRequest.completionDate ? new Date(apiASRequest.completionDate) : undefined,
        notes: apiASRequest.notes,
        status: apiASRequest.status || 'pending'
      };

      set((state) => ({
        asRequests: state.asRequests.map((req) => (req.id === id ? asRequest : req))
      }));
    } catch (error) {
      console.error('Failed to update AS request in API:', error);
      throw error;
    }
  },

  deleteASRequestFromAPI: async (id: string) => {
    try {
      await asRequestService.deleteASRequest(id);
      set((state) => ({ asRequests: state.asRequests.filter((req) => req.id !== id) }));
    } catch (error) {
      console.error('Failed to delete AS request from API:', error);
      throw error;
    }
  }
    }),
    {
      name: 'interior-management-storage',
      // Date 객체를 저장하고 복원하기 위한 커스텀 직렬화
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);

          // Date 문자열을 Date 객체로 변환 및 budget → contractAmount 마이그레이션
          const projects = state.projects?.map((p: { id: string; name: string; client: string; startDate?: string; endDate?: string; contractAmount?: number; budget?: number; [key: string]: unknown }) => ({
            ...p,
            startDate: p.startDate ? new Date(p.startDate) : undefined,
            endDate: p.endDate ? new Date(p.endDate) : undefined,
            // 마이그레이션: budget 필드를 contractAmount로 변환
            contractAmount: p.contractAmount !== undefined ? p.contractAmount : p.budget || 0,
          })) || [];

          const existingConstructionPayments = state.constructionPayments?.map((cp: { id: string; vatType?: string; vatPercentage?: number; vatAmount?: number; payments?: { date: string; [key: string]: unknown }[]; [key: string]: unknown }) => ({
            ...cp,
            vatType: cp.vatType || 'percentage',
            vatPercentage: cp.vatPercentage ?? 100,
            vatAmount: cp.vatAmount ?? 0,
            payments: cp.payments?.map((p) => ({
              ...p,
              date: new Date(p.date)
            })) || []
          })) || [];

          // 프로젝트에 대응하는 공사대금 레코드가 없으면 자동 생성
          const existingPaymentIds = new Set(existingConstructionPayments.map((cp) => cp.id));
          const missingPayments = projects
            .filter((project) => !existingPaymentIds.has(project.id))
            .map((project) => ({
              id: project.id,
              project: project.name,
              client: project.client,
              totalAmount: project.contractAmount || 0,
              vatType: 'percentage',
              vatPercentage: 100,
              vatAmount: 0,
              payments: []
            }));

          const constructionPayments = [...existingConstructionPayments, ...missingPayments];

          return {
            state: {
              ...state,
              projects,
              schedules: state.schedules?.map((s: { start: string; end: string; [key: string]: unknown }) => ({
                ...s,
                start: new Date(s.start),
                end: new Date(s.end)
              })) || [],
              payments: state.payments?.map((p: { requestDate: string; approvalDate?: string; [key: string]: unknown }) => ({
                ...p,
                requestDate: new Date(p.requestDate),
                approvalDate: p.approvalDate ? new Date(p.approvalDate) : undefined
              })) || [],
              contractors: state.contractors?.map((c: { createdAt: string; updatedAt: string; [key: string]: unknown }) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt)
              })) || [],
              constructionPayments,
              asRequests: state.asRequests?.map((req: { requestDate: string; scheduledVisitDate?: string; completionDate?: string; [key: string]: unknown }) => ({
                ...req,
                requestDate: new Date(req.requestDate),
                scheduledVisitDate: req.scheduledVisitDate ? new Date(req.scheduledVisitDate) : undefined,
                completionDate: req.completionDate ? new Date(req.completionDate) : undefined
              })) || [],
              executionRecords: state.executionRecords?.map((record: { date: string; createdAt: string; updatedAt: string; [key: string]: unknown }) => ({
                ...record,
                date: new Date(record.date),
                createdAt: new Date(record.createdAt),
                updatedAt: new Date(record.updatedAt)
              })) || []
            }
          };
        },
        setItem: (name, newValue) => {
          const str = JSON.stringify(newValue);
          localStorage.setItem(name, str);
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
);
