import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Upload, X, ChevronLeft, ChevronRight, Trash2, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import siteLogService from '../services/siteLogService';

interface SiteLog {
  id: string;
  project: string;
  date: Date;
  images: string[];
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

interface DayData {
  date: Date;
  logs: SiteLog[];
  hasImages: boolean;
}

const SiteLog = () => {
  const { user } = useAuth();
  const projects = useFilteredProjects();
  const [logs, setLogs] = useState<SiteLog[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDragging, setIsDragging] = useState(false);
  const [imageModal, setImageModal] = useState<{ show: boolean; url: string | null; images?: string[] }>({ show: false, url: null });
  const [isUploading, setIsUploading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // 폼 데이터
  const [formData, setFormData] = useState({
    notes: '',
    images: [] as string[]
  });

  // 프로젝트 초기값 설정
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject]);

  // 로그 데이터 로드
  useEffect(() => {
    loadSiteLogs();
  }, [selectedProject]);

  const loadSiteLogs = async () => {
    if (!selectedProject) return;

    try {
      const data = await siteLogService.getProjectLogs(selectedProject);
      setLogs(data.map((log: any) => ({
        ...log,
        id: log._id || log.id,
        date: log.date ? new Date(log.date) : new Date(),
        createdAt: log.created_at ? new Date(log.created_at) : new Date()
      })));
    } catch (error) {
      console.error('Failed to load site logs:', error);
      // 에러 시 빈 배열로 초기화
      setLogs([]);
    }
  };

