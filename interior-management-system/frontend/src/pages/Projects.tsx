import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useDataStore, type Project } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import ProjectModal from '../components/ProjectModal';
import MeetingNotesModal from '../components/MeetingNotesModal';
import CustomerRequestsModal from '../components/CustomerRequestsModal';
import SitePasswordModal from '../components/SitePasswordModal';
import DesignContractModal from '../components/DesignContractModal';
import toast from 'react-hot-toast';

type TabStatus = 'planning' | 'in-progress' | 'completed' | 'all';

const Projects = () => {
  const {
    loadProjectsFromAPI,
    addProjectToAPI,
    updateProjectInAPI,
    deleteProjectFromAPI
  } = useDataStore();
  const { user } = useAuth();
  const projects = useFilteredProjects();
  const [activeTab, setActiveTab] = useState<TabStatus>('in-progress');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showMeetingNotesModal, setShowMeetingNotesModal] = useState(false);
  const [showCustomerRequestsModal, setShowCustomerRequestsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDesignContractModal, setShowDesignContractModal] = useState(false);
  const [selectedProjectForNotes, setSelectedProjectForNotes] = useState<Project | null>(null);

  // Helper functions for counting and checking NEW items
  const getLastViewedKey = (projectId: string, type: 'meeting' | 'request') => {
    return `lastViewed_${user?.id}_${projectId}_${type}`;
  };

  const getLastViewedTime = (projectId: string, type: 'meeting' | 'request'): number => {
    const key = getLastViewedKey(projectId, type);
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  };

  const markAsViewed = (projectId: string, type: 'meeting' | 'request') => {
    const key = getLastViewedKey(projectId, type);
    localStorage.setItem(key, Date.now().toString());
  };

  const hasNewItems = (project: Project, type: 'meeting' | 'request'): boolean => {
    const lastViewed = getLastViewedTime(project.id, type);

    if (type === 'meeting') {
      const notes = project.meetingNotes || [];
      return notes.some(note => {
        const noteTime = note.createdAt ? new Date(note.createdAt).getTime() : new Date(note.date).getTime();
        return noteTime > lastViewed;
      });
    } else {
      const requests = project.customerRequests || [];
      // 미완료된 요청사항이 있으면 N을 표시
      return requests.some(req => !req.completed);
    }
  };

  // 컴포넌트 마운트 시 API에서 프로젝트 데이터 로드
  useEffect(() => {
    loadProjectsFromAPI().catch(error => {
      console.error('Failed to load projects:', error);
      toast.error('프로젝트 데이터를 불러오는데 실패했습니다');
    });
  }, [loadProjectsFromAPI]);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      setSelectedProject(null);
      setShowModal(true);
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

  const calculateProgress = (startDate: Date | undefined, endDate: Date | undefined): number => {
    if (!startDate || !endDate) return 0;

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 0;
    if (now > end) return 100;

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const progress = Math.round((elapsedDays / totalDays) * 100);
    return Math.min(100, Math.max(0, progress));
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setShowModal(true);
  };

  const handleDelete = async (id: string, projectName: string) => {
    if (window.confirm(`"${projectName}" 프로젝트를 삭제하시겠습니까?\n\n삭제된 내역은 복구할 수 없습니다.`)) {
      try {
        await deleteProjectFromAPI(id);
        toast.success('프로젝트가 삭제되었습니다');
      } catch (error) {
        console.error('Failed to delete project:', error);
        toast.error('프로젝트 삭제에 실패했습니다');
      }
    }
  };

  const handleSave = async (data: Partial<Project>) => {
    try {
      if (selectedProject) {
        await updateProjectInAPI(selectedProject.id, data);
        toast.success('프로젝트가 수정되었습니다');
      } else {
        const newProject: Project = {
          id: '',
          ...data,
          team: data.team || []
        };
        await addProjectToAPI(newProject);
        toast.success('프로젝트가 추가되었습니다');
        // Auto-navigate to the new project's status tab
        setActiveTab(data.status || 'planning');
      }
      setShowModal(false);
      setSelectedProject(null);
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('프로젝트 저장에 실패했습니다');
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      await updateProjectInAPI(projectId, { status: newStatus as Project['status'] });
      toast.success('상태가 변경되었습니다');
    } catch (error) {
      console.error('Failed to update project status:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const handleOpenMeetingNotes = (project: Project) => {
    setSelectedProjectForNotes(project);
    setShowMeetingNotesModal(true);
    markAsViewed(project.id, 'meeting');
  };

  const handleOpenCustomerRequests = (project: Project) => {
    setSelectedProjectForNotes(project);
    setShowCustomerRequestsModal(true);
    markAsViewed(project.id, 'request');
  };

  const handleOpenPassword = (project: Project) => {
    setSelectedProjectForNotes(project);
    setShowPasswordModal(true);
  };

  const handleOpenDesignContract = (project: Project) => {
    setSelectedProjectForNotes(project);
    setShowDesignContractModal(true);
  };

  const handleSavePasswords = async (entrancePassword: string, sitePassword: string) => {
    if (!selectedProjectForNotes) return;

    const oldEntrancePassword = selectedProjectForNotes.entrancePassword;
    const oldSitePassword = selectedProjectForNotes.sitePassword;

    // Immediately update local state for instant UI feedback
    setSelectedProjectForNotes({
      ...selectedProjectForNotes,
      entrancePassword,
      sitePassword
    });

    try {
      await updateProjectInAPI(selectedProjectForNotes.id, {
        entrancePassword,
        sitePassword
      });

      toast.success('비밀번호가 저장되었습니다');
    } catch (error) {
      console.error('Failed to save passwords:', error);
      toast.error('비밀번호 저장에 실패했습니다');

      // Revert on error
      setSelectedProjectForNotes({
        ...selectedProjectForNotes,
        entrancePassword: oldEntrancePassword,
        sitePassword: oldSitePassword
      });
    }
  };

  const handleSaveMeetingNote = async (content: string, meetingDate: Date) => {
    if (!selectedProjectForNotes) return;

    const newNote = {
      id: Date.now().toString(),
      content,
      date: meetingDate,
      createdAt: new Date()
    };

    const updatedNotes = [...(selectedProjectForNotes.meetingNotes || []), newNote];

    // Immediately update local state for instant UI feedback
    setSelectedProjectForNotes({
      ...selectedProjectForNotes,
      meetingNotes: updatedNotes
    });

    try {
      await updateProjectInAPI(selectedProjectForNotes.id, {
        meetingNotes: updatedNotes
      });

      toast.success('미팅 내용이 추가되었습니다');
    } catch (error) {
      console.error('Failed to save meeting note:', error);
      toast.error('미팅 내용 저장에 실패했습니다');

      // Revert on error
      setSelectedProjectForNotes({
        ...selectedProjectForNotes,
        meetingNotes: selectedProjectForNotes.meetingNotes || []
      });
    }
  };

  const handleSaveCustomerRequest = async (content: string, requestDate: Date) => {
    if (!selectedProjectForNotes) return;

    const newRequest = {
      id: Date.now().toString(),
      content,
      completed: false,
      createdAt: requestDate
    };

    const updatedRequests = [...(selectedProjectForNotes.customerRequests || []), newRequest];

    // Immediately update local state for instant UI feedback
    setSelectedProjectForNotes({
      ...selectedProjectForNotes,
      customerRequests: updatedRequests
    });

    try {
      await updateProjectInAPI(selectedProjectForNotes.id, {
        customerRequests: updatedRequests
      });

      toast.success('고객 요청사항이 추가되었습니다');
    } catch (error) {
      console.error('Failed to save customer request:', error);
      toast.error('고객 요청사항 저장에 실패했습니다');

      // Revert on error
      setSelectedProjectForNotes({
        ...selectedProjectForNotes,
        customerRequests: selectedProjectForNotes.customerRequests || []
      });
    }
  };

  const handleToggleRequestComplete = async (requestId: string) => {
    if (!selectedProjectForNotes) return;

    const oldRequests = selectedProjectForNotes.customerRequests || [];
    const updatedRequests = oldRequests.map(req =>
      req.id === requestId ? { ...req, completed: !req.completed } : req
    );

    // Immediately update local state for instant UI feedback
    setSelectedProjectForNotes({
      ...selectedProjectForNotes,
      customerRequests: updatedRequests
    });

    try {
      await updateProjectInAPI(selectedProjectForNotes.id, {
        customerRequests: updatedRequests
      });

      toast.success('요청사항 상태가 변경되었습니다');
    } catch (error) {
      console.error('Failed to toggle request:', error);
      toast.error('상태 변경에 실패했습니다');

      // Revert on error
      setSelectedProjectForNotes({
        ...selectedProjectForNotes,
        customerRequests: oldRequests
      });
    }
  };

  const handleDeleteMeetingNote = async (noteId: string) => {
    if (!selectedProjectForNotes) return;

    const oldNotes = selectedProjectForNotes.meetingNotes || [];
    const updatedNotes = oldNotes.filter(note => note.id !== noteId);

    // Immediately update local state for instant UI feedback
    setSelectedProjectForNotes({
      ...selectedProjectForNotes,
      meetingNotes: updatedNotes
    });

    try {
      await updateProjectInAPI(selectedProjectForNotes.id, {
        meetingNotes: updatedNotes
      });

      toast.success('미팅 내용이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete meeting note:', error);
      toast.error('삭제에 실패했습니다');

      // Revert on error
      setSelectedProjectForNotes({
        ...selectedProjectForNotes,
        meetingNotes: oldNotes
      });
    }
  };

  const handleDeleteCustomerRequest = async (requestId: string) => {
    if (!selectedProjectForNotes) return;

    const oldRequests = selectedProjectForNotes.customerRequests || [];
    const updatedRequests = oldRequests.filter(req => req.id !== requestId);

    // Immediately update local state for instant UI feedback
    setSelectedProjectForNotes({
      ...selectedProjectForNotes,
      customerRequests: updatedRequests
    });

    try {
      await updateProjectInAPI(selectedProjectForNotes.id, {
        customerRequests: updatedRequests
      });

      toast.success('고객 요청사항이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete customer request:', error);
      toast.error('삭제에 실패했습니다');

      // Revert on error
      setSelectedProjectForNotes({
        ...selectedProjectForNotes,
        customerRequests: oldRequests
      });
    }
  };

  const StatusDropdown = ({ project }: { project: Project }) => {
    const statusConfig = {
      planning: { label: '공사대기', color: 'bg-white text-gray-700 border-gray-300' },
      'in-progress': { label: '공사진행중', color: 'bg-white text-gray-900 border-gray-300' },
      completed: { label: '공사완료', color: 'bg-gray-900 text-white border-gray-900' },
      'on-hold': { label: '보류', color: 'bg-white text-gray-600 border-gray-300' }
    };
    const currentConfig = statusConfig[project.status as keyof typeof statusConfig];

    return (
      <select
        value={project.status}
        onChange={(e) => handleStatusChange(project.id, e.target.value)}
        className={clsx(
          'px-2 py-1 text-xs font-medium border rounded cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-gray-500',
          currentConfig.color
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="planning">공사대기</option>
        <option value="in-progress">공사진행중</option>
        <option value="completed">공사완료</option>
        <option value="on-hold">보류</option>
      </select>
    );
  };

  // 탭별 필터링
  const getFilteredProjects = () => {
    let filtered = projects;

    // 탭 필터
    if (activeTab !== 'all') {
      filtered = filtered.filter(p => p.status === activeTab);
    }

    return filtered;
  };

  const filteredProjects = getFilteredProjects();

  // 통계 계산
  const stats = {
    planning: projects.filter(p => p.status === 'planning').length,
    inProgress: projects.filter(p => p.status === 'in-progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
    onHold: projects.filter(p => p.status === 'on-hold').length
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const autoProgress = calculateProgress(project.startDate, project.endDate);

    return (
      <div className="card p-3 md:p-4 hover:border-gray-400 transition-colors">
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-base md:text-lg text-gray-900">{project.name}</h3>
            <p className="text-xs md:text-sm text-gray-600 mt-1">{project.client}님</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {project.status === 'planning' && (
                <button
                  onClick={() => handleOpenDesignContract(project)}
                  className="px-2 py-1 text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 rounded transition-colors"
                >
                  디자인 계약서
                </button>
              )}
              <StatusDropdown project={project} />
            </div>
            <button
              onClick={() => handleEdit(project)}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              수정
            </button>
          </div>
        </div>

        <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4 text-xs md:text-sm">
          <div className="text-gray-600">
            위치: {project.location}
          </div>
          <div className="text-gray-600">
            기간: {project.startDate && project.endDate ?
              `${format(project.startDate, 'MM.dd (eee)', { locale: ko })} - ${format(project.endDate, 'MM.dd (eee)', { locale: ko })}`
              : '미정'}
          </div>
          <div className="text-gray-600">
            담당: {project.manager}
          </div>
        </div>

        <div className="mb-3 md:mb-4">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-xs text-gray-600">진행률 (자동 계산)</span>
            <span className="text-xs md:text-sm font-medium text-gray-900">{autoProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 h-1">
            <div
              className="bg-gray-900 h-1 transition-all"
              style={{ width: `${autoProgress}%` }}
            />
          </div>
        </div>

        {/* 펼쳐진 요약 카드 영역 */}
        <div className="pt-3 border-t border-gray-200 space-y-2">
          {/* 미팅내용 */}
          <div
            onClick={() => handleOpenMeetingNotes(project)}
            className="relative p-2.5 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors border border-blue-100"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                📝 미팅내용
                {(project.meetingNotes?.length || 0) > 0 && (
                  <span className="text-blue-500">({project.meetingNotes?.length})</span>
                )}
              </span>
              {hasNewItems(project, 'meeting') && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">NEW</span>
              )}
            </div>
            {project.meetingNotes && project.meetingNotes.length > 0 ? (
              <p className="text-xs text-gray-600 line-clamp-1">
                {project.meetingNotes[project.meetingNotes.length - 1]?.content || '내용 없음'}
              </p>
            ) : (
              <p className="text-xs text-blue-400 italic">+ 미팅 내용을 추가하세요</p>
            )}
          </div>

          {/* 고객요청 */}
          <div
            onClick={() => handleOpenCustomerRequests(project)}
            className="relative p-2.5 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer transition-colors border border-amber-100"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                📋 고객요청
                {(project.customerRequests?.length || 0) > 0 && (
                  <span className="text-amber-500">({project.customerRequests?.length})</span>
                )}
              </span>
              {hasNewItems(project, 'request') && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">NEW</span>
              )}
            </div>
            {project.customerRequests && project.customerRequests.length > 0 ? (
              <p className="text-xs text-gray-600 line-clamp-1">
                {project.customerRequests[project.customerRequests.length - 1]?.content || '내용 없음'}
              </p>
            ) : (
              <p className="text-xs text-amber-400 italic">+ 고객 요청을 추가하세요</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div
            onClick={() => handleOpenPassword(project)}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                🔑 비밀번호
              </span>
              <span className="text-[10px] text-gray-400">클릭하여 수정</span>
            </div>
            <div className="flex gap-4 mt-1 text-xs">
              <span className="text-gray-600">
                현관: <span className="font-medium text-gray-800">{project.entrancePassword || '-'}</span>
              </span>
              <span className="text-gray-600">
                현장: <span className="font-medium text-gray-800">{project.sitePassword || '-'}</span>
              </span>
            </div>
          </div>

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => handleDelete(project.id, project.name)}
                className="text-xs text-rose-500 hover:text-rose-600"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header with Tabs and Controls */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Tabs */}
          <nav className="flex space-x-4 md:space-x-8 overflow-x-auto">
            {[
              { id: 'planning' as TabStatus, label: '공사대기', count: stats.planning, color: 'text-gray-700' },
              { id: 'in-progress' as TabStatus, label: '공사진행중', count: stats.inProgress, color: 'text-gray-700' },
              { id: 'completed' as TabStatus, label: '공사완료', count: stats.completed, color: 'text-gray-700' },
              { id: 'all' as TabStatus, label: '전체', count: projects.length, color: 'text-gray-600' }
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
                <span className={clsx(
                  'ml-1 md:ml-2 py-0.5 px-1.5 md:px-2 rounded-full text-[10px] md:text-xs font-semibold',
                  activeTab === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>

          {/* View Controls */}
          <div className="flex items-center gap-6 mb-3 md:mb-4">
            {/* View Type Toggle */}
            <div className="hidden sm:flex border border-gray-300 overflow-hidden rounded">
              <button
                onClick={() => setViewType('grid')}
                className={clsx(
                  'px-3 md:px-4 py-2 text-xs md:text-sm',
                  viewType === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
                )}
              >
                그리드
              </button>
              <button
                onClick={() => setViewType('list')}
                className={clsx(
                  'px-3 md:px-4 py-2 text-xs md:text-sm border-l border-gray-300',
                  viewType === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'
                )}
              >
                리스트
              </button>
            </div>

            <button
              onClick={() => {
                setSelectedProject(null);
                setShowModal(true);
              }}
              className="hidden lg:inline-flex btn btn-primary portrait:px-2 landscape:px-4 py-2 items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span className="portrait:hidden landscape:inline">새 프로젝트</span>
            </button>
          </div>
        </div>
      </div>

      {viewType === 'grid' || window.innerWidth < 768 ? (
        <div className="projects-grid grid grid-cols-1 md:grid-cols-2 ipad:grid-cols-2 ipad-lg:grid-cols-2 ipad-xl:grid-cols-3 ipad-2xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  프로젝트
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  고객
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  진행률
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.map((project) => {
                const autoProgress = calculateProgress(project.startDate, project.endDate);
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-gray-500">{project.location}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm">{project.client}님</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {project.startDate && project.endDate ? (
                        <>
                          {format(project.startDate, 'yyyy.MM.dd (eee)', { locale: ko })} -
                          <br />
                          {format(project.endDate, 'yyyy.MM.dd (eee)', { locale: ko })}
                        </>
                      ) : '미정'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {project.status === 'planning' && (
                          <button
                            onClick={() => handleOpenDesignContract(project)}
                            className="px-2 py-1 text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 rounded transition-colors"
                          >
                            디자인 계약서
                          </button>
                        )}
                        <StatusDropdown project={project} />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 h-1 mr-2">
                          <div
                            className="bg-gray-900 h-1"
                            style={{ width: `${autoProgress}%` }}
                          />
                        </div>
                        <span className="text-sm">{autoProgress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 min-w-[280px]">
                        {/* 미팅내용 */}
                        <div
                          onClick={() => handleOpenMeetingNotes(project)}
                          className="flex items-center gap-2 p-2 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-medium text-blue-700 whitespace-nowrap flex items-center gap-1">
                            📝 미팅
                            {(project.meetingNotes?.length || 0) > 0 && (
                              <span className="text-blue-500">({project.meetingNotes?.length})</span>
                            )}
                            {hasNewItems(project, 'meeting') && (
                              <span className="px-1 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded">N</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-600 truncate flex-1">
                            {project.meetingNotes?.length ? project.meetingNotes[project.meetingNotes.length - 1]?.content || '-' : '내용 없음'}
                          </span>
                        </div>
                        {/* 고객요청 */}
                        <div
                          onClick={() => handleOpenCustomerRequests(project)}
                          className="flex items-center gap-2 p-2 bg-amber-50 hover:bg-amber-100 rounded cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-medium text-amber-700 whitespace-nowrap flex items-center gap-1">
                            📋 요청
                            {(project.customerRequests?.length || 0) > 0 && (
                              <span className="text-amber-500">({project.customerRequests?.length})</span>
                            )}
                            {hasNewItems(project, 'request') && (
                              <span className="px-1 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded">N</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-600 truncate flex-1">
                            {project.customerRequests?.length ? project.customerRequests[project.customerRequests.length - 1]?.content || '-' : '내용 없음'}
                          </span>
                        </div>
                        {/* 비밀번호 */}
                        <div
                          onClick={() => handleOpenPassword(project)}
                          className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-medium text-gray-700 whitespace-nowrap">🔑 비밀번호</span>
                          <span className="text-xs text-gray-600">
                            현관: <span className="font-medium">{project.entrancePassword || '-'}</span>
                            <span className="mx-2">|</span>
                            현장: <span className="font-medium">{project.sitePassword || '-'}</span>
                          </span>
                        </div>
                        {/* 수정/삭제 버튼 */}
                        <div className="flex space-x-2 pt-1">
                          <button
                            onClick={() => handleEdit(project)}
                            className="text-xs text-gray-600 hover:text-gray-900"
                          >
                            수정
                          </button>
                          {(user?.role === 'admin' || user?.role === 'manager') && (
                            <button
                              onClick={() => handleDelete(project.id, project.name)}
                              className="text-xs text-rose-600 hover:text-rose-700"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={selectedProject}
          onClose={() => {
            setShowModal(false);
            setSelectedProject(null);
          }}
          onSave={handleSave}
        />
      )}

      {showMeetingNotesModal && selectedProjectForNotes && (
        <MeetingNotesModal
          projectName={selectedProjectForNotes.name}
          meetingNotes={selectedProjectForNotes.meetingNotes || []}
          onClose={() => {
            setShowMeetingNotesModal(false);
            setSelectedProjectForNotes(null);
          }}
          onSave={handleSaveMeetingNote}
          onDelete={handleDeleteMeetingNote}
        />
      )}

      {showCustomerRequestsModal && selectedProjectForNotes && (
        <CustomerRequestsModal
          projectName={selectedProjectForNotes.name}
          customerRequests={selectedProjectForNotes.customerRequests || []}
          onClose={() => {
            setShowCustomerRequestsModal(false);
            setSelectedProjectForNotes(null);
          }}
          onSave={handleSaveCustomerRequest}
          onToggleComplete={handleToggleRequestComplete}
          onDelete={handleDeleteCustomerRequest}
        />
      )}

      {showPasswordModal && selectedProjectForNotes && (
        <SitePasswordModal
          projectName={selectedProjectForNotes.name}
          entrancePassword={selectedProjectForNotes.entrancePassword || ''}
          sitePassword={selectedProjectForNotes.sitePassword || ''}
          onClose={() => {
            setShowPasswordModal(false);
            setSelectedProjectForNotes(null);
          }}
          onSave={handleSavePasswords}
        />
      )}

      {showDesignContractModal && selectedProjectForNotes && (
        <DesignContractModal
          projectName={selectedProjectForNotes.name}
          onClose={() => {
            setShowDesignContractModal(false);
            setSelectedProjectForNotes(null);
          }}
        />
      )}
    </div>
  );
};

export default Projects;
