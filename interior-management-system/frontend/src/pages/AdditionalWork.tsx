import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, Edit, ChevronDown, ChevronUp, Upload, ImageIcon, X, Plus, Image as ImageIcon2 } from 'lucide-react';
import AdditionalWorkModal from '../components/AdditionalWorkModal';
import additionalWorkService from '../services/additionalWorkService';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';

interface AdditionalWork {
  id: string;
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
  images?: string[];
}

interface ProjectGroup {
  projectName: string;
  works: AdditionalWork[];
  totalAmount: number;
}

const AdditionalWork = () => {
  const { user } = useAuth();
  const filteredProjects = useFilteredProjects();
  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWork[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<AdditionalWork | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [initialProject, setInitialProject] = useState<string | undefined>(undefined);

  // 입력 폼 상태
  const [formData, setFormData] = useState({
    project: '',
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [formImages, setFormImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingForm, setIsDraggingForm] = useState(false);

  // 이미지 관련 상태
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [workImages, setWorkImages] = useState<Record<string, string[]>>(() => {
    const stored = localStorage.getItem('additionalWorkImages');
    return stored ? JSON.parse(stored) : {};
  });
  const [isDragging, setIsDragging] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Load additional works from API on mount
  useEffect(() => {
    loadAdditionalWorks();
  }, []);

  // 안팀 사용자에게 프로젝트 자동 선택
  useEffect(() => {
    if (user?.name === '안팀' && filteredProjects.length > 0 && !formData.project) {
      setFormData(prev => ({
        ...prev,
        project: filteredProjects[0].name
      }));
    }
  }, [user, filteredProjects]);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      handleAddWork();
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

  // 이미지를 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('additionalWorkImages', JSON.stringify(workImages));
  }, [workImages]);

  // 클립보드 붙여넣기 통합 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 선택된 추가내역이 있으면 그쪽으로, 없으면 폼으로
    if (selectedWorkId) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setWorkImages(prev => ({
                ...prev,
                [selectedWorkId]: [...(prev[selectedWorkId] || []), base64]
              }));
              toast.success('이미지가 추가되었습니다');
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    } else {
      // 폼에 이미지 추가
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setFormImages(prev => [...prev, base64]);
              toast.success('등록 폼에 이미지가 추가되었습니다');
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    }
  }, [selectedWorkId]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // 드래그 앤 드롭 처리
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!selectedWorkId) {
      toast.error('먼저 추가내역을 선택해주세요');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setWorkImages(prev => ({
            ...prev,
            [selectedWorkId]: [...(prev[selectedWorkId] || []), base64]
          }));
        };
        reader.readAsDataURL(file);
      }
    });

    if (files.some(f => f.type.startsWith('image/'))) {
      toast.success('이미지가 추가되었습니다');
    }
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedWorkId) {
      toast.error('먼저 추가내역을 선택해주세요');
      return;
    }

    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setWorkImages(prev => ({
            ...prev,
            [selectedWorkId]: [...(prev[selectedWorkId] || []), base64]
          }));
        };
        reader.readAsDataURL(file);
      }
    });

    if (files.length > 0) {
      toast.success('이미지가 추가되었습니다');
    }
  };

  // 이미지 삭제
  const handleDeleteImage = (workId: string, imageIndex: number) => {
    setWorkImages(prev => ({
      ...prev,
      [workId]: (prev[workId] || []).filter((_, i) => i !== imageIndex)
    }));
    toast.success('이미지가 삭제되었습니다');
  };

  // 폼 이미지 처리 함수들
  const handleFormDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingForm(true);
  };

  const handleFormDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingForm(false);
  };

  const handleFormDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingForm(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setFormImages(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      }
    });

    if (files.some(f => f.type.startsWith('image/'))) {
      toast.success(`${files.filter(f => f.type.startsWith('image/')).length}개의 이미지가 추가되었습니다`);
    }
  };

  const handleFormFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setFormImages(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      }
    });

    if (files.length > 0) {
      toast.success(`${files.length}개의 이미지가 추가되었습니다`);
    }

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFormImage = (index: number) => {
    setFormImages(prev => prev.filter((_, i) => i !== index));
    toast.success('이미지가 삭제되었습니다');
  };

  // 이미지 클릭 시 모달 열기
  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
    setShowImageModal(true);
  };

  const loadAdditionalWorks = async () => {
    try {
      const works = await additionalWorkService.getAllAdditionalWorks();

      // 안팀 사용자인 경우 필터링
      const filteredProjectNames = filteredProjects.map(p => p.name);
      const filteredWorks = user?.name === '안팀'
        ? works.filter(work => filteredProjectNames.includes(work.project))
        : works;

      setAdditionalWorks(filteredWorks.map(work => ({
        id: work._id,
        project: work.project,
        description: work.description,
        amount: work.amount,
        date: new Date(work.date),
        notes: work.notes
      })));
    } catch (error) {
      console.error('Failed to load additional works:', error);
      toast.error('추가내역 데이터를 불러오는데 실패했습니다');
    }
  };

  const handleAddWork = (projectName?: string) => {
    setSelectedWork(null);
    setInitialProject(projectName);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setInitialProject(undefined);
  };

  const handleEditWork = (work: AdditionalWork) => {
    setSelectedWork(work);
    setInitialProject(undefined);
    setIsModalOpen(true);
  };

  const handleDeleteWork = async (id: string, projectName: string) => {
    if (window.confirm(`"${projectName}" 추가내역을 삭제하시겠습니까?\n\n삭제된 내역은 복구할 수 없습니다.`)) {
      try {
        await additionalWorkService.deleteAdditionalWork(id);
        await loadAdditionalWorks();
        toast.success('추가내역이 삭제되었습니다');
      } catch (error) {
        console.error('Failed to delete additional work:', error);
        toast.error('추가내역 삭제에 실패했습니다');
      }
    }
  };

  const handleSaveWork = async (data: Partial<AdditionalWork>) => {
    try {
      if (selectedWork) {
        await additionalWorkService.updateAdditionalWork(selectedWork.id, data);
        toast.success('추가내역이 수정되었습니다');
      } else {
        await additionalWorkService.createAdditionalWork(data);
        toast.success('추가내역이 추가되었습니다');
      }
      await loadAdditionalWorks();
      setIsModalOpen(false);
      setInitialProject(undefined);
    } catch (error) {
      console.error('Failed to save additional work:', error);
      toast.error('추가내역 저장에 실패했습니다');
    }
  };

  // 폼 제출 처리
  const handleSubmitForm = async () => {
    // 유효성 검사
    if (!formData.project) {
      toast.error('프로젝트를 선택하세요');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('내용을 입력하세요');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('금액을 입력하세요');
      return;
    }
    if (!formData.date) {
      toast.error('일자를 선택하세요');
      return;
    }

    try {
      const data = {
        project: formData.project,
        description: formData.description.trim(),
        amount: Number(formData.amount),
        date: new Date(formData.date),
        notes: formData.notes.trim(),
        images: formImages
      };

      await additionalWorkService.createAdditionalWork(data);
      toast.success('추가내역이 등록되었습니다');

      // 폼 초기화 (프로젝트는 유지)
      setFormData(prev => ({
        ...prev,
        description: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      }));
      setFormImages([]);

      // 목록 새로고침
      await loadAdditionalWorks();
    } catch (error) {
      console.error('Failed to submit additional work:', error);
      toast.error('추가내역 등록에 실패했습니다');
    }
  };

  const filteredWorks = additionalWorks.filter(work => {
    const matchesSearch = (work.project?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (work.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // 프로젝트별로 그룹핑
  const projectGroups: ProjectGroup[] = filteredWorks.reduce((groups, work) => {
    const existingGroup = groups.find(g => g.projectName === work.project);
    if (existingGroup) {
      existingGroup.works.push(work);
      existingGroup.totalAmount += work.amount;
    } else {
      groups.push({
        projectName: work.project,
        works: [work],
        totalAmount: work.amount
      });
    }
    return groups;
  }, [] as ProjectGroup[]);

  // 프로젝트명으로 정렬
  projectGroups.sort((a, b) => a.projectName.localeCompare(b.projectName));

  // 각 프로젝트 내 작업은 날짜순 정렬 (최신순)
  projectGroups.forEach(group => {
    group.works.sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  // 모든 프로젝트를 자동으로 펼침
  useEffect(() => {
    const allProjectNames = new Set(projectGroups.map(g => g.projectName));
    setExpandedProjects(allProjectNames);
  }, [filteredWorks.length]);

  const toggleProject = (projectName: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  const totalAmount = projectGroups.reduce((sum, group) => sum + group.totalAmount, 0);

  return (
    <div className="space-y-3 md:space-y-4">
      {/* 데스크톱 2열 레이아웃 */}
      <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: '400px 1fr' }}>
        {/* 왼쪽: 추가내역 등록 폼 (400px 고정 너비) */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 h-fit sticky top-4" style={{ maxWidth: '400px' }}>

          <div className="space-y-4">
            {/* 프로젝트 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트 *
              </label>
              <select
                value={formData.project}
                onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {user?.name !== '안팀' && <option value="">선택하세요</option>}
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 일자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                일자 *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                내용 *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="추가 공사 내용을 입력하세요"
              />
            </div>

            {/* 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                금액 (원) *
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="예: 500000"
              />
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비고
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="추가 메모 (선택사항)"
              />
            </div>

            {/* 이미지 업로드 영역 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                증빙 이미지
              </label>

              {/* 이미지 미리보기 */}
              {formImages.length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                {formImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`증빙 ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => handleImageClick(img)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFormImage(index)}
                      className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                </div>
              )}

              <div
                className={`border-2 border-dashed rounded-lg p-3 transition-colors ${
                  isDraggingForm ? 'border-gray-500 bg-gray-50' : 'border-gray-300'
                }`}
                onDragOver={handleFormDragOver}
                onDragLeave={handleFormDragLeave}
                onDrop={handleFormDrop}
              >
                <div className="text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFormFileSelect}
                    className="hidden"
                    id="form-file-upload"
                  />
                  <label
                    htmlFor="form-file-upload"
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    이미지 선택
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    드래그 또는 Ctrl+V로 붙여넣기
                  </p>
                </div>
              </div>
            </div>

            {/* 등록 버튼 */}
            <div className="pt-2">
              <button
                onClick={handleSubmitForm}
                className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
              >
                추가내역 등록
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 기존 추가내역 목록 */}
        <div className="flex-1 space-y-4">
          {/* 검색 */}
          <input
            type="text"
            placeholder="기존 추가내역 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
          />

          {/* Total Summary */}
          {projectGroups.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 추가내역 합계</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{totalAmount.toLocaleString()}원</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{projectGroups.length}개 프로젝트</p>
                  <p className="text-sm text-gray-600">{filteredWorks.length}건</p>
                </div>
              </div>
            </div>
          )}

          {/* 프로젝트별 추가내역 목록 */}
          <div className="space-y-3">
            {projectGroups.map((group) => (
              <div key={group.projectName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Project Header */}
                <div className="w-full px-4 py-3 flex items-center justify-between bg-gray-50">
                  <button
                    onClick={() => toggleProject(group.projectName)}
                    className="flex-1 text-left hover:bg-gray-100 transition-colors -m-3 p-3 rounded"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.projectName}</h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {group.works.length}건 · {group.totalAmount.toLocaleString()}원
                        </p>
                      </div>
                      {expandedProjects.has(group.projectName) ? (
                        <ChevronUp className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                  </button>
                </div>

                {/* Project Works */}
                {expandedProjects.has(group.projectName) && (
                  <div className="divide-y divide-gray-200">
                    {group.works.map((work) => (
                      <div key={work.id} className="p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 mr-3">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-sm text-gray-600">
                                {format(work.date, 'MM.dd', { locale: ko })}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {work.amount.toLocaleString()}원
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{work.description}</p>
                            {work.notes && (
                              <p className="text-xs text-gray-500 mt-1">{work.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleEditWork(work)}
                              className="text-gray-500 hover:text-gray-700 p-1"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteWork(work.id, work.project)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {projectGroups.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-white border border-gray-200 rounded-lg">
                추가내역이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일용 폼과 목록 */}
      <div className="md:hidden space-y-4">
        {/* 모바일 입력 폼 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">프로젝트 *</label>
              <select
                value={formData.project}
                onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {user?.name !== '안팀' && <option value="">선택하세요</option>}
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">일자 *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">금액 *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="금액"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">내용 *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="추가 공사 내용"
              />
            </div>

            <button
              onClick={handleSubmitForm}
              className="w-full py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium"
            >
              추가내역 등록
            </button>
          </div>
        </div>

        {/* 모바일 검색 및 목록 */}
        <input
          type="text"
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />

        {/* 모바일 프로젝트별 목록 */}
        <div className="space-y-3">
          {projectGroups.map((group) => (
            <div key={group.projectName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-50" onClick={() => toggleProject(group.projectName)}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.projectName}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {group.works.length}건 · {group.totalAmount.toLocaleString()}원
                    </p>
                  </div>
                  {expandedProjects.has(group.projectName) ? (
                    <ChevronUp className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600" />
                  )}
                </div>
              </div>

              {expandedProjects.has(group.projectName) && (
                <div className="divide-y divide-gray-200">
                  {group.works.map((work) => (
                    <div key={work.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 mr-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-600">
                              {format(work.date, 'MM.dd', { locale: ko })}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {work.amount.toLocaleString()}원
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{work.description}</p>
                          {work.notes && (
                            <p className="text-xs text-gray-500 mt-1">{work.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditWork(work)}
                            className="text-gray-500 p-1"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteWork(work.id, work.project)}
                            className="text-rose-500 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Additional Work Modal */}
      {isModalOpen && (
        <AdditionalWorkModal
          work={selectedWork}
          onClose={handleCloseModal}
          onSave={handleSaveWork}
          initialProject={initialProject}
        />
      )}

      {/* Image Modal */}
      {showImageModal && modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <X className="h-6 w-6 text-gray-700" />
            </button>
            <img
              src={modalImage}
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

export default AdditionalWork;