  // 이미지 업로드 처리
  const handleImageUpload = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }

    const promises = imageFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(images => {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...images]
      }));
      toast.success(`${images.length}개의 이미지가 추가되었습니다`);
    });
  }, []);

  // 드래그 앤 드롭
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageUpload(e.dataTransfer.files);
  }, [handleImageUpload]);

  // 클립보드 붙여넣기
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
      if (imageItems.length === 0) return;

      e.preventDefault();

      const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      handleImageUpload(files);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleImageUpload]);

  // 일지 저장
  const handleSave = async () => {
    if (!selectedProject) {
      toast.error('프로젝트를 선택하세요');
      return;
    }

    if (!formData.notes && formData.images.length === 0) {
      toast.error('작업 내용을 입력하거나 사진을 업로드해주세요');
      return;
    }

    setIsUploading(true);
    try {
      const logData = {
        project: selectedProject,
        date: selectedDate,
        images: formData.images,
        notes: formData.notes,
        createdBy: user?.name || ''
      };

      await siteLogService.createLog(logData);
      toast.success('현장일지가 저장되었습니다');

      // 폼 초기화
      setFormData({
        notes: '',
        images: []
      });

      // 목록 새로고침
      await loadSiteLogs();
    } catch (error) {
      console.error('Failed to save site log:', error);
      toast.error('현장일지 저장에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  };

  // 일지 삭제
  const handleDelete = async (logId: string) => {
    if (!window.confirm('이 현장일지를 삭제하시겠습니까?')) return;

    try {
      await siteLogService.deleteLog(logId);
      toast.success('현장일지가 삭제되었습니다');
      await loadSiteLogs();
    } catch (error) {
      console.error('Failed to delete site log:', error);
      toast.error('현장일지 삭제에 실패했습니다');
    }
  };

  // 캘린더 데이터 생성
  const getCalendarDays = (): DayData[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: DayData[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dayLogs = logs.filter(log => {
        try {
          const logDate = log.date ? new Date(log.date) : null;
          return logDate && !isNaN(logDate.getTime()) &&
                 format(logDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
        } catch {
          return false;
        }
      });

      days.push({
        date: new Date(currentDate),
        logs: dayLogs,
        hasImages: dayLogs.some(log => log.images && log.images.length > 0)
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  // 월 변경
  const changeMonth = (direction: number) => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setCalendarMonth(newDate);
  };

  // 날짜별 그룹화된 로그
  const groupedLogs = logs.reduce((groups, log) => {
    try {
      const logDate = log.date ? new Date(log.date) : null;
      if (logDate && !isNaN(logDate.getTime())) {
        const dateKey = format(logDate, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(log);
      }
    } catch {
      // 날짜 파싱 실패 시 무시
    }
    return groups;
  }, {} as Record<string, SiteLog[]>);

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  // 이미지 갤러리 모달 열기
  const openImageGallery = (images: string[], startIndex: number = 0) => {
    setImageModal({ show: true, url: images[startIndex], images });
    setCurrentImageIndex(startIndex);
  };

  // 다음/이전 이미지
  const navigateImage = (direction: number) => {
    if (!imageModal.images) return;
    const newIndex = (currentImageIndex + direction + imageModal.images.length) % imageModal.images.length;
    setCurrentImageIndex(newIndex);
    setImageModal(prev => ({ ...prev, url: imageModal.images![newIndex] }));
  };

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageModal.show) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (imageModal.images && imageModal.images.length > 1) {
            navigateImage(-1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (imageModal.images && imageModal.images.length > 1) {
            navigateImage(1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setImageModal({ show: false, url: null });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageModal.show, imageModal.images, currentImageIndex]);

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 왼쪽: 캘린더 + 입력 폼 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 프로젝트 선택 및 캘린더 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            {/* 프로젝트 선택 */}
            <div className="mb-4">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 캘린더 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold">
                {format(calendarMonth, 'yyyy년 M월')}
              </h3>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* 캘린더 그리드 */}
            <div className="grid grid-cols-7 gap-0.5">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
                  {day}
                </div>
              ))}
              {getCalendarDays().map((day, idx) => {
                const isCurrentMonth = day.date.getMonth() === calendarMonth.getMonth();
                const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const isSelected = format(day.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(day.date)}
                    className={`text-center p-2 text-xs cursor-pointer rounded transition-colors ${
                      !isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                    } ${isToday ? 'bg-blue-100' : ''} ${
                      isSelected ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                    } ${day.hasImages ? 'font-bold' : ''}`}
                  >
                    {format(day.date, 'd')}
                    {day.hasImages && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mx-auto mt-0.5"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 입력 폼 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold mb-4">
              {format(selectedDate, 'M월 d일')} 일지 작성
            </h2>

            <div className="space-y-4">

              {/* 작업 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  작업 내용
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="오늘 진행한 작업 내용을 입력하세요"
                />
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSave}
                disabled={isUploading}
                className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                  isUploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {isUploading ? '저장 중...' : '작업 내용 저장'}
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 선택된 날짜의 일지 */}
        <div className="lg:col-span-9 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 현장일지
            </h2>
            {formData.images.length > 0 && (
              <span className="text-sm text-gray-500">
                {formData.images.length}개의 사진 대기 중
              </span>
            )}
          </div>

          {/* 이미지 업로드 영역 - 새로운 일지 추가할 때 */}
          {formData.images.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">업로드 대기 중인 사진</h3>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, images: [] }))}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  모두 삭제
                </button>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      alt={`대기 ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== idx)
                      }))}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                왼쪽 폼에서 작업 내용을 입력하고 저장 버튼을 누르면 사진이 함께 저장됩니다.
              </p>
            </div>
          )}

          <div className="space-y-6 max-h-[800px] overflow-y-auto">
            {(() => {
              const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
              const selectedDateLogs = logs.filter(log => {
                try {
                  const logDate = log.date ? new Date(log.date) : null;
                  return logDate && !isNaN(logDate.getTime()) &&
                         format(logDate, 'yyyy-MM-dd') === selectedDateStr;
                } catch {
                  return false;
                }
              });

              if (selectedDateLogs.length > 0) {
                return (
                  <div className="space-y-4">
                    {selectedDateLogs.map(log => (
                      <div key={log.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                              <span>작성자: {log.createdBy || log.created_by || '알 수 없음'}</span>
                              {log.createdAt && (
                                <span>• {format(new Date(log.createdAt), 'HH:mm')}</span>
                              )}
                            </div>
                            {log.notes && (
                              <p className="text-sm text-gray-700">{log.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>

                        {/* 이미지 갤러리 - 크게 보기 */}
                        {log.images && log.images.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {log.images.map((img, idx) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={img}
                                  alt={`현장사진 ${idx + 1}`}
                                  className="w-full h-36 lg:h-44 object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => openImageGallery(log.images, idx)}
                                />
                                <button
                                  onClick={() => openImageGallery(log.images, idx)}
                                  className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Maximize2 className="h-4 w-4" />
                                </button>
                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                  {idx + 1} / {log.images.length}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              } else {
                return (
                  <div>
                    {/* 큰 드래그 영역 */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                        isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      <Camera className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                      <p className="text-lg font-medium text-gray-700 mb-2">
                        {format(selectedDate, 'M월 d일')} 현장 사진을 업로드하세요
                      </p>
                      <p className="text-sm text-gray-600 mb-4">
                        이미지를 이곳에 드래그하거나 클릭하여 선택
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        Ctrl+V로 클립보드 이미지 붙여넣기도 가능합니다
                      </p>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                        className="hidden"
                        id="main-image-upload"
                      />
                      <label
                        htmlFor="main-image-upload"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        파일 선택
                      </label>
                    </div>
                    {selectedDateLogs.length === 0 && formData.images.length === 0 && (
                      <p className="text-center text-sm text-gray-500 mt-4">
                        사진을 업로드한 후 왼쪽에서 작업 내용을 입력하고 저장하세요
                      </p>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </div>

      {/* 이미지 모달 - 갤러리 형식 */}
      {imageModal.show && imageModal.url && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setImageModal({ show: false, url: null })}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageModal({ show: false, url: null });
              }}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 backdrop-blur rounded-full hover:bg-opacity-30 z-10"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* 이전 버튼 */}
            {imageModal.images && imageModal.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage(-1);
                }}
                className="absolute left-4 p-3 bg-white bg-opacity-20 backdrop-blur rounded-full hover:bg-opacity-30"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            )}

            {/* 이미지 */}
            <img
              src={imageModal.url}
              alt="확대 이미지"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* 다음 버튼 */}
            {imageModal.images && imageModal.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage(1);
                }}
                className="absolute right-4 p-3 bg-white bg-opacity-20 backdrop-blur rounded-full hover:bg-opacity-30"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            )}

            {/* 페이지 표시 */}
            {imageModal.images && imageModal.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full">
                {currentImageIndex + 1} / {imageModal.images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteLog;