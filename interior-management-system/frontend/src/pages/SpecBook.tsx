import { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Upload, Settings, X, Plus, GripVertical } from 'lucide-react';
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
  description: string;
  project_id: number | null;
  is_library: number;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  title: string;
}

// Sortable 카테고리 아이템 컴포넌트
const SortableCategoryItem = ({
  category,
  onRemove
}: {
  category: string;
  onRemove: (category: string) => void;
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
      {...attributes}
      {...listeners}
      className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-white cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2 flex-1">
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-900">{category}</span>
      </div>
      {category !== '전체' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(category);
          }}
          className="text-red-500 hover:text-red-700 transition-colors"
          title="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const SpecBook = () => {
  const [view, setView] = useState<'library' | 'project'>('library');
  const [items, setItems] = useState<SpecBookItem[]>([]);
  const [allLibraryItems, setAllLibraryItems] = useState<SpecBookItem[]>([]); // 전체 라이브러리 아이템 (수량 계산용)
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
    imageData: null as string | null
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategories, setEditingCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [view, selectedCategory, selectedProject]);

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

  const loadItems = async () => {
    try {
      setLoading(true);
      const params = selectedCategory !== '전체' ? { category: selectedCategory } : {};

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

  // 카테고리별 수량 계산 (스펙 라이브러리만)
  const getCategoryCount = (category: string) => {
    if (view !== 'library') return 0;
    if (category === '전체') return allLibraryItems.length;
    return allLibraryItems.filter(item => item.category === category).length;
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

    try {
      const submitData = {
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        price: formData.price,
        description: '',
        imageData: formData.imageData,
        projectId: view === 'project' ? selectedProject : null,
        isLibrary: view === 'library'
      };

      if (editingItem) {
        await api.put(`/specbook/${editingItem.id}`, submitData);
        toast.success('스펙북 아이템이 수정되었습니다');
      } else {
        await api.post('/specbook/base64', submitData);
        toast.success('스펙북 아이템이 추가되었습니다');
      }

      setEditingItem(null);
      setFormData({ name: '', category: selectedCategory !== '전체' ? selectedCategory : '', brand: '', price: '', imageData: null });
      loadItems();
      // 스펙 라이브러리에 추가/수정한 경우 전체 라이브러리 아이템도 업데이트
      if (view === 'library') {
        loadAllLibraryItems();
      }
    } catch (error: any) {
      console.error('스펙북 아이템 저장 실패:', error);
      toast.error(error.response?.data?.error || '저장에 실패했습니다');
    }
  };

  const handleEdit = (item: SpecBookItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      brand: item.brand,
      price: item.price,
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
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setFormData({ name: '', category: selectedCategory !== '전체' ? selectedCategory : '', brand: '', price: '', imageData: null });
  };

  const handleOpenCategoryModal = () => {
    setEditingCategories([...categories]);
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setNewCategoryName('');
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('카테고리 이름을 입력하세요');
      return;
    }
    if (editingCategories.includes(newCategoryName.trim())) {
      toast.error('이미 존재하는 카테고리입니다');
      return;
    }
    setEditingCategories([...editingCategories, newCategoryName.trim()]);
    setNewCategoryName('');
  };

  const handleRemoveCategory = (category: string) => {
    if (category === '전체') {
      toast.error('전체 카테고리는 삭제할 수 없습니다');
      return;
    }
    setEditingCategories(editingCategories.filter(c => c !== category));
  };

  const handleSaveCategories = async () => {
    try {
      await api.put('/specbook/categories', { categories: editingCategories });
      setCategories(editingCategories);
      toast.success('카테고리가 저장되었습니다');
      handleCloseCategoryModal();
    } catch (error) {
      console.error('카테고리 저장 실패:', error);
      toast.error('카테고리 저장에 실패했습니다');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditingCategories((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);

        return arrayMove(items, oldIndex, newIndex);
      });
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
      {/* 버튼 영역 */}
      <div className="flex gap-2 mb-4" style={{ maxWidth: '20%' }}>
        <button
          onClick={() => {
            setView('library');
            setSelectedProject(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'library'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
        >
          스펙 라이브러리
        </button>

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
          className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 ${
            view === 'project' && selectedProject
              ? 'bg-gray-800 text-white'
              : 'bg-white'
          }`}
        >
          <option value="">프로젝트 선택</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex gap-6 overflow-hidden -ml-0">
        {/* 좌측: 입력 폼 + 카테고리 (프로젝트 선택 시 숨김) */}
        {view === 'library' && (
          <div className="w-1/5 flex flex-col gap-4">
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
                      className="w-full h-full object-cover rounded-lg"
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

          {/* 카테고리 버튼들 (3열) */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">카테고리</h3>
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
                // 스펙 라이브러리이고 수량이 0이 아닌 경우만 수량 표시
                const showCount = view === 'library' && count > 0;

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
        )}

        {/* 아이템 그리드 영역 */}
        {view === 'library' ? (
          /* 라이브러리 뷰: 전체 폭 */
          <div className="flex-1 overflow-y-auto pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              등록된 스펙북 아이템이 없습니다
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-4">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden flex flex-col"
                >
                  {/* 상단: 정사각형 이미지 */}
                  <div className="w-full aspect-square bg-gray-100 flex-shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover block"
                        onError={(e) => {
                          console.error('이미지 로드 실패:', item.image_url);
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">이미지 로드 실패</div>';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        이미지 없음
                      </div>
                    )}
                  </div>

                  {/* 하단: 텍스트 정보 */}
                  <div className="p-2 pt-1.5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                        {item.category}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-0.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="수정"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-0.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
        ) : (
          /* 프로젝트 뷰: 좌우 분할 */
          <>
            {/* 좌측: 스펙 라이브러리 (드래그 소스) */}
            <div className="w-1/2 flex flex-col overflow-hidden p-4">
              <div className="mb-3">
                <h2 className="text-lg font-bold mb-2 text-gray-900">스펙 라이브러리</h2>
                {/* 카테고리 필터 */}
                <div className="grid grid-cols-8 gap-1">
                  {categories.map(category => {
                    const count = allLibraryItems.filter(item => category === '전체' || item.category === category).length;
                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-1 py-0.5 rounded text-[10px] font-medium transition-colors truncate ${
                          selectedCategory === category
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={`${category}${count > 0 ? ` (${count})` : ''}`}
                      >
                        {category}
                        {count > 0 && (
                          <span className={`ml-0.5 ${
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
                  <div className="grid grid-cols-3 gap-3">
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
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('이미지 로드 실패 (라이브러리):', item.image_url);
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">이미지 로드 실패</div>';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="p-2 flex flex-col flex-1">
                          <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded mb-1 w-fit">
                            {item.category}
                          </span>
                          <h3 className="font-semibold text-xs text-gray-900 line-clamp-2 mb-1">{item.name}</h3>
                          {item.price && (
                            <p className="text-xs text-gray-900 font-medium mt-auto">{item.price}원</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 프로젝트 아이템 (드롭 타겟) */}
            <div className="w-1/2 flex flex-col overflow-hidden p-4">
              <div className="mb-3">
                <h2 className="text-lg font-bold mb-2 text-gray-900">
                  {projects.find(p => p.id === selectedProject)?.title}
                </h2>
                {/* 프로젝트 카테고리 개수 */}
                <div className="grid grid-cols-8 gap-1">
                  {categories.map(category => {
                    const count = items.filter(item => category === '전체' || item.category === category).length;
                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-1 py-0.5 rounded text-[10px] font-medium transition-colors truncate ${
                          selectedCategory === category
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={`${category}${count > 0 ? ` (${count})` : ''}`}
                      >
                        {category}
                        {count > 0 && (
                          <span className={`ml-0.5 ${
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
              <div
                className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300"
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
                  <div className="grid grid-cols-3 gap-3">
                    {items
                      .filter(item => selectedCategory === '전체' || item.category === selectedCategory)
                      .map(item => (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden flex flex-col"
                      >
                        <div className="w-full aspect-square bg-gray-100">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="p-2 flex flex-col flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                              {item.category}
                            </span>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-0.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="제거"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <h3 className="font-semibold text-xs text-gray-900 line-clamp-2 mb-1">{item.name}</h3>
                          {item.price && (
                            <p className="text-xs text-gray-900 font-medium mt-auto">{item.price}원</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
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
                <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
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
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              {/* 저장/취소 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCategories}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={handleCloseCategoryModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecBook;
