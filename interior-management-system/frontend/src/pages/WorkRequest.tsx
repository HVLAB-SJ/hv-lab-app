import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Trash2, Calendar, AlertCircle } from 'lucide-react';
import workRequestService from '../services/workRequestService';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';

interface WorkRequest {
  id: string;
  project: string;
  requestType: string; // 목공도면, 전기도면, 설비도면, 3D모델링, 기타
  description: string;
  requestDate: Date;
  dueDate: Date;
  requestedBy: string; // 요청자
  assignedTo: string; // 담당자
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  completedDate?: Date;
}

type TabStatus = 'pending' | 'in-progress' | 'completed' | 'all';

const TEAM_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현', '안팀', '디자인팀', '현장팀'];

const WorkRequest = () => {
  const { addScheduleToAPI, deleteScheduleFromAPI, updateScheduleInAPI, schedules, fetchSchedules } = useDataStore();
  const { user } = useAuth();
  const projects = useFilteredProjects();
  const [requests, setRequests] = useState<WorkRequest[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [editingDate, setEditingDate] = useState<{
    requestId: string;
    field: 'requestDate' | 'dueDate';
  } | null>(null);
  const [editingPerson, setEditingPerson] = useState<{
    requestId: string;
    field: 'requestedBy' | 'assignedTo';
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    project: '',
    requestType: '',
    description: '',
    requestDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    requestedBy: user?.name || '',
    assignedTo: ''
  });
  const [isUrgent, setIsUrgent] = useState(false);
  const [customRequestType, setCustomRequestType] = useState('');
  const [editingRequest, setEditingRequest] = useState<WorkRequest | null>(null);
  const [showMobileForm, setShowMobileForm] = useState(false);

  // Load work requests from API on mount
  useEffect(() => {
    loadWorkRequests();
  }, []);

  // Set default requestedBy and project when user is loaded
  useEffect(() => {
    if (user?.name) {
      setFormData(prev => {
        const updates: any = {};

        // Set requestedBy if not set
        if (!prev.requestedBy) {
          updates.requestedBy = user.name;
        }

        // Set default project for 안팀 user
        if (user.name === '안팀' && !prev.project && projects.length > 0) {
          updates.project = projects[0].name;
        }

        return { ...prev, ...updates };
      });
    }
  }, [user, projects]);

  const loadWorkRequests = async () => {
    try {
      const apiRequests = await workRequestService.getAllWorkRequests();
      const workRequests: WorkRequest[] = apiRequests.map(r => ({
        id: r._id,
        project: r.project,
        requestType: r.requestType,
        description: r.description,
        requestDate: new Date(r.requestDate),
        dueDate: new Date(r.dueDate),
        requestedBy: r.requestedBy,
        assignedTo: r.assignedTo,
        status: r.status,
        priority: r.priority,
        notes: r.notes,
        completedDate: r.completedDate ? new Date(r.completedDate) : undefined
      }));
      setRequests(workRequests);
    } catch (error) {
      console.error('Failed to load work requests:', error);
      toast.error('업무요청을 불러오는데 실패했습니다');
    }
  };

  useEffect(() => {
    if (editingDate && inputRef.current) {
      inputRef.current.showPicker?.();
    }
  }, [editingDate]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (editingPerson) {
        setEditingPerson(null);
      }
    };

    if (editingPerson) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [editingPerson]);

  // 헤더의 + 버튼 클릭 이벤트 처리
  useEffect(() => {
    const handleHeaderAddClick = () => {
      setShowMobileForm(prev => {
        const newState = !prev;
        window.dispatchEvent(new CustomEvent('mobileFormStateChange', { detail: { isOpen: newState } }));
        return newState;
      });
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddClick);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddClick);
  }, []);

  // showMobileForm 상태 변경 시 Layout에 알림
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mobileFormStateChange', { detail: { isOpen: showMobileForm } }));
  }, [showMobileForm]);

  const handleDelete = async (id: string, projectName: string) => {
    if (window.confirm(`"${projectName}" 업무요청을 삭제하시겠습니까?\n\n삭제된 내역은 복구할 수 없습니다.`)) {
      try {
        const requestToDelete = requests.find(r => r.id === id);

        // 먼저 업무요청 삭제
        await workRequestService.deleteWorkRequest(id);

        // UI 즉시 업데이트
        setRequests(requests.filter(req => req.id !== id));
        toast.success('업무요청이 삭제되었습니다');

        // 관련 일정 삭제는 백그라운드에서 처리
        if (requestToDelete) {
          try {
            let expectedTitle = '';
            if (requestToDelete.project) {
              expectedTitle = requestToDelete.requestType
                ? `[업무요청] ${requestToDelete.requestType}`
                : `[업무요청] ${requestToDelete.description.substring(0, 20)}`;
            } else {
              expectedTitle = requestToDelete.description;
            }

            const relatedSchedules = schedules.filter(s => {
              const isSameDate = s.start && new Date(s.start).toDateString() === requestToDelete.dueDate.toDateString();
              const isSameTitle = s.title === expectedTitle;
              return isSameDate && isSameTitle;
            });

            for (const schedule of relatedSchedules) {
              try {
                await deleteScheduleFromAPI(schedule.id);
              } catch (schedError) {
                console.error('Failed to delete related schedule:', schedError);
              }
            }

            await fetchSchedules();
          } catch (scheduleError) {
            console.error('Failed to handle related schedules:', scheduleError);
            // 일정 삭제 실패는 무시 (업무요청은 이미 삭제됨)
          }
        }
      } catch (error) {
        console.error('Failed to delete work request:', error);
        toast.error('업무요청 삭제에 실패했습니다');
        // 실패 시 데이터 다시 로드
        await loadWorkRequests();
      }
    }
  };

  const handleEdit = (request: WorkRequest) => {
    setEditingRequest(request);
    setFormData({
      project: request.project,
      requestType: request.requestType,
      description: request.description,
      requestDate: format(request.requestDate, 'yyyy-MM-dd'),
      dueDate: format(request.dueDate, 'yyyy-MM-dd'),
      requestedBy: request.requestedBy,
      assignedTo: request.assignedTo
    });
    setIsUrgent(request.priority === 'high');
    setShowMobileForm(true); // Show form in mobile mode when editing
  };

  const resetForm = () => {
    setEditingRequest(null);
    setFormData({
      project: '',
      requestType: '',
      description: '',
      requestDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      requestedBy: user?.name || '',
      assignedTo: ''
    });
    setIsUrgent(false);
    setCustomRequestType('');
    // Keep mobile form open for easy consecutive entries
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.requestedBy || !formData.assignedTo || !formData.requestDate || !formData.dueDate) {
      toast.error('필수 항목을 모두 입력하세요');
      return;
    }

    try {
      const requestType = formData.requestType === '직접입력' ? customRequestType : formData.requestType;

      if (editingRequest) {
        // Update existing request
        const updated = await workRequestService.updateWorkRequest(editingRequest.id, {
          project: formData.project,
          requestType: requestType,
          description: formData.description,
          requestDate: new Date(formData.requestDate),
          dueDate: new Date(formData.dueDate),
          requestedBy: formData.requestedBy,
          assignedTo: formData.assignedTo,
          status: editingRequest.status,
          priority: isUrgent ? 'high' : 'medium'
        });

        const updatedRequest: WorkRequest = {
          id: updated._id,
          project: updated.project,
          requestType: updated.requestType,
          description: updated.description,
          requestDate: new Date(updated.requestDate),
          dueDate: new Date(updated.dueDate),
          requestedBy: updated.requestedBy,
          assignedTo: updated.assignedTo,
          status: updated.status,
          priority: updated.priority,
          notes: updated.notes,
          completedDate: updated.completedDate ? new Date(updated.completedDate) : undefined
        };

        // Update related schedule
        let expectedTitle = '';
        if (updated.project) {
          expectedTitle = updated.requestType
            ? `[업무요청] ${updated.requestType}`
            : `[업무요청] ${updated.description.substring(0, 20)}`;
        } else {
          expectedTitle = updated.description;
        }

        const relatedSchedule = schedules.find(s => {
          const isSameDate = s.start &&
            new Date(s.start).toDateString() === new Date(updated.dueDate).toDateString();
          const isSameTitle = s.title === expectedTitle;
          return isSameDate && isSameTitle;
        });

        if (relatedSchedule) {
          try {
            let projectId = null;
            let scheduleTitle = '';

            if (updated.project) {
              const matchingProject = projects.find(p => p.name === updated.project);
              projectId = matchingProject ? matchingProject.id : relatedSchedule.project;
              scheduleTitle = updated.requestType
                ? `[업무요청] ${updated.requestType}`
                : `[업무요청] ${updated.description.substring(0, 20)}`;
            } else {
              scheduleTitle = updated.description;
              projectId = relatedSchedule.project;
            }

            const attendees = updated.assignedTo === '디자인팀'
              ? ['신애', '재성', '재현']
              : [updated.assignedTo];

            await updateScheduleInAPI(relatedSchedule.id, {
              title: scheduleTitle,
              start: new Date(updated.dueDate),
              end: new Date(updated.dueDate),
              project: projectId,
              attendees: attendees,
              description: `${updated.description}\n\n담당자: ${updated.assignedTo}\n요청자: ${updated.requestedBy}\n우선순위: ${updated.priority}\n${updated.notes || ''}`
            });
          } catch (schedError) {
            console.error('Failed to update related schedule:', schedError);
          }
        }

        setRequests(requests.map(req =>
          req.id === editingRequest.id ? updatedRequest : req
        ));
        toast.success('업무요청이 수정되었습니다');
      } else {
        // Create new request
        const created = await workRequestService.createWorkRequest({
          project: formData.project,
          requestType: requestType,
          description: formData.description || '',
          requestDate: new Date(formData.requestDate),
          dueDate: new Date(formData.dueDate),
          requestedBy: formData.requestedBy,
          assignedTo: formData.assignedTo,
          status: 'pending',
          priority: isUrgent ? 'high' : 'medium'
        });

        const newRequest: WorkRequest = {
          id: created._id,
          project: created.project,
          requestType: created.requestType,
          description: created.description,
          requestDate: new Date(created.requestDate),
          dueDate: new Date(created.dueDate),
          requestedBy: created.requestedBy,
          assignedTo: created.assignedTo,
          status: created.status,
          priority: created.priority,
          notes: created.notes,
          completedDate: created.completedDate ? new Date(created.completedDate) : undefined
        };

        // Create related schedule
        try {
          let projectId = null;
          let scheduleTitle = '';

          if (created.project) {
            const matchingProject = projects.find(p => p.name === created.project);
            projectId = matchingProject ? matchingProject.id : null;

            if (!projectId) {
              console.warn('Project not found for work request:', created.project);
              throw new Error('Project not found');
            }

            scheduleTitle = created.requestType
              ? `[업무요청] ${created.requestType}`
              : `[업무요청] ${created.description.substring(0, 20)}`;
          } else {
            scheduleTitle = created.description;
          }

          const attendees = created.assignedTo === '디자인팀'
            ? ['신애', '재성', '재현']
            : [created.assignedTo];

          await addScheduleToAPI({
            id: `workrequest-${created._id}`,
            title: scheduleTitle,
            start: new Date(created.dueDate),
            end: new Date(created.dueDate),
            type: 'other',
            project: projectId,
            location: '',
            attendees: attendees,
            description: `${created.description}\n\n담당자: ${created.assignedTo}\n요청자: ${created.requestedBy}\n우선순위: ${created.priority}\n${created.notes || ''}`
          });
        } catch (schedError) {
          console.error('Failed to create schedule:', schedError);
        }

        setRequests([newRequest, ...requests]);
        toast.success('업무요청이 추가되었습니다');
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save work request:', error);
      toast.error('업무요청 저장에 실패했습니다');
    }
  };

  const handleDateClick = (requestId: string, field: 'requestDate' | 'dueDate') => {
    setEditingDate({ requestId, field });
  };

  const handleDateChange = async (newDateValue: string) => {
    if (!editingDate) return;

    const newDate = new Date(newDateValue);
    if (isNaN(newDate.getTime())) {
      return;
    }

    try {
      const requestToUpdate = requests.find(r => r.id === editingDate.requestId);
      if (!requestToUpdate) return;

      await workRequestService.updateWorkRequest(editingDate.requestId, {
        [editingDate.field]: newDate
      });

      setRequests(requests.map(req =>
        req.id === editingDate.requestId
          ? { ...req, [editingDate.field]: newDate }
          : req
      ));
      setEditingDate(null);
      toast.success('날짜가 수정되었습니다');
    } catch (error) {
      console.error('Failed to update date:', error);
      toast.error('날짜 수정에 실패했습니다');
      setEditingDate(null);
    }
  };

  const handlePersonClick = (requestId: string, field: 'requestedBy' | 'assignedTo') => {
    setEditingPerson({ requestId, field });
  };

  const handlePersonSelect = async (person: string) => {
    if (!editingPerson) return;

    try {
      await workRequestService.updateWorkRequest(editingPerson.requestId, {
        [editingPerson.field]: person
      });

      setRequests(requests.map(req =>
        req.id === editingPerson.requestId
          ? { ...req, [editingPerson.field]: person }
          : req
      ));
      setEditingPerson(null);
      toast.success('담당자가 수정되었습니다');
    } catch (error) {
      console.error('Failed to update person:', error);
      toast.error('담당자 수정에 실패했습니다');
      setEditingPerson(null);
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: 'pending' | 'in-progress' | 'completed') => {
    try {
      const completedDate = newStatus === 'completed' ? new Date() : undefined;

      await workRequestService.updateWorkRequest(requestId, {
        status: newStatus,
        completedDate: completedDate
      });

      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: newStatus, completedDate: completedDate }
          : req
      ));

      if (newStatus === 'completed') {
        const requestToComplete = requests.find(r => r.id === requestId);
        if (requestToComplete) {
          const relatedSchedule = schedules.find(s =>
            s.id === `workrequest-${requestId}` ||
            (s.title.includes(`[업무요청]`) && s.project === requestToComplete.project)
          );

          if (relatedSchedule) {
            try {
              await deleteScheduleFromAPI(relatedSchedule.id);
            } catch (schedError) {
              console.error('Failed to delete related schedule:', schedError);
            }
          }
        }
      }

      const statusLabels = {
        'pending': '대기',
        'in-progress': '진행중',
        'completed': '완료'
      };
      toast.success(`상태가 ${statusLabels[newStatus]}로 변경되었습니다`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '대기', color: 'bg-gray-100 text-gray-700 border-gray-300' },
      'in-progress': { label: '진행중', color: 'bg-gray-100 text-gray-800 border-gray-300' },
      completed: { label: '완료', color: 'bg-gray-900 text-white border-gray-900' },
      cancelled: { label: '취소', color: 'bg-gray-100 text-gray-500 border-gray-300' },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: '낮음', color: 'text-gray-600', bg: '', border: '' },
      medium: { label: '보통', color: 'text-gray-600', bg: '', border: '' },
      high: {
        label: '긴급',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border border-rose-300'
      },
    };
    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${config.color} ${config.bg} ${config.border}`}>
        {config.label}
      </span>
    );
  };

  const calculateDday = (dueDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDdayBadge = (dueDate: Date) => {
    const dday = calculateDday(dueDate);

    if (dday < 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded">
          D+{Math.abs(dday)}
        </span>
      );
    } else if (dday === 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-bold bg-gray-900 text-white border border-gray-900 rounded">
          D-Day
        </span>
      );
    } else if (dday <= 3) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded">
          D-{dday}
        </span>
      );
    } else if (dday <= 7) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded">
          D-{dday}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded">
          D-{dday}
        </span>
      );
    }
  };

  const getFilteredRequests = () => {
    let filtered = requests;

    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status === activeTab);
    }

    if (searchTerm) {
      filtered = filtered.filter(req =>
        req.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requestType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(req => req.priority === filterPriority);
    }

    return filtered;
  };

  const filteredRequests = getFilteredRequests();

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in-progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    total: requests.length,
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* 데스크톱 2열 레이아웃 */}
      <div className="hidden md:grid md:grid-cols-[400px_1fr] gap-4">
        {/* 왼쪽: 업무요청 폼 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 h-fit sticky top-4">
          {editingRequest && (
            <h2 className="text-xl font-semibold mb-4">
              업무요청 수정
            </h2>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Project */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트
              </label>
              <select
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="input w-full"
              >
                {user?.name !== '안팀' && <option value="">선택하세요</option>}
                {projects
                  .filter(project => project.status !== 'completed')
                  .map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Request Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                요청유형
              </label>
              <select
                value={formData.requestType}
                onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                className="input w-full"
              >
                <option value=""></option>
                <option value="3D모델링">3D모델링</option>
                <option value="철거도면">철거도면</option>
                <option value="설비도면">설비도면</option>
                <option value="에어컨 배치도">에어컨 배치도</option>
                <option value="디퓨저 배치도">디퓨저 배치도</option>
                <option value="스프링클러 배치도">스프링클러 배치도</option>
                <option value="전기도면">전기도면</option>
                <option value="목공도면">목공도면</option>
                <option value="디테일도면">디테일도면</option>
                <option value="금속도면">금속도면</option>
                <option value="가구도면">가구도면</option>
                <option value="세라믹도면">세라믹도면</option>
                <option value="트렌치유가">트렌치유가</option>
                <option value="욕실장">욕실장</option>
                <option value="발주">발주</option>
                <option value="마감">마감</option>
                <option value="직접입력">직접입력</option>
              </select>

              {formData.requestType === '직접입력' && (
                <input
                  type="text"
                  value={customRequestType}
                  onChange={(e) => setCustomRequestType(e.target.value)}
                  placeholder="요청유형을 직접 입력하세요"
                  className="input w-full mt-2"
                />
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                요청내용
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="input w-full"
                placeholder="상세한 요청 내용을 입력하세요"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  요청일 *
                </label>
                <input
                  type="date"
                  value={formData.requestDate}
                  onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                  required
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  마감일 *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                  className="input w-full"
                />
              </div>
            </div>

            {/* People */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  요청자 *
                </label>
                <select
                  value={formData.requestedBy}
                  onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                  required
                  className="input w-full"
                >
                  <option value="">선택하세요</option>
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  담당자 *
                </label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  required
                  className="input w-full"
                >
                  <option value="">선택하세요</option>
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Urgent Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all w-full ${
                  isUrgent
                    ? 'bg-rose-50 border-rose-500 text-rose-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <AlertCircle className={`h-5 w-5 ${isUrgent ? 'text-rose-600' : 'text-gray-400'}`} />
                <span className="font-medium">
                  {isUrgent ? '긴급 업무입니다' : '긴급 업무로 표시'}
                </span>
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              {editingRequest && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 btn btn-outline"
                >
                  취소
                </button>
              )}
              <button type="submit" className="flex-1 btn btn-primary">
                {editingRequest ? '수정' : '추가'}
              </button>
            </div>
          </form>
        </div>

        {/* 오른쪽: 업무요청 목록 */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'pending' as TabStatus, label: '대기', count: stats.pending, color: 'text-gray-700' },
                { id: 'in-progress' as TabStatus, label: '진행중', count: stats.inProgress, color: 'text-gray-700' },
                { id: 'completed' as TabStatus, label: '완료', count: stats.completed, color: 'text-gray-700' },
                { id: 'all' as TabStatus, label: '전체', count: stats.total, color: 'text-gray-600' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? `border-gray-700 ${tab.color}`
                      : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={clsx(
                      'ml-2 py-0.5 px-2 rounded-full text-xs font-semibold',
                      activeTab === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            >
              <option value="all">모든 우선순위</option>
              <option value="high">긴급</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">프로젝트</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청유형</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">내용</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">담당자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마감일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">D-day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">우선순위</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" style={{ overflow: 'visible' }}>
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className={`hover:bg-gray-50 ${
                      request.priority === 'high' ? 'bg-rose-50/30' : ''
                    }`}
                    style={{ overflow: 'visible' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{request.project}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{request.requestType}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{request.description}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" style={{ overflow: 'visible' }}>
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePersonClick(request.id, 'requestedBy');
                          }}
                          className="text-sm text-gray-900 hover:text-gray-600 hover:underline transition-colors"
                        >
                          {request.requestedBy}
                        </button>
                        {editingPerson?.requestId === request.id && editingPerson?.field === 'requestedBy' && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[100px]"
                          >
                            {TEAM_MEMBERS.map((member) => (
                              <button
                                key={member}
                                onClick={() => handlePersonSelect(member)}
                                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                  member === request.requestedBy ? 'bg-gray-50 font-medium' : ''
                                }`}
                              >
                                {member}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" style={{ overflow: 'visible' }}>
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePersonClick(request.id, 'assignedTo');
                          }}
                          className="text-sm text-gray-900 hover:text-gray-600 hover:underline transition-colors"
                        >
                          {request.assignedTo}
                        </button>
                        {editingPerson?.requestId === request.id && editingPerson?.field === 'assignedTo' && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[100px]"
                          >
                            {TEAM_MEMBERS.map((member) => (
                              <button
                                key={member}
                                onClick={() => handlePersonSelect(member)}
                                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                  member === request.assignedTo ? 'bg-gray-50 font-medium' : ''
                                }`}
                              >
                                {member}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative inline-block">
                        {editingDate?.requestId === request.id && editingDate?.field === 'requestDate' && (
                          <input
                            ref={inputRef}
                            type="date"
                            defaultValue={format(request.requestDate, 'yyyy-MM-dd')}
                            onChange={(e) => handleDateChange(e.target.value)}
                            onBlur={() => setEditingDate(null)}
                            className="absolute left-0 top-0 w-auto h-auto opacity-0 z-50"
                            style={{ pointerEvents: 'auto' }}
                          />
                        )}
                        <button
                          onClick={() => handleDateClick(request.id, 'requestDate')}
                          className="flex items-center space-x-2 text-sm text-gray-900 hover:text-gray-600 transition-colors"
                        >
                          <Calendar className="h-4 w-4" />
                          <span>{format(request.requestDate, 'yyyy.MM.dd (eee)', { locale: ko })}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative inline-block">
                        {editingDate?.requestId === request.id && editingDate?.field === 'dueDate' && (
                          <input
                            ref={inputRef}
                            type="date"
                            defaultValue={format(request.dueDate, 'yyyy-MM-dd')}
                            onChange={(e) => handleDateChange(e.target.value)}
                            onBlur={() => setEditingDate(null)}
                            className="absolute left-0 top-0 w-auto h-auto opacity-0 z-50"
                            style={{ pointerEvents: 'auto' }}
                          />
                        )}
                        <button
                          onClick={() => handleDateClick(request.id, 'dueDate')}
                          className="flex items-center space-x-2 text-sm text-gray-900 hover:text-gray-600 transition-colors"
                        >
                          <Calendar className="h-4 w-4" />
                          <span>{format(request.dueDate, 'yyyy.MM.dd (eee)', { locale: ko })}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getDdayBadge(request.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPriorityBadge(request.priority)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        {request.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(request.id, 'in-progress')}
                            className="px-3 py-1 text-xs font-semibold text-white rounded transition-colors bg-gray-600 hover:bg-gray-700"
                          >
                            수락
                          </button>
                        )}
                        {request.status === 'in-progress' && (
                          <button
                            onClick={() => handleStatusChange(request.id, 'completed')}
                            className="px-3 py-1 text-xs font-semibold bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                          >
                            완료
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(request)}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(request.id, request.project)}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 모바일 뷰 */}
      <div className="md:hidden space-y-3">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto">
            {[
              { id: 'pending' as TabStatus, label: '대기', count: stats.pending, color: 'text-gray-700' },
              { id: 'in-progress' as TabStatus, label: '진행중', count: stats.inProgress, color: 'text-gray-700' },
              { id: 'completed' as TabStatus, label: '완료', count: stats.completed, color: 'text-gray-700' },
              { id: 'all' as TabStatus, label: '전체', count: stats.total, color: 'text-gray-600' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'py-3 px-1 border-b-2 font-medium text-xs transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? `border-gray-700 ${tab.color}`
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={clsx(
                    'ml-1 py-0.5 px-1.5 rounded-full text-[10px] font-semibold',
                    activeTab === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* 업무요청 입력 폼 */}
        {showMobileForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {editingRequest && (
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              업무요청 수정
            </h2>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3">
                {/* Project */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    프로젝트
                  </label>
                  <select
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                  >
                    {user?.name !== '안팀' && <option value="">선택하세요</option>}
                    {projects
                      .filter(project => project.status !== 'completed')
                      .map((project) => (
                        <option key={project.id} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Request Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    요청유형
                  </label>
                  <select
                    value={formData.requestType}
                    onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                  >
                    <option value=""></option>
                    <option value="3D모델링">3D모델링</option>
                    <option value="철거도면">철거도면</option>
                    <option value="설비도면">설비도면</option>
                    <option value="에어컨 배치도">에어컨 배치도</option>
                    <option value="디퓨저 배치도">디퓨저 배치도</option>
                    <option value="스프링클러 배치도">스프링클러 배치도</option>
                    <option value="전기도면">전기도면</option>
                    <option value="목공도면">목공도면</option>
                    <option value="디테일도면">디테일도면</option>
                    <option value="금속도면">금속도면</option>
                    <option value="가구도면">가구도면</option>
                    <option value="세라믹도면">세라믹도면</option>
                    <option value="트렌치유가">트렌치유가</option>
                    <option value="욕실장">욕실장</option>
                    <option value="발주">발주</option>
                    <option value="마감">마감</option>
                    <option value="직접입력">직접입력</option>
                  </select>

                  {formData.requestType === '직접입력' && (
                    <input
                      type="text"
                      value={customRequestType}
                      onChange={(e) => setCustomRequestType(e.target.value)}
                      placeholder="요청유형을 직접 입력하세요"
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 mt-2 hover:border-gray-400 transition-colors"
                    />
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    요청내용
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 hover:border-gray-400 transition-colors"
                    placeholder="상세한 요청 내용을 입력하세요"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      요청일 *
                    </label>
                    <input
                      type="date"
                      value={formData.requestDate}
                      onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                      required
                      className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      마감일 *
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                      className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                  </div>
                </div>

                {/* People */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      요청자 *
                    </label>
                    <select
                      value={formData.requestedBy}
                      onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                    >
                      <option value="">선택하세요</option>
                      {TEAM_MEMBERS.map((member) => (
                        <option key={member} value={member}>
                          {member}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      담당자 *
                    </label>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                    >
                      <option value="">선택하세요</option>
                      {TEAM_MEMBERS.map((member) => (
                        <option key={member} value={member}>
                          {member}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Urgent Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setIsUrgent(!isUrgent)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all w-full text-sm ${
                      isUrgent
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <AlertCircle className={`h-4 w-4 ${isUrgent ? 'text-rose-600' : 'text-gray-400'}`} />
                    <span className="font-medium">
                      {isUrgent ? '긴급 업무입니다' : '긴급 업무로 표시'}
                    </span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {editingRequest && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {editingRequest ? '수정' : '추가'}
                  </button>
                </div>
              </form>
        </div>
        )}

        {/* 업무요청 목록 */}
        {filteredRequests.map((request) => (
          <div
            key={request.id}
            className={`card p-3 hover:border-gray-400 transition-colors ${
              request.priority === 'high' ? 'border-2 border-rose-200 bg-rose-50/30' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(request.status)}
                  {getDdayBadge(request.dueDate)}
                  {request.priority === 'high' && getPriorityBadge(request.priority)}
                </div>
                <h3 className="font-bold text-base text-gray-900">{request.project}</h3>
                <p className="text-xs text-gray-600 mt-0.5">{request.requestType}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(request)}
                  className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(request.id, request.project)}
                  className="text-gray-600 hover:text-gray-700 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-gray-100 pt-2">
              <div>
                <p className="text-xs text-gray-500">요청 내용</p>
                <p className="text-gray-900 mt-0.5">{request.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">요청자</p>
                  <p className="text-gray-900 font-medium mt-0.5">{request.requestedBy}</p>
                </div>
                <div>
                  <p className="text-gray-500">담당자</p>
                  <p className="text-gray-900 font-medium mt-0.5">{request.assignedTo}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="text-xs text-gray-500 mb-1">요청일</p>
                  <p className="text-xs text-gray-900">
                    {format(request.requestDate, 'MM.dd (eee)', { locale: ko })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">마감일</p>
                  <p className="text-xs text-gray-900">
                    {format(request.dueDate, 'MM.dd (eee)', { locale: ko })}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs">
                  <span className="text-gray-500">우선순위: </span>
                  {getPriorityBadge(request.priority)}
                </div>
              </div>
            </div>

            {/* Status change buttons */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              {request.status === 'pending' && (
                <button
                  onClick={() => handleStatusChange(request.id, 'in-progress')}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-white rounded-lg transition-colors bg-gray-600 hover:bg-gray-700"
                >
                  수락
                </button>
              )}
              {request.status === 'in-progress' && (
                <button
                  onClick={() => handleStatusChange(request.id, 'completed')}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  완료
                </button>
              )}
              {request.status === 'completed' && (
                <div className="flex-1 text-center text-xs text-gray-500 py-2">
                  완료된 업무입니다
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkRequest;
