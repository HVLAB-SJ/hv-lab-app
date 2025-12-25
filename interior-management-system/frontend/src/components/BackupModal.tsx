/**
 * Firebase 백업 관리 모달
 */
import { useState, useRef } from 'react';
import { Download, Upload, X, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">데이터 백업 관리</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-4">
          {/* 진행 상태 */}
          {progress && progress.status !== 'idle' && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {progress.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : progress.status === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                )}
                <span className="font-medium">
                  {progress.status === 'backing_up' && '백업 중...'}
                  {progress.status === 'restoring' && '복원 중...'}
                  {progress.status === 'completed' && '완료!'}
                  {progress.status === 'error' && '오류 발생'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercent()}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {progress.currentCollection && `처리 중: ${progress.currentCollection}`}
                {!progress.currentCollection && progress.status === 'completed' &&
                  `${progress.completedCollections}개 컬렉션 처리 완료`}
              </p>
            </div>
          )}

          {/* 백업 결과 */}
          {backupData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">백업 준비 완료</h3>
              <p className="text-sm text-green-700 mb-3">
                생성 시간: {new Date(backupData.createdAt).toLocaleString()}
                <br />
                총 {backupService.getBackupStats(backupData).totalDocuments.toLocaleString()}개 문서
              </p>
              <button
                onClick={handleDownloadBackup}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                백업 파일 다운로드
              </button>
            </div>
          )}

          {/* 버튼들 */}
          <div className="space-y-3">
            <button
              onClick={handleCreateBackup}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing && progress?.status === 'backing_up' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              새 백업 생성
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing && progress?.status === 'restoring' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                백업 파일에서 복원
              </button>
            </div>
          </div>

          {/* 경고 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>주의:</strong> 복원 시 기존 데이터가 덮어씌워집니다.
              복원 전 현재 상태를 먼저 백업해두세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
