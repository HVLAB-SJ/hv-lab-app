import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, Edit, ChevronDown, ChevronUp, Upload, ImageIcon, X, Plus, Image as ImageIcon2 } from 'lucide-react';
import AdditionalWorkModal from '../components/AdditionalWorkModal';
import additionalWorkService from '../services/additionalWorkService';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { useDataStore } from '../store/dataStore';

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
  const allFilteredProjects = useFilteredProjects();
  const { constructionPayments } = useDataStore();

  // 공사완료 현장 포함 여부
  const [includeCompleted, setIncludeCompleted] = useState(() => {
    const saved = localStorage.getItem('additionalWork_includeCompleted');
    return saved === 'true';
  });

  // 완료된 프로젝트 필터링
  const filteredProjects = includeCompleted
    ? allFilteredProjects
    : allFilteredProjects.filter(p => p.status !== 'completed');
  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWork[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<AdditionalWork | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [initialProject, setInitialProject] = useState<string | undefined>(undefined);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [workImages, setWorkImages] = useState<Record<string, string[]>>({});
  const [formImages, setFormImages] = useState<string[]>([]); // 좌측 폼의 이미지
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formFileInputRef = useRef<HTMLInputElement>(null); // 폼용 파일 입력
  const [showMobileForm, setShowMobileForm] = useState(false);
  const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 중복 제출 방지

  // 프로젝트별 추가내역 총 합계 계산
  const calculateAdditionalWorkTotal = (projectName: string) => {
    return additionalWorks
      .filter(work => work.project === projectName)
      .reduce((sum, work) => sum + work.amount, 0);
  };

  // 안팀 사용자인 경우 공사대금도 본인 프로젝트만 필터링
  const filteredConstructionPayments = user?.name === '안팀'
    ? constructionPayments.filter(cp => filteredProjects.some(p => p.name === cp.project))
    : constructionPayments;

  // 공사대금 완납된 프로젝트 목록 계산 (공사대금 페이지와 동일한 로직)
  const completedProjects = filteredConstructionPayments
    .filter(cp => {
      const additionalWorkAmount = calculateAdditionalWorkTotal(cp.project);

      // 부가세 계산
      let totalWithVat: number;
      if ((cp as any).vatType === 'amount') {
        totalWithVat = (cp.totalAmount || 0) + ((cp as any).vatAmount || 0);
      } else {
        const vatAmount = (cp.totalAmount || 0) * (((cp as any).vatPercentage ?? 100) / 100) * 0.1;
        totalWithVat = (cp.totalAmount || 0) + vatAmount;
      }

      const totalAmount = totalWithVat + additionalWorkAmount;
      const received = cp.payments?.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0) || 0;
      return totalAmount > 0 && received >= totalAmount;
    })
    .map(cp => cp.project);

  // 입력 폼 상태
  const [formData, setFormData] = useState({
    project: '',
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  useEffect(() => {
    // 모바일에서 접속 시 무한 로딩 방지를 위한 초기 프로젝트 설정
    if (filteredProjects.length > 0 && !formData.project) {
      const lastProject = localStorage.getItem('lastSelectedProject');
      const defaultProject = filteredProjects.find(p => p.name === lastProject)?.name || filteredProjects[0].name;
      setFormData(prev => ({ ...prev, project: defaultProject }));
    }
  }, [filteredProjects]);

  // includeCompleted 설정 저장
  useEffect(() => {
    localStorage.setItem('additionalWork_includeCompleted', String(includeCompleted));
  }, [includeCompleted]);

  // 클립보드 이미지 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    // 텍스트 입력 필드에서 붙여넣기할 때는 무시 (텍스트 붙여넣기 허용)
    const activeElement = document.activeElement;
    const isTextInput = activeElement instanceof HTMLInputElement ||
                        activeElement instanceof HTMLTextAreaElement ||
                        activeElement instanceof HTMLSelectElement;

    if (isTextInput) {
      return; // 텍스트 입력 중에는 이미지 붙여넣기 무시
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;

            if (selectedWorkId) {
              // 내역이 선택된 경우: 우측 이미지 영역에 첨부
              setWorkImages(prev => {
                const currentImages = prev[selectedWorkId] || [];
                const newImages = [...currentImages, base64];

                // 서버에 이미지 저장 (최신 상태 사용)
                saveImagesToWork(selectedWorkId, newImages);

                return {
                  ...prev,
                  [selectedWorkId]: newImages
                };
              });
            } else {
              // 내역이 선택되지 않은 경우: 좌측 폼에 첨부
              setFormImages(prev => [...prev, base64]);
            }

            toast.success('이미지가 첨부되었습니다');
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, [selectedWorkId]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // localStorage에서 이미지 로드
  useEffect(() => {
    const savedImages = localStorage.getItem('additionalWorkImages');
    if (savedImages) {
      setWorkImages(JSON.parse(savedImages));
    }
  }, []);

  // workImages가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('additionalWorkImages', JSON.stringify(workImages));
  }, [workImages]);

  // 헤더의 + 버튼 클릭 이벤트 처리
  useEffect(() => {
    const handleHeaderAddClick = () => {
      setShowMobileForm(prev => {
        const newState = !prev;
        // Layout에 상태 변경 알림
        window.dispatchEvent(new CustomEvent('mobileFormStateChange', { detail: { isOpen: newState } }));
        return newState;
      });
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddClick);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddClick);
  }, []);

  // showMobileForm 상태 변경 시 Layout에 알림
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mobileFormStateChange', { detail: { isOpen: showMobileForm } }));
  }, [showMobileForm]);

  // 이미지 저장 함수
  const saveImagesToWork = async (workId: string, images: string[]) => {
    try {
      await additionalWorkService.updateAdditionalWork(workId, { images });
    } catch (error) {
      console.error('Failed to save images:', error);
    }
  };

  // 이미지 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!selectedWorkId) {
      toast.error('먼저 추가내역을 선택해주세요');
      return;
    }

    files.forEach(file => {
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
      toast.success('이미지가 첨부되었습니다');
    }
  };

  // 이미지 삭제
  const handleDeleteImage = (workId: string, imageIndex: number) => {
    setWorkImages(prev => ({
      ...prev,
      [workId]: (prev[workId] || []).filter((_, i) => i !== imageIndex)
    }));
    toast.success('이미지가 삭제되었습니다');

    // 서버에서도 삭제
    const updatedImages = (workImages[workId] || []).filter((_, i) => i !== imageIndex);
    saveImagesToWork(workId, updatedImages);
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
        notes: work.notes,
        images: work.images || []
      })));

      // 서버에서 이미지 데이터 로드
      const imageData: Record<string, string[]> = {};
      filteredWorks.forEach(work => {
        if (work.images && work.images.length > 0) {
          imageData[work._id] = work.images;
        }
      });
      setWorkImages(imageData);
    } catch (error) {
      console.error('Failed to load additional works:', error);
      setAdditionalWorks([]);
    }
  };

  useEffect(() => {
    loadAdditionalWorks();
  }, []);

  const handleEdit = (work: AdditionalWork) => {
    setSelectedWork(work);
    setInitialProject(work.project);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('이 추가내역을 삭제하시겠습니까?')) {
      try {
        await additionalWorkService.deleteAdditionalWork(id);
        await loadAdditionalWorks();
        toast.success('추가내역이 삭제되었습니다');
        if (selectedWorkId === id) {
          setSelectedWorkId(null);
        }
      } catch (error) {
        console.error('Failed to delete additional work:', error);
        toast.error('추가내역 삭제에 실패했습니다');
      }
    }
  };

  const handleModalClose = async (saved?: boolean) => {
    setIsModalOpen(false);
    setSelectedWork(null);
    setInitialProject(undefined);
    if (saved) {
      await loadAdditionalWorks();
    }
  };

  // 모달에서 저장 시 호출되는 함수
  const handleModalSave = async (data: {
    project: string;
    description: string;
    amount: number;
    date: Date;
    notes?: string;
    images?: string[];
  }) => {
    try {
      if (selectedWork) {
        // 수정
        await additionalWorkService.updateAdditionalWork(selectedWork.id, {
          project: data.project,
          description: data.description,
          amount: data.amount,
          date: data.date,
          notes: data.notes,
          images: data.images
        });
        toast.success('추가내역이 수정되었습니다');
      } else {
        // 새로 등록
        await additionalWorkService.createAdditionalWork({
          project: data.project,
          description: data.description,
          amount: data.amount,
          date: data.date,
          notes: data.notes,
          images: data.images
        });
        toast.success('추가내역이 등록되었습니다');
      }
      handleModalClose(true);
    } catch (error) {
      console.error('추가내역 저장 실패:', error);
      toast.error('추가내역 저장에 실패했습니다');
      throw error;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 중복 제출 방지
    if (isSubmitting) return;

    if (!formData.project || !formData.description || !formData.amount || !formData.date) {
      toast.error('모든 필수 항목을 입력해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      const newWork = await additionalWorkService.createAdditionalWork({
        project: formData.project,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date),
        images: formImages  // 폼 이미지 포함
      });

      toast.success('추가내역이 등록되었습니다');

      // 폼 초기화 (프로젝트는 유지)
      setFormData(prev => ({
        ...prev,
        description: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      }));
      setFormImages([]); // 폼 이미지 초기화

      // 목록 새로고침
      await loadAdditionalWorks();

      // 새로 생성된 내역의 이미지를 workImages에도 저장
      if (formImages.length > 0 && newWork._id) {
        setWorkImages(prev => ({
          ...prev,
          [newWork._id]: formImages
        }));
      }

      // localStorage에 마지막 선택 프로젝트 저장
      localStorage.setItem('lastSelectedProject', formData.project);
    } catch (error) {
      console.error('Failed to create additional work:', error);
      toast.error('추가내역 등록에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredWorks = additionalWorks.filter(work => {
    // 미납: completedProjects에 없는 것, 완납: completedProjects에 있는 것
    const isCompleted = completedProjects.includes(work.project);
    return showOnlyCompleted ? isCompleted : !isCompleted;
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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 태블릿/데스크톱 3열 레이아웃 */}
      <div className="additional-work-container hidden desktop:grid desktop:gap-4 2xl:gap-6 desktop:grid-cols-12">
        {/* 왼쪽: 추가내역 등록 폼 */}
        <div className="additional-work-form md:col-span-4 lg:col-span-4 bg-white border border-gray-200 rounded-lg p-4 md:p-5 lg:p-6 h-fit sticky top-4">
          <div className="aw-form-inner space-y-4">
            {/* 프로젝트 선택 */}
            <div className="aw-project space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                프로젝트 *
              </label>
              <select
                value={formData.project}
                onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white"
              >
                {user?.name !== '안팀' && <option value="">선택하세요</option>}
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                />
                공사완료 현장 포함
              </label>
            </div>

            {/* 일자 */}
            <div className="aw-date">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                일자 *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* 내용 */}
            <div className="aw-description">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                내용 *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={5}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                placeholder="추가내역 내용을 입력하세요"
              />
            </div>

            {/* 금액 */}
            <div className="aw-amount">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                금액 *
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0"
              />
            </div>

            {/* 이미지 첨부 */}
            <div className="aw-images">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이미지 첨부
                <span className="text-xs text-gray-500 ml-2">(Ctrl+V로 붙여넣기 가능)</span>
              </label>
              <div className="space-y-2">
                <input
                  ref={formFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
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
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => formFileInputRef.current?.click()}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  이미지 첨부
                </button>
                {formImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {formImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`첨부 ${idx + 1}`}
                          className="w-full h-20 object-cover rounded cursor-pointer"
                          onClick={() => handleImageClick(img)}
                        />
                        <button
                          type="button"
                          onClick={() => setFormImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 등록 버튼 */}
            <button
              onClick={handleFormSubmit}
              disabled={isSubmitting}
              className="aw-submit w-full py-3.5 bg-gray-900 text-white text-base font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '등록 중...' : '추가내역 등록'}
            </button>
          </div>
        </div>

        {/* 중간: 추가내역 목록 */}
        <div className="additional-work-list md:col-span-4 lg:col-span-5 flex flex-col h-[calc(100vh-120px)]">
          {/* 미납/완납 탭 및 검색 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex-shrink-0">
            <div className="space-y-4">
              {/* 미납/완납 탭 */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setShowOnlyCompleted(false)}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    !showOnlyCompleted
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  미납 ({projectGroups.filter(g => !completedProjects.includes(g.projectName)).length})
                </button>
                <button
                  onClick={() => setShowOnlyCompleted(true)}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    showOnlyCompleted
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  완납 ({completedProjects.length})
                </button>
              </div>
            </div>
          </div>

          {/* 프로젝트별 추가내역 */}
          <div className="space-y-4 flex-1 overflow-y-auto mt-3 pr-1">
            {projectGroups.map(group => (
              <div key={group.projectName} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div
                  className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between cursor-pointer bg-gray-100 hover:bg-gray-200"
                  onClick={() => toggleProject(group.projectName)}
                >
                  <div className="flex items-center gap-3">
                    {expandedProjects.has(group.projectName) ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                    <h3 className="text-base font-semibold text-gray-900">{group.projectName}</h3>
                    <span className="text-sm text-gray-500">({group.works.length})</span>
                  </div>
                  <span className="text-base font-bold text-gray-900">
                    {group.totalAmount.toLocaleString()}원
                  </span>
                </div>

                {expandedProjects.has(group.projectName) && (
                  <div className="divide-y divide-gray-100">
                    {group.works.map(work => (
                      <div
                        key={work.id}
                        className={`px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedWorkId === work.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                        onClick={() => setSelectedWorkId(work.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-base text-gray-900 line-clamp-2">{work.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-sm text-gray-500">
                                {format(work.date, 'yyyy.MM.dd')}
                              </span>
                              {workImages[work.id]?.length > 0 && (
                                <span className="text-sm text-blue-600 flex items-center gap-1">
                                  <ImageIcon2 className="h-4 w-4" />
                                  {workImages[work.id].length}
                                </span>
                              )}
                            </div>
                            {work.notes && (
                              <p className="text-sm text-gray-500 mt-2">{work.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <span className="text-base font-semibold text-gray-900">
                              {work.amount.toLocaleString()}원
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(work);
                                }}
                                className="p-1.5 text-gray-500 hover:text-gray-700"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(work.id);
                                }}
                                className="p-1.5 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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

        {/* 오른쪽: 선택된 항목의 이미지 */}
        <div className="additional-work-images md:col-span-4 lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 lg:p-6 h-[calc(100vh-120px)] overflow-y-auto">
          {selectedWorkId ? (
            <div>
              <div className="flex items-center justify-between mb-5 sticky top-0 bg-white pb-2">
                <h3 className="text-base font-semibold text-gray-900">이미지 관리</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    Ctrl+V로 이미지 붙여넣기
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="work-image-upload"
                  />
                  <label
                    htmlFor="work-image-upload"
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Upload className="h-4 w-4" />
                    이미지 첨부
                  </label>
                </div>
              </div>

              {workImages[selectedWorkId]?.length > 0 ? (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {workImages[selectedWorkId].map((image, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={image}
                        alt={`이미지 ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-lg cursor-pointer"
                        onClick={() => handleImageClick(image)}
                      />
                      <button
                        onClick={() => handleDeleteImage(selectedWorkId, idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <ImageIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-base">이미지가 없습니다</p>
                  <p className="text-sm mt-2">
                    이미지를 업로드하거나 Ctrl+V로 붙여넣기
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <ImageIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <p className="text-base">추가내역을 선택하세요</p>
              <p className="text-sm mt-2">선택한 항목의 이미지를 관리할 수 있습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 레이아웃 */}
      <div className="desktop:hidden space-y-3">
        {/* 추가내역 등록 폼 */}
        {showMobileForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="space-y-3">
              {/* 프로젝트 선택 */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  프로젝트 *
                </label>
                <select
                  value={formData.project}
                  onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white"
                >
                  {user?.name !== '안팀' && <option value="">선택하세요</option>}
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCompleted}
                    onChange={(e) => setIncludeCompleted(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                  />
                  공사완료 현장 포함
                </label>
              </div>

              {/* 일자 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  일자 *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  내용 *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                  placeholder="추가내역 내용을 입력하세요"
                />
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  금액 *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white"
                  placeholder="0"
                />
              </div>

              {/* 등록 버튼 */}
              <button
                onClick={handleFormSubmit}
                disabled={isSubmitting}
                className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '등록 중...' : '추가내역 등록'}
              </button>
            </div>
          </div>
        )}

        {/* 미납/완납 탭 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setShowOnlyCompleted(false)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
              !showOnlyCompleted
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500'
            }`}
          >
            미납 ({additionalWorks.filter(w => !completedProjects.includes(w.project)).length > 0 ? projectGroups.filter(g => !completedProjects.includes(g.projectName)).length : 0})
          </button>
          <button
            onClick={() => setShowOnlyCompleted(true)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
              showOnlyCompleted
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500'
            }`}
          >
            완납 ({completedProjects.length})
          </button>
        </div>

        {/* 프로젝트별 추가내역 */}
        {projectGroups.map(group => (
          <div key={group.projectName} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div
              className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-100"
              onClick={() => toggleProject(group.projectName)}
            >
              <div className="flex items-center gap-2">
                {expandedProjects.has(group.projectName) ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
                <h3 className="font-semibold text-gray-900">{group.projectName}</h3>
                <span className="text-sm text-gray-500">({group.works.length})</span>
              </div>
              <span className="font-bold text-gray-900">
                {group.totalAmount.toLocaleString()}원
              </span>
            </div>

            {expandedProjects.has(group.projectName) && (
              <div className="divide-y divide-gray-100">
                {group.works.map(work => (
                  <div key={work.id} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{work.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(work.date, 'yyyy.MM.dd', { locale: ko })}
                        </p>
                        {work.notes && (
                          <p className="text-xs text-gray-500 mt-1">{work.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="font-semibold text-gray-900">
                          {work.amount.toLocaleString()}원
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(work)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(work.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

      </div>

      {/* 수정/추가 모달 */}
      {isModalOpen && (
        <AdditionalWorkModal
          work={selectedWork}
          onClose={() => handleModalClose(false)}
          onSave={handleModalSave}
          initialProject={initialProject}
        />
      )}

      {/* 이미지 확대 모달 */}
      {showImageModal && modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={modalImage}
              alt="확대 이미지"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdditionalWork;