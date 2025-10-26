import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import AdditionalWorkModal from '../components/AdditionalWorkModal';
import additionalWorkService from '../services/additionalWorkService';
import toast from 'react-hot-toast';

interface AdditionalWork {
  id: string;
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
}

interface ProjectGroup {
  projectName: string;
  works: AdditionalWork[];
  totalAmount: number;
}

const AdditionalWork = () => {
  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWork[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<AdditionalWork | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Load additional works from API on mount
  useEffect(() => {
    loadAdditionalWorks();
  }, []);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      handleAddWork();
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

  const loadAdditionalWorks = async () => {
    try {
      const works = await additionalWorkService.getAllAdditionalWorks();
      setAdditionalWorks(works.map(work => ({
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

  const handleAddWork = () => {
    setSelectedWork(null);
    setIsModalOpen(true);
  };

  const handleEditWork = (work: AdditionalWork) => {
    setSelectedWork(work);
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
    } catch (error) {
      console.error('Failed to save additional work:', error);
      toast.error('추가내역 저장에 실패했습니다');
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
      {/* Header */}
      <div className="flex items-center justify-between lg:justify-start">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">추가내역</h1>
        <button onClick={handleAddWork} className="hidden lg:inline-flex btn btn-primary px-4 py-2 ml-auto">
          + 추가내역
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="검색..."
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
            <button
              onClick={() => toggleProject(group.projectName)}
              className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 text-left">
                <h3 className="font-bold text-base text-gray-900">{group.projectName}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {group.works.length}건 · {group.totalAmount.toLocaleString()}원
                </p>
              </div>
              {expandedProjects.has(group.projectName) ? (
                <ChevronUp className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-600" />
              )}
            </button>

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

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">내용</p>
                        <p className="text-gray-900 mt-0.5">{work.description}</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">금액</p>
                        <p className="text-gray-900 mt-0.5 font-medium">{work.amount.toLocaleString()}원</p>
                      </div>

                      {work.notes && (
                        <div>
                          <p className="text-xs text-gray-500">비고</p>
                          <p className="text-gray-900 mt-0.5">{work.notes}</p>
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

      {/* Desktop View - Grouped by Project */}
      <div className="hidden md:block space-y-4">
        {projectGroups.map((group) => (
          <div key={group.projectName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Project Header */}
            <button
              onClick={() => toggleProject(group.projectName)}
              className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <h3 className="font-bold text-lg text-gray-900">{group.projectName}</h3>
                <span className="text-sm text-gray-600">
                  {group.works.length}건
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">프로젝트 합계</p>
                  <p className="text-lg font-bold text-gray-900">{group.totalAmount.toLocaleString()}원</p>
                </div>
                {expandedProjects.has(group.projectName) ? (
                  <ChevronUp className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                )}
              </div>
            </button>

            {/* Project Works Table */}
            {expandedProjects.has(group.projectName) && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">일자</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">내용</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">수정</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">삭제</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {group.works.map((work) => (
                    <tr key={work.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{format(work.date, 'yyyy.MM.dd (eee)', { locale: ko })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{work.description}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-medium text-gray-900">{work.amount.toLocaleString()}원</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{work.notes || '-'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleEditWork(work)}
                          className="text-gray-600 hover:text-gray-700 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDeleteWork(work.id, work.project)}
                          className="text-rose-600 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {projectGroups.length === 0 && (
          <div className="text-center py-8 text-gray-500 bg-white border border-gray-200 rounded-lg">
            추가내역이 없습니다
          </div>
        )}
      </div>

      {/* Additional Work Modal */}
      {isModalOpen && (
        <AdditionalWorkModal
          work={selectedWork}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveWork}
        />
      )}
    </div>
  );
};

export default AdditionalWork;
