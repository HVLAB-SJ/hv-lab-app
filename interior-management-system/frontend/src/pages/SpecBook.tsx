import { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Trash2, Upload, Settings, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useAuth } from '../contexts/AuthContext';
import ImageCropper from '../components/ImageCropper';
import { useSpecbookStore } from '../store/specbookStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SpecBookItem {
  id: number;
  name: string;
  category: string;
  brand: string;
  price: string;
  image_url: string | null;
  sub_images?: string[]; // 상세 이미지들
  description: string;
  project_id: number | null;
  is_library: number;
  display_order?: number;
  grade?: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  title: string;
}

// 등급 표시 형식을 변환하는 함수
const formatGradeRange = (gradeString: string | undefined): string => {
  if (!gradeString) return '';

  const grades = gradeString.split(',').map(g => g.trim());
  if (grades.length === 0) return '';
  if (grades.length === 1) return grades[0] === '하이엔드' ? '하이' : grades[0];

  // 등급 순서 정의
  const gradeOrder = ['알뜰', '기본', '고급', '하이엔드'];
  const sortedGrades = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b));

  // 첫 번째와 마지막 등급만 표시
  const first = sortedGrades[0];
  const last = sortedGrades[sortedGrades.length - 1];
  const lastDisplay = last === '하이엔드' ? '하이' : last;

  return `${first}-${lastDisplay}`;
};

// 등급에 따른 색상 반환 함수
const getGradeColor = (gradeString: string | undefined): string => {
  if (!gradeString) return '';

  const grades = gradeString.split(',').map(g => g.trim());

  // 여러 등급이 포함된 경우
  if (grades.includes('하이엔드')) return 'bg-purple-100 text-purple-700';
  if (grades.includes('고급')) return 'bg-blue-100 text-blue-700';
  if (grades.includes('기본')) return 'bg-green-100 text-green-700';
  if (grades.includes('알뜰')) return 'bg-yellow-100 text-yellow-700';

  return 'bg-gray-100 text-gray-700';
};

