import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, Calendar, User, Building, Trash2 } from 'lucide-react';
import api from '../services/api';

interface QuoteInquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  projectType?: string;
  budget?: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

const QuoteInquiry = () => {
  const [inquiries, setInquiries] = useState<QuoteInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<QuoteInquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInquiries();
  }, []);

  const loadInquiries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/quote-inquiries');
      setInquiries(response.data);
    } catch (error) {
      console.error('Failed to load inquiries:', error);
      toast.error('견적문의를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/quote-inquiries/${id}/read`);
      setInquiries(prev =>
        prev.map(inq => inq.id === id ? { ...inq, isRead: true } : inq)
      );
      // 배지 업데이트를 위한 이벤트 발생
      window.dispatchEvent(new CustomEvent('quoteInquiryRead'));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleSelectInquiry = (inquiry: QuoteInquiry) => {
    setSelectedInquiry(inquiry);
    if (!inquiry.isRead) {
      markAsRead(inquiry.id);
    }
  };

  const handleDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 클릭 이벤트가 상위로 전파되지 않도록

    if (!confirm('이 견적문의를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await api.delete(`/quote-inquiries/${id}`);
      setInquiries(prev => prev.filter(inq => inq.id !== id));

      // 삭제된 항목이 선택된 항목이면 선택 해제
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(null);
      }

      toast.success('견적문의가 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete inquiry:', error);
      toast.error('견적문의 삭제에 실패했습니다');
    }
  };

  const unreadCount = inquiries.filter(inq => !inq.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 p-4">
      {/* 목록 - 모바일에서는 상세가 선택되면 숨김 */}
      <div className={`w-full md:w-1/3 bg-white rounded-lg shadow overflow-hidden flex flex-col ${selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            견적문의 목록
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {inquiries.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              접수된 견적문의가 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {inquiries.map(inquiry => (
                <div
                  key={inquiry.id}
                  className={`relative group ${
                    selectedInquiry?.id === inquiry.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  } ${!inquiry.isRead ? 'bg-yellow-50' : ''}`}
                >
                  <button
                    onClick={() => handleSelectInquiry(inquiry)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{inquiry.name}</span>
                        {!inquiry.isRead && (
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {format(new Date(inquiry.createdAt), 'MM/dd HH:mm')}
                        </span>
                        <button
                          onClick={(e) => handleDelete(inquiry.id, e)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3" />
                      {inquiry.phone}
                    </div>

                    <div className="text-sm text-gray-500 line-clamp-2">
                      {inquiry.message}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 상세 - 모바일에서는 목록이 선택되지 않으면 숨김 */}
      <div className={`flex-1 bg-white rounded-lg shadow overflow-hidden ${!selectedInquiry ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        {selectedInquiry ? (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedInquiry.name}
                </h3>
                {/* 모바일에서 목록으로 돌아가기 버튼 */}
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="md:hidden px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                >
                  목록으로
                </button>
              </div>
              <div className="text-sm text-gray-500">
                {format(new Date(selectedInquiry.createdAt), 'yyyy년 MM월 dd일 HH:mm')}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 연락처 정보 */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  연락처 정보
                </h4>
                <div className="pl-6 space-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{selectedInquiry.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{selectedInquiry.email}</span>
                  </div>
                  {selectedInquiry.address && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{selectedInquiry.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 프로젝트 정보 */}
              {(selectedInquiry.projectType || selectedInquiry.budget) && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    프로젝트 정보
                  </h4>
                  <div className="pl-6 space-y-2">
                    {selectedInquiry.projectType && (
                      <div className="text-gray-700">
                        <span className="text-gray-500">공사 종류: </span>
                        {selectedInquiry.projectType}
                      </div>
                    )}
                    {selectedInquiry.budget && (
                      <div className="text-gray-700">
                        <span className="text-gray-500">예산: </span>
                        {selectedInquiry.budget}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 문의 내용 */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">문의 내용</h4>
                <div className="pl-6 text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                  {selectedInquiry.message}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            견적문의를 선택해주세요
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteInquiry;
