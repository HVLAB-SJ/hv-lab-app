import { useState } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CustomerRequest {
  id: string;
  content: string;
  completed: boolean;
  createdAt: Date;
}

interface MeetingNote {
  id: string;
  content: string;
  date: Date;
}

interface ProjectNotesModalProps {
  projectId: string;
  projectName: string;
  meetingNotes: MeetingNote[];
  customerRequests: CustomerRequest[];
  onClose: () => void;
  onSaveMeetingNote: (content: string) => void;
  onSaveCustomerRequest: (content: string) => void;
  onToggleRequestComplete: (requestId: string) => void;
  onDeleteMeetingNote: (noteId: string) => void;
  onDeleteCustomerRequest: (requestId: string) => void;
}

const ProjectNotesModal = ({
  projectName,
  meetingNotes,
  customerRequests,
  onClose,
  onSaveMeetingNote,
  onSaveCustomerRequest,
  onToggleRequestComplete,
  onDeleteMeetingNote,
  onDeleteCustomerRequest
}: ProjectNotesModalProps) => {
  const [activeTab, setActiveTab] = useState<'meeting' | 'request'>('meeting');
  const [meetingInput, setMeetingInput] = useState('');
  const [requestInput, setRequestInput] = useState('');

  const handleSaveMeeting = () => {
    if (!meetingInput.trim()) {
      alert('미팅 내용을 입력하세요');
      return;
    }
    onSaveMeetingNote(meetingInput);
    setMeetingInput('');
  };

  const handleSaveRequest = () => {
    if (!requestInput.trim()) {
      alert('고객 요청사항을 입력하세요');
      return;
    }
    onSaveCustomerRequest(requestInput);
    setRequestInput('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {projectName}
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1">미팅 내용 및 고객 요청사항</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4 md:px-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('meeting')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'meeting'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              미팅 내용
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                activeTab === 'meeting' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {meetingNotes.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('request')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'request'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              고객 요청사항
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                activeTab === 'request' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {customerRequests.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'meeting' ? (
            <div className="space-y-4">
              {/* Input Form */}
              <div className="space-y-3">
                <textarea
                  value={meetingInput}
                  onChange={(e) => setMeetingInput(e.target.value)}
                  placeholder="미팅 내용을 입력하세요..."
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                  rows={4}
                />
                <button
                  onClick={handleSaveMeeting}
                  className="w-full md:w-auto px-4 md:px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  추가
                </button>
              </div>

              {/* Meeting Notes List */}
              <div className="space-y-3 mt-6">
                {meetingNotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    아직 작성된 미팅 내용이 없습니다
                  </div>
                ) : (
                  meetingNotes.map((note) => (
                    <div key={note.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base text-gray-900 whitespace-pre-wrap break-words">
                            {note.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {format(note.date, 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteMeetingNote(note.id)}
                          className="text-xs text-gray-500 hover:text-red-600 transition-colors flex-shrink-0"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Input Form */}
              <div className="space-y-3">
                <textarea
                  value={requestInput}
                  onChange={(e) => setRequestInput(e.target.value)}
                  placeholder="고객 요청사항을 입력하세요..."
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                  rows={4}
                />
                <button
                  onClick={handleSaveRequest}
                  className="w-full md:w-auto px-4 md:px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  추가
                </button>
              </div>

              {/* Customer Requests List */}
              <div className="space-y-3 mt-6">
                {customerRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    아직 작성된 고객 요청사항이 없습니다
                  </div>
                ) : (
                  customerRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={request.completed}
                          onChange={() => onToggleRequestComplete(request.id)}
                          className="mt-1 h-4 w-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm md:text-base whitespace-pre-wrap break-words ${
                              request.completed
                                ? 'line-through text-gray-500'
                                : 'text-gray-900'
                            }`}
                          >
                            {request.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {format(request.createdAt, 'yyyy년 MM월 dd일', { locale: ko })}
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteCustomerRequest(request.id)}
                          className="text-xs text-gray-500 hover:text-red-600 transition-colors flex-shrink-0"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectNotesModal;