// Sortable Sub Image 컴포넌트
const SortableSubImage = ({
  id,
  fileData,
  index,
  onDelete,
  onFileClick,
}: {
  id: string;
  fileData: string;
  index: number;
  onDelete: (index: number) => void;
  onFileClick: (fileData: string, fileName: string, isImage: boolean, isPDF: boolean) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  // 파일명|base64 형식인지 확인
  const hasFileName = fileData.includes('|') && !fileData.startsWith('data:image');
  const fileName = hasFileName ? fileData.split('|')[0] : '';
  const actualData = hasFileName ? fileData.split('|')[1] : fileData;

  const isImage = actualData.startsWith('data:image');
  const isPDF = actualData.startsWith('data:application/pdf');
  const isWord = actualData.includes('wordprocessingml') || actualData.includes('msword');
  const isExcel = actualData.includes('spreadsheetml') || actualData.includes('ms-excel');
  const isPPT = actualData.includes('presentationml') || actualData.includes('ms-powerpoint');
  const isZip = actualData.includes('application/zip');
  const isText = actualData.startsWith('data:text/plain');
  const isHWP = fileName.endsWith('.hwp') || actualData.includes('x-hwp');
  const isDWG = fileName.toLowerCase().endsWith('.dwg') || actualData.includes('autocad') || actualData.includes('vnd.dwg');
  const isDXF = fileName.toLowerCase().endsWith('.dxf');
  const isSKP = fileName.toLowerCase().endsWith('.skp');
  const is3DM = fileName.toLowerCase().endsWith('.3dm');

  const getFileIcon = () => {
    if (isPDF) return { color: 'text-red-600', label: 'PDF' };
    if (isWord) return { color: 'text-blue-600', label: 'DOC' };
    if (isExcel) return { color: 'text-green-600', label: 'XLS' };
    if (isPPT) return { color: 'text-orange-600', label: 'PPT' };
    if (isZip) return { color: 'text-yellow-600', label: 'ZIP' };
    if (isText) return { color: 'text-gray-600', label: 'TXT' };
    if (isHWP) return { color: 'text-sky-600', label: 'HWP' };
    if (isDWG) return { color: 'text-purple-600', label: 'DWG' };
    if (isDXF) return { color: 'text-violet-600', label: 'DXF' };
    if (isSKP) return { color: 'text-amber-600', label: 'SKP' };
    if (is3DM) return { color: 'text-teal-600', label: '3DM' };
    return { color: 'text-gray-600', label: 'FILE' };
  };

  const fileIcon = getFileIcon();

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* 드래그 핸들 - 좌측 상단 */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-gray-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 touch-none"
        title="드래그하여 순서 변경"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      {/* 클릭 가능한 이미지/파일 영역 */}
      <div
        className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
        onClick={() => onFileClick(actualData, fileName, isImage, isPDF)}
      >
        {isImage ? (
          <img
            src={actualData}
            alt={`상세 이미지 ${index + 1}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center ${fileIcon.color}`}>
            <svg className="h-12 w-12 mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6"/>
            </svg>
            <span className="text-xs font-bold">{fileIcon.label}</span>
            {fileName && (
              <span className="text-xs text-gray-500 mt-1 px-2 truncate max-w-full">
                {fileName.length > 15 ? fileName.slice(0, 12) + '...' : fileName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 삭제 버튼 - 우측 상단 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
        className="absolute top-2 right-2 p-1.5 bg-gray-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-800 z-10"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

// Sortable 스펙북 아이템 컴포넌트
const SortableSpecBookItem = ({
  item,
  onEdit,
  onDelete,
  onImageClick
}: {
  item: SpecBookItem;
  onEdit: (item: SpecBookItem) => void;
  onDelete: (id: number) => void;
  onImageClick: (item: SpecBookItem) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden flex flex-col group relative cursor-move"
    >

      {/* 상단: 정사각형 이미지 (썸네일) */}
      <div className="w-full aspect-square bg-gray-100 flex-shrink-0 relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-contain block cursor-pointer"
            loading="lazy"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick(item);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            이미지 없음
          </div>
        )}

        {/* 수정/삭제 버튼 - 호버 시 이미지 우측 상단에 표시 */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 bg-white text-gray-700 hover:bg-gray-100 rounded-md shadow-md transition-colors"
            title="수정"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-md shadow-md transition-colors"
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 하단: 텍스트 정보 */}
      <div className="p-2 pt-1.5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
              {item.category}
            </span>
            {item.brand && (
              <span className="text-xs text-gray-500">{item.brand}</span>
            )}
          </div>
          {item.grade && (
            <span className={`hidden md:inline-block px-1 py-0.5 text-[10px] rounded ${getGradeColor(item.grade)}`}>
              {formatGradeRange(item.grade)}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-1 mt-auto">
          <div className="flex items-baseline gap-1 min-w-0">
            <h3 className="font-semibold text-xs text-gray-900 truncate">{item.name}</h3>
          </div>
          {item.price && (
            <span className="hidden md:inline text-xs text-gray-900 font-medium flex-shrink-0">{item.price}원</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Sortable 카테고리 아이템 컴포넌트
const SortableCategoryItem = ({
  category,
  onRemove,
  onEdit
}: {
  category: string;
  onRemove: (category: string) => void;
  onEdit: (category: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-white"
    >
      <div
        className="flex items-center gap-2 flex-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span className="text-sm text-gray-900">{category}</span>
      </div>
      {category !== '전체' && (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEdit(category);
            }}
            className="text-gray-600 hover:text-gray-800 transition-colors p-1"
            title="수정"
            type="button"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove(category);
            }}
            className="text-red-500 hover:text-red-700 transition-colors p-1"
            title="삭제"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const SpecBook = () => {
  const { user } = useAuth();
  const filteredProjects = useFilteredProjects();
  const isAnTeamUser = user?.name === '안팀';

  // 스펙북 Store에서 캐시된 데이터 사용
  const {
    libraryItems: cachedLibraryItems,
    libraryLoaded,
    categories: cachedCategories,
    categoriesLoaded,
    getLibraryItems,
    loadProjectItems,
    preloadLibrary,
    invalidateLibrary,
    invalidateProject,
    addItemToCache,
    updateItemInCache,
    removeItemFromCache
  } = useSpecbookStore();
  const [view, setView] = useState<'library' | 'project'>(() => {
    // 안팀 사용자이거나 저장된 프로젝트가 있으면 'project' 뷰로 시작
    if (isAnTeamUser) return 'project';
    const savedProject = localStorage.getItem('specBook_lastProject');
    return savedProject ? 'project' : 'library';
  });
  const [items, setItems] = useState<SpecBookItem[]>([]);
  const [allLibraryItems, setAllLibraryItems] = useState<SpecBookItem[]>([]); // 전체 라이브러리 아이템 (수량 계산용)
  const [allProjectItems, setAllProjectItems] = useState<SpecBookItem[]>([]); // 전체 프로젝트 아이템 (수량 계산용)
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(() => {
    const saved = localStorage.getItem('specBook_lastProject');
    return saved ? Number(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<SpecBookItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    price: '',
    grades: ['기본'] as string[],
    imageData: null as string | null
  });
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategories, setEditingCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSubImageModalOpen, setIsSubImageModalOpen] = useState(false);
  const [selectedItemForImages, setSelectedItemForImages] = useState<SpecBookItem | null>(null);
  const [subImages, setSubImages] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageIndex, setViewingImageIndex] = useState<number>(0); // 현재 보고 있는 이미지 인덱스
  const [allViewableImages, setAllViewableImages] = useState<string[]>([]); // 뷰어에서 볼 수 있는 모든 이미지
  const [isDraggingSubImage, setIsDraggingSubImage] = useState(false);
  const [isSavingSubImages, setIsSavingSubImages] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showProjectSelectModal, setShowProjectSelectModal] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lastTapPosition, setLastTapPosition] = useState<{ x: number; y: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subImageFileInputRef = useRef<HTMLInputElement>(null);
  const subImagesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialSubImagesRef = useRef<string[]>([]);
  const isMountedRef = useRef(true); // 컴포넌트 마운트 상태 추적

  // 이미지 크롭 관련 상태
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);


  // DnD 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // 컴포넌트 마운트/언마운트 추적
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadCategories();
    loadAllLibraryItems(); // 전체 라이브러리 아이템 로드
  }, [categoriesLoaded, cachedCategories, libraryLoaded, cachedLibraryItems]);

  // filteredProjects가 변경될 때 프로젝트 다시 로드
  useEffect(() => {
    loadProjects();
  }, [filteredProjects]);

  useEffect(() => {
    loadItems();
  }, [view, selectedCategory, selectedProject, selectedGrades, libraryLoaded, cachedLibraryItems]);

  // 프로젝트가 선택될 때 전체 프로젝트 아이템 로드
  useEffect(() => {
    if (view === 'project' && selectedProject) {
      loadAllProjectItems();
    }
  }, [view, selectedProject]);

  // 선택한 프로젝트 localStorage에 저장
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('specBook_lastProject', String(selectedProject));
    }
  }, [selectedProject]);

  const loadCategories = async () => {
    // 캐시된 카테고리가 있으면 사용
    if (categoriesLoaded && cachedCategories.length > 0) {
      setCategories(cachedCategories);
      return;
    }

    try {
      const response = await api.get('/specbook/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const loadProjects = async () => {
    try {
      // filteredProjects를 Project 형식으로 변환
      const mappedProjects = filteredProjects.map(p => ({
        id: p.id,
        title: p.name
      }));
      console.log('프로젝트 목록 로드됨:', mappedProjects.length, '개', mappedProjects);
      setProjects(mappedProjects);

      // localStorage에서 저장된 프로젝트 확인
      const savedProjectId = localStorage.getItem('specBook_lastProject');
      if (savedProjectId && mappedProjects.length > 0) {
        const savedId = Number(savedProjectId);
        const projectExists = mappedProjects.find(p => p.id === savedId);
        if (projectExists) {
          setSelectedProject(savedId);
          setView('project');
          return;
        }
      }

      // 안팀 사용자인 경우 첫 번째 프로젝트 자동 선택
      if (isAnTeamUser && mappedProjects.length > 0 && !selectedProject) {
        setSelectedProject(mappedProjects[0].id);
        setView('project');
      }
    } catch (error) {
      console.error('프로젝트 로드 실패:', error);
    }
  };

  const loadAllLibraryItems = async () => {
    // 캐시된 라이브러리 데이터가 있으면 사용
    if (libraryLoaded && cachedLibraryItems.length > 0) {
      if (isMountedRef.current) {
        setAllLibraryItems(cachedLibraryItems);
      }
      return;
    }

    try {
      // 메타데이터만 로드 (이미지 제외) - 빠른 로딩
      const response = await api.get('/specbook/library/meta');
      if (isMountedRef.current) {
        setAllLibraryItems(response.data);
      }
    } catch (error) {
      console.error('전체 라이브러리 아이템 로드 실패:', error);
    }
  };

  const loadAllProjectItems = async () => {
    if (!selectedProject) return;
    try {
      // 메타데이터만 로드 (이미지 제외) - 빠른 로딩
      const response = await api.get(`/specbook/project/${selectedProject}/meta`);
      setAllProjectItems(response.data);
    } catch (error) {
      console.error('전체 프로젝트 아이템 로드 실패:', error);
    }
  };

  const loadItems = async () => {
    try {
      if (view === 'library') {
        // 라이브러리 뷰: 캐시된 데이터 우선 사용
        if (libraryLoaded && cachedLibraryItems.length > 0) {
          // 캐시에서 필터링하여 즉시 표시 (로딩 없음!)
          const filteredItems = getLibraryItems(
            selectedCategory !== '전체' ? selectedCategory : undefined,
            selectedGrades.length > 0 ? selectedGrades : undefined
          );
          if (isMountedRef.current) {
            // 점진적 렌더링: 첫 20개를 즉시 표시
            const chunkSize = 20;
            const firstChunk = filteredItems.slice(0, chunkSize);
            setItems(firstChunk);
            setLoading(false);

            // 나머지 아이템을 비동기로 로드
            if (filteredItems.length > chunkSize) {
              requestAnimationFrame(() => {
                if (isMountedRef.current) {
                  setItems(filteredItems);
                }
              });
            }
          }
          return;
        }

        // 캐시가 없으면 API에서 로드
        if (items.length === 0) {
          setLoading(true);
        }

        const params: Record<string, string> = {};
        if (selectedCategory !== '전체') {
          params.category = selectedCategory;
        }
        if (selectedGrades.length > 0) {
          params.grades = selectedGrades.join(',');
        }

        const response = await api.get('/specbook/library/meta', { params });
        if (isMountedRef.current) {
          const allItems = response.data;
          // 점진적 렌더링 적용
          const chunkSize = 20;
          const firstChunk = allItems.slice(0, chunkSize);
          setItems(firstChunk);
          setLoading(false);

          // 나머지 아이템을 비동기로 로드
          if (allItems.length > chunkSize) {
            requestAnimationFrame(() => {
              if (isMountedRef.current) {
                setItems(allItems);
              }
            });
          }
        }
      } else {
        // 프로젝트 뷰
        if (!selectedProject) {
          setItems([]);
          setLoading(false);
          return;
        }

        // 데이터가 없을 때만 로딩 표시
        if (items.length === 0) {
          setLoading(true);
        }

        const params: Record<string, string> = {};
        if (selectedCategory !== '전체') {
          params.category = selectedCategory;
        }
        if (selectedGrades.length > 0) {
          params.grades = selectedGrades.join(',');
        }

        const response = await api.get(`/specbook/project/${selectedProject}/meta`, { params });
        if (isMountedRef.current) {
          const allItems = response.data;
          // 점진적 렌더링: 첫 20개를 즉시 표시
          const chunkSize = 20;
          const firstChunk = allItems.slice(0, chunkSize);
          setItems(firstChunk);
          setLoading(false);

          // 나머지 아이템을 비동기로 로드
          if (allItems.length > chunkSize) {
            requestAnimationFrame(() => {
              if (isMountedRef.current) {
                setItems(allItems);
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('스펙북 아이템 로드 실패:', error);
      if (isMountedRef.current) {
        toast.error('스펙북 아이템을 불러오는데 실패했습니다');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // 카테고리별 수량 계산
  const getCategoryCount = (category: string) => {
    if (view === 'library') {
      // 라이브러리 뷰: 전체 라이브러리 아이템에서 계산
      if (category === '전체') return allLibraryItems.length;
      return allLibraryItems.filter(item => item.category === category).length;
    } else {
      // 프로젝트 뷰: 전체 프로젝트 아이템에서 계산
      if (category === '전체') return allProjectItems.length;
      return allProjectItems.filter(item => item.category === category).length;
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // 크롭 모달 열기
        setImageToCrop(e.target?.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    // 크롭 모달이나 서브이미지 모달이 열려있으면 무시
    if (showCropper || isSubImageModalOpen) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            // 크롭 모달 열기
            setImageToCrop(e.target?.result as string);
            setShowCropper(true);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste as any);
    return () => document.removeEventListener('paste', handlePaste as any);
  }, [formData, showCropper, isSubImageModalOpen]);

  const formatPrice = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (!numbers) return '';
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPrice(e.target.value);
    setFormData({ ...formData, price: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.name || !formData.category) {
      toast.error('제품명과 카테고리는 필수입니다');
      return;
    }

    if (formData.grades.length === 0) {
      toast.error('최소 하나의 등급을 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const gradeString = formData.grades.join(',');

      if (editingItem) {
        // 수정 모드: 기존 로직 유지
        const submitData = {
          name: formData.name,
          category: formData.category,
          brand: formData.brand,
          price: formData.price,
          grade: gradeString,
          description: '',
          imageData: formData.imageData,
          projectId: view === 'project' ? selectedProject : null,
          isLibrary: view === 'library'
        };
        await api.put(`/specbook/base64/${editingItem.id}`, submitData);
        toast.success('스펙북 아이템이 수정되었습니다');
      } else {
        // 새 아이템 추가
        if (view === 'project' && selectedProject) {
          // 프로젝트 뷰에서 추가: 라이브러리와 프로젝트 모두에 추가
          // 1. 먼저 라이브러리에 추가
          const libraryData = {
            name: formData.name,
            category: formData.category,
            brand: formData.brand,
            price: formData.price,
            grade: gradeString,
            description: '',
            imageData: formData.imageData,
            projectId: null,
            isLibrary: true
          };
          await api.post('/specbook/base64', libraryData);

          // 2. 프로젝트에도 추가
          const projectData = {
            name: formData.name,
            category: formData.category,
            brand: formData.brand,
            price: formData.price,
            grade: gradeString,
            description: '',
            imageData: formData.imageData,
            projectId: selectedProject,
            isLibrary: false
          };
          await api.post('/specbook/base64', projectData);
          toast.success('스펙북 아이템이 라이브러리와 프로젝트에 추가되었습니다');
        } else {
          // 라이브러리 뷰에서 추가: 라이브러리에만 추가
          const submitData = {
            name: formData.name,
            category: formData.category,
            brand: formData.brand,
            price: formData.price,
            grade: gradeString,
            description: '',
            imageData: formData.imageData,
            projectId: null,
            isLibrary: true
          };
          await api.post('/specbook/base64', submitData);
          toast.success('스펙북 아이템이 추가되었습니다');
        }
      }

      setEditingItem(null);
      setFormData({ name: '', category: selectedCategory !== '전체' ? selectedCategory : '', brand: '', price: '', grades: ['기본'], imageData: null });
      loadItems();
      // 전체 아이템 목록 업데이트
      if (view === 'library' || (view === 'project' && !editingItem)) {
        loadAllLibraryItems();
      }
      if (view === 'project' && selectedProject) {
        loadAllProjectItems();
      }
    } catch (error: any) {
      console.error('스펙북 아이템 저장 실패:', error);
      toast.error(error.response?.data?.error || '저장에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: SpecBookItem) => {
    setEditingItem(item);
    // grade가 문자열이면 배열로 변환 (기존 데이터 호환성)
    const grades = item.grade ?
      (item.grade.includes(',') ? item.grade.split(',') : [item.grade]) :
      ['기본'];
    setFormData({
      name: item.name,
      category: item.category,
      brand: item.brand,
      price: item.price,
      grades: grades,
      imageData: null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await api.delete(`/specbook/${id}`);
      toast.success('스펙북 아이템이 삭제되었습니다');
      loadItems();
      // 스펙 라이브러리에서 삭제한 경우 전체 라이브러리 아이템도 업데이트
      if (view === 'library') {
        loadAllLibraryItems();
      } else if (view === 'project' && selectedProject) {
        loadAllProjectItems();
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: selectedCategory !== '전체' ? selectedCategory : '',
      brand: '',
      price: '',
      grades: ['기본'],
      imageData: null
    });
  };

  // 이미지 크롭 완료 핸들러
  const handleCropComplete = (croppedImage: string) => {
    setFormData({ ...formData, imageData: croppedImage });
    setShowCropper(false);
    setImageToCrop(null);
  };

  // 이미지 크롭 취소 핸들러
  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
  };

  // 이미지 클릭 - Sub 이미지 모달 열기
  const handleImageClick = (item: SpecBookItem) => {
    setSelectedItemForImages(item);
    const initialImages = item.sub_images || [];
    setSubImages(initialImages);
    initialSubImagesRef.current = initialImages;
    setIsSubImageModalOpen(true);
  };

  // Sub 이미지 추가 (이미지 및 PDF 지원)
  const handleAddSubImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processSubImageFiles(files);
  };

  // 파일 처리 함수 (이미지, PDF, 문서 파일 지원)
  const processSubImageFiles = (files: File[]) => {
    const supportedTypes = [
      'image/', // 모든 이미지
      'application/pdf', // PDF
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.ms-excel', // XLS
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-powerpoint', // PPT
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
      'application/zip', // ZIP
      'application/x-hwp', // HWP
      'text/plain', // TXT
      'application/acad', // DWG
      'application/x-autocad', // DWG
      'image/vnd.dwg', // DWG
    ];

    // 확장자로 체크해야 하는 파일들
    const supportedExtensions = ['.hwp', '.dwg', '.skp', '.3dm', '.dxf'];

    files.forEach(file => {
      const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      const isSupported = supportedTypes.some(type =>
        type.endsWith('/') ? file.type.startsWith(type) : file.type === type
      ) || supportedExtensions.includes(fileExt); // 확장자 체크

      if (isSupported) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          // 파일명을 base64에 포함시켜 저장 (파일명|base64 형식)
          const dataWithName = file.type.startsWith('image/') ? base64 : `${file.name}|${base64}`;
          setSubImages(prev => [...prev, dataWithName]);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error(`지원하지 않는 파일 형식입니다: ${file.name}`);
      }
    });
  };

  // Sub 이미지 드래그 앤 드롭
  const handleSubImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSubImage(false);

    const files = Array.from(e.dataTransfer.files);
    processSubImageFiles(files);
  };

  // Sub 이미지 Paste 이벤트
  const handleSubImagePaste = (e: ClipboardEvent) => {
    if (!isSubImageModalOpen) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      processSubImageFiles(files);
      toast.success(`${files.length}개의 이미지가 추가되었습니다`);
    }
  };

  // Paste 이벤트 리스너 등록
  useEffect(() => {
    if (isSubImageModalOpen) {
      document.addEventListener('paste', handleSubImagePaste as any);
      return () => document.removeEventListener('paste', handleSubImagePaste as any);
    }
  }, [isSubImageModalOpen]);

  // Sub 이미지 자동 저장 (debounce 적용)
  useEffect(() => {
    if (!selectedItemForImages || !isSubImageModalOpen) return;

    // 초기 로드인지 확인 (실제로 변경되었는지 확인)
    const hasChanged = JSON.stringify(subImages) !== JSON.stringify(initialSubImagesRef.current);
    if (!hasChanged) return;

    // 이전 타이머 취소
    if (subImagesSaveTimeoutRef.current) {
      clearTimeout(subImagesSaveTimeoutRef.current);
    }

    // 1초 후 저장
    subImagesSaveTimeoutRef.current = setTimeout(async () => {
      setIsSavingSubImages(true);
      try {
        await api.put(`/specbook/${selectedItemForImages.id}/sub-images`, {
          sub_images: subImages
        });
        // 성공 시 초기값 업데이트 및 아이템 목록 업데이트
        initialSubImagesRef.current = subImages;
        loadItems();
        if (view === 'library') {
          loadAllLibraryItems();
        } else if (view === 'project' && selectedProject) {
          loadAllProjectItems();
        }
      } catch (error) {
        console.error('Sub 이미지 자동 저장 실패:', error);
        toast.error('상세 이미지 저장에 실패했습니다');
      } finally {
        setIsSavingSubImages(false);
      }
    }, 1000);

    return () => {
      if (subImagesSaveTimeoutRef.current) {
        clearTimeout(subImagesSaveTimeoutRef.current);
      }
    };
  }, [subImages, selectedItemForImages, isSubImageModalOpen]);

  // Sub 이미지 삭제
  const handleDeleteSubImage = (index: number) => {
    setSubImages(prev => prev.filter((_, i) => i !== index));
  };

  // Sub 이미지 드래그 종료 핸들러
  const handleSubImageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSubImages((items) => {
        const oldIndex = items.findIndex((_, i) => `subimg-${i}` === active.id);
        const newIndex = items.findIndex((_, i) => `subimg-${i}` === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Sub 이미지/파일 클릭 핸들러
  const handleSubImageFileClick = (actualData: string, fileName: string, isImage: boolean, isPDF: boolean) => {
    if (isImage) {
      // 모든 이미지 목록 구성 (메인 이미지 + 서브 이미지 중 이미지만)
      const imageList: string[] = [];
      if (selectedItemForImages?.image_url) {
        imageList.push(selectedItemForImages.image_url);
      }
      subImages.forEach(fileData => {
        const hasFileName = fileData.includes('|') && !fileData.startsWith('data:image');
        const data = hasFileName ? fileData.split('|')[1] : fileData;
        if (data.startsWith('data:image')) {
          imageList.push(data);
        }
      });

      setAllViewableImages(imageList);
      const index = imageList.indexOf(actualData);
      setViewingImageIndex(index >= 0 ? index : 0);
      setViewingImage(actualData);
    } else if (isPDF) {
      // PDF는 새 탭에서 열기
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>${fileName || 'PDF 파일'}</title></head>
            <body style="margin:0;padding:0;overflow:hidden;">
              <iframe src="${actualData}" style="width:100%;height:100vh;border:none;"></iframe>
            </body>
          </html>
        `);
      }
    } else {
      // 다른 파일은 다운로드
      const link = document.createElement('a');
      link.href = actualData;
      link.download = fileName || 'file';
      link.click();
    }
  };

  // 이전 이미지로 이동
  const goToPrevImage = () => {
    if (allViewableImages.length <= 1) return;
    const newIndex = viewingImageIndex > 0 ? viewingImageIndex - 1 : allViewableImages.length - 1;
    setViewingImageIndex(newIndex);
    setViewingImage(allViewableImages[newIndex]);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // 다음 이미지로 이동
  const goToNextImage = () => {
    if (allViewableImages.length <= 1) return;
    const newIndex = viewingImageIndex < allViewableImages.length - 1 ? viewingImageIndex + 1 : 0;
    setViewingImageIndex(newIndex);
    setViewingImage(allViewableImages[newIndex]);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // 키보드 이벤트 핸들러 (이미지 뷰어용)
  useEffect(() => {
    if (!viewingImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextImage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setViewingImage(null);
        setImageZoom(1);
        setImagePosition({ x: 0, y: 0 });
        setAllViewableImages([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingImage, viewingImageIndex, allViewableImages]);

  // Sub 이미지 모달 닫기
  const handleCloseSubImageModal = async () => {
    // 저장 중이면 타이머 취소
    if (subImagesSaveTimeoutRef.current) {
      clearTimeout(subImagesSaveTimeoutRef.current);
    }

    // 변경사항이 있으면 즉시 저장
    const hasChanged = JSON.stringify(subImages) !== JSON.stringify(initialSubImagesRef.current);
    if (hasChanged && selectedItemForImages) {
      setIsSavingSubImages(true);
      try {
        await api.put(`/specbook/${selectedItemForImages.id}/sub-images`, {
          sub_images: subImages
        });
        // 아이템 목록 업데이트
        loadItems();
        if (view === 'library') {
          loadAllLibraryItems();
        } else if (view === 'project' && selectedProject) {
          loadAllProjectItems();
        }
      } catch (error) {
        console.error('Sub 이미지 저장 실패:', error);
        toast.error('파일 저장에 실패했습니다');
      }
    }

    setIsSubImageModalOpen(false);
    setSelectedItemForImages(null);
    setSubImages([]);
    setIsSavingSubImages(false);
  };

  // 아이템 순서 변경 처리
  const handleItemDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems); // 즉시 UI 업데이트

      try {
        // 백엔드에 새로운 순서 저장
        await api.put('/specbook/reorder', {
          items: newItems.map((item, index) => ({
            id: item.id,
            display_order: index
          }))
        });
        toast.success('아이템 순서가 업데이트되었습니다');
      } catch (error) {
        console.error('순서 업데이트 실패:', error);
        toast.error('순서 업데이트 실패');
        loadItems(); // 실패 시 원래 데이터로 복구
      }
    }
  };

  const handleOpenCategoryModal = () => {
    setEditingCategories([...categories]);
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setNewCategoryName('');
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('카테고리 이름을 입력하세요');
      return;
    }
    if (editingCategories.includes(newCategoryName.trim())) {
      toast.error('이미 존재하는 카테고리입니다');
      return;
    }

    const updatedCategories = [...editingCategories, newCategoryName.trim()];
    setEditingCategories(updatedCategories);
    setNewCategoryName('');

    // 서버에 즉시 저장
    try {
      await api.put('/specbook/categories', { categories: updatedCategories });
      setCategories(updatedCategories);
      toast.success('카테고리가 추가되었습니다');
    } catch (error) {
      console.error('카테고리 추가 저장 실패:', error);
      toast.error('카테고리 추가 저장에 실패했습니다');
      // 실패 시 원래대로 복구
      setEditingCategories(categories);
    }
  };

  const handleEditCategory = async (category: string) => {
    if (category === '전체') {
      toast.error('전체 카테고리는 수정할 수 없습니다');
      return;
    }
    const newName = window.prompt('새 카테고리 이름을 입력하세요', category);
    if (!newName || !newName.trim()) {
      return;
    }
    if (newName.trim() === category) {
      return;
    }
    if (editingCategories.includes(newName.trim())) {
      toast.error('이미 존재하는 카테고리입니다');
      return;
    }

    const updatedCategories = editingCategories.map(c => c === category ? newName.trim() : c);
    setEditingCategories(updatedCategories);

    // 서버에 즉시 저장
    try {
      await api.put('/specbook/categories', { categories: updatedCategories });
      setCategories(updatedCategories);
      toast.success('카테고리 이름이 변경되었습니다');
    } catch (error) {
      console.error('카테고리 수정 저장 실패:', error);
      toast.error('카테고리 수정 저장에 실패했습니다');
      // 실패 시 원래대로 복구
      setEditingCategories(categories);
    }
  };

  const handleRemoveCategory = async (category: string) => {
    if (category === '전체') {
      toast.error('전체 카테고리는 삭제할 수 없습니다');
      return;
    }

    const updatedCategories = editingCategories.filter(c => c !== category);
    setEditingCategories(updatedCategories);

    // 서버에 즉시 저장
    try {
      await api.put('/specbook/categories', { categories: updatedCategories });
      setCategories(updatedCategories);
      toast.success('카테고리가 삭제되었습니다');
    } catch (error) {
      console.error('카테고리 삭제 저장 실패:', error);
      toast.error('카테고리 삭제 저장에 실패했습니다');
      // 실패 시 원래대로 복구
      setEditingCategories(categories);
    }
  };


  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = editingCategories.indexOf(active.id as string);
      const newIndex = editingCategories.indexOf(over.id as string);
      const updatedCategories = arrayMove(editingCategories, oldIndex, newIndex);

      setEditingCategories(updatedCategories);

      // 서버에 즉시 저장
      try {
        await api.put('/specbook/categories', { categories: updatedCategories });
        setCategories(updatedCategories);
        toast.success('카테고리 순서가 변경되었습니다');
      } catch (error) {
        console.error('카테고리 순서 저장 실패:', error);
        toast.error('카테고리 순서 저장에 실패했습니다');
        // 실패 시 원래대로 복구
        setEditingCategories(categories);
      }
    }
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-120px)] bg-gray-50"
    >

      {/* 메인 컨텐츠 */}
      <div className="specbook-container flex-1 flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">
        {/* 좌측: 입력 폼 + 카테고리 (데스크톱에서만 표시) */}
        <div className="specbook-sidebar hidden md:flex flex-col gap-4 w-80 lg:w-96 flex-shrink-0">
          {/* 새 아이템 추가 폼 */}
          <div className="specbook-form bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <form onSubmit={handleSubmit} className="flex flex-col pt-3">
                {/* 수평 카드 형태: 이미지 + 입력 필드 */}
                <div className="flex flex-col sm:flex-row gap-3 px-3">
                  {/* 좌측: 이미지 - 정사각형 */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleImageDrop}
                    className={`w-full sm:w-48 aspect-square flex-shrink-0 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                      isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.imageData || editingItem?.image_url ? (
                      <img
                        src={formData.imageData || editingItem?.image_url || ''}
                        alt="Preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-1 text-gray-400" />
                        <p className="text-sm text-gray-500">이미지</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            // 크롭 모달 열기
                            setImageToCrop(e.target?.result as string);
                            setShowCropper(true);
                          };
                          reader.readAsDataURL(file);
                        }
                        // input 초기화 (같은 파일 다시 선택 가능하도록)
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* 우측: 입력 필드들 */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="space-y-1.5">
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                        required
                      >
                        <option value="">카테고리</option>
                        {categories.filter(c => c !== '전체').map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                        placeholder="브랜드"
                      />

                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                        placeholder="제품명"
                        required
                      />

                      <div className="relative">
                        <input
                          type="text"
                          value={formData.price}
                          onChange={handlePriceChange}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 pr-8"
                          placeholder="가격"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
                      </div>
                    </div>

                    {/* 등급 선택 버튼들 */}
                    <div className="flex gap-1">
                      {['알뜰', '기본', '고급', '하이'].map((grade, index) => {
                        const fullGrade = index === 3 ? '하이엔드' : grade;
                        return (
                          <button
                            key={fullGrade}
                            type="button"
                            onClick={() => {
                              if (formData.grades.includes(fullGrade)) {
                                setFormData({ ...formData, grades: formData.grades.filter(g => g !== fullGrade) });
                              } else {
                                setFormData({ ...formData, grades: [...formData.grades, fullGrade] });
                              }
                            }}
                            className={`flex-1 px-1 py-1 text-xs font-medium rounded transition-colors ${
                              formData.grades.includes(fullGrade)
                                ? fullGrade === '하이엔드' ? 'bg-violet-500 text-white' :
                                  fullGrade === '고급' ? 'bg-sky-500 text-white' :
                                  fullGrade === '기본' ? 'bg-emerald-500 text-white' :
                                  'bg-amber-400 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {grade}
                          </button>
                        );
                      })}
                    </div>

                    {/* 버튼 영역 - 이미지 하단에 맞춤 */}
                    <div className="flex gap-1.5 mt-3">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? '저장 중...' : (editingItem ? '수정' : '추가')}
                      </button>
                      {editingItem && (
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 하단 패딩 */}
                <div className="p-3 pt-0"></div>
              </form>
          </div>

          {/* 등급 필터 */}
          <div className="specbook-grade-filter bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-900 mr-3">등급 필터</h3>
              <div className="flex gap-2 flex-1">
                {['알뜰', '기본', '고급', '하이엔드'].map(grade => (
                  <button
                    key={grade}
                    onClick={() => {
                      if (selectedGrades.includes(grade)) {
                        setSelectedGrades(selectedGrades.filter(g => g !== grade));
                      } else {
                        setSelectedGrades([...selectedGrades, grade]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      selectedGrades.includes(grade)
                        ? grade === '하이엔드' ? 'bg-violet-500 text-white' :
                          grade === '고급' ? 'bg-sky-500 text-white' :
                          grade === '기본' ? 'bg-emerald-500 text-white' :
                          'bg-amber-400 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {grade}
                  </button>
                ))}
                {selectedGrades.length > 0 && (
                  <button
                    onClick={() => setSelectedGrades([])}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors whitespace-nowrap"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 카테고리 버튼들 (3열) */}
          <div className="specbook-category bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                카테고리
                {view === 'project' && selectedProject && (
                  <span className="ml-1 text-gray-600">
                    ({projects.find(p => p.id === selectedProject)?.title})
                  </span>
                )}
              </h3>
              <button
                onClick={handleOpenCategoryModal}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title="카테고리 편집"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map(category => {
                const count = getCategoryCount(category);
                // 라이브러리 또는 프로젝트가 선택된 경우에 수량 표시
                const showCount = (view === 'library' || (view === 'project' && selectedProject)) && count > 0;

                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category}
                    {showCount && (
                      <span className={`ml-1 ${
                        selectedCategory === category ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          </div>

        {/* 아이템 그리드 영역 */}
        {view === 'library' ? (
          /* 라이브러리 뷰: 전체 폭 */
          <div className="specbook-main flex-1 flex flex-col overflow-hidden pr-4 pt-3">
          {/* 버튼 영역 */}
          <div className="mb-4 px-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 lg:gap-4">
              {!isAnTeamUser && (
                <button
                  onClick={() => {
                    setView('library');
                    setSelectedProject(null);
                  }}
                  className={`col-span-1 lg:col-span-1 h-9 rounded-lg font-medium transition-colors text-xs md:text-sm flex items-center justify-center ${view === 'library' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  스펙 라이브러리
                </button>
              )}
              <select
                value={selectedProject || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setView('project');
                    setSelectedProject(Number(e.target.value));
                  } else if (!isAnTeamUser) {
                    setView('library');
                    setSelectedProject(null);
                  }
                }}
                className={`specbook-header-project-select col-span-1 lg:col-span-1 ${isAnTeamUser ? '' : 'lg:col-start-4'} h-9 border border-gray-300 rounded-lg focus:outline-none bg-white text-xs md:text-sm px-1 md:px-2`}
              >
                {!isAnTeamUser && <option value="">프로젝트 선택</option>}
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="specbook-content flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* 스펙 라이브러리 */}
            <div className="specbook-library w-full md:w-1/2 flex flex-col overflow-hidden pb-4 md:pr-3">
              <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              등록된 스펙북 아이템이 없습니다
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    setIsDraggingItem(true);
                    e.dataTransfer.setData('itemId', item.id.toString());
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDragEnd={() => {
                    setIsDraggingItem(false);
                    setDragStartPos(null);
                  }}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 overflow-hidden cursor-grab active:cursor-grabbing flex flex-col group relative"
                >
                  <div
                    className="w-full aspect-square bg-gray-100 relative"
                    onMouseDown={(e) => {
                      setDragStartPos({ x: e.clientX, y: e.clientY });
                    }}
                    onClick={(e) => {
                      // 드래그 중이 아니고, 마우스가 거의 이동하지 않았으면 클릭으로 간주
                      if (!isDraggingItem && dragStartPos) {
                        const distance = Math.sqrt(
                          Math.pow(e.clientX - dragStartPos.x, 2) +
                          Math.pow(e.clientY - dragStartPos.y, 2)
                        );
                        if (distance < 5) {  // 5px 이하 이동은 클릭
                          handleImageClick(item);
                        }
                      }
                      setDragStartPos(null);
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-contain pointer-events-none"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs pointer-events-none">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-1.5 bg-white text-gray-700 hover:bg-gray-100 rounded-md shadow-md transition-colors cursor-pointer"
                      title="수정"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-md shadow-md transition-colors cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-2 pt-1.5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                          {item.category}
                        </span>
                        {item.brand && (
                          <span className="text-xs text-gray-500">{item.brand}</span>
                        )}
                      </div>
                      {item.grade && (
                        <span className={`hidden md:inline-block px-1.5 py-0.5 text-xs rounded ${getGradeColor(item.grade)}`}>
                          {formatGradeRange(item.grade)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-auto">
                      <div className="flex items-baseline gap-1 min-w-0">
                        <h3 className="font-semibold text-xs text-gray-900 truncate">{item.name}</h3>
                      </div>
                      {item.price && (
                        <span className="hidden md:inline text-xs text-gray-900 font-medium flex-shrink-0">{item.price}원</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
                )}
              </div>
            </div>
            {/* 중앙 경계선 (데스크톱에서만 표시) */}
            <div className="hidden md:block w-px bg-gray-300 self-stretch"></div>
            {/* 우측: 드롭 영역 (데스크톱에서만 표시) */}
            <div className="specbook-drop-zone hidden md:flex w-1/2 flex-col overflow-hidden pl-3 pb-4">
              {/* 프로젝트 선택 드롭다운 - 세로모드에서 드롭 영역 위에 표시 */}
              <div className="specbook-drop-project-select hidden mb-2">
                <select
                  value={selectedProject || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setView('project');
                      setSelectedProject(Number(e.target.value));
                    }
                  }}
                  className="h-9 border border-gray-300 rounded-lg focus:outline-none bg-white text-sm px-3"
                >
                  <option value="">프로젝트 선택</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300 transition-colors"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('bg-blue-50', 'border-blue-400');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');
                  const itemId = e.dataTransfer.getData('itemId');
                  if (itemId) {
                    setDraggedItemId(Number(itemId));
                    setShowProjectSelectModal(true);
                  }
                }}
              >
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  <span className="specbook-drop-text-landscape">좌측에서 아이템을 드래그하여 추가하세요</span>
                  <span className="specbook-drop-text-portrait">상단에서 아이템을 드래그하여 추가하세요</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
          /* 프로젝트 뷰: 좌우 분할 - 스펙 라이브러리 + 프로젝트 아이템 */
          <div className="specbook-main flex-1 flex flex-col overflow-hidden pr-4 pt-3">
            {/* 버튼 영역 */}
            <div className="mb-4 px-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 lg:gap-4">
                {!isAnTeamUser && (
                  <button
                    onClick={() => {
                      setView('library');
                      setSelectedProject(null);
                    }}
                    className="col-span-1 lg:col-span-1 h-9 rounded-lg font-medium transition-colors bg-gray-200 text-gray-700 text-xs md:text-sm flex items-center justify-center"
                  >
                    스펙 라이브러리
                  </button>
                )}
                <select
                  value={selectedProject || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setView('project');
                      setSelectedProject(Number(e.target.value));
                    } else if (!isAnTeamUser) {
                      setView('library');
                      setSelectedProject(null);
                    }
                  }}
                  className={`specbook-header-project-select col-span-1 lg:col-span-1 ${isAnTeamUser ? '' : 'lg:col-start-4'} h-9 border border-gray-300 rounded-lg focus:outline-none bg-white text-xs md:text-sm px-1 md:px-2`}
                >
                  {!isAnTeamUser && <option value="">프로젝트 선택</option>}
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="specbook-content flex-1 flex flex-col md:flex-row overflow-hidden gap-4">
              {/* 좌측: 스펙 라이브러리 (드래그 소스) - 데스크톱에서만 표시, 안팀 제외 */}
              {!isAnTeamUser && (
                <div className="specbook-library hidden md:flex md:w-1/2 flex-col overflow-hidden pb-4 md:pr-3">
                <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                {(
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {allLibraryItems
                      .filter(item => selectedCategory === '전체' || item.category === selectedCategory)
                      .map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setIsDraggingItem(true);
                          e.dataTransfer.setData('itemId', item.id.toString());
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => {
                          setIsDraggingItem(false);
                          setDragStartPos(null);
                        }}
                        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 overflow-hidden cursor-grab active:cursor-grabbing flex flex-col"
                      >
                        <div
                          className="w-full aspect-square bg-gray-100"
                          onMouseDown={(e) => {
                            setDragStartPos({ x: e.clientX, y: e.clientY });
                          }}
                          onClick={(e) => {
                            // 드래그 중이 아니고, 마우스가 거의 이동하지 않았으면 클릭으로 간주
                            if (!isDraggingItem && dragStartPos) {
                              const distance = Math.sqrt(
                                Math.pow(e.clientX - dragStartPos.x, 2) +
                                Math.pow(e.clientY - dragStartPos.y, 2)
                              );
                              if (distance < 5) {  // 5px 이하 이동은 클릭
                                handleImageClick(item);
                              }
                            }
                            setDragStartPos(null);
                          }}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-contain pointer-events-none"
                              loading="lazy"
                              draggable={false}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs pointer-events-none">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="p-2 pt-1.5 flex flex-col flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                                {item.category}
                              </span>
                              {item.brand && (
                                <span className="text-xs text-gray-500">{item.brand}</span>
                              )}
                            </div>
                            {item.grade && (
                              <span className={`hidden md:inline-block px-1.5 py-0.5 text-xs rounded ${getGradeColor(item.grade)}`}>
                                {formatGradeRange(item.grade)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between gap-1 mt-auto">
                            <div className="flex items-baseline gap-1 min-w-0">
                              <h3 className="font-semibold text-xs text-gray-900 truncate">{item.name}</h3>
                            </div>
                            {item.price && (
                              <span className="hidden md:inline text-xs text-gray-900 font-medium flex-shrink-0">{item.price}원</span>
                            )}
                          </div>
                        </div>
                      </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
              )}
            {/* 중앙 경계선 - 안팀 제외 */}
            {!isAnTeamUser && (
              <div className="hidden md:block w-px bg-gray-300 self-stretch"></div>
            )}
            {/* 우측: 프로젝트 아이템 (드롭 타겟) - 안팀은 전체 폭 사용 */}
            <div className={`specbook-project w-full ${isAnTeamUser ? '' : 'md:w-1/2'} flex flex-col overflow-hidden ${isAnTeamUser ? '' : 'md:pl-3'} pb-4`}>
              {/* 프로젝트 선택 드롭다운 - 세로모드에서 프로젝트 영역 위에 표시 */}
              <div className="specbook-drop-project-select hidden mb-2">
                <select
                  value={selectedProject || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setView('project');
                      setSelectedProject(Number(e.target.value));
                    } else if (!isAnTeamUser) {
                      setView('library');
                      setSelectedProject(null);
                    }
                  }}
                  className="w-full h-9 border border-gray-300 rounded-lg focus:outline-none bg-white text-sm px-3"
                >
                  {!isAnTeamUser && <option value="">프로젝트 선택</option>}
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
                <div
                  className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const itemId = e.dataTransfer.getData('itemId');
                  if (itemId && selectedProject) {
                    try {
                      // 라이브러리 아이템을 프로젝트에 복사
                      const sourceItem = allLibraryItems.find(i => i.id === Number(itemId));
                      if (sourceItem) {
                        const { id, created_at, updated_at, ...itemData } = sourceItem;
                        await api.post('/specbook/base64', {
                          ...itemData,
                          isLibrary: false,
                          projectId: selectedProject
                        });
                        toast.success('아이템이 프로젝트에 추가되었습니다');
                        loadItems(); // 프로젝트 아이템 새로고침
                        loadAllProjectItems(); // 전체 프로젝트 아이템도 새로고침
                      }
                    } catch (error) {
                      console.error('아이템 추가 실패:', error);
                      toast.error('아이템 추가 실패');
                    }
                  }
                }}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">로딩 중...</div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                    <span className="specbook-drop-text-landscape">좌측에서 아이템을 드래그하여 추가하세요</span>
                    <span className="specbook-drop-text-portrait">상단에서 아이템을 드래그하여 추가하세요</span>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleItemDragEnd}
                  >
                    <SortableContext
                      items={items
                        .filter(item => selectedCategory === '전체' || item.category === selectedCategory)
                        .map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {items
                          .filter(item => selectedCategory === '전체' || item.category === selectedCategory)
                          .map(item => (
                            <SortableSpecBookItem
                              key={item.id}
                              item={item}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onImageClick={handleImageClick}
                            />
                          ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* 카테고리 편집 모달 */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">카테고리 관리</h2>
              <button
                onClick={handleCloseCategoryModal}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {/* 새 카테고리 추가 */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCategory();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    placeholder="카테고리 이름 입력"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    추가
                  </button>
                </div>
              </div>

              {/* 카테고리 목록 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리 목록 (드래그하여 순서 변경)
                </label>
                <div className="max-h-120 overflow-y-auto border border-gray-200 rounded-lg">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={editingCategories}
                      strategy={verticalListSortingStrategy}
                    >
                      {editingCategories.map((category) => (
                        <SortableCategoryItem
                          key={category}
                          category={category}
                          onRemove={handleRemoveCategory}
                          onEdit={handleEditCategory}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              {/* 닫기 버튼 */}
              <div className="flex justify-center">
                <button
                  onClick={handleCloseCategoryModal}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub 이미지 관리 모달 */}
      {isSubImageModalOpen && selectedItemForImages && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // 배경 클릭 시 모달 닫기
            if (e.target === e.currentTarget) {
              handleCloseSubImageModal();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedItemForImages.name}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  드래그 앤 드롭 또는 Ctrl+V로 이미지/PDF를 추가할 수 있습니다
                </p>
              </div>
              <button
                onClick={handleCloseSubImageModal}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* 컨텐츠 */}
            <div
              className="flex-1 overflow-y-auto p-4 md:p-6"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingSubImage(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingSubImage(false);
              }}
              onDrop={handleSubImageDrop}
            >
              {/* 숨겨진 파일 입력 */}
              <input
                ref={subImageFileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.txt,.zip,.dwg,.skp,.3dm,.dxf"
                multiple
                onChange={handleAddSubImage}
                className="hidden"
              />

              {/* 이미지 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {/* 메인 이미지 (읽기 전용) */}
                {selectedItemForImages.image_url && (
                  <div className="relative group">
                    <div
                      className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-500 cursor-pointer hover:border-blue-600 transition-colors"
                      onClick={() => {
                        // 모든 이미지 목록 구성
                        const imageList: string[] = [selectedItemForImages.image_url!];
                        subImages.forEach(fileData => {
                          const hasFileName = fileData.includes('|') && !fileData.startsWith('data:image');
                          const data = hasFileName ? fileData.split('|')[1] : fileData;
                          if (data.startsWith('data:image')) {
                            imageList.push(data);
                          }
                        });
                        setAllViewableImages(imageList);
                        setViewingImageIndex(0);
                        setViewingImage(selectedItemForImages.image_url!);
                      }}
                    >
                      <img
                        src={selectedItemForImages.image_url}
                        alt="메인 이미지"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                      메인
                    </div>
                  </div>
                )}

                {/* Sub 이미지/파일들 (드래그 정렬 가능) */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSubImageDragEnd}
                >
                  <SortableContext
                    items={subImages.map((_, index) => `subimg-${index}`)}
                    strategy={rectSortingStrategy}
                  >
                    {subImages.map((fileData, index) => (
                      <SortableSubImage
                        key={`subimg-${index}`}
                        id={`subimg-${index}`}
                        fileData={fileData}
                        index={index}
                        onDelete={handleDeleteSubImage}
                        onFileClick={handleSubImageFileClick}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* 이미지 추가 버튼 */}
                <div
                  onClick={() => subImageFileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-12 w-12 text-gray-400" />
                </div>
              </div>

            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-center p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  총 {(selectedItemForImages.image_url ? 1 : 0) + subImages.length}개의 파일
                </p>
                {isSavingSubImages && (
                  <p className="text-sm text-blue-600 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    저장 중...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 원본 사이즈 이미지 뷰어 (확대/축소 기능 포함) */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingImage(null);
              setImageZoom(1);
              setImagePosition({ x: 0, y: 0 });
              setLastTouchDistance(null);
              setLastTouchCenter(null);
              setIsPinching(false);
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setImageZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
          }}
        >
          {/* 컨트롤 버튼들 */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => {
                setViewingImage(null);
                setImageZoom(1);
                setImagePosition({ x: 0, y: 0 });
                setLastTouchDistance(null);
                setLastTouchCenter(null);
                setIsPinching(false);
              }}
              className="p-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageZoom(prev => Math.min(5, prev + 0.5));
              }}
              className="p-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
              title="확대 (+)"
            >
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageZoom(prev => Math.max(0.5, prev - 0.5));
              }}
              className="p-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
              title="축소 (-)"
            >
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageZoom(1);
                setImagePosition({ x: 0, y: 0 });
              }}
              className="p-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
              title="초기화"
            >
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* 줌 레벨 및 이미지 인덱스 표시 */}
          <div className="absolute top-4 left-4 flex items-center gap-3">
            <div className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm">
              {Math.round(imageZoom * 100)}%
            </div>
            {allViewableImages.length > 1 && (
              <div className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm">
                {viewingImageIndex + 1} / {allViewableImages.length}
              </div>
            )}
          </div>

          {/* 이전/다음 버튼 */}
          {allViewableImages.length > 1 && (
            <>
              {/* 이전 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white bg-opacity-10 hover:bg-opacity-30 rounded-full transition-colors z-10"
                title="이전 이미지 (←)"
              >
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* 다음 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white bg-opacity-10 hover:bg-opacity-30 rounded-full transition-colors z-10"
                title="다음 이미지 (→)"
              >
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* 하단 키보드 단축키 안내 */}
          {allViewableImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white bg-opacity-10 text-white px-4 py-2 rounded-lg text-sm">
              ← → 키보드로 이동 | ESC 닫기
            </div>
          )}

          {/* 이미지 */}
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden"
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
              src={viewingImage}
              alt="원본 이미지"
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
            />
          </div>

          {/* 사용 안내 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-10 text-white px-4 py-2 rounded-lg text-xs text-center">
            마우스 휠 또는 두 손가락으로 확대/축소 | 드래그로 이동 | 더블클릭으로 2배 확대/초기화
          </div>
        </div>
      )}

      {/* 프로젝트 선택 모달 */}
      {showProjectSelectModal && draggedItemId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">프로젝트 선택</h3>
            <p className="text-sm text-gray-600 mb-4">
              아이템을 추가할 프로젝트를 선택하세요
            </p>
            <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={async () => {
                    try {
                      const sourceItem = allLibraryItems.find(i => i.id === draggedItemId);
                      if (sourceItem) {
                        const { id, created_at, updated_at, ...itemData } = sourceItem;
                        await api.post('/specbook/base64', {
                          ...itemData,
                          isLibrary: false,
                          projectId: project.id
                        });
                        toast.success(`"${project.title}"에 아이템이 추가되었습니다`);
                        loadAllProjectItems();
                      }
                    } catch (error) {
                      console.error('아이템 추가 실패:', error);
                      toast.error('아이템 추가 실패');
                    } finally {
                      setShowProjectSelectModal(false);
                      setDraggedItemId(null);
                    }
                  }}
                  className="w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">{project.title}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowProjectSelectModal(false);
                setDraggedItemId(null);
              }}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 이미지 크롭 모달 */}
      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
        />
      )}
    </div>
  );
};

export default SpecBook;
