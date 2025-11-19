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
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [initialProject, setInitialProject] = useState<string | undefined>(undefined);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [workImages, setWorkImages] = useState<Record<string, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMobileForm, setShowMobileForm] = useState(false);

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

  // 클립보드 이미지 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!selectedWorkId) {
      toast.error('먼저 추가내역을 선택해주세요');
      return;
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

            // workImages에 이미지 추가
            setWorkImages(prev => ({
              ...prev,
              [selectedWorkId]: [...(prev[selectedWorkId] || []), base64]
            }));

            toast.success('이미지가 추가되었습니다');

            // 서버에 이미지 저장
            saveImagesToWork(selectedWorkId, [...(workImages[selectedWorkId] || []), base64]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, [selectedWorkId, workImages]);

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.project || !formData.description || !formData.amount || !formData.date) {
      toast.error('모든 필수 항목을 입력해주세요');
      return;
    }

    try {
      await additionalWorkService.createAdditionalWork({
        project: formData.project,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date)
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

      // 목록 새로고침
      await loadAdditionalWorks();

      // localStorage에 마지막 선택 프로젝트 저장
      localStorage.setItem('lastSelectedProject', formData.project);
    } catch (error) {
      console.error('Failed to create additional work:', error);
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
    <div className="space-y-4 md:space-y-6">
      {/* 태블릿/데스크톱 3열 레이아웃 */}
      <div className="hidden desktop:grid desktop:gap-4 2xl:gap-6 desktop:grid-cols-12">
        {/* 왼쪽: 추가내역 등록 폼 */}
        <div className="md:col-span-4 lg:col-span-4 bg-white border border-gray-200 rounded-lg p-4 md:p-5 lg:p-6 h-fit sticky top-4">
          <div className="space-y-4">
            {/* 프로젝트 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
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
                rows={5}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
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
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0"
              />
            </div>

            {/* 등록 버튼 */}
            <button
              onClick={handleFormSubmit}
              className="w-full py-3.5 bg-gray-900 text-white text-base font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              추가내역 등록
            </button>
          </div>
        </div>

        {/* 중간: 추가내역 목록 */}
        <div className="md:col-span-4 lg:col-span-5 space-y-3 md:space-y-4">
          {/* 검색 및 총액 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="space-y-4">
              <input
                type="text"
                placeholder="프로젝트명 또는 내용으로 검색"
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-gray-700">전체 합계:</span>
                <span className="text-lg font-bold text-gray-900">
                  {totalAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* 프로젝트별 추가내역 */}
          <div className="space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto">
            {projectGroups.map(group => (
              <div key={group.projectName} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div
                  className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
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
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 lg:p-6">
          {selectedWorkId ? (
            <div>
              <div className="flex items-center justify-between mb-5">
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
                    업로드
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
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
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="0"
                />
              </div>

              {/* 등록 버튼 */}
              <button
                onClick={handleFormSubmit}
                className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                추가내역 등록
              </button>
            </div>
          </div>
        )}

        {/* 검색 및 총액 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="프로젝트명 또는 내용으로 검색"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">전체 합계:</span>
              <span className="text-lg font-bold text-gray-900">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
          </div>
        </div>

        {/* 프로젝트별 추가내역 */}
        {projectGroups.map(group => (
          <div key={group.projectName} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div
              className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
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

        {/* 추가내역 등록 토글 버튼 */}
        <button
          onClick={() => setShowMobileForm(!showMobileForm)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-transform"
        >
          {showMobileForm ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/* 수정/추가 모달 */}
      {isModalOpen && (
        <AdditionalWorkModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          work={selectedWork}
          projects={filteredProjects}
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