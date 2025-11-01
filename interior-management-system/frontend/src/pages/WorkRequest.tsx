import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Trash2, Calendar } from 'lucide-react';
import WorkRequestModal from '../components/WorkRequestModal';
import workRequestService from '../services/workRequestService';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';

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

const TEAM_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현'];

const WorkRequest = () => {
  const { addScheduleToAPI, deleteScheduleFromAPI, updateScheduleInAPI, schedules, projects, fetchSchedules } = useDataStore();
  const [requests, setRequests] = useState<WorkRequest[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WorkRequest | null>(null);
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

  // Load work requests from API on mount
  useEffect(() => {
    loadWorkRequests();
  }, []);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      setSelectedRequest(null);
      setShowModal(true);
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

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

  const handleDelete = async (id: string, projectName: string) => {
    if (window.confirm(`"${projectName}" 업무요청을 삭제하시겠습니까?\n\n삭제된 내역은 복구할 수 없습니다.`)) {
      try {
        // 먼저 업무요청 정보 가져오기 (일정 제목 생성을 위해)
        const requestToDelete = workRequests.find(r => r.id === id);

        // 업무요청 삭제
        await workRequestService.deleteWorkRequest(id);

        // 연결된 일정 찾기 및 삭제
        if (requestToDelete) {
          // 제목 생성 로직 (생성 시와 동일)
          let expectedTitle = '';
          if (requestToDelete.project) {
            expectedTitle = requestToDelete.requestType
              ? `[업무요청] ${requestToDelete.requestType}`
              : `[업무요청] ${requestToDelete.description.substring(0, 20)}`;
          } else {
            expectedTitle = requestToDelete.description;
          }

          // 제목과 날짜로 일정 찾기
          const relatedSchedules = schedules.filter(s => {
            const isSameDate = s.start && new Date(s.start).toDateString() === requestToDelete.dueDate.toDateString();
            const isSameTitle = s.title === expectedTitle;
            return isSameDate && isSameTitle;
          });

          // 연결된 일정들 모두 삭제
          for (const schedule of relatedSchedules) {
            try {
              await deleteScheduleFromAPI(schedule.id);
              console.log('✅ Related schedule deleted:', schedule.id);
            } catch (schedError) {
              console.error('Failed to delete related schedule:', schedError);
            }
          }

          // 일정 목록 새로고침
          await fetchSchedules();
        }

        setRequests(requests.filter(req => req.id !== id));
        toast.success('업무요청이 삭제되었습니다');
      } catch (error) {
        console.error('Failed to delete work request:', error);
        toast.error('업무요청 삭제에 실패했습니다');
      }
    }
  };

  const handleEdit = (request: WorkRequest) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const handleSave = async (data: Partial<WorkRequest>) => {
    console.log('💾 handleSave called with data:', data);
    console.log('💾 selectedRequest:', selectedRequest);
    try {
      if (selectedRequest) {
        console.log('✏️ Update mode - selectedRequest.id:', selectedRequest.id);
        // 수정
        const updated = await workRequestService.updateWorkRequest(selectedRequest.id, {
          project: data.project,
          requestType: data.requestType,
          description: data.description,
          requestDate: data.requestDate,
          dueDate: data.dueDate,
          requestedBy: data.requestedBy,
          assignedTo: data.assignedTo,
          status: data.status,
          priority: data.priority,
          notes: data.notes,
          completedDate: data.completedDate
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

        // 관련 일정 찾아서 업데이트
        // 일정을 제목과 날짜로 찾기 (ID가 숫자 형식이므로)
        // 제목 생성 로직을 schedule 생성과 동일하게 맞춤
        let expectedTitle = '';
        if (updated.project) {
          // 프로젝트가 있는 경우
          expectedTitle = updated.requestType
            ? `[업무요청] ${updated.requestType}`
            : `[업무요청] ${updated.description.substring(0, 20)}`;
        } else {
          // 프로젝트가 없는 경우 - 요청내용을 제목으로
          expectedTitle = updated.description;
        }

        console.log('🔍 Looking for schedule with title:', expectedTitle);
        console.log('🔍 Looking for schedule on date:', updated.dueDate);
        console.log('🔍 All schedules on same date:', schedules.filter(s =>
          s.start && new Date(s.start).toDateString() === new Date(updated.dueDate).toDateString()
        ).map(s => ({ id: s.id, title: s.title, start: s.start })));

        const relatedSchedule = schedules.find(s => {
          const isSameDate = s.start &&
            new Date(s.start).toDateString() === new Date(updated.dueDate).toDateString();
          // 제목이 정확히 일치하는지 확인 (부분 일치가 아닌)
          const isSameTitle = s.title === expectedTitle;
          console.log(`🔍 Checking schedule ${s.id}: date=${isSameDate}, title=${isSameTitle}, s.title="${s.title}", expected="${expectedTitle}"`);
          return isSameDate && isSameTitle;
        });

        console.log('🔍 Found schedule?', relatedSchedule ? `Yes: ${relatedSchedule.id}` : 'No');

        if (relatedSchedule) {
          console.log('✅ Found related schedule:', relatedSchedule.id);
          try {
            // 프로젝트 ID 찾기
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

            // 담당자 처리: 디자인팀이면 세 명 모두 추가
            const attendees = updated.assignedTo === '디자인팀'
              ? ['신애', '재성', '재현']
              : [updated.assignedTo];

            console.log('📝 Updating schedule with attendees:', attendees);

            await updateScheduleInAPI(relatedSchedule.id, {
              title: scheduleTitle,
              start: new Date(updated.dueDate),
              end: new Date(updated.dueDate),
              project: projectId,
              attendees: attendees,
              description: `${updated.description}\n\n담당자: ${updated.assignedTo}\n요청자: ${updated.requestedBy}\n우선순위: ${updated.priority}\n${updated.notes || ''}`
            });
            console.log('✅ Related schedule updated successfully');
          } catch (schedError) {
            console.error('❌ Failed to update related schedule:', schedError);
          }
        } else {
          console.warn('⚠️ No related schedule found for work request ID:', updated._id);
          console.warn('⚠️ Expected title:', expectedTitle);
          console.warn('⚠️ Expected date:', new Date(updated.dueDate).toDateString());
        }

        setRequests(requests.map(req =>
          req.id === selectedRequest.id ? updatedRequest : req
        ));
        toast.success('업무요청이 수정되었습니다');
      } else {
        // 추가
        console.log('🔵 Creating work request with data:', data);

        const created = await workRequestService.createWorkRequest({
          project: data.project!,
          requestType: data.requestType!,
          description: data.description || '',
          requestDate: data.requestDate!,
          dueDate: data.dueDate!,
          requestedBy: data.requestedBy!,
          assignedTo: data.assignedTo!,
          status: data.status || 'pending',
          priority: data.priority || 'medium',
          notes: data.notes,
          completedDate: data.completedDate
        });

        console.log('🟢 Backend response:', created);

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

        // 일정관리에 마감일 자동 추가
        try {
          // 프로젝트가 있으면 프로젝트 ID 찾기, 없으면 null
          let projectId = null;
          let scheduleTitle = '';

          if (created.project) {
            // 프로젝트가 선택된 경우
            const matchingProject = projects.find(p => p.name === created.project);
            projectId = matchingProject ? matchingProject.id : null;

            if (!projectId) {
              console.warn('⚠️ Project not found for work request:', created.project);
              throw new Error('Project not found');
            }

            // 프로젝트가 있으면 요청유형을 제목으로
            scheduleTitle = created.requestType
              ? `[업무요청] ${created.requestType}`
              : `[업무요청] ${created.description.substring(0, 20)}`;
          } else {
            // 프로젝트가 없으면 요청내용을 제목으로
            scheduleTitle = created.description;
          }

          // 담당자 처리: 디자인팀이면 세 명 모두 추가
          const attendees = created.assignedTo === '디자인팀'
            ? ['신애', '재성', '재현']
            : [created.assignedTo];

          await addScheduleToAPI({
            id: `workrequest-${created._id}`,
            title: scheduleTitle,
            start: new Date(created.dueDate),
            end: new Date(created.dueDate),
            type: 'other',
            project: projectId, // 프로젝트 ID로 전달 (없으면 null)
            location: '',
            attendees: attendees,
            description: `${created.description}\n\n담당자: ${created.assignedTo}\n요청자: ${created.requestedBy}\n우선순위: ${created.priority}\n${created.notes || ''}`
          });
          console.log('✅ Schedule created:', scheduleTitle, 'with project ID:', projectId);
        } catch (schedError) {
          console.error('Failed to create schedule:', schedError);
          // 일정 생성 실패해도 업무요청은 생성됨
        }

        setRequests([newRequest, ...requests]);
        toast.success('업무요청이 추가되었습니다');
      }
      setShowModal(false);
      setSelectedRequest(null);
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

      // 업무요청이 완료되면 관련 일정 삭제
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
              console.log('✅ Related schedule deleted on completion:', relatedSchedule.id);
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

  // 탭별 필터링
  const getFilteredRequests = () => {
    let filtered = requests;

    // 탭 필터
    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status === activeTab);
    }

    // 검색 필터
    if (searchTerm) {
      filtered = filtered.filter(req =>
        req.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requestType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 우선순위 필터
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
      {/* Header */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setSelectedRequest(null);
            setShowModal(true);
          }}
          className="hidden lg:inline-flex btn btn-primary px-4 py-2 ml-auto"
        >
          + 새 업무요청
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 md:space-x-8 overflow-x-auto">
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
                'py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? `border-gray-700 ${tab.color}`
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={clsx(
                  'ml-1 md:ml-2 py-0.5 px-1.5 md:px-2 rounded-full text-[10px] md:text-xs font-semibold',
                  activeTab === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters - Desktop only */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 md:space-x-4">
        <input
          type="text"
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
        />
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
        >
          <option value="all">모든 우선순위</option>
          <option value="high">긴급</option>
          <option value="medium">보통</option>
          <option value="low">낮음</option>
        </select>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
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

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white border border-gray-200 overflow-x-auto">
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

      {/* Modal */}
      {showModal && (
        <WorkRequestModal
          request={selectedRequest}
          onClose={() => {
            setShowModal(false);
            setSelectedRequest(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default WorkRequest;
