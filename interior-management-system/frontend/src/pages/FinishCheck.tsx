import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface FinishCheckItem {
  id: number;
  space_id: number;
  content: string;
  is_completed: number;
  completed_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
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

const FinishCheck = () => {
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

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const response = await api.get('/finish-check/spaces');
      setSpaces(response.data);

      // 첫 번째 공간을 자동으로 선택
      if (response.data.length > 0 && !selectedSpaceId) {
        setSelectedSpaceId(response.data[0].id);
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

    try {
      const response = await api.post('/finish-check/spaces', {
        name: newSpaceName.trim()
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
          ? { ...space, items: [...space.items, response.data] }
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
      toast.success('항목이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('항목 삭제에 실패했습니다');
    }
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row gap-4 overflow-hidden">
      {/* 좌측: 공간 목록 */}
      <div className={`w-full md:w-64 lg:w-80 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col ${showMobileItems ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200">
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
                    <h3 className="font-medium text-gray-900">📋 전체 보기</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      모든 공간의 항목 표시
                    </p>
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
                            <span className="flex-1 text-sm text-gray-900">{item.content}</span>
                            <div className="flex items-center gap-1">
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
                            <span className="flex-1 text-sm text-gray-500 line-through">{item.content}</span>
                            <div className="flex items-center gap-1">
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
    </div>
  );
};

export default FinishCheck;
