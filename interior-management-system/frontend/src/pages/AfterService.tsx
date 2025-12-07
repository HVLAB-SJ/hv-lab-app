import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, Calendar, Edit, X, Upload, ImageIcon } from 'lucide-react';
import { useDataStore, type ASRequest } from '../store/dataStore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useForm } from 'react-hook-form';
import { formatTimeKorean } from '../utils/formatters';

const TEAM_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현', '안팀'];

const AfterService = () => {
  const { user } = useAuth();
  const filteredProjects = useFilteredProjects();
  const {
    asRequests,
    loadASRequestsFromAPI,
    addASRequestToAPI,
    updateASRequestInAPI,
    deleteASRequestFromAPI
  } = useDataStore();

  // 안팀 사용자인 경우 필터링
  const filteredProjectNames = filteredProjects.map(p => p.name);
  const requests = user?.name === '안팀'
    ? asRequests.filter(req => filteredProjectNames.includes(req.project))
    : asRequests;

    const [selectedRequest, setSelectedRequest] = useState<ASRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [editingDate, setEditingDate] = useState<{
    requestId: string;
    field: 'requestDate' | 'scheduledVisitDate';
    time?: { period: '오전' | '오후'; hour: number; minute: number };
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedRequestForImage, setSelectedRequestForImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');
  const [showMobileForm, setShowMobileForm] = useState(false);

  // 폼 관련 state
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customMember, setCustomMember] = useState('');
  const [visitTimePeriod, setVisitTimePeriod] = useState<'오전' | '오후'>('오전');
  const [visitTimeHour, setVisitTimeHour] = useState<number>(9);
  const [visitTimeMinute, setVisitTimeMinute] = useState<number>(0);

  // 공사완료된 프로젝트만 필터링
  const completedProjects = filteredProjects.filter(p => p.status === 'completed');

  // Load AS requests from API on mount
  useEffect(() => {
    loadASRequestsFromAPI().catch(error => {
      console.error('Failed to load AS requests:', error);
      toast.error('AS 요청 데이터를 불러오는데 실패했습니다');
    });
  }, [loadASRequestsFromAPI]);

  // 선택된 요청이 변경되면 폼에 값 설정
  useEffect(() => {
    if (selectedRequest) {
      setValue('project', selectedRequest.project);
      setValue('client', selectedRequest.client);
      setValue('siteAddress', selectedRequest.siteAddress);
      setValue('description', selectedRequest.description);
      if (selectedRequest.requestDate) {
        setValue('requestDate', new Date(selectedRequest.requestDate).toISOString().split('T')[0]);
      }
      if (selectedRequest.scheduledVisitDate) {
        setValue('scheduledVisitDate', new Date(selectedRequest.scheduledVisitDate).toISOString().split('T')[0]);
      }
      if (selectedRequest.scheduledVisitTime) {
        const [hoursStr, minutesStr] = selectedRequest.scheduledVisitTime.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (hours >= 12) {
          setVisitTimePeriod('오후');
          setVisitTimeHour(hours === 12 ? 12 : hours - 12);
        } else {
          setVisitTimePeriod('오전');
          setVisitTimeHour(hours === 0 ? 12 : hours);
        }
        setVisitTimeMinute(minutes);
      }
      setSelectedMembers(selectedRequest.assignedTo || []);
    } else {
      // 폼 초기화
      reset();
      setSelectedMembers([]);
      setVisitTimePeriod('오전');
      setVisitTimeHour(9);
      setVisitTimeMinute(0);
      setCustomMember('');
    }
  }, [selectedRequest, setValue, reset]);

  useEffect(() => {
    if (editingDate && inputRef.current) {
      inputRef.current.showPicker?.();
    }
  }, [editingDate]);

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

  const handleResetForm = () => {
    setSelectedRequest(null);
    reset();
    setSelectedMembers([]);
    setVisitTimePeriod('오전');
    setVisitTimeHour(9);
    setVisitTimeMinute(0);
    setCustomMember('');
  };

  const onSubmit = async (data: any) => {
    try {
      // Convert time to HH:mm format (only if visit date is set)
      let timeString: string | undefined = undefined;
      if (data.scheduledVisitDate) {
        let hours24 = visitTimeHour;
        if (visitTimePeriod === '오후' && visitTimeHour !== 12) {
          hours24 = visitTimeHour + 12;
        } else if (visitTimePeriod === '오전' && visitTimeHour === 12) {
          hours24 = 0;
        }
        timeString = `${hours24.toString().padStart(2, '0')}:${visitTimeMinute.toString().padStart(2, '0')}`;
      }

      const formData = {
        ...data,
        requestDate: new Date(data.requestDate),
        scheduledVisitDate: data.scheduledVisitDate ? new Date(data.scheduledVisitDate) : undefined,
        scheduledVisitTime: timeString,
        assignedTo: selectedMembers,
      };

      if (selectedRequest) {
        // Update existing request
        await updateASRequestInAPI(selectedRequest.id, formData);
        toast.success('AS 요청이 수정되었습니다');
      } else {
        // Add new request
        const newRequest: ASRequest = {
          id: '',
          ...formData,
        };
        await addASRequestToAPI(newRequest);
        toast.success('AS 요청이 추가되었습니다');
      }

      handleResetForm();
    } catch (error) {
      console.error('Failed to save AS request:', error);
      toast.error('AS 요청 저장에 실패했습니다');
    }
  };

  const toggleMember = (member: string) => {
    setSelectedMembers(prev =>
      prev.includes(member)
        ? prev.filter(m => m !== member)
        : [...prev, member]
    );
  };

  const addCustomMember = () => {
    if (customMember.trim() && !selectedMembers.includes(customMember.trim())) {
      setSelectedMembers(prev => [...prev, customMember.trim()]);
      setCustomMember('');
    }
  };

  const removeMember = (member: string) => {
    setSelectedMembers(prev => prev.filter(m => m !== member));
  };

  const handleEdit = (request: ASRequest) => {
    setSelectedRequest(request);
    // 모바일에서는 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, projectName: string) => {
    if (window.confirm(`"${projectName}" AS 요청을 삭제하시겠습니까?\n\n삭제된 내역은 복구할 수 없습니다.`)) {
      try {
        await deleteASRequestFromAPI(id);
        toast.success('AS 요청이 삭제되었습니다');
      } catch (error) {
        console.error('Failed to delete AS request:', error);
        toast.error('AS 요청 삭제에 실패했습니다');
      }
    }
  };

  const handleDateClick = (requestId: string, field: 'requestDate' | 'scheduledVisitDate') => {
    if (field === 'scheduledVisitDate') {
      const request = asRequests.find(r => r.id === requestId);
      let defaultTime = { period: '오전' as '오전' | '오후', hour: 9, minute: 0 };

      if (request?.scheduledVisitTime) {
        const [hoursStr, minutesStr] = request.scheduledVisitTime.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        defaultTime = {
          period: hours >= 12 ? '오후' : '오전',
          hour: hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours),
          minute: minutes
        };
      }

      setEditingDate({ requestId, field, time: defaultTime });
    } else {
      setEditingDate({ requestId, field });
    }
  };

  const handleDateChange = async (newDateValue: string, timeValue?: { period: '오전' | '오후'; hour: number; minute: number }) => {
    if (!editingDate) return;

    const newDate = new Date(newDateValue);
    if (isNaN(newDate.getTime())) {
      return;
    }

    try {
      const updateData: any = {
        [editingDate.field]: newDate
      };

      if (editingDate.field === 'scheduledVisitDate' && timeValue) {
        let hours24 = timeValue.hour;
        if (timeValue.period === '오후' && timeValue.hour !== 12) {
          hours24 = timeValue.hour + 12;
        } else if (timeValue.period === '오전' && timeValue.hour === 12) {
          hours24 = 0;
        }
        updateData.scheduledVisitTime = `${hours24.toString().padStart(2, '0')}:${timeValue.minute.toString().padStart(2, '0')}`;
      }

      await updateASRequestInAPI(editingDate.requestId, updateData);
      setEditingDate(null);
    } catch (error) {
      console.error('Failed to update date:', error);
      toast.error('날짜 수정에 실패했습니다');
      setEditingDate(null);
    }
  };

  // 클립보드 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const targetId = selectedRequestForImage || (e.target as HTMLElement).closest('[data-request-id]')?.getAttribute('data-request-id');
            if (targetId) {
              const request = requests.find(r => r.id === targetId);
              if (request) {
                const updatedImages = [...(request.images || []), base64];
                updateASRequestInAPI(targetId, { images: updatedImages });
                toast.success('이미지가 추가되었습니다');
              }
            } else {
              toast.error('AS 요청 카드 위에서 붙여넣기 해주세요');
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, [selectedRequestForImage, requests, updateASRequestInAPI]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
    setShowImageModal(true);
  };

  const handleDragOver = (e: React.DragEvent, requestId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (requestId) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, requestId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const newImages: string[] = [];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        newImages.push(base64);

        if (newImages.length === imageFiles.length) {
          const request = requests.find(r => r.id === requestId);
          if (request) {
            const updatedImages = [...(request.images || []), ...newImages];
            updateASRequestInAPI(requestId, { images: updatedImages });
            toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleStatusChange = async (requestId: string, newStatus: 'completed' | 'revisit' | 'pending') => {
    try {
      const updateData: Partial<ASRequest> = {
        status: newStatus
      };

      if (newStatus === 'completed') {
        updateData.completionDate = new Date();
      } else if (newStatus === 'pending') {
        updateData.completionDate = undefined;
      } else if (newStatus === 'revisit') {
        updateData.scheduledVisitDate = undefined;
        updateData.completionDate = undefined;
      }

      await updateASRequestInAPI(requestId, updateData);

      const statusText = newStatus === 'completed' ? 'AS 완료' :
                         newStatus === 'revisit' ? '재방문 필요' : '진행중';
      toast.success(`상태가 "${statusText}"으로 변경되었습니다`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const getStatusBadge = (status?: string) => {
    const statusConfig = {
      pending: { label: '대기중', color: 'bg-gray-100 text-gray-700 border-gray-300' },
      completed: { label: 'AS 완료', color: 'bg-green-100 text-green-700 border-green-300' },
      revisit: { label: '재방문', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium border rounded ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'completed') {
      return req.status === 'completed';
    } else {
      return req.status !== 'completed';
    }
  });

  return (
    <div className="as-container grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* 좌측: AS 요청 폼 */}
      <div className={`as-form lg:col-span-1 ${showMobileForm ? 'block' : 'hidden lg:block'}`}>
        <div className="card p-4 sticky top-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Project & Client */}
            <div>
              <select
                {...register('project', { required: '프로젝트를 선택하세요' })}
                className="input text-sm"
                onChange={(e) => {
                  const selectedProject = completedProjects.find(p => p.name === e.target.value);
                  if (selectedProject) {
                    setValue('client', selectedProject.client);
                    setValue('siteAddress', selectedProject.location);
                  }
                }}
              >
                <option value="">프로젝트 선택 (공사완료 현장)</option>
                {completedProjects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
              {errors.project && (
                <p className="mt-1 text-xs text-red-600">{String(errors.project.message)}</p>
              )}
            </div>

            {/* Hidden fields for client and siteAddress - auto-filled from project */}
            <input type="hidden" {...register('client')} />
            <input type="hidden" {...register('siteAddress')} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="input text-sm"
              />
            </div>

            {/* Assigned Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                담당자 (중복 선택 가능)
              </label>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {TEAM_MEMBERS.map((member) => (
                  <button
                    key={member}
                    type="button"
                    onClick={() => toggleMember(member)}
                    className={`px-2.5 py-1.5 rounded border transition-colors text-xs ${
                      selectedMembers.includes(member)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {member}
                  </button>
                ))}

                {selectedMembers
                  .filter(member => !TEAM_MEMBERS.includes(member))
                  .map((member) => (
                    <button
                      key={member}
                      type="button"
                      onClick={() => removeMember(member)}
                      className="px-2.5 py-1.5 rounded border transition-colors text-xs bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                    >
                      {member} ×
                    </button>
                  ))
                }
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customMember}
                  onChange={(e) => setCustomMember(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomMember();
                    }
                  }}
                  placeholder="직접 입력"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <button
                  type="button"
                  onClick={addCustomMember}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  추가
                </button>
              </div>
            </div>

            {/* Request Date & Scheduled Visit Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  요청일
                </label>
                <input
                  {...register('requestDate')}
                  type="date"
                  className="w-full px-2.5 py-2 text-xs bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  방문예정일
                </label>
                <input
                  {...register('scheduledVisitDate')}
                  type="date"
                  className="w-full px-2.5 py-2 text-xs bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                />
              </div>
            </div>

            {/* Scheduled Visit Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                방문 시간
              </label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setVisitTimePeriod('오전')}
                    className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                      visitTimePeriod === '오전'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    오전
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitTimePeriod('오후')}
                    className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                      visitTimePeriod === '오후'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    오후
                  </button>
                </div>

                <select
                  value={visitTimeHour}
                  onChange={(e) => setVisitTimeHour(parseInt(e.target.value))}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}시
                    </option>
                  ))}
                </select>

                <select
                  value={visitTimeMinute}
                  onChange={(e) => setVisitTimeMinute(parseInt(e.target.value))}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {[0, 10, 20, 30, 40, 50].map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}분
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {selectedRequest && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 btn btn-outline text-sm py-2"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                className="flex-1 btn btn-primary text-sm py-2"
              >
                {selectedRequest ? '수정' : '추가'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 우측: AS 요청 목록 */}
      <div className="as-list lg:col-span-4 space-y-4">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 md:space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-2 md:py-3 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'active'
                  ? 'border-gray-700 text-gray-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              진행중
              <span className={`ml-1 md:ml-2 py-0.5 px-1.5 md:px-2 rounded-full text-[10px] md:text-xs font-semibold ${
                activeTab === 'active' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {requests.filter(r => r.status !== 'completed').length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-2 md:py-3 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'border-gray-700 text-gray-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              AS 완료
              <span className={`ml-1 md:ml-2 py-0.5 px-1.5 md:px-2 rounded-full text-[10px] md:text-xs font-semibold ${
                activeTab === 'completed' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {requests.filter(r => r.status === 'completed').length}
              </span>
            </button>
          </nav>
        </div>

        {/* AS Request Cards */}
        <div className="as-cards grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              data-request-id={request.id}
              className="card p-4 hover:border-gray-400 transition-colors"
              onDragOver={(e) => handleDragOver(e, request.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, request.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(request.status)}
                  </div>
                  <h3 className="font-bold text-base text-gray-900">{request.project}</h3>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(request)}
                    className="text-gray-600 hover:text-gray-700 p-1"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(request.id, request.project)}
                    className="text-rose-600 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">현장주소</p>
                  <p className="text-gray-900 mt-0.5">{request.siteAddress}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">AS 내용</p>
                  <p className="text-gray-900 mt-0.5">{request.description}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">담당자</p>
                  <p className="text-gray-900 mt-0.5">
                    {request.assignedTo && request.assignedTo.length > 0
                      ? request.assignedTo.join(', ')
                      : '\u00A0'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">요청일</p>
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
                        className="flex items-center space-x-1 text-xs text-gray-900 hover:text-gray-600 transition-colors"
                      >
                        <Calendar className="h-3 w-3" />
                        <span>{format(request.requestDate, 'MM.dd (eee)', { locale: ko })}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">방문예정일</p>
                    <div className="relative inline-block">
                      {editingDate?.requestId === request.id && editingDate?.field === 'scheduledVisitDate' && (
                        <div className="absolute left-0 top-0 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3" style={{ minWidth: '280px' }}>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">날짜</label>
                              <input
                                ref={inputRef}
                                type="date"
                                defaultValue={request.scheduledVisitDate ? format(request.scheduledVisitDate, 'yyyy-MM-dd') : ''}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                                onChange={(e) => {
                                  const newDate = e.target.value;
                                  const timeValue = editingDate.time || { period: '오전' as const, hour: 9, minute: 0 };
                                  handleDateChange(newDate, timeValue);
                                }}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">시간</label>
                              <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingDate(prev => prev ? { ...prev, time: { ...prev.time!, period: '오전' } } : null)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                      editingDate?.time?.period === '오전'
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    오전
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingDate(prev => prev ? { ...prev, time: { ...prev.time!, period: '오후' } } : null)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                      editingDate?.time?.period === '오후'
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    오후
                                  </button>
                                </div>

                                <select
                                  value={editingDate?.time?.hour || 9}
                                  onChange={(e) => setEditingDate(prev => prev ? { ...prev, time: { ...prev.time!, hour: parseInt(e.target.value) } } : null)}
                                  className="px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                                    <option key={hour} value={hour}>
                                      {hour}시
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={editingDate?.time?.minute || 0}
                                  onChange={(e) => setEditingDate(prev => prev ? { ...prev, time: { ...prev.time!, minute: parseInt(e.target.value) } } : null)}
                                  className="px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                  {[0, 10, 20, 30, 40, 50].map((minute) => (
                                    <option key={minute} value={minute}>
                                      {minute}분
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                              <button
                                type="button"
                                onClick={() => setEditingDate(null)}
                                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const dateInput = inputRef.current;
                                  if (dateInput && editingDate?.time) {
                                    handleDateChange(dateInput.value, editingDate.time);
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                              >
                                확인
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => handleDateClick(request.id, 'scheduledVisitDate')}
                        className="flex items-center space-x-1 text-xs text-gray-900 hover:text-gray-600 transition-colors"
                      >
                        <Calendar className="h-3 w-3" />
                        <span>
                          {request.scheduledVisitDate ? format(request.scheduledVisitDate, 'MM.dd (eee)', { locale: ko }) : '미정'}
                          {request.scheduledVisitTime && ` ${formatTimeKorean(request.scheduledVisitTime)}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status change buttons */}
                {request.status !== 'completed' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleStatusChange(request.id, 'completed')}
                      className="flex-1 px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      AS 완료
                    </button>
                    <button
                      onClick={() => handleStatusChange(request.id, 'revisit')}
                      className="flex-1 px-3 py-2 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      재방문
                    </button>
                  </div>
                )}
                {request.status === 'completed' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleStatusChange(request.id, 'pending')}
                      className="w-full px-3 py-2 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors mb-2"
                    >
                      진행중으로 변경
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      {request.completionDate && `완료일: ${format(request.completionDate, 'yyyy.MM.dd', { locale: ko })}`}
                    </p>
                  </div>
                )}

                {/* 이미지 표시 영역 */}
                {request.images && request.images.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">첨부 이미지 ({request.images.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {request.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`AS 이미지 ${idx + 1}`}
                          className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-75"
                          onClick={() => handleImageClick(img)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 이미지 팝업 모달 */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(false);
              }}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={modalImage}
              alt="원본 이미지"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AfterService;
