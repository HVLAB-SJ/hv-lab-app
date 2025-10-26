import { useState } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface MeetingNote {
  id: string;
  content: string;
  date: Date;
}

interface MeetingNotesModalProps {
  projectName: string;
  meetingNotes: MeetingNote[];
  onClose: () => void;
  onSave: (content: string, meetingDate: Date) => void;
  onDelete: (noteId: string) => void;
}

const MeetingNotesModal = ({
  projectName,
  meetingNotes,
  onClose,
  onSave,
  onDelete
}: MeetingNotesModalProps) => {
  const [newContent, setNewContent] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewContent('');
    setMeetingDate(new Date().toISOString().split('T')[0]);
  };

  const handleSaveNew = () => {
    if (!newContent.trim()) {
      alert('내용을 입력하세요');
      return;
    }
    if (!meetingDate) {
      alert('미팅일자를 선택하세요');
      return;
    }
    onSave(newContent.trim(), new Date(meetingDate));
    setNewContent('');
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setIsAddingNew(false);
  };

  const handleCancelNew = () => {
    setNewContent('');
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setIsAddingNew(false);
  };

  const handleDeleteNote = (noteId: string) => {
    if (window.confirm('이 미팅 내용을 삭제하시겠습니까?')) {
      onDelete(noteId);
    }
  };

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
            <h2 className="text-lg font-semibold text-gray-900">미팅 내용</h2>
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

          {/* New Note Form */}
          {isAddingNew && (
            <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  미팅일자 *
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  미팅 내용 *
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="미팅 내용을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900 resize-none"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNew}
                  className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={handleCancelNew}
                  className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* Notes List */}
          <div className="space-y-3">
            {meetingNotes.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                작성된 미팅 내용이 없습니다
              </div>
            ) : (
              meetingNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 bg-white border border-gray-200 rounded hover:border-gray-300 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 mb-2">
                        {format(new Date(note.date), 'yyyy.MM.dd (eee)', { locale: ko })}
                      </p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-gray-500 hover:text-red-600 transition-all"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingNotesModal;
