import { useState } from 'react';
import { X } from 'lucide-react';

interface SitePasswordModalProps {
  projectName: string;
  entrancePassword: string;
  sitePassword: string;
  onClose: () => void;
  onSave: (entrancePassword: string, sitePassword: string) => void;
}

const SitePasswordModal = ({
  projectName,
  entrancePassword: initialEntrancePassword,
  sitePassword: initialSitePassword,
  onClose,
  onSave
}: SitePasswordModalProps) => {
  const [entrancePassword, setEntrancePassword] = useState(initialEntrancePassword || '');
  const [sitePassword, setSitePassword] = useState(initialSitePassword || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(entrancePassword, sitePassword);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEntrancePassword(initialEntrancePassword || '');
    setSitePassword(initialSitePassword || '');
    setIsEditing(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">비밀번호</h2>
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
        <div className="p-6 space-y-4">
          {/* 공동현관 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              공동현관
            </label>
            {isEditing ? (
              <input
                type="text"
                value={entrancePassword}
                onChange={(e) => setEntrancePassword(e.target.value)}
                placeholder="공동현관 비밀번호 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                {entrancePassword ? (
                  <span className="text-sm font-mono text-gray-900">{entrancePassword}</span>
                ) : (
                  <span className="text-sm text-gray-400">미등록</span>
                )}
              </div>
            )}
          </div>

          {/* 현장 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현장
            </label>
            {isEditing ? (
              <input
                type="text"
                value={sitePassword}
                onChange={(e) => setSitePassword(e.target.value)}
                placeholder="현장 비밀번호 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                {sitePassword ? (
                  <span className="text-sm font-mono text-gray-900">{sitePassword}</span>
                ) : (
                  <span className="text-sm text-gray-400">미등록</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 transition-colors"
              >
                저장
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                수정
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 transition-colors"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SitePasswordModal;
