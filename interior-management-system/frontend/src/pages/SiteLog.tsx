import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Calendar, Upload, X, ChevronLeft, ChevronRight, Trash2, List, Maximize2 } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageModal, setImageModal] = useState<{ show: boolean; url: string | null; images?: string[] }>({ show: false, url: null });
  const [isUploading, setIsUploading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
        id: log._id,
        date: new Date(log.date)
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

    if (formData.images.length === 0) {
      toast.error('최소 1개 이상의 현장 사진이 필요합니다');
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
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: DayData[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dayLogs = logs.filter(log =>
        format(log.date, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
      );

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
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  // 날짜별 그룹화된 로그
  const groupedLogs = logs.reduce((groups, log) => {
    const dateKey = format(log.date, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(log);
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

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Camera className="h-6 w-6 text-gray-600" />
            현장일지
          </h1>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* 프로젝트 선택 */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {projects.map(project => (
                <option key={project.id} value={project.name}>
                  {project.name}
                </option>
              ))}
            </select>

            {/* 보기 모드 전환 */}
            <div className="flex rounded-lg border border-gray-300">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 flex items-center gap-2 ${
                  viewMode === 'list'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="h-4 w-4" />
                목록
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 flex items-center gap-2 border-l ${
                  viewMode === 'calendar'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-4 w-4" />
                캘린더
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 입력 폼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-fit">
          <h2 className="text-lg font-semibold mb-4">일지 작성</h2>

          <div className="space-y-4">
            {/* 날짜 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                날짜
              </label>
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* 작업 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                작업 내용
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="오늘 진행한 작업 내용을 입력하세요"
              />
            </div>

            {/* 이미지 업로드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                현장 사진 (필수)
              </label>

              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center ${
                  isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Camera className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  이미지를 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ctrl+V로 붙여넣기 가능
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="mt-3 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  파일 선택
                </label>
              </div>

              {/* 이미지 미리보기 */}
              {formData.images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img}
                        alt={`현장사진 ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer"
                        onClick={() => openImageGallery(formData.images, idx)}
                      />
                      <button
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          images: prev.images.filter((_, i) => i !== idx)
                        }))}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={isUploading || formData.images.length === 0}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                isUploading || formData.images.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isUploading ? '저장 중...' : '현장일지 저장'}
            </button>
          </div>
        </div>

        {/* 캘린더 뷰 / 리스트 뷰 */}
        <div className="xl:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {viewMode === 'calendar' ? (
            <>
              {/* 캘린더 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold">
                  {format(selectedDate, 'yyyy년 M월')}
                </h2>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* 캘린더 그리드 - 더 작게 */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="bg-gray-50 p-1.5 text-center text-xs font-medium text-gray-700">
                    {day}
                  </div>
                ))}
                {getCalendarDays().map((day, idx) => {
                  const isCurrentMonth = day.date.getMonth() === selectedDate.getMonth();
                  const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const isSelected = format(day.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(day.date)}
                      className={`bg-white p-1.5 min-h-[60px] cursor-pointer transition-colors ${
                        !isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                      } ${isToday ? 'bg-blue-50' : ''} ${
                        isSelected ? 'ring-2 ring-gray-900' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium">
                          {format(day.date, 'd')}
                        </span>
                        {day.hasImages && (
                          <Camera className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                      {day.logs.length > 0 && (
                        <div className="text-[10px] text-gray-500">
                          {day.logs.reduce((total, log) => total + log.images.length, 0)}장
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* 리스트 뷰 - 사진 크게 보기 */}
              <h2 className="text-lg font-semibold mb-4">현장일지 목록</h2>

              <div className="space-y-6 max-h-[800px] overflow-y-auto">
                {sortedDates.length > 0 ? (
                  sortedDates.map(dateKey => (
                    <div key={dateKey} className="border-l-4 border-gray-300 pl-4">
                      <h3 className="font-medium text-gray-900 mb-3">
                        {format(new Date(dateKey), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                      </h3>
                      <div className="space-y-4">
                        {groupedLogs[dateKey].map(log => (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                  <span>작성자: {log.createdBy}</span>
                                  <span>• {format(new Date(log.createdAt), 'HH:mm')}</span>
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
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {log.images.map((img, idx) => (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={img}
                                      alt={`현장사진 ${idx + 1}`}
                                      className="w-full h-40 lg:h-48 object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
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
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Camera className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p>아직 작성된 현장일지가 없습니다</p>
                  </div>
                )}
              </div>
            </>
          )}
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