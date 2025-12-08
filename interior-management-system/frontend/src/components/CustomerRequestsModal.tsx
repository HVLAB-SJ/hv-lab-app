import { useState } from 'react';
import { X, Circle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CustomerRequest {
  id: string;
  content: string;
  completed: boolean;
  createdAt: Date;
}

interface CustomerRequestsModalProps {
  projectName: string;
  customerRequests: CustomerRequest[];
  onClose: () => void;
  onSave: (content: string, requestDate: Date) => void;
  onToggleComplete: (requestId: string) => void;
  onDelete: (requestId: string) => void;
}

const CustomerRequestsModal = ({
  projectName,
  customerRequests,
  onClose,
  onSave,
  onToggleComplete,
  onDelete
}: CustomerRequestsModalProps) => {
  const [newContent, setNewContent] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewContent('');
    setRequestDate(new Date().toISOString().split('T')[0]);
  };

  const handleSaveNew = async () => {
    if (isSaving) return;
    if (!newContent.trim()) {
      alert('내용을 입력하세요');
      return;
    }
    if (!requestDate) {
      alert('요청일자를 선택하세요');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(newContent.trim(), new Date(requestDate));
      setNewContent('');
      setRequestDate(new Date().toISOString().split('T')[0]);
      setIsAddingNew(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelNew = () => {
    setNewContent('');
    setRequestDate(new Date().toISOString().split('T')[0]);
    setIsAddingNew(false);
  };

  const handleDeleteRequest = (requestId: string) => {
    if (window.confirm('이 요청사항을 삭제하시겠습니까?')) {
      onDelete(requestId);
    }
  };

  const handleToggle = (requestId: string) => {
    onToggleComplete(requestId);
  };

  const pendingRequests = customerRequests.filter(r => !r.completed);
  const completedRequests = customerRequests.filter(r => r.completed);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">고객 요청사항</h2>
            <p className="text-sm text-gray-500 mt-0.5">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Button */}
          {!isAddingNew && (
            <button
              onClick={handleAddNew}
              className="w-full mb-4 px-4 py-2.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              + 추가
            </button>
          )}

          {/* New Request Form */}
          {isAddingNew && (
            <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  요청일자 *
                </label>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  요청 내용 *
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="고객 요청사항을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNew}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={handleCancelNew}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* Requests List */}
          <div className="space-y-2">
            {customerRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                등록된 요청사항이 없습니다
              </div>
            ) : (
              <>
                {/* Pending Requests */}
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 bg-white border border-gray-300 rounded hover:border-gray-400 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggle(request.id)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        <Circle className="h-4 w-4 text-gray-400" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                          {request.content}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(request.createdAt), 'yyyy.MM.dd', { locale: ko })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRequest(request.id)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-gray-500 hover:text-red-600 transition-all"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}

                {/* Completed Requests */}
                {completedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded hover:border-gray-300 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggle(request.id)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        <CheckCircle2 className="h-4 w-4 text-gray-900" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-500 line-through whitespace-pre-wrap break-words">
                          {request.content}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(request.createdAt), 'yyyy.MM.dd', { locale: ko })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRequest(request.id)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-gray-500 hover:text-red-600 transition-all"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRequestsModal;
