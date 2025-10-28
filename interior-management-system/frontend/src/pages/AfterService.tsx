import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, Calendar, Edit } from 'lucide-react';
import ASRequestModal from '../components/ASRequestModal';
import { useDataStore, type ASRequest } from '../store/dataStore';
import toast from 'react-hot-toast';

// Format time to Korean format (14:00 -> 오후 2시, 02:00 -> 오전 2시)
const formatTimeKorean = (time: string): string => {
  if (!time) return '';
  const [hoursStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? '오후' : '오전';
  const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${period} ${displayHours}시`;
};

const AfterService = () => {
  const {
    asRequests,
    loadASRequestsFromAPI,
    addASRequestToAPI,
    updateASRequestInAPI,
    deleteASRequestFromAPI
  } = useDataStore();
  const requests = asRequests;

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ASRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [editingDate, setEditingDate] = useState<{
    requestId: string;
    field: 'requestDate' | 'scheduledVisitDate';
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load AS requests from API on mount
  useEffect(() => {
    loadASRequestsFromAPI().catch(error => {
      console.error('Failed to load AS requests:', error);
      toast.error('AS 요청 데이터를 불러오는데 실패했습니다');
    });
  }, [loadASRequestsFromAPI]);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      handleAddRequest();
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

  useEffect(() => {
    if (editingDate && inputRef.current) {
      inputRef.current.showPicker?.();
    }
  }, [editingDate]);

  const handleAddRequest = () => {
    setSelectedRequest(null);
    setIsModalOpen(true);
  };

  const handleSaveRequest = async (data: Partial<ASRequest>) => {
    try {
      if (selectedRequest) {
        // Update existing request
        await updateASRequestInAPI(selectedRequest.id, data);
        toast.success('AS 요청이 수정되었습니다');
      } else {
        // Add new request
        const newRequest: ASRequest = {
          id: '',
          ...data,
        };
        await addASRequestToAPI(newRequest);
        toast.success('AS 요청이 추가되었습니다');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save AS request:', error);
      toast.error('AS 요청 저장에 실패했습니다');
    }
  };

  const handleEdit = (request: ASRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, projectName: string) => {
    if (window.confirm(`"${projectName}" AS 요청을 삭제하시겠습니까?\n\n삭제된 내역은 복구할 수 없습니다.`)) {
      try {
        // 백엔드에서 AS 요청과 관련 일정을 모두 삭제합니다
        await deleteASRequestFromAPI(id);
        toast.success('AS 요청이 삭제되었습니다');
      } catch (error) {
        console.error('Failed to delete AS request:', error);
        toast.error('AS 요청 삭제에 실패했습니다');
      }
    }
  };

  const handleDateClick = (requestId: string, field: 'requestDate' | 'scheduledVisitDate') => {
    setEditingDate({ requestId, field });
  };

  const handleDateChange = async (newDateValue: string) => {
    if (!editingDate) return;

    const newDate = new Date(newDateValue);
    if (isNaN(newDate.getTime())) {
      return;
    }

    try {
      await updateASRequestInAPI(editingDate.requestId, {
        [editingDate.field]: newDate
      });
      setEditingDate(null);
    } catch (error) {
      console.error('Failed to update date:', error);
      toast.error('날짜 수정에 실패했습니다');
      setEditingDate(null);
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: 'completed' | 'revisit' | 'pending') => {
    try {
      const updateData: Partial<ASRequest> = {
        status: newStatus
      };

      // 완료 상태로 변경 시 완료일 설정
      if (newStatus === 'completed') {
        updateData.completionDate = new Date();
      } else if (newStatus === 'pending') {
        // 진행중으로 변경 시 완료일 제거
        updateData.completionDate = undefined;
      } else if (newStatus === 'revisit') {
        // 재방문으로 변경 시 방문예정일만 초기화 (요청일은 그대로 유지)
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
    const matchesSearch = req.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.description.toLowerCase().includes(searchTerm.toLowerCase());

    // 탭에 따른 필터링
    if (activeTab === 'completed') {
      return matchesSearch && req.status === 'completed';
    } else {
      return matchesSearch && req.status !== 'completed';
    }
  });

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end">
        <button onClick={handleAddRequest} className="hidden lg:inline-flex btn btn-primary px-4 py-2">
          + AS 요청
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 md:space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${
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
            className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${
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

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
        />
      </div>

      {/* Mobile & Tablet Card View */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredRequests.map((request) => (
          <div key={request.id} className="card p-3 md:p-4 hover:border-gray-400 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(request.status)}
                </div>
                <h3 className="font-bold text-base text-gray-900">{request.project}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{request.client}님</p>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleEdit(request)}
                  className="text-gray-600 hover:text-gray-700 p-1 -mt-1"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(request.id, request.project)}
                  className="text-rose-600 hover:text-rose-700 p-1 -mt-1"
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

              {request.assignedTo && request.assignedTo.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500">담당자</p>
                  <p className="text-gray-900 mt-0.5">{request.assignedTo.join(', ')}</p>
                </div>
              )}

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
                      <input
                        ref={inputRef}
                        type="date"
                        defaultValue={request.scheduledVisitDate ? format(request.scheduledVisitDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => handleDateChange(e.target.value)}
                        onBlur={() => setEditingDate(null)}
                        className="absolute left-0 top-0 w-auto h-auto opacity-0 z-50"
                        style={{ pointerEvents: 'auto' }}
                      />
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
                    className="flex-1 px-3 py-2 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">프로젝트</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">현장주소</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">내용</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">담당자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">방문예정일</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">작업</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRequests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(request.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="font-medium text-gray-900">{request.project}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm text-gray-900">{request.client}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900">{request.siteAddress}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900">{request.description}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm text-gray-900">
                    {request.assignedTo && request.assignedTo.length > 0
                      ? request.assignedTo.join(', ')
                      : '-'}
                  </p>
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
                    {editingDate?.requestId === request.id && editingDate?.field === 'scheduledVisitDate' && (
                      <input
                        ref={inputRef}
                        type="date"
                        defaultValue={request.scheduledVisitDate ? format(request.scheduledVisitDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => handleDateChange(e.target.value)}
                        onBlur={() => setEditingDate(null)}
                        className="absolute left-0 top-0 w-auto h-auto opacity-0 z-50"
                        style={{ pointerEvents: 'auto' }}
                      />
                    )}
                    <button
                      onClick={() => handleDateClick(request.id, 'scheduledVisitDate')}
                      className="flex items-center space-x-2 text-sm text-gray-900 hover:text-gray-600 transition-colors"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>
                        {request.scheduledVisitDate ? format(request.scheduledVisitDate, 'yyyy.MM.dd (eee)', { locale: ko }) : '-'}
                        {request.scheduledVisitTime && ` ${formatTimeKorean(request.scheduledVisitTime)}`}
                      </span>
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-2">
                    {request.status !== 'completed' ? (
                      <>
                        <button
                          onClick={() => handleStatusChange(request.id, 'completed')}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          완료
                        </button>
                        <button
                          onClick={() => handleStatusChange(request.id, 'revisit')}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          재방문
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(request.id, 'pending')}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        진행중
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(request)}
                      className="p-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      title="수정"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(request.id, request.project)}
                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                      title="삭제"
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

      {/* AS Request Modal */}
      {isModalOpen && (
        <ASRequestModal
          request={selectedRequest}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveRequest}
        />
      )}
    </div>
  );
};

export default AfterService;
