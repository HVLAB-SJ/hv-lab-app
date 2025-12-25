/**
 * Firebase 백업 관리 모달
 */
import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import backupService, { BackupData, BackupProgress } from '../services/firestore/backupService';
import toast from 'react-hot-toast';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    setBackupData(null);

    try {
      const backup = await backupService.createBackup(setProgress);
      setBackupData(backup);
      toast.success('백업이 완료되었습니다!');
    } catch (error) {
      console.error('백업 실패:', error);
      toast.error('백업에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadBackup = () => {
    if (backupData) {
      backupService.downloadBackup(backupData);
      toast.success('백업 파일이 다운로드됩니다.');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const backup = await backupService.readBackupFile(file);
      const stats = backupService.getBackupStats(backup);

      const confirmMessage = `다음 백업을 복원하시겠습니까?\n\n` +
        `생성일: ${new Date(backup.createdAt).toLocaleString()}\n` +
        `총 문서 수: ${stats.totalDocuments.toLocaleString()}개\n` +
        `컬렉션 수: ${stats.collections.length}개\n\n` +
        `주의: 기존 데이터가 덮어씌워집니다!`;

      if (window.confirm(confirmMessage)) {
        setIsProcessing(true);
        const result = await backupService.restoreBackup(backup, setProgress);

        if (result.success) {
          toast.success(`${result.restoredCount.toLocaleString()}개 문서가 복원되었습니다.`);
        } else {
          toast.error(`복원 중 일부 오류 발생: ${result.errors.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('복원 실패:', error);
      toast.error((error as Error).message || '복원에 실패했습니다.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getProgressPercent = () => {
    if (!progress) return 0;
    return Math.round((progress.completedCollections / progress.totalCollections) * 100);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-base font-medium text-gray-900">데이터 백업</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-3">
          {/* 진행 상태 */}
          {progress && progress.status !== 'idle' && progress.status !== 'completed' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {progress.status === 'backing_up' ? '백업 중...' : '복원 중...'}
                </span>
                <span className="text-gray-900 font-medium">{getProgressPercent()}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-gray-900 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercent()}%` }}
                />
              </div>
              {progress.currentCollection && (
                <p className="text-xs text-gray-500">{progress.currentCollection}</p>
              )}
            </div>
          )}

          {/* 백업 결과 */}
          {backupData && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-sm text-gray-700">
                {new Date(backupData.createdAt).toLocaleString()} 생성
              </p>
              <p className="text-xs text-gray-500">
                {backupService.getBackupStats(backupData).totalDocuments.toLocaleString()}개 문서
              </p>
              <button
                onClick={handleDownloadBackup}
                className="w-full py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                다운로드
              </button>
            </div>
          )}

          {/* 버튼들 */}
          {!backupData && (
            <div className="space-y-2">
              <button
                onClick={handleCreateBackup}
                disabled={isProcessing}
                className="w-full py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing && progress?.status === 'backing_up' ? '백업 중...' : '새 백업 생성'}
              </button>

              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing && progress?.status === 'restoring' ? '복원 중...' : '백업 파일에서 복원'}
                </button>
              </div>
            </div>
          )}

          {/* 안내 */}
          <p className="text-xs text-gray-400 text-center">
            매일 새벽 3시 자동 백업 (7일 보관)
          </p>
        </div>
      </div>
    </div>
  );
}
