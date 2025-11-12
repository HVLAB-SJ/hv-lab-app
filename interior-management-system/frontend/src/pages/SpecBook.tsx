import { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Upload, Settings, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
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

      {/* 상단: 정사각형 이미지 */}
      <div className="w-full aspect-square bg-gray-100 flex-shrink-0 relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-contain block cursor-pointer"
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
          <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
            {item.category}
          </span>
          {item.grade && (
            <span className={`inline-block px-1 py-0.5 text-[10px] rounded ${getGradeColor(item.grade)}`}>
              {formatGradeRange(item.grade)}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-1 mt-auto">
          <div className="flex items-baseline gap-1 min-w-0">
            <h3 className="font-semibold text-xs text-gray-900 truncate">{item.name}</h3>
            {item.brand && (
              <span className="text-xs text-gray-600 flex-shrink-0">{item.brand}</span>
            )}
          </div>
          {item.price && (
            <span className="text-xs text-gray-900 font-medium flex-shrink-0">{item.price}원</span>
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
  const [view, setView] = useState<'library' | 'project'>('library');
  const [items, setItems] = useState<SpecBookItem[]>([]);
  const [allLibraryItems, setAllLibraryItems] = useState<SpecBookItem[]>([]); // 전체 라이브러리 아이템 (수량 계산용)
  const [allProjectItems, setAllProjectItems] = useState<SpecBookItem[]>([]); // 전체 프로젝트 아이템 (수량 계산용)
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [isDraggingSubImage, setIsDraggingSubImage] = useState(false);
  const [isSavingSubImages, setIsSavingSubImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subImageFileInputRef = useRef<HTMLInputElement>(null);
  const subImagesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // DnD 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadCategories();
    loadProjects();
    loadAllLibraryItems(); // 전체 라이브러리 아이템 로드
  }, []);

  useEffect(() => {
    loadItems();
  }, [view, selectedCategory, selectedProject, selectedGrades]);

  // 프로젝트가 선택될 때 전체 프로젝트 아이템 로드
  useEffect(() => {
    if (view === 'project' && selectedProject) {
      loadAllProjectItems();
    }
  }, [view, selectedProject]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/specbook/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await api.get('/specbook/projects');
      console.log('프로젝트 목록 로드됨:', response.data.length, '개', response.data);
      setProjects(response.data);
      // 자동 선택 제거 - 사용자가 직접 선택하도록 함
    } catch (error) {
      console.error('프로젝트 로드 실패:', error);
    }
  };

  const loadAllLibraryItems = async () => {
    try {
      const response = await api.get('/specbook/library');
      setAllLibraryItems(response.data);
    } catch (error) {
      console.error('전체 라이브러리 아이템 로드 실패:', error);
    }
  };

  const loadAllProjectItems = async () => {
    if (!selectedProject) return;
    try {
      const response = await api.get(`/specbook/project/${selectedProject}`);
      setAllProjectItems(response.data);
    } catch (error) {
      console.error('전체 프로젝트 아이템 로드 실패:', error);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedCategory !== '전체') {
        params.category = selectedCategory;
      }
      if (selectedGrades.length > 0) {
        params.grades = selectedGrades.join(',');
      }

      let response;
      if (view === 'library') {
        response = await api.get('/specbook/library', { params });
      } else {
        if (!selectedProject) {
          setItems([]);
          setLoading(false);
          return;
        }
        response = await api.get(`/specbook/project/${selectedProject}`, { params });
      }

      setItems(response.data);
    } catch (error) {
      console.error('스펙북 아이템 로드 실패:', error);
      toast.error('스펙북 아이템을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
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
        setFormData({ ...formData, imageData: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setFormData({ ...formData, imageData: e.target?.result as string });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste as any);
    return () => document.removeEventListener('paste', handlePaste as any);
  }, [formData]);

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

    if (!formData.name || !formData.category) {
      toast.error('제품명과 카테고리는 필수입니다');
      return;
    }

    if (formData.grades.length === 0) {
      toast.error('최소 하나의 등급을 선택해주세요');
      return;
    }

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

  // 이미지 클릭 - Sub 이미지 모달 열기
  const handleImageClick = (item: SpecBookItem) => {
    setSelectedItemForImages(item);
    setSubImages(item.sub_images || []);
    setIsSubImageModalOpen(true);
  };

  // Sub 이미지 추가 (이미지 및 PDF 지원)
  const handleAddSubImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processSubImageFiles(files);
  };

  // 파일 처리 함수
  const processSubImageFiles = (files: File[]) => {
    files.forEach(file => {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setSubImages(prev => [...prev, base64]);
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
        // 성공 시 아이템 목록 업데이트
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

  // Sub 이미지 모달 닫기
  const handleCloseSubImageModal = () => {
    // 저장 중이면 타이머 취소
    if (subImagesSaveTimeoutRef.current) {
      clearTimeout(subImagesSaveTimeoutRef.current);
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
      onDragOver={(e) => {
        e.preventDefault();
        if (showModal) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => {
        if (showModal) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        if (showModal) {
          handleImageDrop(e);
        }
      }}
    >

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex gap-6 overflow-hidden -ml-0">
        {/* 좌측: 입력 폼 + 카테고리 (항상 표시) */}
        <div className="flex flex-col gap-4" style={{ width: '20%' }}>
          {/* 새 아이템 추가 폼 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-3">
                <h2 className="text-sm font-semibold mb-2 text-gray-900">
                  {editingItem ? '아이템 수정' : '새 아이템 추가'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col">
                {/* 수평 카드 형태: 이미지 + 입력 필드 */}
                <div className="flex gap-3 px-3">
                  {/* 좌측: 이미지 - 정사각형 */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleImageDrop}
                    className={`w-56 h-56 flex-shrink-0 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
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
                            setFormData({ ...formData, imageData: e.target?.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* 우측: 입력 필드들 */}
                  <div className="flex-1 flex flex-col justify-between h-56">
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
                    <div className="flex gap-1 mt-2">
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
                    <div className="flex gap-1.5">
                      <button
                        type="submit"
                        className="flex-1 px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                      >
                        {editingItem ? '수정' : '추가'}
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
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
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
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
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
                    className="px-3 py-1.5 rounded text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 카테고리 버튼들 (3열) */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
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
            <div className="grid grid-cols-3 gap-2">
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
          <div className="flex-1 flex flex-col overflow-hidden pr-4">
          {/* 버튼 영역 */}
          <div className="mb-4 flex">
            <div className="w-1/2 pr-3">
              <div className="pl-4">
                <button
                  onClick={() => {
                    setView('library');
                    setSelectedProject(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${view === 'library' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  스펙 라이브러리
                </button>
              </div>
            </div>
            <div className="w-px bg-transparent"></div>
            <div className="w-1/2 pl-3">
              <div className="pl-4">
                <select
                  value={selectedProject || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setView('project');
                      setSelectedProject(Number(e.target.value));
                    } else {
                      setView('library');
                      setSelectedProject(null);
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none bg-white"
                >
                  <option value="">프로젝트 선택</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* 좌측: 스펙 라이브러리 */}
            <div className="w-1/2 flex flex-col overflow-hidden pb-4 pr-3">
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleItemDragEnd}
            >
              <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-3 gap-4">
                  {items.map(item => (
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
            {/* 중앙 경계선 */}
            <div className="w-px bg-gray-300 self-stretch"></div>
            {/* 우측: 빈 공간 */}
            <div className="w-1/2 flex flex-col overflow-hidden pl-3 pb-4">
              <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  프로젝트를 선택하면 여기에 프로젝트 아이템이 표시됩니다
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
          /* 프로젝트 뷰: 좌우 분할 - 스펙 라이브러리 + 프로젝트 아이템 */
          <div className="flex-1 flex flex-col overflow-hidden pr-4">
            {/* 버튼 영역 */}
            <div className="mb-4 flex">
              <div className="w-1/2 pr-3">
                <div className="pl-4">
                  <button
                    onClick={() => {
                      setView('library');
                      setSelectedProject(null);
                    }}
                    className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-800 text-white"
                  >
                    스펙 라이브러리
                  </button>
                </div>
              </div>
              <div className="w-px bg-transparent"></div>
              <div className="w-1/2 pl-3">
                <div className="pl-4">
                  <select
                    value={selectedProject || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setView('project');
                        setSelectedProject(Number(e.target.value));
                      } else {
                        setView('library');
                        setSelectedProject(null);
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none bg-white"
                  >
                    <option value="">프로젝트 선택</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* 좌측: 스펙 라이브러리 (드래그 소스) */}
              <div className="w-1/2 flex flex-col overflow-hidden pb-4 pr-3">
                <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">로딩 중...</div>
                  </div>
                ) : allLibraryItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    라이브러리 아이템이 없습니다
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {allLibraryItems
                      .filter(item => selectedCategory === '전체' || item.category === selectedCategory)
                      .map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('itemId', item.id.toString());
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 overflow-hidden cursor-move flex flex-col"
                      >
                        <div className="w-full aspect-square bg-gray-100">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="p-2 pt-1.5 flex flex-col flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                              {item.category}
                            </span>
                            {item.grade && (
                              <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${getGradeColor(item.grade)}`}>
                                {formatGradeRange(item.grade)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between gap-1 mt-auto">
                            <div className="flex items-baseline gap-1 min-w-0">
                              <h3 className="font-semibold text-xs text-gray-900 truncate">{item.name}</h3>
                              {item.brand && (
                                <span className="text-xs text-gray-600 flex-shrink-0">{item.brand}</span>
                              )}
                            </div>
                            {item.price && (
                              <span className="text-xs text-gray-900 font-medium flex-shrink-0">{item.price}원</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* 중앙 경계선 */}
            <div className="w-px bg-gray-300 self-stretch"></div>
            {/* 우측: 프로젝트 아이템 (드롭 타겟) */}
            <div className="w-1/2 flex flex-col overflow-hidden pl-3 pb-4">
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
                    좌측에서 아이템을 드래그하여 추가하세요
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
                      <div className="grid grid-cols-3 gap-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
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
              className="flex-1 overflow-y-auto p-6"
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
                accept="image/*,application/pdf"
                multiple
                onChange={handleAddSubImage}
                className="hidden"
              />

              {/* 이미지 그리드 */}
              <div className="grid grid-cols-4 gap-4">
                {/* 메인 이미지 (읽기 전용) */}
                {selectedItemForImages.image_url && (
                  <div className="relative group">
                    <div
                      className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-500 cursor-pointer hover:border-blue-600 transition-colors"
                      onClick={() => setViewingImage(selectedItemForImages.image_url!)}
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

                {/* Sub 이미지들 */}
                {subImages.map((fileData, index) => {
                  const isPDF = fileData.startsWith('data:application/pdf');
                  return (
                    <div key={index} className="relative group">
                      <div
                        className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
                        onClick={() => !isPDF && setViewingImage(fileData)}
                      >
                        {isPDF ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-red-600">
                            <svg className="h-16 w-16 mb-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                              <path d="M14 2v6h6M10 12h4M10 16h4"/>
                            </svg>
                            <span className="text-xs font-medium">PDF</span>
                          </div>
                        ) : (
                          <img
                            src={fileData}
                            alt={`상세 이미지 ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSubImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  );
                })}

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

      {/* 원본 사이즈 이미지 뷰어 */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
          >
            <X className="h-8 w-8 text-white" />
          </button>
          <img
            src={viewingImage}
            alt="원본 이미지"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default SpecBook;
