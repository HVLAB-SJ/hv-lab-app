import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataStore, type ExecutionRecord } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { Search, Trash2, ImageIcon, X, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

// 공정 목록
const PROCESS_LIST = [
  '가설',
  '철거',
  '설비/미장',
  '전기',
  '목공',
  '조명',
  '가구',
  '마루',
  '타일',
  '욕실',
  '필름',
  '도배',
  '도장',
  '창호',
  '에어컨',
  '기타'
];

const ExecutionHistory = () => {
  const {
    payments,
    executionRecords,
    loadPaymentsFromAPI,
    addExecutionRecord,
    deleteExecutionRecord,
    updateExecutionRecord,
    projects
  } = useDataStore();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [includeVat, setIncludeVat] = useState(false);
  const [includeTaxDeduction, setIncludeTaxDeduction] = useState(false);
  const [showProcessSummary, setShowProcessSummary] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');
  const [mobileView, setMobileView] = useState<'form' | 'list' | 'image'>('form');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showProcessPicker, setShowProcessPicker] = useState(false);
  const processButtonRef = useRef<HTMLButtonElement>(null);
  // 결제요청 레코드의 이미지를 저장하는 별도의 상태 (페이지 이동 시에도 유지)
  const [paymentRecordImages, setPaymentRecordImages] = useState<Record<string, string[]>>(() => {
    // localStorage에서 이미지 복원
    const stored = localStorage.getItem('paymentRecordImages');
    return stored ? JSON.parse(stored) : {};
  });
  // 실행내역에서 숨긴 결제요청 ID 저장
  const [hiddenPaymentIds, setHiddenPaymentIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('hiddenPaymentIds');
    return stored ? JSON.parse(stored) : [];
  });
  // 마지막 선택된 프로젝트 불러오기 (프로젝트가 없으면 첫 번째 프로젝트 선택)
  const getInitialProject = () => {
    const lastSelected = localStorage.getItem('lastSelectedProject');

    // 공사완료되지 않은 프로젝트만 필터링
    const activeProjects = projects.filter(p => p.status !== 'completed');

    if (lastSelected && activeProjects.some(p => p.name === lastSelected)) {
      return lastSelected;
    }

    // 프로젝트가 있으면 첫 번째 프로젝트를 기본값으로
    if (activeProjects.length > 0) {
      return activeProjects[0].name;
    }

    return '';
  };

  const [formData, setFormData] = useState({
    project: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    process: '',
    itemName: '',
    materialCost: '' as number | string,
    laborCost: '' as number | string,
    images: [] as string[]
  });

  // 초기 데이터 로드 및 프로젝트 설정
  useEffect(() => {
    loadPaymentsFromAPI().catch(error => {
      console.error('Failed to load payments:', error);
    });

    // 모바일 여부 확인
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // 프로젝트가 로드되면 초기 프로젝트 설정
    if (projects.length > 0 && !formData.project) {
      const initialProject = getInitialProject();
      if (initialProject) {
        setFormData(prev => ({ ...prev, project: initialProject }));
        localStorage.setItem('lastSelectedProject', initialProject);
      }
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, [loadPaymentsFromAPI, projects]);

  // paymentRecordImages가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('paymentRecordImages', JSON.stringify(paymentRecordImages));
  }, [paymentRecordImages]);

  // hiddenPaymentIds가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('hiddenPaymentIds', JSON.stringify(hiddenPaymentIds));
  }, [hiddenPaymentIds]);

  // 클립보드 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!selectedRecord) {
      toast.error('먼저 실행내역을 선택해주세요');
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

            // 실제 레코드에 이미지 추가
            const record = executionRecords.find(r => r.id === selectedRecord);
            if (record) {
              const updatedImages = [...(record.images || []), base64];
              updateExecutionRecord(selectedRecord, { images: updatedImages });
            } else {
              // 결제요청 레코드인 경우 별도 저장소에 저장
              setPaymentRecordImages(prev => ({
                ...prev,
                [selectedRecord]: [...(prev[selectedRecord] || []), base64]
              }));
            }
            toast.success('이미지가 추가되었습니다');
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, [selectedRecord, executionRecords, updateExecutionRecord]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // 승인된 결제요청을 실행내역 형식으로 변환
  // 이미 executionRecord가 생성된 payment와 숨긴 payment는 제외
  const paymentRecords = payments
    .filter(p => (p.status === 'approved' || p.status === 'completed') &&
            !executionRecords.some(r => r.paymentId === p.id) &&
            !hiddenPaymentIds.includes(p.id))
    .map(payment => {
      // 결제요청에서 자재비와 인건비 가져오기
      const materialCost = payment.materialAmount || 0;
      const laborCost = payment.laborAmount || 0;
      const totalAmount = payment.amount || 0;

      let materialSupplyAmount = materialCost;
      let laborSupplyAmount = laborCost;
      let vatAmount = 0;

      // 자재비와 인건비가 모두 0인 경우 (이전 버전 데이터)
      if (materialCost === 0 && laborCost === 0 && totalAmount > 0) {
        // 전체 금액을 자재비로 처리
        if (payment.includesVAT) {
          materialSupplyAmount = Math.round(totalAmount / 1.1);
          vatAmount = totalAmount - materialSupplyAmount;
        } else {
          materialSupplyAmount = totalAmount;
          vatAmount = 0;
        }
      } else {
        // 자재비와 인건비가 있는 경우
        if (payment.includesVAT) {
          // 부가세 포함인 경우: 각각 부가세 역산
          if (materialCost > 0) {
            materialSupplyAmount = Math.round(materialCost / 1.1);
          }
          if (laborCost > 0) {
            laborSupplyAmount = Math.round(laborCost / 1.1);
          }
          vatAmount = totalAmount - (materialSupplyAmount + laborSupplyAmount);
        } else {
          // 부가세 미포함인 경우
          vatAmount = 0;
        }
      }

      return {
        id: payment.id,
        type: 'payment' as const,
        project: payment.project,
        author: payment.requestedBy || '-', // 요청자를 작성자로 표시
        date: payment.requestDate,
        process: payment.process || '-',
        itemName: payment.itemName || payment.purpose || '-',
        materialCost: materialSupplyAmount, // 자재비 (공급가액)
        laborCost: laborSupplyAmount, // 인건비 (공급가액)
        vatAmount: vatAmount, // 부가세
        totalAmount: totalAmount, // 총액
        images: paymentRecordImages[payment.id] || [],
        notes: payment.notes
      };
    });

  // 실행내역 레코드 변환
  const manualRecords = executionRecords.map(record => ({
    ...record,
    type: 'manual' as const
  }));

  // 모든 레코드 합치기
  const allRecords = [...paymentRecords, ...manualRecords].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 필터링 - 폼에서 선택한 프로젝트로 필터링
  const filteredRecords = allRecords.filter(record => {
    const matchesProject = formData.project === '' || record.project === formData.project;
    const matchesSearch = searchTerm === '' ||
      record.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.process?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProject && matchesSearch;
  });

  // 프로젝트별 총계 계산
  const projectTotals = filteredRecords.reduce((acc, record) => {
    acc.material += record.materialCost || 0;
    acc.labor += record.laborCost || 0;
    acc.vat += record.vatAmount || 0;
    acc.total += record.totalAmount || 0;
    return acc;
  }, { material: 0, labor: 0, vat: 0, total: 0 });

  // 폼 저장
  const handleSave = () => {
    if (!formData.project) {
      toast.error('프로젝트를 선택해주세요');
      return;
    }

    const now = new Date();
    let materialCost = Number(formData.materialCost) || 0;
    let laborCost = Number(formData.laborCost) || 0;
    let vatAmount = 0;
    let totalAmount = 0;

    if (includeVat) {
      // 부가세 포함인 경우: 입력된 금액이 부가세 포함 총액
      // 실제 공급가액 = 부가세포함금액 / 1.1
      const totalInput = materialCost + laborCost;
      const actualAmount = Math.round(totalInput / 1.1);
      vatAmount = totalInput - actualAmount;

      // 자재비와 인건비 비율에 따라 재분배
      if (totalInput > 0) {
        const materialRatio = materialCost / totalInput;
        const laborRatio = laborCost / totalInput;
        materialCost = Math.round(actualAmount * materialRatio);
        laborCost = Math.round(actualAmount * laborRatio);
      }
      totalAmount = totalInput;
    } else {
      // 부가세 미포함인 경우: 입력된 금액 그대로 사용
      vatAmount = 0;
      totalAmount = materialCost + laborCost;
    }

    const newRecord: ExecutionRecord = {
      id: `exec_${Date.now()}`,
      project: formData.project,
      author: user?.name || '알 수 없음', // 로그인한 사용자 이름 추가
      date: new Date(formData.date),
      process: formData.process,
      itemName: formData.itemName,
      materialCost,
      laborCost,
      vatAmount,
      totalAmount,
      images: formData.images,
      notes: '',
      createdAt: now,
      updatedAt: now
    };

    addExecutionRecord(newRecord);
    toast.success('실행내역이 추가되었습니다');

    // 폼 초기화 (프로젝트는 유지)
    setFormData(prev => ({
      project: prev.project,  // 프로젝트 유지
      date: format(new Date(), 'yyyy-MM-dd'),
      process: '',
      itemName: '',
      materialCost: '',
      laborCost: '',
      images: []
    }));
    setIncludeVat(false); // 부가세 체크 초기화
    setIncludeTaxDeduction(false); // 세금공제 체크 초기화
  };

  // 공정별 합계 계산 (상세)
  const getProcessSummary = () => {
    const summary: Record<string, {
      materialCost: number;
      laborCost: number;
      vatAmount: number;
      totalAmount: number;
    }> = {};

    filteredRecords.forEach(record => {
      const process = record.process || '기타';
      if (!summary[process]) {
        summary[process] = {
          materialCost: 0,
          laborCost: 0,
          vatAmount: 0,
          totalAmount: 0
        };
      }
      summary[process].materialCost += record.materialCost || 0;
      summary[process].laborCost += record.laborCost || 0;
      summary[process].vatAmount += record.vatAmount || 0;
      summary[process].totalAmount += record.totalAmount || 0;
    });

    return Object.entries(summary).sort((a, b) => b[1].totalAmount - a[1].totalAmount);
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRecord) {
      toast.error('먼저 실행내역을 선택해주세요');
      return;
    }

    const files = Array.from(e.target?.files || []);
    const newImages: string[] = [];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        newImages.push(base64);

        if (newImages.length === imageFiles.length) {
          // 실제 레코드에 이미지 추가
          const record = executionRecords.find(r => r.id === selectedRecord);
          if (record) {
            const updatedImages = [...(record.images || []), ...newImages];
            updateExecutionRecord(selectedRecord, { images: updatedImages });
          } else {
            // 결제요청 레코드인 경우 별도 저장소에 저장
            setPaymentRecordImages(prev => ({
              ...prev,
              [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
            }));
          }
          toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 삭제
  const removeImage = (index: number) => {
    if (!selectedRecord) return;

    const record = executionRecords.find(r => r.id === selectedRecord);
    if (record) {
      const updatedImages = record.images?.filter((_, i) => i !== index) || [];
      updateExecutionRecord(selectedRecord, { images: updatedImages });
    } else {
      // 결제요청 레코드인 경우
      setPaymentRecordImages(prev => ({
        ...prev,
        [selectedRecord]: prev[selectedRecord]?.filter((_, i) => i !== index) || []
      }));
    }
  };

  // 이미지 클릭 시 모달 열기
  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
    setShowImageModal(true);
  };

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

    if (!selectedRecord) {
      toast.error('먼저 실행내역을 선택해주세요');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const newImages: string[] = [];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        newImages.push(base64);

        if (newImages.length === imageFiles.length) {
          // 실제 레코드에 이미지 추가
          const record = executionRecords.find(r => r.id === selectedRecord);
          if (record) {
            const updatedImages = [...(record.images || []), ...newImages];
            updateExecutionRecord(selectedRecord, { images: updatedImages });
          } else {
            // 결제요청 레코드인 경우 별도 저장소에 저장
            setPaymentRecordImages(prev => ({
              ...prev,
              [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
            }));
          }
          toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between lg:justify-start">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">실행내역</h1>
      </div>

      {/* 모바일에서 프로젝트 선택 */}
      <div className="lg:hidden mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트</label>
        <select
          value={formData.project}
          onChange={(e) => {
            setFormData({ ...formData, project: e.target.value });
            if (e.target.value) {
              localStorage.setItem('lastSelectedProject', e.target.value);
            }
          }}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          {projects.filter(p => p.status !== 'completed').map(project => (
            <option key={project.id} value={project.name}>{project.name}</option>
          ))}
        </select>
      </div>

      {/* 모바일에서 탭 표시 */}
      <div className="lg:hidden border-b border-gray-200 mb-4">
        <nav className="flex space-x-4">
          <button
            onClick={() => setMobileView('form')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              mobileView === 'form'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500'
            }`}
          >
            입력
          </button>
          <button
            onClick={() => setMobileView('list')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              mobileView === 'list'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500'
            }`}
          >
            내역
          </button>
          <button
            onClick={() => setMobileView('image')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              mobileView === 'image'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500'
            }`}
          >
            이미지
          </button>
        </nav>
      </div>

      {/* 메인 컨텐츠 - 3열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* 왼쪽: 입력 폼 (2열로 축소) */}
        <div className={`lg:col-span-2 bg-white rounded-lg border p-4 overflow-y-auto ${
          mobileView !== 'form' ? 'hidden lg:block' : ''
        }`}>
          <div className="space-y-4">
            {/* 프로젝트 - 데스크톱에서만 표시 */}
            <div className="hidden lg:block">
              <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트 *</label>
              <select
                value={formData.project}
                onChange={(e) => {
                  setFormData({ ...formData, project: e.target.value });
                  // 선택한 프로젝트 저장
                  if (e.target.value) {
                    localStorage.setItem('lastSelectedProject', e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {/* 빈칸 옵션 제거 - 모든 환경에서 */}
                {projects.filter(p => p.status !== 'completed').map(project => (
                  <option key={project.id} value={project.name}>{project.name}</option>
                ))}
              </select>
            </div>

            {/* 날짜 & 공정 */}
            <div className="grid grid-cols-2 gap-2">
              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  날짜 {formData.date && `(${format(new Date(formData.date), 'E', { locale: ko })})`}
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 cursor-pointer"
                  style={{ colorScheme: 'light', backgroundColor: 'white' }}
                />
              </div>

              {/* 공정 */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">공정</label>
                <button
                  ref={processButtonRef}
                  type="button"
                  onClick={() => setShowProcessPicker(true)}
                  className="w-full px-3 py-2 border rounded-lg text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {formData.process || <span className="text-gray-400">선택하세요</span>}
                </button>
              </div>
            </div>

            {/* 항목명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* 금액 입력 */}
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자재비</label>
                <input
                  type="number"
                  value={formData.materialCost}
                  onChange={(e) => setFormData({ ...formData, materialCost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">인건비</label>
                <input
                  type="number"
                  value={formData.laborCost}
                  onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              {/* 부가세 체크박스 */}
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeVat"
                    checked={includeVat}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setIncludeTaxDeduction(false);
                      }
                      setIncludeVat(e.target.checked);
                    }}
                    className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeVat" className="ml-2 block text-sm text-gray-700">
                    부가세 포함 (10%)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeTaxDeduction"
                    checked={includeTaxDeduction}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setIncludeVat(false);
                      }
                      setIncludeTaxDeduction(e.target.checked);
                    }}
                    className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeTaxDeduction" className="ml-2 block text-sm text-gray-700">
                    3.3% 세금공제
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium">총액</span>
                  <div className="text-right">
                    {(includeVat || includeTaxDeduction) && (
                      <span className="text-xs text-gray-500 mr-2">
                        ({includeVat && '부가세 포함'}{includeTaxDeduction && '3.3% 세금공제'})
                      </span>
                    )}
                    <span className="font-semibold">
                      {(() => {
                        const baseAmount = (Number(formData.materialCost) || 0) + (Number(formData.laborCost) || 0);
                        const finalAmount = includeTaxDeduction ? Math.round(baseAmount * 0.967) : baseAmount;
                        return finalAmount.toLocaleString();
                      })()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 내역추가 버튼 */}
              <div className="my-6 lg:my-[50px]">
                <button
                  onClick={handleSave}
                  className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  내역추가
                </button>
              </div>
            </div>

            {/* 총계 표시 - 데스크톱에서만 표시 */}
            <div className="hidden lg:block bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">자재비 총합:</span>
                <span className="text-sm font-medium text-gray-900">{projectTotals.material.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">인건비 총합:</span>
                <span className="text-sm font-medium text-gray-900">{projectTotals.labor.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">부가세 총합:</span>
                <span className="text-sm font-medium text-gray-900">{projectTotals.vat.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-900">총 합계:</span>
                <span className="text-base font-bold text-gray-900">{projectTotals.total.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 중앙: 실행내역 목록 - 테이블 형식 (7열로 확대) */}
        <div className={`lg:col-span-7 bg-white rounded-lg border overflow-hidden flex flex-col ${
          mobileView !== 'list' ? 'hidden lg:flex' : ''
        }`}>
          {/* 모바일: 카드 형식, 데스크톱: 테이블 형식 */}
          <div className="flex-1 overflow-auto">
            {filteredRecords.length > 0 ? (
              <>
                {/* 데스크톱 테이블 뷰 */}
                <table className="hidden lg:table w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs text-gray-700 border-b">
                    <th className="px-3 py-3 font-medium w-[12%]">작성자</th>
                    <th className="px-3 py-3 font-medium w-[15%]">날짜</th>
                    <th className="px-3 py-3 font-medium w-[10%]">공정</th>
                    <th className="px-3 py-3 font-medium w-[23%]">항목명</th>
                    <th className="px-3 py-3 font-medium text-right w-[10%]">자재비</th>
                    <th className="px-3 py-3 font-medium text-right w-[10%]">인건비</th>
                    <th className="px-3 py-3 font-medium text-right w-[10%]">부가세</th>
                    <th className="px-3 py-3 font-medium text-right w-[10%]">총액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={`hover:bg-gray-50 cursor-pointer text-sm ${selectedRecord === record.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedRecord(record.id)}
                    >
                      <td className="px-3 py-3 text-gray-600">
                        {record.author || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {format(new Date(record.date), 'yyyy-MM-dd (EEE)', { locale: ko })}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {record.process || '-'}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {record.itemName}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(record.materialCost || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(record.laborCost || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(record.vatAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {(record.totalAmount || 0).toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden space-y-3 p-3">
                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`border rounded-lg p-4 ${
                      selectedRecord === record.id ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    }`}
                    onClick={() => setSelectedRecord(record.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{record.itemName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {record.process || '-'} • {record.author || '-'}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        ₩{(record.totalAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(record.date), 'yyyy.MM.dd (EEE)', { locale: ko })}
                    </div>
                    <div className="mt-2 pt-2 border-t grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">자재비</span>
                        <p className="font-medium">₩{(record.materialCost || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">인건비</span>
                        <p className="font-medium">₩{(record.laborCost || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">부가세</span>
                        <p className="font-medium">₩{(record.vatAmount || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                실행내역이 없습니다
              </div>
            )}
          </div>

          {/* 하단 검색 및 공정별 합계 버튼 영역 */}
          <div className="border-t bg-gray-50 p-3">
            {/* 모바일에서만 검색 입력창을 먼저 표시 */}
            {mobileView === 'list' && (
              <>
                {/* 모바일 검색 입력창 */}
                <div className="lg:hidden mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* 모바일 총계 표시 */}
                <div className="lg:hidden bg-white rounded-lg p-3 mb-3 space-y-2 border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">자재비 총합:</span>
                    <span className="text-sm font-medium text-gray-900">{projectTotals.material.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">인건비 총합:</span>
                    <span className="text-sm font-medium text-gray-900">{projectTotals.labor.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">부가세 총합:</span>
                    <span className="text-sm font-medium text-gray-900">{projectTotals.vat.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm font-bold text-gray-900">총 합계:</span>
                    <span className="text-base font-bold text-gray-900">{projectTotals.total.toLocaleString()}원</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* 데스크톱 검색 입력창 */}
              <div className="hidden lg:block flex-1 lg:max-w-sm">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm lg:text-base"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* 버튼들 */}
              <div className="flex items-center justify-between lg:justify-end gap-2">
                {selectedRecord && (
                  <button
                    onClick={() => {
                      // executionRecords에 있는 레코드 찾기
                      const execRecord = executionRecords.find(r => r.id === selectedRecord);

                      // allRecords에서 선택된 레코드 찾기
                      const selectedItem = allRecords.find(r => r.id === selectedRecord);

                      if (execRecord) {
                        // executionRecords에 있는 레코드는 삭제 가능
                        if (confirm('선택한 실행내역을 삭제하시겠습니까?')) {
                          deleteExecutionRecord(selectedRecord);
                          setSelectedRecord(null);
                          toast.success('실행내역이 삭제되었습니다');
                        }
                      } else if (selectedItem?.type === 'payment') {
                        // payment 타입(결제요청)은 실행내역에서만 숨김
                        if (confirm('이 결제요청을 실행내역에서 숨기시겠습니까?\n(결제요청 자체는 삭제되지 않습니다)')) {
                          setHiddenPaymentIds(prev => [...prev, selectedRecord]);
                          setSelectedRecord(null);
                          toast.success('결제요청이 실행내역에서 숨겨졌습니다');
                        }
                      } else {
                        toast.error('삭제할 수 없는 항목입니다');
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}

                {/* 공정별 합계 버튼 */}
                <button
                  onClick={() => setShowProcessSummary(true)}
                  className="px-3 py-2 text-sm lg:text-base lg:px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium whitespace-nowrap"
                >
                  공정별 합계
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 이미지 업로드 및 뷰어 (3열) */}
        <div
          className={`lg:col-span-3 bg-white rounded-lg border flex flex-col overflow-hidden ${
            mobileView !== 'image' ? 'hidden lg:flex' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 파일 선택을 위한 숨겨진 input */}
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-file-input"
          />

          {/* 모바일에서 선택한 내역 정보 표시 */}
          {isMobileDevice && selectedRecord && mobileView === 'image' && (() => {
            const record = allRecords.find(r => r.id === selectedRecord);
            if (record) {
              return (
                <div className="border-b bg-gray-50 p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{record.itemName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {record.process || '-'} • {format(new Date(record.date), 'yyyy.MM.dd', { locale: ko })}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      ₩{(record.totalAmount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* 이미지 영역 전체를 클릭 가능하게 */}
          <div
            className="flex-1 overflow-y-auto p-4 relative"
            onClick={(e) => {
              // 이미지나 삭제 버튼 클릭이 아닌 경우에만 파일 선택 다이얼로그 열기
              const target = e.target as HTMLElement;
              if (!target.closest('img') && !target.closest('button') && selectedRecord) {
                const images = (() => {
                  const record = executionRecords.find(r => r.id === selectedRecord);
                  return record?.images || paymentRecordImages[selectedRecord] || [];
                })();

                // 이미지가 있을 때만 빈 공간 클릭 시 파일 선택 열기
                if (images.length > 0) {
                  document.getElementById('image-file-input')?.click();
                }
              }
            }}
          >
            {/* 선택된 레코드가 있을 때 */}
            {selectedRecord ? (() => {
              const record = executionRecords.find(r => r.id === selectedRecord);
              const images = record?.images || paymentRecordImages[selectedRecord] || [];

              return images.length > 0 ? (
                // 이미지가 있을 때
                <div className="grid grid-cols-1 gap-3">
                  {images.map((img, index) => (
                    <div key={index} className="relative group border rounded-lg overflow-hidden">
                      <img
                        src={img}
                        alt={`증빙 ${index + 1}`}
                        className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick(img);
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                // 이미지가 없을 때 - 업로드 영역 표시
                <label
                  htmlFor="image-file-input"
                  className="h-full flex items-center justify-center cursor-pointer"
                >
                  <div
                    className={`w-full h-full min-h-[200px] border-2 border-dashed rounded-lg p-6 text-center transition-colors flex flex-col items-center justify-center ${
                      isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">클릭하여 선택</p>
                    <p className="text-xs text-gray-500 mt-1">또는 이미지를 드래그하거나 Ctrl+V로 붙여넣기</p>
                  </div>
                </label>
              );
            })() : (
              // 선택된 레코드가 없을 때
              <div className="h-full flex items-center justify-center min-h-[200px]">
                <div className="text-center text-gray-400">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">실행내역을 선택하세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 공정별 합계 모달 */}
      {showProcessSummary && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-t-2xl lg:rounded-lg w-full lg:max-w-4xl max-h-[85vh] lg:max-h-[80vh] overflow-hidden lg:m-4">
            <div className="flex items-center justify-between p-4 lg:p-6 border-b">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">공정별 합계</h2>
              <button
                onClick={() => setShowProcessSummary(false)}
                className="p-1.5 lg:p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 lg:p-6 overflow-y-auto max-h-[calc(85vh-120px)] lg:max-h-[calc(80vh-120px)]">
              {getProcessSummary().length > 0 ? (
                <>
                  {/* 데스크톱 테이블 뷰 */}
                  <table className="hidden lg:table w-full">
                    <thead className="bg-gray-100">
                      <tr className="text-left text-sm text-gray-700">
                        <th className="px-4 py-3 font-medium">공정</th>
                        <th className="px-4 py-3 font-medium text-right">자재비</th>
                        <th className="px-4 py-3 font-medium text-right">인건비</th>
                        <th className="px-4 py-3 font-medium text-right">부가세</th>
                        <th className="px-4 py-3 font-medium text-right">총액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getProcessSummary().map(([process, data]) => (
                        <tr key={process} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-700">{process}</td>
                          <td className="px-4 py-3 text-right">{data.materialCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">{data.laborCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">{data.vatAmount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-semibold">{data.totalAmount.toLocaleString()}원</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-700">총합계</td>
                        <td className="px-4 py-3 text-right font-bold">{projectTotals.material.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold">{projectTotals.labor.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold">{projectTotals.vat.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{projectTotals.total.toLocaleString()}원</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* 모바일 카드 뷰 */}
                  <div className="lg:hidden space-y-3">
                    {getProcessSummary().map(([process, data]) => (
                      <div key={process} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-gray-900">{process}</h3>
                          <span className="text-lg font-bold text-gray-900">
                            ₩{data.totalAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">자재비</p>
                            <p className="font-medium">₩{data.materialCost.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">인건비</p>
                            <p className="font-medium">₩{data.laborCost.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">부가세</p>
                            <p className="font-medium">₩{data.vatAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 총합계 카드 */}
                    <div className="bg-gray-900 text-white rounded-lg p-4 mt-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-white">총합계</h3>
                        <span className="text-xl font-bold">
                          ₩{projectTotals.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-gray-300 text-xs">자재비</p>
                          <p className="font-semibold">₩{projectTotals.material.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-300 text-xs">인건비</p>
                          <p className="font-semibold">₩{projectTotals.labor.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-300 text-xs">부가세</p>
                          <p className="font-semibold">₩{projectTotals.vat.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  표시할 데이터가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 공정 선택 모달 */}
      {showProcessPicker && (
        <>
          {/* 모바일: 중앙 모달 */}
          <div className="lg:hidden fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b">
                <h2 className="text-base font-bold text-gray-900">공정 선택</h2>
                <button
                  onClick={() => setShowProcessPicker(false)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <div className="p-3 overflow-y-auto max-h-[calc(80vh-100px)]">
                {/* 공정 목록 그리드 */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {PROCESS_LIST.map((process) => (
                    <button
                      key={process}
                      onClick={() => {
                        setFormData({ ...formData, process });
                        setShowProcessPicker(false);
                      }}
                      className={`p-2 text-sm text-center border rounded-lg transition-all ${
                        formData.process === process
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {process}
                    </button>
                  ))}
                </div>

                {/* 빈 값 선택 옵션 */}
                <button
                  onClick={() => {
                    setFormData({ ...formData, process: '' });
                    setShowProcessPicker(false);
                  }}
                  className="w-full p-2 text-sm text-center border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 text-gray-500"
                >
                  선택 안함
                </button>
              </div>
            </div>
          </div>

          {/* 데스크톱: 버튼 근처 팝업 */}
          <div className="hidden lg:block fixed inset-0 z-40" onClick={() => setShowProcessPicker(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bg-white rounded-lg shadow-xl border border-gray-200"
              style={{
                top: processButtonRef.current ? `${processButtonRef.current.getBoundingClientRect().bottom + window.scrollY + 4}px` : '50%',
                left: processButtonRef.current ? `${processButtonRef.current.getBoundingClientRect().left + window.scrollX}px` : '50%',
              }}
            >
              <div className="flex items-center justify-between p-2 border-b">
                <h2 className="text-sm font-bold text-gray-900">공정 선택</h2>
                <button
                  onClick={() => setShowProcessPicker(false)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-3 w-3 text-gray-500" />
                </button>
              </div>

              <div className="p-2">
                {/* 공정 목록 그리드 - 4열로 확대하여 모든 공정이 보이도록 */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {PROCESS_LIST.map((process) => (
                    <button
                      key={process}
                      onClick={() => {
                        setFormData({ ...formData, process });
                        setShowProcessPicker(false);
                      }}
                      className={`p-1.5 text-xs text-center border rounded-lg transition-all whitespace-nowrap ${
                        formData.process === process
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {process}
                    </button>
                  ))}
                </div>

                {/* 빈 값 선택 옵션 */}
                <button
                  onClick={() => {
                    setFormData({ ...formData, process: '' });
                    setShowProcessPicker(false);
                  }}
                  className="w-full p-1.5 text-xs text-center border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 text-gray-500"
                >
                  선택 안함
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 이미지 팝업 모달 */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(false);
              }}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={modalImage}
              alt="원본 이미지"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionHistory;