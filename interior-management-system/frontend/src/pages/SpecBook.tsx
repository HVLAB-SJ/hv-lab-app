import { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-gray-50">
      {/* 버튼 영역 */}
      <div className="flex gap-2 mb-4">
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
          className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 ${
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
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* 좌측: 입력 폼 + 카테고리 (프로젝트 선택 시 숨김) */}
        {view === 'library' && (
          <div className="w-1/4 flex flex-col gap-4 p-4">
          {/* 새 아이템 추가 폼 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h2 className="text-base font-semibold mb-3 text-gray-900">
              {editingItem ? '아이템 수정' : '새 아이템 추가'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* 수평 카드 형태: 이미지 + 입력 필드 */}
              <div className="flex gap-3">
                {/* 좌측: 이미지 - 정사각형 유동 사이즈 */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleImageDrop}
                  className={`aspect-square w-full max-w-xs flex-shrink-0 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
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
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                      placeholder="브랜드"
                    />

                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                      placeholder="제품명"
                      required
                    />

                    <div className="relative">
                      <input
                        type="text"
                        value={formData.price}
                        onChange={handlePriceChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 pr-10"
                        placeholder="가격"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">원</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                    >
                      {editingItem ? '수정' : '추가'}
                    </button>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* 카테고리 버튼들 (4열) */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="text-sm font-semibold mb-3 text-gray-900">카테고리</h3>
            <div className="grid grid-cols-4 gap-2">
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
          <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              등록된 스펙북 아이템이 없습니다
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden"
                >
                  <div className="flex h-32">
                    {/* 좌측: 정사각형 이미지 */}
                    <div className="w-32 h-32 flex-shrink-0 bg-gray-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          이미지 없음
                        </div>
                      )}
                    </div>

                    {/* 우측: 텍스트 정보 */}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-1">
                          <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                            {item.category}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="수정"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">{item.name}</h3>
                      </div>
                      <div className="space-y-0.5">
                        {item.brand && (
                          <p className="text-xs text-gray-600">브랜드: {item.brand}</p>
                        )}
                        {item.price && (
                          <p className="text-xs text-gray-900 font-medium">{item.price}원</p>
                        )}
                      </div>
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
                  <div className="grid grid-cols-2 gap-3">
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
                        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 overflow-hidden cursor-move"
                      >
                        <div className="flex h-24">
                          <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                이미지 없음
                              </div>
                            )}
                          </div>
                          <div className="flex-1 p-2 flex flex-col justify-between overflow-hidden">
                            <div>
                              <span className="inline-block px-1 py-0.5 text-xs bg-gray-100 text-gray-700 rounded mb-1">
                                {item.category}
                              </span>
                              <h3 className="font-semibold text-xs text-gray-900 line-clamp-2">{item.name}</h3>
                            </div>
                            {item.price && (
                              <p className="text-xs text-gray-900 font-medium">{item.price}원</p>
                            )}
                          </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    {items
                      .filter(item => selectedCategory === '전체' || item.category === selectedCategory)
                      .map(item => (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden"
                      >
                        <div className="flex h-24">
                          <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                이미지 없음
                              </div>
                            )}
                          </div>
                          <div className="flex-1 p-2 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between mb-1">
                                <span className="inline-block px-1 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
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
                              <h3 className="font-semibold text-xs text-gray-900 line-clamp-2">{item.name}</h3>
                            </div>
                            {item.price && (
                              <p className="text-xs text-gray-900 font-medium">{item.price}원</p>
                            )}
                          </div>
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
    </div>
  );
};

export default SpecBook;
