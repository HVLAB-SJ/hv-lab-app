import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronLeft, Image as ImageIcon, Upload, XCircle, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';

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
  is_priority?: number;
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
  const filteredProjects = useFilteredProjects();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [spaces, setSpaces] = useState<FinishCheckSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [selectedSpaceIdForNewItem, setSelectedSpaceIdForNewItem] = useState<number | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemContent, setEditingItemContent] = useState('');
  const [selectedItemForImages, setSelectedItemForImages] = useState<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileImageModal, setShowMobileImageModal] = useState(false);
  const [deletingSpaceId, setDeletingSpaceId] = useState<number | null>(null);
  const [selectedItemsToDelete, setSelectedItemsToDelete] = useState<Set<number>>(new Set());
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(() => {
    const saved = localStorage.getItem('finishCheck_showOnlyIncomplete');
    return saved === 'true';
  });
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [isAddingSpace, setIsAddingSpace] = useState(false); // 중복 실행 방지

  // showOnlyIncomplete 상태 저장
  useEffect(() => {
    localStorage.setItem('finishCheck_showOnlyIncomplete', String(showOnlyIncomplete));
  }, [showOnlyIncomplete]);

  useEffect(() => {
    // Don't load spaces initially - wait for project to be selected
    // loadSpaces(); // Removed to prevent loading before project is selected

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // filteredProjects가 변경될 때 프로젝트 다시 로드
  useEffect(() => {
    loadProjects();
  }, [filteredProjects]);

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
      // filteredProjects를 Project 형식으로 변환
      const mappedProjects = filteredProjects.map(p => ({
        id: p.id,
        title: p.name
      }));
      setProjects(mappedProjects);

      // localStorage에서 사용자별 마지막 선택 프로젝트 불러오기
      const savedProjectId = user?.id
        ? localStorage.getItem(`finishCheck_selectedProject_${user.id}`)
        : null;

      if (savedProjectId && mappedProjects.some((p: Project) => p.id === Number(savedProjectId))) {
        // 저장된 프로젝트가 목록에 있으면 선택
        setSelectedProjectId(Number(savedProjectId));
      } else if (mappedProjects.length > 0) {
        // 저장된 프로젝트가 없거나 유효하지 않으면 첫 번째 프로젝트 선택
        setSelectedProjectId(mappedProjects[0].id);
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
    } catch (error) {
      console.error('Failed to load spaces:', error);
      toast.error('공간 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpace = async () => {
    // 중복 실행 방지
    if (isAddingSpace) return;

    if (!newSpaceName.trim()) {
      toast.error('공간 이름을 입력하세요');
      return;
    }

    if (!selectedProjectId) {
      toast.error('프로젝트를 선택하세요');
      return;
    }

    setIsAddingSpace(true);

    try {
      const response = await api.post('/finish-check/spaces', {
        name: newSpaceName.trim(),
        project_id: selectedProjectId
      });
      // Ensure items array exists
      const newSpace = {
        ...response.data,
        items: response.data.items || []
      };
      setSpaces([...spaces, newSpace]);
      setNewSpaceName('');
      setShowAddSpaceModal(false);
      toast.success('공간이 추가되었습니다');
    } catch (error) {
      console.error('Failed to add space:', error);
      toast.error('공간 추가에 실패했습니다');
    } finally {
      setIsAddingSpace(false);
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

  const handleDeleteSpace = (spaceId: number) => {
    setDeletingSpaceId(spaceId);
    setSelectedItemsToDelete(new Set());
  };

  const handleDeleteSelectedItems = async () => {
    if (deletingSpaceId === null) return;

    if (selectedItemsToDelete.size === 0) {
      toast.error('삭제할 항목을 선택하세요');
      return;
    }

    try {
      // 선택된 항목들을 삭제
      await Promise.all(
        Array.from(selectedItemsToDelete).map(itemId =>
          api.delete(`/finish-check/items/${itemId}`)
        )
      );

      // 로컬 상태 업데이트
      setSpaces(spaces.map(space =>
        space.id === deletingSpaceId
          ? { ...space, items: space.items.filter(item => !selectedItemsToDelete.has(item.id)) }
          : space
      ));

      toast.success(`${selectedItemsToDelete.size}개 항목이 삭제되었습니다`);
      setDeletingSpaceId(null);
      setSelectedItemsToDelete(new Set());
    } catch (error) {
      console.error('Failed to delete items:', error);
      toast.error('항목 삭제에 실패했습니다');
    }
  };

  const handleDeleteEntireSpace = async () => {
    if (deletingSpaceId === null) return;

    const space = spaces.find(s => s.id === deletingSpaceId);
    if (!space) return;

    if (!confirm(`"${space.name}" 공간을 삭제하시겠습니까?\n\n삭제된 공간과 해당 공간의 모든 항목은 복구할 수 없습니다.`)) {
      return;
    }

    try {
      await api.delete(`/finish-check/spaces/${deletingSpaceId}`);
      setSpaces(spaces.filter(s => s.id !== deletingSpaceId));
      toast.success('공간이 삭제되었습니다');
      setDeletingSpaceId(null);
      setSelectedItemsToDelete(new Set());
    } catch (error) {
      console.error('Failed to delete space:', error);
      toast.error('공간 삭제에 실패했습니다');
    }
  };

  const handleAddItem = async (spaceId: number) => {
    if (!newItemContent.trim()) {
      toast.error('항목 내용을 입력하세요');
      return;
    }

    // 낙관적 업데이트: 임시 ID로 즉시 UI에 추가
    const tempId = -Date.now();
    const tempItem = {
      id: tempId,
      space_id: spaceId,
      content: newItemContent.trim(),
      is_checked: false,
      is_priority: false,
      images: []
    };

    // 즉시 UI 업데이트
    setSpaces(spaces.map(space =>
      space.id === spaceId
        ? { ...space, items: [...space.items, tempItem] }
        : space
    ));
    const savedContent = newItemContent.trim();
    setNewItemContent('');
    setSelectedSpaceIdForNewItem(null);

    // 백그라운드에서 API 호출
    try {
      const response = await api.post('/finish-check/items', {
        space_id: spaceId,
        content: savedContent
      });

      // API 성공 시 임시 항목을 실제 데이터로 교체
      setSpaces(prev => prev.map(space =>
        space.id === spaceId
          ? { ...space, items: space.items.map(item =>
              item.id === tempId ? { ...response.data, images: [] } : item
            )}
          : space
      ));
    } catch (error) {
      console.error('Failed to add item:', error);
      // 실패 시 임시 항목 제거
      setSpaces(prev => prev.map(space =>
        space.id === spaceId
          ? { ...space, items: space.items.filter(item => item.id !== tempId) }
          : space
      ));
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

  const handleTogglePriority = async (itemId: number) => {
    try {
      const response = await api.put(`/finish-check/items/${itemId}/toggle-priority`);

      setSpaces(spaces.map(space => ({
        ...space,
        items: space.items.map(item =>
          item.id === itemId ? { ...item, is_priority: response.data.is_priority } : item
        )
      })));
    } catch (error) {
      console.error('Failed to toggle priority:', error);
      toast.error('우선순위 변경에 실패했습니다');
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

      {/* 메인 영역 */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        {/* 상단 헤더 */}
        <div className="p-4 border-b border-gray-200">
          {/* 모바일 레이아웃 */}
          {isMobile ? (
            <div className="flex items-center gap-2">
              {/* 프로젝트 선택 */}
              <div className="flex-1">
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    const projectId = e.target.value ? Number(e.target.value) : null;
                    setSelectedProjectId(projectId);
                  }}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                >
                  {user?.name !== '안팀' && <option value="">프로젝트 선택</option>}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 필터 토글 */}
              <button
                onClick={() => setShowOnlyIncomplete(!showOnlyIncomplete)}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  showOnlyIncomplete
                    ? 'bg-gray-800 text-white hover:bg-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={showOnlyIncomplete ? '전체 보기' : '미완료만 보기'}
              >
                {showOnlyIncomplete ? '미완료' : '전체'}
              </button>

              {/* 공간 추가 버튼 */}
              <button
                onClick={() => setShowAddSpaceModal(true)}
                className="p-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center"
                title="공간 추가"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ) : (
            /* 데스크톱 레이아웃 */
            <div className="flex gap-3">
              {/* 프로젝트 선택 */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">프로젝트</label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    const projectId = e.target.value ? Number(e.target.value) : null;
                    setSelectedProjectId(projectId);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                >
                  {user?.name !== '안팀' && <option value="">프로젝트 선택</option>}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 공간 추가 */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">공간 추가</label>
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
                    placeholder="공간 이름 입력"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <button
                    onClick={handleAddSpace}
                    disabled={isAddingSpace}
                    className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center min-w-[44px] disabled:opacity-50"
                    title="공간 추가"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 필터 토글 */}
              <div className="flex items-end">
                <button
                  onClick={() => setShowOnlyIncomplete(!showOnlyIncomplete)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    showOnlyIncomplete
                      ? 'bg-gray-800 text-white hover:bg-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={showOnlyIncomplete ? '전체 보기' : '미완료만 보기'}
                >
                  {showOnlyIncomplete ? '미완료만' : '전체보기'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 전체 마감체크 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {spaces.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              공간을 추가해주세요
            </div>
          ) : (
            <div className="columns-1 portrait:md:columns-2 landscape:md:columns-3 desktop:columns-4 column-gap-4">
              {spaces.map((space, spaceIndex) => {
                const incompleteItems = space.items
                  .filter(item => !item.is_completed)
                  .sort((a, b) => (b.is_priority || 0) - (a.is_priority || 0));
                const completedItems = space.items.filter(item => item.is_completed);

                // 필터링: 미완료만 보기가 활성화되어 있고 미완료 항목이 없으면 건너뛰기
                if (showOnlyIncomplete && incompleteItems.length === 0) return null;

                return (
                  <div key={space.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4 break-inside-avoid">
                    {/* 공간 헤더 */}
                    {editingSpaceId === space.id ? (
                      <div className="flex gap-2 mb-4">
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
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-800 text-white text-xs font-bold rounded-full">
                              {spaceIndex + 1}
                            </span>
                            {space.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {completedItems.length}/{space.items.length} 완료
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (selectedSpaceIdForNewItem === space.id) {
                                setSelectedSpaceIdForNewItem(null);
                                setNewItemContent('');
                              } else {
                                setSelectedSpaceIdForNewItem(space.id);
                              }
                            }}
                            className={`p-1 transition-colors ${
                              selectedSpaceIdForNewItem === space.id
                                ? 'text-gray-900 bg-gray-100 rounded'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                            title="항목 추가"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
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
                            onClick={() => handleDeleteSpace(space.id)}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 항목 추가 입력 폼 */}
                    {selectedSpaceIdForNewItem === space.id && (
                      <div className="mb-4 p-3 bg-white border border-gray-300 rounded-lg">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newItemContent}
                            onChange={(e) => setNewItemContent(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && newItemContent.trim()) {
                                handleAddItem(space.id);
                              }
                            }}
                            placeholder="마감 항목 입력"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddItem(space.id)}
                            disabled={!newItemContent.trim()}
                            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            추가
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 미완료 항목 */}
                    {incompleteItems.length > 0 && (
                      <div className="mb-4">
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

                              <span
                                className={`flex-1 text-sm text-gray-900 ${!isMobile && selectedItemForImages === item.id ? 'font-semibold' : ''}`}
                                onClick={() => !isMobile && setSelectedItemForImages(item.id)}
                                style={{ cursor: !isMobile ? 'pointer' : 'default' }}
                              >
                                {item.content}
                                {item.images && item.images.length > 0 && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({item.images.length})
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedItemForImages(item.id);
                                    if (isMobile) {
                                      setShowMobileImageModal(true);
                                    }
                                  }}
                                  className={`p-1 transition-colors ${
                                    item.images && item.images.length > 0
                                      ? 'text-blue-600 hover:text-blue-800'
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                  title="이미지"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleTogglePriority(item.id)}
                                  className={`p-1 transition-colors ${
                                    item.is_priority
                                      ? 'text-yellow-500 hover:text-yellow-600'
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                  title="우선순위"
                                >
                                  <Star className={`w-4 h-4 ${item.is_priority ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 완료 항목 */}
                    {!showOnlyIncomplete && completedItems.length > 0 && (
                      <div>
                        <div className="space-y-2">
                          {completedItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg opacity-40"
                            >
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleToggleItem(item.id)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 focus:ring-gray-500 cursor-pointer"
                              />

                              <span
                                className={`flex-1 text-sm text-gray-500 line-through ${!isMobile && selectedItemForImages === item.id ? 'font-semibold' : ''}`}
                                onClick={() => !isMobile && setSelectedItemForImages(item.id)}
                                style={{ cursor: !isMobile ? 'pointer' : 'default' }}
                              >
                                {item.content}
                                {item.images && item.images.length > 0 && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({item.images.length})
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedItemForImages(item.id);
                                    if (isMobile) {
                                      setShowMobileImageModal(true);
                                    }
                                  }}
                                  className={`p-1 transition-colors ${
                                    item.images && item.images.length > 0
                                      ? 'text-blue-600 hover:text-blue-800'
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                  title="이미지"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleTogglePriority(item.id)}
                                  className={`p-1 transition-colors ${
                                    item.is_priority
                                      ? 'text-yellow-500 hover:text-yellow-600'
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                  title="우선순위"
                                >
                                  <Star className={`w-4 h-4 ${item.is_priority ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

      {/* 공간 삭제 모달 */}
      {deletingSpaceId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {spaces.find(s => s.id === deletingSpaceId)?.name} - 삭제
                </h3>
                <button
                  onClick={() => {
                    setDeletingSpaceId(null);
                    setSelectedItemsToDelete(new Set());
                  }}
                  className="p-1 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-gray-600 mb-4">
                삭제할 항목을 선택하세요. 선택하지 않은 항목은 유지됩니다.
              </p>
              <div className="space-y-2">
                {spaces
                  .find(s => s.id === deletingSpaceId)
                  ?.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => {
                        const newSet = new Set(selectedItemsToDelete);
                        if (newSet.has(item.id)) {
                          newSet.delete(item.id);
                        } else {
                          newSet.add(item.id);
                        }
                        setSelectedItemsToDelete(newSet);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItemsToDelete.has(item.id)}
                        onChange={() => {}}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 focus:ring-gray-500 cursor-pointer"
                      />
                      <span className={`flex-1 text-sm ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {item.content}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleDeleteSelectedItems}
                disabled={selectedItemsToDelete.size === 0}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                선택 항목 삭제 ({selectedItemsToDelete.size})
              </button>
              <button
                onClick={handleDeleteEntireSpace}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                공간 전체 삭제
              </button>
              <button
                onClick={() => {
                  setDeletingSpaceId(null);
                  setSelectedItemsToDelete(new Set());
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공간 추가 모달 (모바일) */}
      {showAddSpaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg w-full md:max-w-md">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">공간 추가</h3>
                <button
                  onClick={() => {
                    setShowAddSpaceModal(false);
                    setNewSpaceName('');
                  }}
                  className="p-1 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">공간 이름</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newSpaceName.trim()) {
                      handleAddSpace();
                    }
                  }}
                  placeholder="공간 이름 입력"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddSpaceModal(false);
                    setNewSpaceName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleAddSpace}
                  disabled={!newSpaceName.trim() || isAddingSpace}
                  className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingSpace ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinishCheck;
