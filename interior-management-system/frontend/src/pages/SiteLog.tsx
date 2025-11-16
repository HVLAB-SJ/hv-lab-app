import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Calendar, Upload, X, ChevronLeft, ChevronRight, Download, Trash2, Grid, List } from 'lucide-react';
import toast from 'react-hot-toast';
import siteLogService from '../services/siteLogService';

interface SiteLog {
  id: string;
  project: string;
  date: Date;
  images: string[];
  notes?: string;
  weather?: string;
  workers?: number;
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageModal, setImageModal] = useState<{ show: boolean; url: string | null }>({ show: false, url: null });
  const [isUploading, setIsUploading] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    notes: '',
    weather: '맑음',
    workers: 0,
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
        weather: formData.weather,
        workers: formData.workers,
        createdBy: user?.name || ''
      };

      await siteLogService.createLog(logData);
      toast.success('현장일지가 저장되었습니다');

      // 폼 초기화
      setFormData({
        notes: '',
        weather: '맑음',
        workers: 0,
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
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 flex items-center gap-2 ${
                  viewMode === 'calendar'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-4 w-4" />
                캘린더
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 flex items-center gap-2 border-l ${
                  viewMode === 'list'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="h-4 w-4" />
                목록
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 입력 폼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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

            {/* 날씨 & 작업 인원 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  날씨
                </label>
                <select
                  value={formData.weather}
                  onChange={(e) => setFormData(prev => ({ ...prev, weather: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <option value="맑음">☀️ 맑음</option>
                  <option value="흐림">☁️ 흐림</option>
                  <option value="비">🌧️ 비</option>
                  <option value="눈">❄️ 눈</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  작업 인원
                </label>
                <input
                  type="number"
                  value={formData.workers}
                  onChange={(e) => setFormData(prev => ({ ...prev, workers: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="0"
                  min="0"
                />
              </div>
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
                        className="w-full h-24 object-cover rounded-lg"
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
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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

              {/* 캘린더 그리드 */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
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
                      className={`bg-white p-2 min-h-[80px] cursor-pointer transition-colors ${
                        !isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                      } ${isToday ? 'bg-blue-50' : ''} ${
                        isSelected ? 'ring-2 ring-gray-900' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {format(day.date, 'd')}
                        </span>
                        {day.hasImages && (
                          <Camera className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                      {day.logs.length > 0 && (
                        <div className="space-y-1">
                          {day.logs.slice(0, 2).map((log, i) => (
                            <div key={i} className="text-xs text-gray-600 truncate">
                              {log.images.length}장
                            </div>
                          ))}
                          {day.logs.length > 2 && (
                            <div className="text-xs text-gray-400">
                              +{day.logs.length - 2}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* 리스트 뷰 */}
              <h2 className="text-lg font-semibold mb-4">현장일지 목록</h2>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {sortedDates.length > 0 ? (
                  sortedDates.map(dateKey => (
                    <div key={dateKey} className="border-l-4 border-gray-300 pl-4">
                      <h3 className="font-medium text-gray-900 mb-2">
                        {format(new Date(dateKey), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                      </h3>
                      <div className="space-y-2">
                        {groupedLogs[dateKey].map(log => (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                  <span>{log.weather}</span>
                                  {log.workers > 0 && <span>• 작업인원 {log.workers}명</span>}
                                  <span>• {log.createdBy}</span>
                                </div>
                                {log.notes && (
                                  <p className="text-sm text-gray-700">{log.notes}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>

                            {/* 이미지 갤러리 */}
                            {log.images && log.images.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-2">
                                {log.images.slice(0, 3).map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    alt={`현장사진 ${idx + 1}`}
                                    className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-90"
                                    onClick={() => setImageModal({ show: true, url: img })}
                                  />
                                ))}
                                {log.images.length > 3 && (
                                  <div
                                    className="w-full h-20 bg-gray-200 rounded flex items-center justify-center cursor-pointer hover:bg-gray-300"
                                    onClick={() => setSelectedImages(log.images)}
                                  >
                                    <span className="text-gray-600 font-medium">
                                      +{log.images.length - 3}
                                    </span>
                                  </div>
                                )}
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

      {/* 이미지 모달 */}
      {imageModal.show && imageModal.url && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setImageModal({ show: false, url: null })}
        >
          <div className="relative max-w-6xl max-h-full">
            <button
              onClick={() => setImageModal({ show: false, url: null })}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={imageModal.url}
              alt="확대 이미지"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteLog;