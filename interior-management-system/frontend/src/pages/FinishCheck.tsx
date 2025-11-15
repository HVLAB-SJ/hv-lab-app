import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronLeft, Image as ImageIcon, Upload, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface FinishCheckItemImage {
  id: number;
  item_id: number;
  image_data: string;
  filename: string | null;
  created_at: string;
}

interface FinishCheckItem {
  id: number;
  space_id: number;
  content: string;
  is_completed: number;
  completed_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  images: FinishCheckItemImage[];
}

interface FinishCheckSpace {
  id: number;
  name: string;
  project_id: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  items: FinishCheckItem[];
}

interface Project {
  id: number;
  title: string;
}

const FinishCheck = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [spaces, setSpaces] = useState<FinishCheckSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemContent, setEditingItemContent] = useState('');
  const [showMobileItems, setShowMobileItems] = useState(false);
  const [selectedItemForImages, setSelectedItemForImages] = useState<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileImageModal, setShowMobileImageModal] = useState(false);

  useEffect(() => {
    loadProjects();
    loadSpaces();

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedProjectId !== null) {
      loadSpaces();
    }
  }, [selectedProjectId]);

  // 프로젝트 선택 시 localStorage에 저장
  useEffect(() => {
    if (selectedProjectId !== null && user?.id) {
      localStorage.setItem(`finishCheck_selectedProject_${user.id}`, selectedProjectId.toString());
    }
  }, [selectedProjectId, user?.id]);

  // 공간 선택 시 localStorage에 저장
  useEffect(() => {
    if (selectedSpaceId !== null && user?.id) {
      localStorage.setItem(`finishCheck_selectedSpace_${user.id}`, selectedSpaceId.toString());
    }
  }, [selectedSpaceId, user?.id]);

  useEffect(() => {
    if (!isMobile && selectedItemForImages) {
      const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              await handleImageUpload(selectedItemForImages, file);
            }
          }
        }
      };

      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [selectedItemForImages, isMobile]);

  const loadProjects = async () => {
    try {
      const response = await api.get('/specbook/projects');
      setProjects(response.data);

      // localStorage에서 사용자별 마지막 선택 프로젝트 불러오기
      const savedProjectId = user?.id
        ? localStorage.getItem(`finishCheck_selectedProject_${user.id}`)
        : null;

      if (savedProjectId && response.data.some((p: Project) => p.id === Number(savedProjectId))) {
        // 저장된 프로젝트가 목록에 있으면 선택
        setSelectedProjectId(Number(savedProjectId));
      } else if (response.data.length > 0) {
        // 저장된 프로젝트가 없거나 유효하지 않으면 첫 번째 프로젝트 선택
        setSelectedProjectId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('프로젝트 목록을 불러오는데 실패했습니다');
    }
  };

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const url = selectedProjectId
        ? `/finish-check/spaces?project_id=${selectedProjectId}`
        : '/finish-check/spaces';
      const response = await api.get(url);

      // Ensure all items have an images array
      const spacesWithImages = response.data.map((space: FinishCheckSpace) => ({
        ...space,
        items: space.items.map(item => ({
          ...item,
          images: item.images || []
        }))
      }));

      setSpaces(spacesWithImages);

      // localStorage에서 사용자별 마지막 선택 공간 불러오기
      const savedSpaceId = user?.id
        ? localStorage.getItem(`finishCheck_selectedSpace_${user.id}`)
        : null;

      if (savedSpaceId) {
        const spaceId = Number(savedSpaceId);
        // 전체 보기(-1) 또는 목록에 있는 공간이면 선택
        if (spaceId === -1 || spacesWithImages.some(s => s.id === spaceId)) {
          setSelectedSpaceId(spaceId);
          return;
        }
      }

      // 저장된 공간이 없거나 유효하지 않으면 첫 번째 공간을 자동으로 선택
      if (spacesWithImages.length > 0 && selectedSpaceId === null) {
        setSelectedSpaceId(spacesWithImages[0].id);
      }
    } catch (error) {
      console.error('Failed to load spaces:', error);
      toast.error('공간 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpace = async () => {
    if (!newSpaceName.trim()) {
      toast.error('공간 이름을 입력하세요');
      return;
    }

    if (!selectedProjectId) {
      toast.error('프로젝트를 선택하세요');
      return;
    }

    try {
      const response = await api.post('/finish-check/spaces', {
        name: newSpaceName.trim(),
        project_id: selectedProjectId
      });
      setSpaces([...spaces, response.data]);
      setNewSpaceName('');
      toast.success('공간이 추가되었습니다');

      // 첫 번째 공간이면 자동 선택
      if (spaces.length === 0) {
        setSelectedSpaceId(response.data.id);
      }
    } catch (error) {
      console.error('Failed to add space:', error);
      toast.error('공간 추가에 실패했습니다');
    }
  };

  const handleUpdateSpace = async (spaceId: number, newName: string) => {
    if (!newName.trim()) {
      toast.error('공간 이름을 입력하세요');
      return;
    }

    try {
      await api.put(`/finish-check/spaces/${spaceId}`, {
        name: newName.trim()
      });
      setSpaces(spaces.map(space =>
        space.id === spaceId ? { ...space, name: newName.trim() } : space
      ));
      setEditingSpaceId(null);
      setEditingSpaceName('');
      toast.success('공간 이름이 수정되었습니다');
    } catch (error) {
      console.error('Failed to update space:', error);
      toast.error('공간 수정에 실패했습니다');
    }
  };

  const handleDeleteSpace = async (spaceId: number, spaceName: string) => {
    if (!confirm(`"${spaceName}" 공간을 삭제하시겠습니까?\n\n삭제된 공간과 해당 공간의 모든 항목은 복구할 수 없습니다.`)) {
      return;
    }

    try {
      await api.delete(`/finish-check/spaces/${spaceId}`);
      const updatedSpaces = spaces.filter(space => space.id !== spaceId);
      setSpaces(updatedSpaces);

      // 삭제된 공간이 선택되어 있었다면 첫 번째 공간을 선택
      if (selectedSpaceId === spaceId) {
        setSelectedSpaceId(updatedSpaces.length > 0 ? updatedSpaces[0].id : null);
      }

      toast.success('공간이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete space:', error);
      toast.error('공간 삭제에 실패했습니다');
    }
  };

  const handleAddItem = async () => {
    if (!selectedSpaceId) {
      toast.error('공간을 선택하세요');
      return;
    }

    if (!newItemContent.trim()) {
      toast.error('항목 내용을 입력하세요');
      return;
    }

    try {
      const response = await api.post('/finish-check/items', {
        space_id: selectedSpaceId,
        content: newItemContent.trim()
      });

      setSpaces(spaces.map(space =>
        space.id === selectedSpaceId
          ? { ...space, items: [...space.items, { ...response.data, images: [] }] }
          : space
      ));
      setNewItemContent('');
      toast.success('항목이 추가되었습니다');
    } catch (error) {
      console.error('Failed to add item:', error);
      toast.error('항목 추가에 실패했습니다');
    }
  };

  const handleToggleItem = async (itemId: number) => {
    try {
      const response = await api.put(`/finish-check/items/${itemId}/toggle`);

      setSpaces(spaces.map(space => ({
        ...space,
        items: space.items.map(item =>
          item.id === itemId ? { ...item, ...response.data } : item
        )
      })));
    } catch (error) {
      console.error('Failed to toggle item:', error);
      toast.error('항목 상태 변경에 실패했습니다');
    }
  };

  const handleUpdateItem = async (itemId: number, newContent: string) => {
    if (!newContent.trim()) {
      toast.error('항목 내용을 입력하세요');
      return;
    }

    try {
      await api.put(`/finish-check/items/${itemId}`, {
        content: newContent.trim()
      });

      setSpaces(spaces.map(space => ({
        ...space,
        items: space.items.map(item =>
          item.id === itemId ? { ...item, content: newContent.trim() } : item
        )
      })));
      setEditingItemId(null);
      setEditingItemContent('');
      toast.success('항목이 수정되었습니다');
    } catch (error) {
      console.error('Failed to update item:', error);
      toast.error('항목 수정에 실패했습니다');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await api.delete(`/finish-check/items/${itemId}`);

      setSpaces(spaces.map(space => ({
        ...space,
        items: space.items.filter(item => item.id !== itemId)
      })));

      // 선택된 항목이 삭제된 경우 선택 해제
      if (selectedItemForImages === itemId) {
        setSelectedItemForImages(null);
      }

      toast.success('항목이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('항목 삭제에 실패했습니다');
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = async (itemId: number, file: File) => {
    // 파일 형식 체크
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('JPEG, PNG, WebP 형식의 이미지만 업로드 가능합니다');
      return;
    }

    // 파일 크기 체크 (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    try {
      setUploadingImages(prev => new Set([...prev, itemId]));

      const base64 = await convertFileToBase64(file);
      const response = await api.post(`/finish-check/items/${itemId}/images`, {
        image_data: base64,
        filename: file.name
      });

      // 로컬 상태 업데이트
      setSpaces(spaces.map(space => ({
        ...space,
        items: space.items.map(item =>
          item.id === itemId
            ? { ...item, images: [...item.images, response.data] }
            : item
        )
      })));

      toast.success('이미지가 업로드되었습니다');
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      toast.error(error.response?.data?.error || '이미지 업로드에 실패했습니다');
    } finally {
      setUploadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleFileSelect = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await handleImageUpload(itemId, files[i]);
    }

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageDelete = async (itemId: number, imageId: number) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await api.delete(`/finish-check/images/${imageId}`);

      setSpaces(spaces.map(space => ({
        ...space,
        items: space.items.map(item =>
          item.id === itemId
            ? { ...item, images: item.images.filter(img => img.id !== imageId) }
            : item
        )
      })));

      toast.success('이미지가 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('이미지 삭제에 실패했습니다');
    }
  };

  const handleDrop = async (e: React.DragEvent, itemId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        await handleImageUpload(itemId, files[i]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const selectedSpace = spaces.find(space => space.id === selectedSpaceId);
  const incompleteItems = selectedSpace?.items.filter(item => !item.is_completed) || [];
  const completedItems = selectedSpace?.items.filter(item => item.is_completed) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const selectedItem = selectedItemForImages
    ? spaces.flatMap(s => s.items).find(item => item.id === selectedItemForImages)
    : null;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row gap-4 overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (selectedItemForImages) {
            handleFileSelect(selectedItemForImages, e);
          }
        }}
      />

      {/* 좌측: 공간 목록 */}
      <div className={`w-full md:w-64 lg:w-80 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col ${showMobileItems ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200">
          {/* 프로젝트 선택 */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트</label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => {
                const projectId = e.target.value ? Number(e.target.value) : null;
                setSelectedProjectId(projectId);
                setSelectedSpaceId(null); // 프로젝트 변경 시 공간 선택 초기화
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="">프로젝트 선택</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-3">공간 목록</h2>

          {/* 공간 추가 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddSpace();
                }
              }}
              placeholder="공간 이름"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
            <button
              onClick={handleAddSpace}
              className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
              title="공간 추가"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 공간 목록 */}
        <div className="flex-1 overflow-y-auto">
          {spaces.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              공간을 추가해주세요
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {/* 전체 보기 옵션 */}
              <div
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedSpaceId === -1 ? 'bg-gray-100 border-l-4 border-gray-800' : ''
                }`}
                onClick={() => {
                  setSelectedSpaceId(-1);
                  setShowMobileItems(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">전체 보기</h3>
                  </div>
                </div>
              </div>

              {spaces.map((space) => (
                <div
                  key={space.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedSpaceId === space.id ? 'bg-gray-100 border-l-4 border-gray-800' : ''
                  }`}
                  onClick={() => {
                    setSelectedSpaceId(space.id);
                    setShowMobileItems(true);
                  }}
                >
                  {editingSpaceId === space.id ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingSpaceName}
                        onChange={(e) => setEditingSpaceName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateSpace(space.id, editingSpaceName);
                          } else if (e.key === 'Escape') {
                            setEditingSpaceId(null);
                            setEditingSpaceName('');
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateSpace(space.id, editingSpaceName)}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingSpaceId(null);
                          setEditingSpaceName('');
                        }}
                        className="p-1 text-gray-600 hover:text-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{space.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {space.items.filter(item => item.is_completed).length} / {space.items.length} 완료
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingSpaceId(space.id);
                            setEditingSpaceName(space.name);
                          }}
                          className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSpace(space.id, space.name)}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 우측: 마감 항목 목록 */}
      <div className={`flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col ${!showMobileItems ? 'hidden md:flex' : 'flex'}`}>
        {selectedSpaceId === -1 ? (
          /* 전체 보기 */
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileItems(false)}
                  className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">전체 마감체크</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {spaces.map((space) => {
                const incompleteItems = space.items.filter(item => !item.is_completed);
                const completedItems = space.items.filter(item => item.is_completed);

                if (space.items.length === 0) return null;

                return (
                  <div key={space.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-300">
                      {space.name}
                    </h3>

                    {/* 미완료 항목 */}
                    {incompleteItems.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          미완료 ({incompleteItems.length})
                        </h4>
                        <div className="space-y-2">
                          {incompleteItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                            >
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => handleToggleItem(item.id)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 focus:ring-gray-500 cursor-pointer"
                              />
                              <span className="flex-1 text-sm text-gray-900">{item.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 완료 항목 */}
                    {completedItems.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          완료 ({completedItems.length})
                        </h4>
                        <div className="space-y-2">
                          {completedItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                            >
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleToggleItem(item.id)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 focus:ring-gray-500 cursor-pointer"
                              />
                              <span className="flex-1 text-sm text-gray-500 line-through">{item.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {spaces.every(space => space.items.length === 0) && (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  등록된 마감 항목이 없습니다
                </div>
              )}
            </div>
          </>
        ) : selectedSpace ? (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setShowMobileItems(false)}
                  className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">{selectedSpace.name} - 마감체크</h2>
              </div>

              {/* 항목 추가 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddItem();
                    }
                  }}
                  placeholder="마감 항목 입력"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <button
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* 미완료 항목 */}
              {incompleteItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    미완료 ({incompleteItems.length})
                  </h3>
                  <div className="space-y-2">
                    {incompleteItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleToggleItem(item.id)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 focus:ring-gray-500 cursor-pointer"
                        />

                        {editingItemId === item.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editingItemContent}
                              onChange={(e) => setEditingItemContent(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateItem(item.id, editingItemContent);
                                } else if (e.key === 'Escape') {
                                  setEditingItemId(null);
                                  setEditingItemContent('');
                                }
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateItem(item.id, editingItemContent)}
                              className="p-1 text-green-600 hover:text-green-700"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemId(null);
                                setEditingItemContent('');
                              }}
                              className="p-1 text-gray-600 hover:text-gray-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`flex-1 text-sm text-gray-900 ${!isMobile && selectedItemForImages === item.id ? 'font-semibold' : ''}`}
                              onClick={() => !isMobile && setSelectedItemForImages(item.id)}
                              style={{ cursor: !isMobile ? 'pointer' : 'default' }}
                            >
                              {item.content}
                              {item.images.length > 0 && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({item.images.length})
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              {isMobile && (
                                <button
                                  onClick={() => {
                                    setSelectedItemForImages(item.id);
                                    setShowMobileImageModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  title="이미지"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingItemContent(item.content);
                                }}
                                className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                                title="수정"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 완료 항목 */}
              {completedItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    완료 ({completedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {completedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => handleToggleItem(item.id)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 focus:ring-gray-500 cursor-pointer"
                        />

                        {editingItemId === item.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editingItemContent}
                              onChange={(e) => setEditingItemContent(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateItem(item.id, editingItemContent);
                                } else if (e.key === 'Escape') {
                                  setEditingItemId(null);
                                  setEditingItemContent('');
                                }
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateItem(item.id, editingItemContent)}
                              className="p-1 text-green-600 hover:text-green-700"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemId(null);
                                setEditingItemContent('');
                              }}
                              className="p-1 text-gray-600 hover:text-gray-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`flex-1 text-sm text-gray-500 line-through ${!isMobile && selectedItemForImages === item.id ? 'font-semibold' : ''}`}
                              onClick={() => !isMobile && setSelectedItemForImages(item.id)}
                              style={{ cursor: !isMobile ? 'pointer' : 'default' }}
                            >
                              {item.content}
                              {item.images.length > 0 && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({item.images.length})
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              {isMobile && (
                                <button
                                  onClick={() => {
                                    setSelectedItemForImages(item.id);
                                    setShowMobileImageModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  title="이미지"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingItemContent(item.content);
                                }}
                                className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                                title="수정"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 항목이 없을 때 */}
              {incompleteItems.length === 0 && completedItems.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  마감 항목을 추가해주세요
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            좌측에서 공간을 선택하세요
          </div>
        )}
      </div>

      {/* 우측: 이미지 패널 (데스크톱만) */}
      {!isMobile && selectedItemForImages && selectedItem && (
        <div className="w-80 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">이미지</h3>
              <button
                onClick={() => setSelectedItemForImages(null)}
                className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{selectedItem.content}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImages.has(selectedItemForImages)}
              className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              {uploadingImages.has(selectedItemForImages) ? '업로드 중...' : '이미지 업로드'}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              클릭 또는 드래그 앤 드롭, Ctrl+V로 붙여넣기
            </p>
          </div>

          <div
            className="flex-1 overflow-y-auto p-4"
            onDrop={(e) => handleDrop(e, selectedItemForImages)}
            onDragOver={handleDragOver}
          >
            {selectedItem.images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                <ImageIcon className="w-12 h-12 mb-2" />
                <p>이미지가 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {selectedItem.images.map((image) => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.image_data}
                      alt={image.filename || '이미지'}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => handleImageDelete(selectedItemForImages, image.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="삭제"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    {image.filename && (
                      <p className="text-xs text-gray-500 mt-1 truncate" title={image.filename}>
                        {image.filename}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모바일 이미지 모달 */}
      {isMobile && showMobileImageModal && selectedItemForImages && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">이미지</h3>
                <button
                  onClick={() => {
                    setShowMobileImageModal(false);
                    setSelectedItemForImages(null);
                  }}
                  className="p-1 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">{selectedItem.content}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImages.has(selectedItemForImages)}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadingImages.has(selectedItemForImages) ? '업로드 중...' : '이미지 업로드'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedItem.images.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ImageIcon className="w-16 h-16 mb-2" />
                  <p className="text-sm">이미지가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {selectedItem.images.map((image) => (
                    <div key={image.id} className="relative">
                      <img
                        src={image.image_data}
                        alt={image.filename || '이미지'}
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => handleImageDelete(selectedItemForImages, image.id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      {image.filename && (
                        <p className="text-xs text-gray-500 mt-1 truncate" title={image.filename}>
                          {image.filename}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinishCheck;
