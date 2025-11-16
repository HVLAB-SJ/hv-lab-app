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
      {/* 입력 폼 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">추가내역 등록</h3>

        <div className="space-y-4">
          {/* 첫째 줄: 프로젝트, 날짜 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* 둘째 줄: 내용 */}
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

          {/* 셋째 줄: 금액, 비고 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* 이미지 업로드 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              증빙 이미지 (Ctrl+V로 붙여넣기 가능)
            </label>

            {/* 이미지 미리보기 */}
            {formImages.length > 0 && (
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {formImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`증빙 ${index + 1}`}
                      className="w-full h-24 md:h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => handleImageClick(img)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFormImage(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                isDraggingForm ? 'border-gray-500 bg-gray-50' : 'border-gray-300'
              }`}
              onDragOver={handleFormDragOver}
              onDragLeave={handleFormDragLeave}
              onDrop={handleFormDrop}
            >
              <div className="text-center">
                <ImageIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  이미지를 드래그하여 놓거나 클릭하여 선택하세요
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  또는 Ctrl+V로 클립보드 이미지 붙여넣기
                </p>
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
                  className="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  파일 선택
                </label>
              </div>
            </div>
          </div>

          {/* 등록 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmitForm}
              className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
            >
              추가내역 등록
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="기존 추가내역 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
        />
      </div>

      {/* Total Summary */}
      {projectGroups.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm md:text-base text-gray-600">전체 추가내역 합계</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{totalAmount.toLocaleString()}원</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{projectGroups.length}개 프로젝트</p>
              <p className="text-sm text-gray-600">{filteredWorks.length}건</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Card View - Grouped by Project */}
      <div className="md:hidden space-y-4">
        {projectGroups.map((group) => (
          <div key={group.projectName} className="card overflow-hidden">
            {/* Project Header */}
            <div className="w-full p-4 flex items-center justify-between bg-gray-50">
              <button
                onClick={() => toggleProject(group.projectName)}
                className="flex-1 text-left hover:bg-gray-100 transition-colors -m-4 p-4 rounded-l"
              >
                <h3 className="font-bold text-base text-gray-900">{group.projectName}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {group.works.length}건 · {group.totalAmount.toLocaleString()}원
                </p>
              </button>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddWork(group.projectName);
                  }}
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                  title="이 프로젝트에 추가내역 등록"
                >
                  <Plus className="h-4 w-4 text-gray-600" />
                </button>
                {expandedProjects.has(group.projectName) ? (
                  <ChevronUp className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                )}
              </div>
            </div>

            {/* Project Works */}
            {expandedProjects.has(group.projectName) && (
              <div className="divide-y divide-gray-200">
                {group.works.map((work) => (
                  <div key={work.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-gray-600">{format(work.date, 'yyyy.MM.dd (eee)', { locale: ko })}</p>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditWork(work)}
                          className="text-gray-600 hover:text-gray-700 p-1"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWork(work.id, work.project)}
                          className="text-rose-600 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">내용</p>
                        <p className="text-sm text-gray-900">{work.description}</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">금액</p>
                        <p className="text-sm text-gray-900 font-medium">{work.amount.toLocaleString()}원</p>
                      </div>

                      {work.notes && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">비고</p>
                          <p className="text-sm text-gray-900">{work.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {projectGroups.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            추가내역이 없습니다
          </div>
        )}
      </div>

      {/* Desktop View - 3 Column Grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {/* 첫 번째, 두 번째 열: 프로젝트 목록 (2열로 나눔) */}
        {(() => {
          // 프로젝트를 2개씩 나눔
          const midPoint = Math.ceil(projectGroups.length / 2);
          const firstHalf = projectGroups.slice(0, midPoint);
          const secondHalf = projectGroups.slice(midPoint);

          return (
            <>
              {/* 첫 번째 열 - 첫 번째 절반 */}
              <div className="space-y-4">
                {firstHalf.map((group) => (
                  <div key={group.projectName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Project Header */}
                    <div className="w-full px-4 py-3 flex items-center justify-between bg-gray-50">
                      <button
                        onClick={() => toggleProject(group.projectName)}
                        className="flex-1 flex items-center justify-between hover:bg-gray-100 transition-colors -m-3 p-3 rounded-l"
                      >
                        <h3 className="font-bold text-lg text-gray-900 truncate flex-1 text-left mr-3">{group.projectName}</h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <p className="text-base font-semibold text-gray-700">
                            {group.works.length}건 {group.totalAmount.toLocaleString()}원
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddWork(group.projectName);
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                          title="이 프로젝트에 추가내역 등록"
                        >
                          <Plus className="h-4 w-4 text-gray-600" />
                        </button>
                        {expandedProjects.has(group.projectName) ? (
                          <ChevronUp className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                    </div>

                    {/* Project Works List */}
                    {expandedProjects.has(group.projectName) && (
                      <div className="divide-y divide-gray-200">
                        {group.works.map((work) => (
                          <div
                            key={work.id}
                            onClick={() => setSelectedWorkId(work.id)}
                            className={`p-4 cursor-pointer transition-colors ${
                              selectedWorkId === work.id
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <p className="text-sm text-gray-600 flex-shrink-0">{format(work.date, 'MM.dd (eee)', { locale: ko })}</p>
                              <p className="text-base text-gray-900 font-medium flex-1 truncate">{work.description}</p>
                              <p className="text-base font-semibold text-gray-900 flex-shrink-0 mr-2">{work.amount.toLocaleString()}원</p>
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditWork(work);
                                  }}
                                  className="text-gray-600 hover:text-gray-700 transition-colors p-1"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWork(work.id, work.project);
                                  }}
                                  className="text-rose-600 hover:text-rose-700 transition-colors p-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {work.notes && (
                              <p className="text-sm text-gray-600 mt-2">{work.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {firstHalf.length === 0 && projectGroups.length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-white border border-gray-200 rounded-lg">
                    추가내역이 없습니다
                  </div>
                )}
              </div>

              {/* 두 번째 열 - 두 번째 절반 */}
              <div className="space-y-4">
                {secondHalf.map((group) => (
                  <div key={group.projectName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Project Header */}
                    <div className="w-full px-4 py-3 flex items-center justify-between bg-gray-50">
                      <button
                        onClick={() => toggleProject(group.projectName)}
                        className="flex-1 flex items-center justify-between hover:bg-gray-100 transition-colors -m-3 p-3 rounded-l"
                      >
                        <h3 className="font-bold text-lg text-gray-900 truncate flex-1 text-left mr-3">{group.projectName}</h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <p className="text-base font-semibold text-gray-700">
                            {group.works.length}건 {group.totalAmount.toLocaleString()}원
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddWork(group.projectName);
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                          title="이 프로젝트에 추가내역 등록"
                        >
                          <Plus className="h-4 w-4 text-gray-600" />
                        </button>
                        {expandedProjects.has(group.projectName) ? (
                          <ChevronUp className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                    </div>

                    {/* Project Works List */}
                    {expandedProjects.has(group.projectName) && (
                      <div className="divide-y divide-gray-200">
                        {group.works.map((work) => (
                          <div
                            key={work.id}
                            onClick={() => setSelectedWorkId(work.id)}
                            className={`p-4 cursor-pointer transition-colors ${
                              selectedWorkId === work.id
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <p className="text-sm text-gray-600 flex-shrink-0">{format(work.date, 'MM.dd (eee)', { locale: ko })}</p>
                              <p className="text-base text-gray-900 font-medium flex-1 truncate">{work.description}</p>
                              <p className="text-base font-semibold text-gray-900 flex-shrink-0 mr-2">{work.amount.toLocaleString()}원</p>
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditWork(work);
                                  }}
                                  className="text-gray-600 hover:text-gray-700 transition-colors p-1"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWork(work.id, work.project);
                                  }}
                                  className="text-rose-600 hover:text-rose-700 transition-colors p-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {work.notes && (
                              <p className="text-sm text-gray-600 mt-2">{work.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {/* 세 번째 열: 이미지 업로드 영역 (여러 장, 스크롤) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4">이미지</h3>

          {selectedWorkId ? (
            <div>
              {/* 이미지 업로드 영역 */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  id="image-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 업로드된 이미지들 (스크롤) */}
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {workImages[selectedWorkId]?.map((image, index) => {
                    if (index === 1) return null;
                    return (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`추가내역 이미지 ${index + 1}`}
                          onClick={() => handleImageClick(image)}
                          className="w-full h-auto object-contain cursor-pointer rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={() => handleDeleteImage(selectedWorkId, index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}

                  {/* 이미지 추가 버튼 */}
                  <label
                    htmlFor="image-file-input"
                    className="block cursor-pointer"
                  >
                    <div
                      className={`w-full min-h-[200px] border-2 border-dashed rounded-lg p-6 text-center transition-colors flex flex-col items-center justify-center ${
                        isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-700">
                        {workImages[selectedWorkId]?.length > 0 ? '이미지 추가' : '클릭하여 선택'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">또는 이미지를 드래그하거나 Ctrl+V로 붙여넣기</p>
                      {workImages[selectedWorkId]?.length > 0 && (
                        <p className="text-xs text-blue-600 mt-2 font-medium">
                          현재 {workImages[selectedWorkId].length}장
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center">
              <div className="text-center text-gray-400">
                <ImageIcon className="h-16 w-16 mx-auto mb-4" />
                <p className="text-lg font-medium">추가내역을 선택하세요</p>
                <p className="text-sm mt-2">선택하면 이미지를 업로드할 수 있습니다</p>
              </div>
            </div>
          )}
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
