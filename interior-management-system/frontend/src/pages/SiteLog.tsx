import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Upload, X, ChevronLeft, ChevronRight, Trash2, Maximize2, Plus, Check } from 'lucide-react';
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
  const allProjects = useFilteredProjects();
  const [includeCompleted, setIncludeCompleted] = useState(() => {
    const saved = localStorage.getItem('siteLog_includeCompleted');
    return saved === 'true';
  });

  // 완료된 프로젝트 필터링
  const projects = includeCompleted
    ? allProjects
    : allProjects.filter(p => p.status !== 'completed');

  const [logs, setLogs] = useState<SiteLog[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDraggingEmpty, setIsDraggingEmpty] = useState(false);
  const [imageModal, setImageModal] = useState<{ show: boolean; url: string | null; images?: string[] }>({ show: false, url: null });
  const [isUploading, setIsUploading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapPosition, setLastTapPosition] = useState<{ x: number; y: number } | null>(null);

  // 폼 데이터
  const [formData, setFormData] = useState({
    notes: '',
    images: [] as string[]
  });

  // 현장일지 노트를 localStorage에서 관리 (프로젝트+날짜별)
  const [siteLogNotes, setSiteLogNotes] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem('siteLogNotes');
    return stored ? JSON.parse(stored) : {};
  });

  // 파일 입력 ref
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  // 수정 중인 로그 추적
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const logFileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // 최신 logs 상태를 참조하기 위한 ref (stale closure 방지)
  const logsRef = useRef<SiteLog[]>([]);

  // 저장되지 않은 변경사항 여부
  const hasUnsavedChanges = saveStatus === 'unsaved';

  // logs가 변경될 때마다 ref 업데이트
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // siteLogNotes가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('siteLogNotes', JSON.stringify(siteLogNotes));
  }, [siteLogNotes]);

  // includeCompleted 설정 저장
  useEffect(() => {
    localStorage.setItem('siteLog_includeCompleted', String(includeCompleted));
  }, [includeCompleted]);

  // 프로젝트 초기값 설정 (사용자별 마지막 선택 복원)
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      // localStorage에서 사용자별 마지막 선택한 프로젝트 가져오기
      const storageKey = `siteLog_lastProject_${user?.id || user?.name}`;
      const savedProject = localStorage.getItem(storageKey);

      // 저장된 프로젝트가 현재 프로젝트 목록에 있는지 확인
      if (savedProject && projects.find(p => p.name === savedProject)) {
        setSelectedProject(savedProject);
      } else {
        // 없으면 첫 번째 프로젝트 선택
        setSelectedProject(projects[0].name);
      }
    }
  }, [projects, user]);

  // 프로젝트 선택 시 localStorage에 저장
  useEffect(() => {
    if (selectedProject && user) {
      const storageKey = `siteLog_lastProject_${user.id || user.name}`;
      localStorage.setItem(storageKey, selectedProject);
    }
  }, [selectedProject, user]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // 로그 데이터 로드
  useEffect(() => {
    loadSiteLogs();
  }, [selectedProject]);

  // 선택된 날짜/프로젝트 변경 시 노트 로드 (localStorage 우선)
  useEffect(() => {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const noteKey = `${selectedProject}_${selectedDateStr}`;

    // localStorage에 저장된 노트가 있으면 그것을 사용
    const localNote = siteLogNotes[noteKey];
    if (localNote !== undefined) {
      setFormData(prev => ({ ...prev, notes: localNote }));
    } else {
      // localStorage에 없으면 빈 값으로 시작 (서버 데이터는 아래 useEffect에서 처리)
      setFormData(prev => ({ ...prev, notes: '' }));
    }
    setSaveStatus('saved');
  }, [selectedDate, selectedProject]);

  // 서버에서 logs 로드 완료 시 localStorage에 없는 노트만 동기화
  useEffect(() => {
    if (logs.length === 0) return;

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const noteKey = `${selectedProject}_${selectedDateStr}`;

    // 이미 localStorage에 있으면 건너뛰기
    if (siteLogNotes[noteKey] !== undefined) return;

    const existingLog = logs.find(log => {
      try {
        const logDate = log.date ? new Date(log.date) : null;
        return logDate && !isNaN(logDate.getTime()) &&
               format(logDate, 'yyyy-MM-dd') === selectedDateStr &&
               log.project === selectedProject;
      } catch {
        return false;
      }
    });

    if (existingLog && existingLog.notes) {
      setFormData(prev => ({ ...prev, notes: existingLog.notes || '' }));
      setSiteLogNotes(prev => ({ ...prev, [noteKey]: existingLog.notes || '' }));
    }
  }, [logs, selectedDate, selectedProject]);

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

  // 이미지 압축 함수
  const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 크기 조정
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }, file.type, quality);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 업로드 처리 - 바로 저장 또는 기존 로그에 추가
  const handleImageUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }

    if (imageFiles.length > 100) {
      toast.error('한번에 최대 100장까지 업로드 가능합니다');
      return;
    }

    if (!selectedProject) {
      toast.error('프로젝트를 선택하세요');
      return;
    }

    setIsUploading(true);
    toast.loading(`${imageFiles.length}개의 이미지를 처리중...`);

    // 이미지 압축
    const promises = imageFiles.map(file => compressImage(file));

    try {
      const images = await Promise.all(promises);

      // 같은 날짜와 프로젝트의 기존 로그 확인
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingLog = logs.find(log => {
        try {
          const logDate = log.date ? new Date(log.date) : null;
          return logDate && !isNaN(logDate.getTime()) &&
                 format(logDate, 'yyyy-MM-dd') === selectedDateStr &&
                 log.project === selectedProject;
        } catch {
          return false;
        }
      });

      // 이미지를 배치로 나누어 업로드 (20개씩)
      const batchSize = 20;
      const batches = [];
      for (let i = 0; i < images.length; i += batchSize) {
        batches.push(images.slice(i, i + batchSize));
      }

      toast.dismiss(); // 로딩 토스트 제거

      if (existingLog) {
        // 기존 로그가 있으면 배치별로 이미지 추가
        let currentImages = [...existingLog.images];

        for (let i = 0; i < batches.length; i++) {
          toast.loading(`이미지 업로드 중... (${i + 1}/${batches.length})`);
          currentImages = [...currentImages, ...batches[i]];

          await siteLogService.updateLog(existingLog.id, {
            project: existingLog.project,
            date: existingLog.date,
            images: currentImages,
            notes: existingLog.notes || ''
          });

          toast.dismiss();
        }
        toast.success(`${images.length}개의 사진이 추가되었습니다`);
      } else {
        // 기존 로그가 없으면 첫 배치로 생성, 나머지는 업데이트
        toast.loading(`이미지 업로드 중... (1/${batches.length})`);

        const logData = {
          project: selectedProject,
          date: selectedDate,
          images: batches[0],
          notes: '',
          createdBy: user?.name || ''
        };
        const newLog = await siteLogService.createLog(logData);
        toast.dismiss();

        // 나머지 배치 업데이트
        if (batches.length > 1) {
          let currentImages = [...batches[0]];

          for (let i = 1; i < batches.length; i++) {
            toast.loading(`이미지 업로드 중... (${i + 1}/${batches.length})`);
            currentImages = [...currentImages, ...batches[i]];

            await siteLogService.updateLog(newLog._id || newLog.id, {
              project: selectedProject,
              date: selectedDate,
              images: currentImages,
              notes: ''
            });

            toast.dismiss();
          }
        }

        toast.success(`${images.length}개의 사진이 저장되었습니다`);
      }

      // 로그 목록 다시 로드
      await loadSiteLogs();
    } catch (error) {
      console.error('Failed to save images:', error);
      toast.error('사진 저장에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  }, [selectedProject, selectedDate, user, logs, loadSiteLogs]);

  // 드래그 앤 드롭
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
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

  // 일지 저장 (기존 로그에 노트 추가 또는 새 로그 생성)
  const handleSaveNotes = async () => {
    if (!selectedProject) {
      toast.error('프로젝트를 선택하세요');
      return;
    }

    setIsSavingNotes(true);
    try {
      // 같은 날짜와 프로젝트의 기존 로그 확인
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingLog = logs.find(log => {
        try {
          const logDate = log.date ? new Date(log.date) : null;
          return logDate && !isNaN(logDate.getTime()) &&
                 format(logDate, 'yyyy-MM-dd') === selectedDateStr &&
                 log.project === selectedProject;
        } catch {
          return false;
        }
      });

      if (existingLog) {
        // 기존 로그가 있으면 노트 업데이트
        await siteLogService.updateLog(existingLog.id, {
          project: existingLog.project,
          date: existingLog.date,
          images: existingLog.images,
          notes: formData.notes
        });
        toast.success('작업 내용이 저장되었습니다');
      } else {
        // 기존 로그가 없으면 새로 생성
        const logData = {
          project: selectedProject,
          date: selectedDate,
          images: formData.images,
          notes: formData.notes,
          createdBy: user?.name || ''
        };
        await siteLogService.createLog(logData);
        toast.success('작업 내용이 저장되었습니다');
      }

      setSaveStatus('saved');

      // 목록 새로고침
      await loadSiteLogs();
    } catch (error) {
      console.error('Failed to save site log:', error);
      toast.error('작업 내용 저장에 실패했습니다');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Auto-save function for notes
  const handleAutoSave = useCallback(async (notes: string) => {
    if (!selectedProject || !notes) {
      return;
    }

    try {
      // 같은 날짜와 프로젝트의 기존 로그 확인
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingLog = logs.find(log => {
        try {
          const logDate = log.date ? new Date(log.date) : null;
          return logDate && !isNaN(logDate.getTime()) &&
                 format(logDate, 'yyyy-MM-dd') === selectedDateStr &&
                 log.project === selectedProject;
        } catch {
          return false;
        }
      });

      if (existingLog) {
        // 기존 로그가 있으면 노트 업데이트
        await siteLogService.updateLog(existingLog.id, {
          project: existingLog.project,
          date: existingLog.date,
          images: existingLog.images,
          notes: notes
        });
      } else {
        // 기존 로그가 없으면 새로 생성
        const logData = {
          project: selectedProject,
          date: selectedDate,
          images: formData.images,
          notes: notes,
          createdBy: user?.name || ''
        };
        await siteLogService.createLog(logData);
      }

      // 목록 새로고침
      await loadSiteLogs();
    } catch (error) {
      console.error('Failed to auto-save site log:', error);
    }
  }, [selectedProject, selectedDate, logs, formData.images, user, loadSiteLogs]);

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

  // 이미지 삭제
  const handleDeleteImage = async (logId: string, imageIndex: number) => {
    if (!window.confirm('이 사진을 삭제하시겠습니까?')) return;

    const log = logs.find(l => l.id === logId);
    if (!log) return;

    try {
      const updatedImages = log.images.filter((_, idx) => idx !== imageIndex);

      if (updatedImages.length === 0 && !log.notes) {
        // 이미지가 모두 삭제되고 메모도 없으면 일지 자체를 삭제
        await handleDelete(logId);
      } else {
        await siteLogService.updateLog(logId, {
          project: log.project,
          date: log.date,
          images: updatedImages,
          notes: log.notes
        });

        // 로컬 상태 업데이트
        setLogs(prev => prev.map(l =>
          l.id === logId ? { ...l, images: updatedImages } : l
        ));
        toast.success('사진이 삭제되었습니다');
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('사진 삭제에 실패했습니다');
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

  // 두 터치 포인트 간 거리 계산
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 두 터치 포인트의 중심점 계산
  const getTouchCenter = (touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  // 이미지 갤러리 모달 열기
  const openImageGallery = (images: string[], startIndex: number = 0) => {
    setImageModal({ show: true, url: images[startIndex], images });
    setCurrentImageIndex(startIndex);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setLastTouchDistance(null);
    setLastTouchCenter(null);
    setIsPinching(false);
  };

  // 다음/이전 이미지
  const navigateImage = (direction: number) => {
    if (!imageModal.images) return;
    const newIndex = (currentImageIndex + direction + imageModal.images.length) % imageModal.images.length;
    setCurrentImageIndex(newIndex);
    setImageModal(prev => ({ ...prev, url: imageModal.images![newIndex] }));
  };

  // 저장된 로그에 이미지 추가
  const handleAddImagesToLog = async (logId: string, newImages: string[]) => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;

    try {
      const updatedLog = {
        ...log,
        images: [...log.images, ...newImages]
      };

      await siteLogService.updateLog(logId, {
        project: log.project,
        date: log.date,
        images: updatedLog.images,
        notes: log.notes
      });

      // 로컬 상태 업데이트
      setLogs(prev => prev.map(l => l.id === logId ? updatedLog : l));
      toast.success(`${newImages.length}개의 사진이 추가되었습니다`);
      setEditingLogId(null);
    } catch (error) {
      console.error('Failed to add images to log:', error);
      toast.error('사진 추가에 실패했습니다');
    }
  };

  // 로그용 이미지 업로드 처리
  const handleLogImageUpload = useCallback((logId: string, files: FileList | File[]) => {
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
      handleAddImagesToLog(logId, images);
    });
  }, [logs]);

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
    <div className="desktop:grid desktop:grid-cols-12 desktop:gap-4 desktop:h-[calc(100vh-140px)] space-y-3 desktop:space-y-0">
      {/* 모바일 상단 - 프로젝트 선택 */}
      <div className="desktop:hidden flex justify-end items-center gap-2 mb-2">
        <label className="flex items-center gap-1 text-[10px] text-gray-500">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
            className="w-3 h-3 rounded border-gray-300"
          />
          완료포함
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 border border-gray-300"
          style={{
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1.25rem',
            paddingRight: '2.5rem'
          }}
        >
          {projects.map(project => (
            <option key={project.id} value={project.name}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* 좌측: 달력 + 일지작성 (데스크톱에서 상하 배치) */}
      <div className="desktop:col-span-4 desktop:flex desktop:flex-col desktop:gap-4 desktop:h-full space-y-3 desktop:space-y-0">
        {/* 달력 */}
        <div className="desktop:flex-shrink-0">
          {/* 프로젝트 선택 및 캘린더 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 max-h-[32vh] desktop:max-h-full overflow-y-auto">
            {/* 프로젝트 선택 - 데스크톱만 */}
            <div className="mb-4 hidden desktop:block">
              <div className="flex items-center gap-2">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {projects.map(project => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300"
                />
                공사완료 현장 포함
              </label>
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
                    className={`text-center p-1.5 desktop:p-2 text-xs cursor-pointer rounded transition-colors min-h-[36px] desktop:min-h-[48px] flex flex-col items-center justify-center ${
                      !isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                    } ${isToday ? 'bg-blue-100' : ''} ${
                      isSelected ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                    } ${day.hasImages ? 'font-bold' : ''}`}
                  >
                    <span>{format(day.date, 'd')}</span>
                    {day.hasImages && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-0.5"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 일지작성 */}
        <div className="desktop:flex-1 desktop:min-h-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 max-h-[30vh] desktop:h-full overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {format(selectedDate, 'M월 d일')} 일지 작성
            </h2>

            <div className="space-y-4">

              {/* 작업 내용 (메모) */}
              <div>
                <textarea
                  value={formData.notes}
                  onChange={(e) => {
                    const newNotes = e.target.value;
                    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                    const noteKey = `${selectedProject}_${selectedDateStr}`;

                    // 즉시 상태 업데이트 (localStorage도 자동 저장됨)
                    setFormData(prev => ({ ...prev, notes: newNotes }));
                    setSiteLogNotes(prev => ({ ...prev, [noteKey]: newNotes }));

                    // 기존 타이머 취소
                    if (autoSaveTimerRef.current) {
                      clearTimeout(autoSaveTimerRef.current);
                    }

                    // 500ms 후 서버에 백그라운드 저장 (로컬 저장은 이미 완료)
                    autoSaveTimerRef.current = setTimeout(async () => {
                      if (!selectedProject) return;

                      try {
                        // logsRef.current를 사용하여 최신 logs 상태 참조 (stale closure 방지)
                        const existingLog = logsRef.current.find(log => {
                          try {
                            const logDate = log.date ? new Date(log.date) : null;
                            return logDate && !isNaN(logDate.getTime()) &&
                                   format(logDate, 'yyyy-MM-dd') === selectedDateStr &&
                                   log.project === selectedProject;
                          } catch {
                            return false;
                          }
                        });

                        if (existingLog) {
                          await siteLogService.updateLog(existingLog.id, {
                            project: existingLog.project,
                            date: existingLog.date,
                            images: existingLog.images,
                            notes: newNotes
                          });
                        } else if (newNotes.trim()) {
                          const newLog = await siteLogService.createLog({
                            project: selectedProject,
                            date: selectedDate,
                            images: formData.images,
                            notes: newNotes,
                            createdBy: user?.name || ''
                          });
                          // 새로 생성된 로그를 로컬 상태에 추가
                          if (newLog) {
                            setLogs(prev => [...prev, {
                              id: newLog._id || newLog.id,
                              project: selectedProject,
                              date: selectedDate,
                              images: formData.images,
                              notes: newNotes,
                              createdBy: user?.name || '',
                              createdAt: new Date()
                            }]);
                          }
                        }
                        // loadSiteLogs 호출 제거 - 로컬 상태가 덮어쓰여지는 것 방지
                      } catch (error) {
                        console.error('서버 저장 실패:', error);
                      }
                    }, 500);
                  }}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none desktop:min-h-[200px]"
                  placeholder="오늘 진행한 작업 내용을 입력하세요"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 우측: 현장일지 목록 (데스크톱에서 크게 표시) */}
      <div className="desktop:col-span-8 desktop:h-full">
        <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 transition-all desktop:h-full desktop:flex desktop:flex-col ${
            isDraggingEmpty ? 'ring-2 ring-blue-400 bg-blue-50' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingEmpty(true);
          }}
          onDragLeave={(e) => {
            // 자식 요소로 이동할 때는 무시
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDraggingEmpty(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingEmpty(false);
            handleDrop(e);
          }}
        >
          <div className="flex items-center justify-between mb-4 desktop:flex-shrink-0">
            <h2 className="text-lg font-semibold flex items-center gap-4">
              <span className="text-sm font-normal text-gray-600">작성자: {user?.name || '알 수 없음'}</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files) {
                      handleImageUpload(target.files);
                    }
                  };
                  input.click();
                }}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="사진 추가"
              >
                <Plus className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={() => {
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
                  if (selectedDateLogs.length > 0 && window.confirm(`${format(selectedDate, 'M월 d일')}의 모든 현장일지를 삭제하시겠습니까?`)) {
                    selectedDateLogs.forEach(log => handleDelete(log.id));
                  }
                }}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="일지 삭제"
              >
                <Trash2 className="h-5 w-5 text-red-500" />
              </button>
            </div>
          </div>

          <div className="space-y-6 max-h-[990px] desktop:max-h-full desktop:flex-1 desktop:min-h-0 overflow-y-auto">
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
                      <div
                        key={log.id}
                        className="bg-white rounded-lg p-4 border border-gray-200"
                      >
                        {log.notes && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-700">{log.notes}</p>
                          </div>
                        )}

                        {/* 이미지 갤러리 영역 */}
                        <div className="min-h-[600px] desktop:min-h-0">
                          {log.images && log.images.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 desktop:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                              {log.images.map((img, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={img}
                                    alt={`현장사진 ${idx + 1}`}
                                    className="w-full aspect-[4/3] object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                    onClick={() => openImageGallery(log.images, idx)}
                                  />
                                  <button
                                    onClick={() => openImageGallery(log.images, idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(log.id, idx);
                                    }}
                                    className="absolute top-2 left-2 p-1.5 bg-red-600 bg-opacity-80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                    {idx + 1} / {log.images.length}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-[600px]">
                              <div className="text-center">
                                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">사진을 드래그하거나 + 버튼을 클릭하세요</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              } else {
                return (
                  <div>
                    {/* 큰 드래그 영역 */}
                    <div
                      className="rounded-lg p-4 pt-2 desktop:p-12 text-center"
                    >
                      <Camera className="mx-auto h-12 w-12 desktop:h-16 desktop:w-16 text-gray-400 mb-2 desktop:mb-4" />
                      <p className="text-sm desktop:text-lg font-medium text-gray-700 mb-2">
                        현장 사진을 업로드하세요
                      </p>
                      <p className="hidden desktop:block text-sm text-gray-600 mb-4">
                        이미지를 이곳에 드래그하거나 클릭하여 선택
                      </p>
                      <p className="hidden desktop:block text-xs text-gray-500 mb-4">
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
                        className="inline-flex items-center px-3 py-1.5 desktop:px-4 desktop:py-2 border border-gray-300 rounded-lg text-xs desktop:text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                      >
                        <Upload className="h-3 w-3 desktop:h-4 desktop:w-4 mr-1.5 desktop:mr-2" />
                        파일 선택
                      </label>
                    </div>
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
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center overflow-hidden"
          onClick={() => {
            setImageModal({ show: false, url: null });
            setImageZoom(1);
            setImagePosition({ x: 0, y: 0 });
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setImageZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* 닫기 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageModal({ show: false, url: null });
                setImageZoom(1);
                setImagePosition({ x: 0, y: 0 });
              }}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 backdrop-blur rounded-full hover:bg-opacity-30 z-10"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* 줌 레벨 표시 */}
            {imageZoom !== 1 && (
              <div className="absolute top-4 left-4 bg-white bg-opacity-20 text-white px-3 py-2 rounded-lg text-sm backdrop-blur">
                {Math.round(imageZoom * 100)}%
              </div>
            )}

            {/* 이전 버튼 */}
            {imageModal.images && imageModal.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage(-1);
                  setImageZoom(1);
                  setImagePosition({ x: 0, y: 0 });
                }}
                className="absolute left-4 p-3 bg-white bg-opacity-20 backdrop-blur rounded-full hover:bg-opacity-30"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            )}

            {/* 이미지 */}
            <div
              className="w-full h-full flex items-center justify-center"
              onMouseDown={(e) => {
                if (imageZoom > 1) {
                  setIsDraggingImage(true);
                  setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
                }
              }}
              onMouseMove={(e) => {
                if (isDraggingImage && imageZoom > 1) {
                  setImagePosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  });
                }
              }}
              onMouseUp={() => setIsDraggingImage(false)}
              onMouseLeave={() => setIsDraggingImage(false)}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  e.preventDefault();
                  setIsPinching(true);
                  const distance = getTouchDistance(e.touches[0], e.touches[1]);
                  const center = getTouchCenter(e.touches[0], e.touches[1]);
                  setLastTouchDistance(distance);
                  setLastTouchCenter(center);
                } else if (e.touches.length === 1 && imageZoom > 1 && !isPinching) {
                  const touch = e.touches[0];
                  setDragStart({ x: touch.clientX - imagePosition.x, y: touch.clientY - imagePosition.y });
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2) {
                  e.preventDefault();
                  setIsPinching(true);
                  const distance = getTouchDistance(e.touches[0], e.touches[1]);
                  const center = getTouchCenter(e.touches[0], e.touches[1]);

                  if (lastTouchDistance && lastTouchCenter) {
                    const scale = distance / lastTouchDistance;
                    const newZoom = Math.max(0.5, Math.min(5, imageZoom * scale));

                    // 중심점 기준으로 위치 조정
                    const deltaX = center.x - lastTouchCenter.x;
                    const deltaY = center.y - lastTouchCenter.y;

                    // 줌 변경에 따른 위치 보정
                    const zoomChange = newZoom / imageZoom;
                    const newX = imagePosition.x * zoomChange + deltaX;
                    const newY = imagePosition.y * zoomChange + deltaY;

                    setImageZoom(newZoom);
                    setImagePosition({ x: newX, y: newY });
                  }

                  setLastTouchDistance(distance);
                  setLastTouchCenter(center);
                } else if (e.touches.length === 1 && imageZoom > 1 && !isPinching) {
                  e.preventDefault();
                  const touch = e.touches[0];
                  setImagePosition({
                    x: touch.clientX - dragStart.x,
                    y: touch.clientY - dragStart.y
                  });
                }
              }}
              onTouchEnd={(e) => {
                if (e.touches.length === 0) {
                  // 모든 손가락을 뗐을 때
                  const now = Date.now();
                  const touch = e.changedTouches[0];
                  const tapPosition = { x: touch.clientX, y: touch.clientY };

                  // 더블탭 감지 (300ms 이내, 30px 이내)
                  const timeDiff = now - lastTapTime;
                  const isDoubleTap = timeDiff < 300 &&
                    lastTapPosition &&
                    Math.abs(tapPosition.x - lastTapPosition.x) < 30 &&
                    Math.abs(tapPosition.y - lastTapPosition.y) < 30;

                  if (isDoubleTap && !isPinching) {
                    // 더블탭 시 줌 토글
                    if (imageZoom === 1) {
                      // 줌 인: 탭한 위치를 중심으로 2.5배 확대
                      const container = e.currentTarget.getBoundingClientRect();
                      const centerX = (tapPosition.x - container.left - container.width / 2);
                      const centerY = (tapPosition.y - container.top - container.height / 2);

                      setImageZoom(2.5);
                      setImagePosition({
                        x: -centerX * 1.5,
                        y: -centerY * 1.5
                      });
                    } else {
                      // 줌 아웃: 화면에 맞춤
                      setImageZoom(1);
                      setImagePosition({ x: 0, y: 0 });
                    }
                    setLastTapTime(0);
                    setLastTapPosition(null);
                  } else {
                    // 단일 탭
                    setLastTapTime(now);
                    setLastTapPosition(tapPosition);
                  }

                  setLastTouchDistance(null);
                  setLastTouchCenter(null);
                  setIsPinching(false);
                } else if (e.touches.length === 1 && isPinching) {
                  // 두 손가락에서 한 손가락으로 전환될 때
                  setLastTouchDistance(null);
                  setLastTouchCenter(null);
                  setIsPinching(false);
                  // 드래그 시작점을 재설정
                  const touch = e.touches[0];
                  setDragStart({ x: touch.clientX - imagePosition.x, y: touch.clientY - imagePosition.y });
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = (e.clientX - rect.left - rect.width / 2);
                const centerY = (e.clientY - rect.top - rect.height / 2);

                if (imageZoom === 1) {
                  // 더블클릭 위치를 중심으로 2.5배 확대
                  setImageZoom(2.5);
                  setImagePosition({
                    x: -centerX * 1.5,
                    y: -centerY * 1.5
                  });
                } else {
                  setImageZoom(1);
                  setImagePosition({ x: 0, y: 0 });
                }
              }}
            >
              <img
                src={imageModal.url}
                alt="확대 이미지"
                style={{
                  transform: `scale(${imageZoom}) translate(${imagePosition.x / imageZoom}px, ${imagePosition.y / imageZoom}px)`,
                  transformOrigin: 'center center',
                  transition: (isDraggingImage || lastTouchDistance !== null) ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  cursor: imageZoom > 1 ? (isDraggingImage ? 'grabbing' : 'grab') : 'pointer',
                  userSelect: 'none',
                  touchAction: 'none'
                }}
                draggable={false}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* 다음 버튼 */}
            {imageModal.images && imageModal.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage(1);
                  setImageZoom(1);
                  setImagePosition({ x: 0, y: 0 });
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

            {/* 사용 안내 */}
            <div className="absolute bottom-4 right-4 bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-xs text-center backdrop-blur">
              마우스 휠 또는 두 손가락으로 확대/축소
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteLog;