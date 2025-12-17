import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataStore, type ExecutionRecord } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { Navigate } from 'react-router-dom';
import { Search, Trash2, ImageIcon, X, Upload, Edit2, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import paymentService from '../services/paymentService';
import { getAllImages, saveImages, migrateFromLocalStorage } from '../utils/imageStorage';
import { compressImage } from '../utils/imageUtils';
import { safeLocalStorageSet } from '../utils/storageUtils';
import { PAYMENT_PROCESS_LIST } from '../constants';

const ExecutionHistory = () => {
  const {
    payments,
    executionRecords,
    loadPaymentsFromAPI,
    loadExecutionRecordsFromAPI,
    addExecutionRecordToAPI,
    deleteExecutionRecordFromAPI,
    updateExecutionRecordInAPI,
    updatePaymentInAPI,
    deletePaymentFromAPI
  } = useDataStore();
  const { user } = useAuth();
  const allProjects = useFilteredProjects(); // 안팀 사용자는 담당 프로젝트만 표시

  // 공사완료 현장 포함 여부
  const [includeCompleted, setIncludeCompleted] = useState(() => {
    const saved = localStorage.getItem('executionHistory_includeCompleted');
    return saved === 'true';
  });

  // 완료된 프로젝트 필터링
  const projects = includeCompleted
    ? allProjects
    : allProjects.filter(p => p.status !== 'completed');

  // 로그인 체크만 수행 (모든 로그인 사용자 접근 가능)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const [searchTerm, setSearchTerm] = useState('');
  // selectedRecord는 "type_id" 형식으로 저장 (예: "payment_123", "manual_456")
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  // selectedRecord에서 type과 id를 추출하는 헬퍼 함수
  const parseSelectedRecord = (selected: string | null): { type: string | null; id: string | null } => {
    if (!selected) return { type: null, id: null };
    const parts = selected.split('_');
    if (parts.length >= 2) {
      const type = parts[0];
      const id = parts.slice(1).join('_'); // ID에 '_'가 포함될 수 있음
      return { type, id };
    }
    return { type: null, id: null };
  };

  // 레코드의 고유 키 생성
  const getRecordKey = (record: { type: string; id: string }) => `${record.type}_${record.id}`;
  const [isDragging, setIsDragging] = useState(false);
  const [includeVat, setIncludeVat] = useState(false);
  const [includeTaxDeduction, setIncludeTaxDeduction] = useState(false);
  const [showProcessSummary, setShowProcessSummary] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');
  const [mobileView, setMobileView] = useState<'form' | 'list' | 'image'>('list');
  const [showMobileForm, setShowMobileForm] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showProcessPicker, setShowProcessPicker] = useState(false);
  const processButtonRef = useRef<HTMLButtonElement>(null);
  // 수정 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExecutionRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    process: '',
    itemName: '',
    materialCost: '',
    laborCost: '',
    date: ''
  });
  // 액션 메뉴 상태 (모바일용)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  // 삭제 확인 팝업 상태
  const [deleteConfirm, setDeleteConfirm] = useState<{
    recordId: string;
    position: { x: number; y: number };
  } | null>(null);
  // 항목명 추천
  const [itemNameSuggestions, setItemNameSuggestions] = useState<string[]>([]);
  const [isItemNameFocused, setIsItemNameFocused] = useState(false); // 항목명 input 포커스 상태
  // 결제요청 레코드의 이미지를 저장하는 별도의 상태 (IndexedDB 사용으로 용량 제한 없음)
  const [paymentRecordImages, setPaymentRecordImages] = useState<Record<string, string[]>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  // 실행내역에서 숨긴 결제요청 ID 저장
  const [hiddenPaymentIds, setHiddenPaymentIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('hiddenPaymentIds');
    return stored ? JSON.parse(stored) : [];
  });
  // 마지막 선택된 프로젝트 불러오기 (프로젝트가 없으면 첫 번째 프로젝트 선택)
  const getInitialProject = () => {
    const lastSelected = localStorage.getItem('lastSelectedProject');

    // "기타"는 항상 유효한 프로젝트로 인정
    if (lastSelected === '기타') {
      return '기타';
    }

    // projects는 이미 includeCompleted에 따라 필터링됨
    if (lastSelected && projects.some(p => p.name === lastSelected)) {
      return lastSelected;
    }

    // 프로젝트가 있으면 첫 번째 프로젝트를 기본값으로
    if (projects.length > 0) {
      return projects[0].name;
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
    images: [] as string[],
    quickText: '',
    quickImages: [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);

  // 실행내역별 메모 저장을 위한 상태
  const [executionMemos, setExecutionMemos] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem('executionMemos');
    return stored ? JSON.parse(stored) : {};
  });

  // 금액 분할 모드 상태
  const [splitModeRecord, setSplitModeRecord] = useState<string | null>(null);
  const [splitMaterialCost, setSplitMaterialCost] = useState<number | ''>('');
  const [splitLaborCost, setSplitLaborCost] = useState<number | ''>('');

  // 입력 적용된 결제요청 ID 목록 (localStorage에 저장)
  const [appliedPaymentIds, setAppliedPaymentIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('executionHistory_appliedPaymentIds');
    return saved ? JSON.parse(saved) : [];
  });

  // 초기 데이터 로드 (마운트 시 1회만 실행)
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          loadPaymentsFromAPI(),
          loadExecutionRecordsFromAPI()
        ]);
        console.log('[ExecutionHistory] 데이터 로드 완료');
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();

    // 모바일 여부 확인
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []); // 마운트 시 1회만 실행

  // 프로젝트가 로드되면 초기 프로젝트 설정 (별도 useEffect로 분리)
  useEffect(() => {
    if (projects.length > 0 && !formData.project) {
      const initialProject = getInitialProject();
      if (initialProject) {
        setFormData(prev => ({ ...prev, project: initialProject }));
        localStorage.setItem('lastSelectedProject', initialProject);
      }
    }
  }, [projects]); // projects가 변경될 때만 실행

  // IndexedDB에서 이미지 로드 (마운트 시 1회)
  useEffect(() => {
    const loadImages = async () => {
      try {
        // 먼저 localStorage에서 마이그레이션
        await migrateFromLocalStorage();
        // IndexedDB에서 이미지 로드
        const images = await getAllImages();
        setPaymentRecordImages(images);
        setImagesLoaded(true);
      } catch (error) {
        console.error('이미지 로드 실패:', error);
        setImagesLoaded(true);
      }
    };
    loadImages();
  }, []);

  // paymentRecordImages가 변경될 때마다 IndexedDB에 저장
  const prevImagesRef = useRef<Record<string, string[]>>({});
  useEffect(() => {
    if (!imagesLoaded) return; // 초기 로드 전에는 저장하지 않음

    // 변경된 레코드만 저장
    Object.entries(paymentRecordImages).forEach(([recordId, images]) => {
      if (JSON.stringify(prevImagesRef.current[recordId]) !== JSON.stringify(images)) {
        saveImages(recordId, images).catch(error => {
          console.error('이미지 저장 실패:', error);
          toast.error('이미지 저장에 실패했습니다');
        });
      }
    });
    prevImagesRef.current = { ...paymentRecordImages };
  }, [paymentRecordImages, imagesLoaded]);

  // hiddenPaymentIds가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('hiddenPaymentIds', JSON.stringify(hiddenPaymentIds));
  }, [hiddenPaymentIds]);

  // includeCompleted 설정 저장
  useEffect(() => {
    localStorage.setItem('executionHistory_includeCompleted', String(includeCompleted));
  }, [includeCompleted]);

  // executionMemos가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('executionMemos', JSON.stringify(executionMemos));
  }, [executionMemos]);

  // 항목명 입력 시 기존 실행내역에서 추천 (포커스 상태일 때만)
  useEffect(() => {
    if (isItemNameFocused && formData.itemName && formData.itemName.trim().length >= 1) {
      const searchText = formData.itemName.trim().toLowerCase();

      // 모든 실행내역에서 항목명 추출 (최신순)
      const allItemNames = [...executionRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(r => r.itemName)
        .filter(name => name && name.toLowerCase().includes(searchText));

      // 중복 제거
      const uniqueItemNames = Array.from(new Set(allItemNames));

      setItemNameSuggestions(uniqueItemNames.slice(0, 10)); // 최대 10개만 표시
    } else {
      setItemNameSuggestions([]);
    }
  }, [formData.itemName, executionRecords, isItemNameFocused]);

  // 모바일 + 버튼 클릭 이벤트 리스너
  useEffect(() => {
    const handleHeaderAddClick = () => {
      setShowMobileForm(prev => !prev);
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddClick);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddClick);
  }, []);

  // showMobileForm 상태 변경 시 Layout에 알림
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mobileFormStateChange', { detail: { isOpen: showMobileForm } }));
  }, [showMobileForm]);

  // 클립보드 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 이미지 파일만 필터링
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          imageFiles.push(blob);
        }
      }
    }

    if (imageFiles.length === 0) return;

    // 모든 이미지를 Promise로 처리 (압축 포함)
    Promise.all(
      imageFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
    ).then(async newImages => {
      // 선택된 내역이 없으면 좌측 폼의 quickImages에 추가
      if (!selectedRecord) {
        setFormData(prev => ({
          ...prev,
          quickImages: [...prev.quickImages, ...newImages]
        }));
        toast.success(`${newImages.length}개의 이미지가 청구내역에 추가되었습니다`);
        return;
      }

      // type_id 형식에서 type과 id 분리
      const { type: selectedType, id: selectedId } = parseSelectedRecord(selectedRecord);
      if (!selectedType || !selectedId) {
        toast.error('레코드를 찾을 수 없습니다');
        return;
      }

      // 실행내역(manual) 레코드인지 확인
      if (selectedType === 'manual') {
        const executionRecord = executionRecords.find(r => r.id === selectedId);
        if (executionRecord) {
          // 실행내역인 경우 서버 API로 저장
          const updatedImages = [...(executionRecord.images || []), ...newImages];
          try {
            await updateExecutionRecordInAPI(selectedId, { images: updatedImages });
            toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
          } catch (error) {
            console.error('이미지 저장 실패:', error);
            toast.error('이미지 저장에 실패했습니다');
          }
        }
      } else {
        // 결제요청 레코드인 경우 로컬 저장소에 저장
        const existingImages = paymentRecordImages[selectedId] || [];
        setPaymentRecordImages(prev => ({
          ...prev,
          [selectedId]: [...existingImages, ...newImages]
        }));
        toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
      }
    }).catch(error => {
      console.error('이미지 처리 중 오류:', error);
      toast.error('이미지 추가 중 오류가 발생했습니다');
    });
  }, [selectedRecord, setFormData, paymentRecordImages, executionRecords, updateExecutionRecordInAPI]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // 안팀 사용자인 경우 담당 프로젝트 목록 가져오기
  const filteredProjectNames = projects.map(p => p.name);

  // 승인된 결제요청을 실행내역 형식으로 변환
  // 이미 executionRecord가 생성된 payment와 숨긴 payment는 제외
  // 안팀 사용자인 경우 담당 프로젝트만 필터링
  console.log('[ExecutionHistory] payments 배열:', payments.length, '개');
  console.log('[ExecutionHistory] 이미지가 있는 payments:', payments.filter(p => p.images && p.images.length > 0).map(p => ({ id: p.id, imagesCount: p.images?.length })));
  console.log('[ExecutionHistory] paymentRecordImages 상태:', Object.keys(paymentRecordImages).length, '개 레코드', Object.entries(paymentRecordImages).slice(0, 3).map(([id, imgs]) => ({ id, count: imgs?.length })));

  const paymentRecords = payments
    .filter(p => {
      const statusMatch = (p.status === 'approved' || p.status === 'completed');
      const notDuplicated = !executionRecords.some(r => r.paymentId === p.id);
      const notHidden = !hiddenPaymentIds.includes(p.id);
      const projectMatch = user?.name !== '안팀' || filteredProjectNames.includes(p.project);
      return statusMatch && notDuplicated && notHidden && projectMatch;
    })
    .map(payment => {
      // 결제요청에서 자재비와 인건비 가져오기
      const materialCost = payment.materialAmount || 0;
      const laborCost = payment.laborAmount || 0;
      const totalAmount = payment.amount || 0;

      // 디버그 로그
      if (materialCost > 0 || laborCost > 0) {
        console.log('[paymentRecords] 금액분할된 결제요청:', {
          id: payment.id,
          itemName: payment.itemName,
          materialAmount: payment.materialAmount,
          laborAmount: payment.laborAmount,
          totalAmount,
          includesVAT: payment.includesVAT
        });
      }

      let materialSupplyAmount = materialCost;
      let laborSupplyAmount = laborCost;
      let vatAmount = 0;

      // 자재비와 인건비가 모두 0인 경우 (이전 버전 데이터 또는 아직 금액분할 안 한 경우)
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
        // 금액분할이 된 경우: 사용자가 입력한 값은 이미 부가세 포함 값
        // 부가세 포함인 경우 공급가액으로 변환
        if (payment.includesVAT) {
          // 전체 금액 기준으로 부가세 계산 (자재비+인건비 합계로 부가세 역산)
          const inputTotal = materialCost + laborCost;
          const supplyTotal = Math.round(inputTotal / 1.1);
          vatAmount = inputTotal - supplyTotal;

          // 자재비와 인건비 비율에 따라 공급가액 분배
          if (inputTotal > 0) {
            const materialRatio = materialCost / inputTotal;
            const laborRatio = laborCost / inputTotal;
            materialSupplyAmount = Math.round(supplyTotal * materialRatio);
            laborSupplyAmount = Math.round(supplyTotal * laborRatio);
          }
        } else {
          // 부가세 미포함인 경우: 입력값 그대로 사용
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
        images: (payment.images && payment.images.length > 0) ? payment.images : (paymentRecordImages[payment.id] || []),  // 서버 이미지 우선, 비어있으면 로컬 이미지
        notes: payment.notes,
        quickText: (payment as any).quickText || ''  // 원본 텍스트 추가
      };
    });

  // 디버그: paymentRecords의 이미지 확인
  const recordsWithImages = paymentRecords.filter(r => r.images && r.images.length > 0);
  if (recordsWithImages.length > 0) {
    console.log('[ExecutionHistory] 이미지가 있는 paymentRecords:', recordsWithImages.map(r => ({ id: r.id, imagesCount: r.images.length })));
  }

  // 실행내역 레코드 변환
  // 안팀 사용자인 경우 담당 프로젝트만 필터링
  console.log('[ExecutionHistory] executionRecords 개수:', executionRecords.length);
  const manualRecords = executionRecords
    .filter(record => user?.name !== '안팀' || filteredProjectNames.includes(record.project))
    .map(record => ({
      ...record,
      type: 'manual' as const
    }));

  // 모든 레코드 합치기 (중복 제거)
  const allRecordsRaw = [...paymentRecords, ...manualRecords].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 중복 제거 - type+id 조합으로 고유성 판단 (payment와 manual은 ID가 같아도 별개 레코드)
  const seenKeys = new Set<string>();
  const allRecords = allRecordsRaw.filter(record => {
    const uniqueKey = `${record.type}_${record.id}`;
    if (seenKeys.has(uniqueKey)) {
      console.warn('[ExecutionHistory] 중복 레코드 발견:', uniqueKey, record.itemName);
      return false;
    }
    seenKeys.add(uniqueKey);
    return true;
  });

  // 필터링 - 폼에서 선택한 프로젝트로 필터링
  // 안팀 사용자인 경우 담당 프로젝트만 표시 (기타 제외)
  const filteredRecords = allRecords.filter(record => {
    // 안팀 사용자인 경우 담당 프로젝트 필터링 적용 + 기타 제외
    const isAllowedProject = user?.name !== '안팀' ||
      (filteredProjectNames.includes(record.project) && record.project !== '기타');
    const matchesProject = formData.project === '' || record.project === formData.project;
    const matchesSearch = searchTerm === '' ||
      record.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.process?.toLowerCase().includes(searchTerm.toLowerCase());
    return isAllowedProject && matchesProject && matchesSearch;
  });

  // 프로젝트별 총계 계산
  const projectTotals = filteredRecords.reduce((acc, record) => {
    acc.material += record.materialCost || 0;
    acc.labor += record.laborCost || 0;
    acc.vat += record.vatAmount || 0;
    acc.total += record.totalAmount || 0;
    return acc;
  }, { material: 0, labor: 0, vat: 0, total: 0 });

  // 빠른 입력 자동 채우기
  const handleQuickTextParse = () => {
    const text = formData.quickText;
    if (!text.trim()) {
      toast.error('붙여넣기한 내용이 없습니다');
      return;
    }

    // 숫자 추출 (콤마 포함)
    const numberMatches = text.match(/[\d,]+/g);
    const numbers = numberMatches
      ? numberMatches.map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => n > 0)
      : [];

    // 공정 추출
    let detectedProcess = '';
    for (const process of PAYMENT_PROCESS_LIST) {
      if (text.includes(process)) {
        detectedProcess = process;
        break;
      }
    }

    // 항목명 추출 (첫 줄 또는 의미 있는 텍스트)
    const lines = text.split('\n').filter(l => l.trim());
    let detectedItemName = '';
    if (lines.length > 0) {
      // 숫자만 있는 줄이 아닌 첫 번째 줄을 항목명으로
      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine && !/^[\d,\s원]+$/.test(cleanLine)) {
          detectedItemName = cleanLine.substring(0, 50); // 최대 50자
          break;
        }
      }
    }

    // 금액 설정 (가장 큰 금액을 자재비로)
    let materialCost = '';
    let laborCost = '';
    if (numbers.length > 0) {
      const sortedNumbers = [...numbers].sort((a, b) => b - a);
      materialCost = String(sortedNumbers[0]);
      if (sortedNumbers.length > 1) {
        laborCost = String(sortedNumbers[1]);
      }
    }

    setFormData(prev => ({
      ...prev,
      process: detectedProcess || prev.process,
      itemName: detectedItemName || prev.itemName,
      materialCost: materialCost || prev.materialCost,
      laborCost: laborCost || prev.laborCost,
      images: [...prev.images, ...prev.quickImages],
      quickText: '',
      quickImages: []
    }));

    toast.success('자동 채우기 완료');
  };

  // 폼 저장
  const handleSave = async () => {
    if (isSaving) return;

    if (!formData.project) {
      toast.error('프로젝트를 선택해주세요');
      return;
    }

    if (!formData.itemName || formData.itemName.trim() === '') {
      toast.error('항목명을 입력해주세요');
      return;
    }

    setIsSaving(true);

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

    // 3.3% 세금공제 적용 (자재비/인건비 각각에 3.3% 공제)
    if (includeTaxDeduction) {
      materialCost = Math.round(materialCost * 0.967);
      laborCost = Math.round(laborCost * 0.967);
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
      includesTaxDeduction: includeTaxDeduction, // 3.3% 세금공제 여부 저장
      includesVat: includeVat, // 부가세포함 여부 저장
      createdAt: now,
      updatedAt: now
    };

    try {
      console.log('[ExecutionHistory] 저장 시도:', newRecord.project, newRecord.itemName);
      const savedRecord = await addExecutionRecordToAPI(newRecord);
      console.log('[ExecutionHistory] 저장 완료:', savedRecord.id, savedRecord.project);

      // 서버에서 최신 목록 다시 불러오기 (동기화 보장)
      await loadExecutionRecordsFromAPI();
      console.log('[ExecutionHistory] 목록 새로고침 완료');

      toast.success('실행내역이 추가되었습니다');

      // 폼 초기화 (프로젝트는 유지)
      setFormData(prev => ({
        project: prev.project,  // 프로젝트 유지
        date: format(new Date(), 'yyyy-MM-dd'),
        process: '',
        itemName: '',
        materialCost: '',
        laborCost: '',
        images: [],
        quickText: '',
        quickImages: []
      }));
      setIncludeVat(false); // 부가세 체크 초기화
      setIncludeTaxDeduction(false); // 세금공제 체크 초기화

      // 새 레코드 선택 (데스크톱/모바일 모두) - manual 타입
      setSelectedRecord(`manual_${savedRecord.id}`);

      // 모바일에서는 폼을 닫고 리스트 뷰로 전환
      if (isMobileDevice) {
        setShowMobileForm(false);
        setMobileView('list');
      }

      // 선택된 레코드로 스크롤 (약간의 딜레이 후)
      setTimeout(() => {
        const element = document.querySelector(`[data-record-id="manual_${savedRecord.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } catch (error) {
      console.error('실행내역 저장 실패:', error);
      toast.error('실행내역 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  // 수정 모드 - 왼쪽 폼에 데이터 채우기
  const handleEditClick = (record: ExecutionRecord & { type?: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuId(null);

    // payment 타입인 경우 원본 payment 데이터에서 정보 가져오기
    const isPaymentType = record.type === 'payment';
    const originalPayment = isPaymentType ? payments.find(p => String(p.id) === String(record.id)) : null;

    console.log('[handleEditClick] Record type:', record.type, 'isPaymentType:', isPaymentType);
    console.log('[handleEditClick] Original payment:', originalPayment);
    console.log('[handleEditClick] Record vatAmount:', record.vatAmount);

    // 부가세 포함 여부 확인
    // 1. payment 타입: originalPayment.includesVAT 확인
    // 2. 실행내역 타입: DB에 저장된 includesVat 필드 사용
    console.log('[handleEditClick] record.includesVat:', (record as any).includesVat, 'type:', typeof (record as any).includesVat);
    console.log('[handleEditClick] Full record:', JSON.stringify(record, null, 2));

    // 단순화: 저장된 금액 그대로 표시, 체크박스는 저장된 값 사용
    // 수정완료 시 새로 등록하는 것과 동일한 로직 적용
    let displayMaterialCost = record.materialCost || 0;
    let displayLaborCost = record.laborCost || 0;
    let wasVatIncluded = false;
    let wasTaxDeducted = false;

    if (isPaymentType && originalPayment) {
      // Payment: 저장된 금액 그대로 사용
      displayMaterialCost = originalPayment.materialAmount || 0;
      displayLaborCost = originalPayment.laborAmount || 0;
      // includesVAT가 명시적으로 true인 경우에만 체크
      wasVatIncluded = originalPayment.includesVAT === true;
    } else {
      // 실행내역: 저장된 값 사용
      wasVatIncluded = (record as any).includesVat === true;
      wasTaxDeducted = (record as any).includesTaxDeduction === true;
    }

    console.log('[handleEditClick] Simple logic:', {
      displayMaterialCost,
      displayLaborCost,
      wasVatIncluded,
      wasTaxDeducted
    });

    setEditingRecord(record);
    setFormData(prev => ({
      ...prev,
      project: record.project || prev.project,
      date: format(new Date(record.date), 'yyyy-MM-dd'),
      process: record.process || '',
      itemName: record.itemName,
      materialCost: displayMaterialCost,  // 원본 금액 표시
      laborCost: displayLaborCost,        // 원본 금액 표시
      images: record.images || [],
      quickText: '',
      quickImages: []
    }));
    // 부가세 포함 여부 설정
    setIncludeVat(wasVatIncluded);
    // 세금공제가 적용되어 있었으면 체크박스 선택
    setIncludeTaxDeduction(wasTaxDeducted);
    // type_id 형식으로 선택
    const recordType = (record as any).type || 'manual';
    setSelectedRecord(`${recordType}_${record.id}`);
    // 모바일에서는 입력 폼으로 이동
    if (isMobileDevice) {
      setMobileView('form');
    }
  };

  // 수정 취소
  const handleEditCancel = () => {
    setEditingRecord(null);
    setFormData(prev => ({
      ...prev,
      date: format(new Date(), 'yyyy-MM-dd'),
      process: '',
      itemName: '',
      materialCost: '',
      laborCost: '',
      images: [],
      quickText: '',
      quickImages: []
    }));
  };

  // 수정 저장
  const handleEditSave = async () => {
    console.log('[handleEditSave] Called, editingRecord:', editingRecord);
    if (!editingRecord) {
      console.log('[handleEditSave] No editingRecord, returning');
      return;
    }

    try {
      // 새로 등록하는 것과 동일한 로직 적용
      let materialCost = Number(formData.materialCost) || 0;
      let laborCost = Number(formData.laborCost) || 0;
      let vatAmount = 0;
      let totalAmount = 0;

      if (includeVat) {
        // 부가세 포함인 경우: 입력된 금액이 부가세 포함 총액
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

      // 3.3% 세금공제 적용 (자재비/인건비 각각에 3.3% 공제)
      if (includeTaxDeduction) {
        materialCost = Math.round(materialCost * 0.967);
        laborCost = Math.round(laborCost * 0.967);
        totalAmount = materialCost + laborCost;
      }

      // 청구내역 붙여넣기 내용을 메모에 추가
      let updatedNotes = editingRecord.notes || '';
      if (formData.quickText.trim()) {
        // 기존 메모가 있으면 줄바꿈 후 추가, 없으면 그냥 추가
        updatedNotes = updatedNotes
          ? `${updatedNotes}\n${formData.quickText.trim()}`
          : formData.quickText.trim();
      }

      // 청구내역 이미지도 기존 이미지에 추가
      const existingImages = editingRecord.images || [];
      const updatedImages = [...existingImages, ...formData.quickImages];

      // 타입에 따라 다른 API 호출
      console.log('[handleEditSave] editingRecord type:', (editingRecord as any).type, 'id:', editingRecord.id, 'typeof id:', typeof editingRecord.id);
      if ((editingRecord as any).type === 'payment') {
        console.log('[handleEditSave] Processing as PAYMENT');
        console.log('[handleEditSave] payments array IDs:', payments.map(p => ({ id: p.id, typeofId: typeof p.id })));
        // 결제요청 수정 - 기존 payment 데이터 찾기 (문자열/숫자 타입 차이 처리)
        const existingPayment = payments.find(p => String(p.id) === String(editingRecord.id));
        console.log('[handleEditSave] Found existingPayment:', existingPayment);
        if (!existingPayment) {
          console.error('[handleEditSave] Payment not found! id:', editingRecord.id, 'payments count:', payments.length, 'all payment ids:', payments.map(p => p.id));
          toast.error('결제요청을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
          return;
        }

        console.log('[handleEditSave] Calling updatePaymentInAPI...');
        await updatePaymentInAPI(editingRecord.id, {
          ...existingPayment,
          process: formData.process,
          itemName: formData.itemName,
          materialAmount: materialCost,
          laborAmount: laborCost,
          vatAmount: vatAmount,
          amount: totalAmount,
          includesVAT: includeVat,
          requestDate: formData.date
        });
        console.log('[handleEditSave] updatePaymentInAPI completed');
        // updatePaymentInAPI가 이미 로컬 상태를 업데이트하므로 추가 로드 불필요
      } else {
        // 실행내역 수정 - 기존 레코드의 데이터 유지하면서 수정된 필드만 업데이트
        console.log('[handleEditSave] Updating execution record:', {
          id: editingRecord.id,
          materialCost,
          laborCost,
          vatAmount,
          totalAmount,
          includeVat,
          includeTaxDeduction,
          date: formData.date
        });
        await updateExecutionRecordInAPI(editingRecord.id, {
          project: formData.project || editingRecord.project,
          author: editingRecord.author,
          process: formData.process,
          itemName: formData.itemName,
          materialCost,
          laborCost,
          vatAmount,
          totalAmount,
          date: new Date(formData.date),
          notes: updatedNotes,
          images: updatedImages,
          paymentId: editingRecord.paymentId,
          includesTaxDeduction: includeTaxDeduction,
          includesVat: includeVat
        });
        // updateExecutionRecordInAPI가 이미 로컬 상태를 업데이트하므로 추가 로드 불필요
      }

      console.log('[handleEditSave] SUCCESS! Showing toast and resetting state...');
      toast.success('수정되었습니다');
      setEditingRecord(null);
      setSelectedRecord(null);
      setIncludeVat(false); // 부가세 체크 초기화
      setIncludeTaxDeduction(false); // 세금공제 체크 초기화
      // 폼 초기화
      setFormData(prev => ({
        ...prev,
        date: format(new Date(), 'yyyy-MM-dd'),
        process: '',
        itemName: '',
        materialCost: '',
        laborCost: '',
        images: [],
        quickText: '',
        quickImages: []
      }));
    } catch (error: any) {
      console.error('수정 실패:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '수정에 실패했습니다';
      toast.error(errorMessage);
    }
  };

  // 삭제 확인 팝업 표시 - recordKey는 type_id 형식
  const handleDeleteClick = (recordKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuId(null);

    // 클릭 위치 저장
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDeleteConfirm({
      recordId: recordKey, // type_id 형식으로 저장
      position: {
        x: rect.left,
        y: rect.bottom + 4
      }
    });
  };

  // 실제 삭제 실행
  const executeDelete = async () => {
    if (!deleteConfirm) return;

    const recordKey = deleteConfirm.recordId; // type_id 형식
    setDeleteConfirm(null);

    // type과 id 분리
    const { type, id } = parseSelectedRecord(recordKey);
    if (!type || !id) {
      toast.error('삭제할 수 없는 항목입니다');
      return;
    }

    try {
      if (type === 'manual') {
        // 실행내역 삭제
        await deleteExecutionRecordFromAPI(id);
        toast.success('실행내역이 삭제되었습니다');
      } else if (type === 'payment') {
        // 결제요청 삭제
        await deletePaymentFromAPI(id);
        toast.success('결제요청이 삭제되었습니다');
      } else {
        toast.error('삭제할 수 없는 항목입니다');
        return;
      }

      if (selectedRecord === recordKey) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다');
    }
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
    try {
      if (!selectedRecord) {
        toast.error('먼저 실행내역을 선택해주세요');
        return;
      }

      const files = Array.from(e.target?.files || []);
      if (files.length === 0) return;

      const imageFiles = files.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        toast.error('이미지 파일만 선택해주세요');
        return;
      }

      // 파일 크기 체크 (10MB 이상이면 경고)
      const largeFiles = imageFiles.filter(f => f.size > 10 * 1024 * 1024);
      if (largeFiles.length > 0) {
        toast.error('10MB 이상의 이미지는 처리가 오래 걸릴 수 있습니다');
      }

      // 모든 이미지를 Promise로 처리 (모바일 호환성 개선)
      Promise.all(
        imageFiles.map(file => {
          return new Promise<string>((resolve, reject) => {
            try {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                if (base64) {
                  resolve(base64);
                } else {
                  reject(new Error('이미지 읽기 실패'));
                }
              };
              reader.onerror = () => reject(new Error('FileReader 오류'));
              reader.readAsDataURL(file);
            } catch (err) {
              reject(err);
            }
          });
        })
      ).then(async newImages => {
        // type_id 형식에서 type과 id 분리
        const { type: selectedType, id: selectedId } = parseSelectedRecord(selectedRecord);
        if (!selectedType || !selectedId) {
          toast.error('레코드를 찾을 수 없습니다');
          return;
        }

        // 실행내역(manual) 레코드인지 확인
        if (selectedType === 'manual') {
          const executionRecord = executionRecords.find(r => r.id === selectedId);
          if (executionRecord) {
            // 실행내역인 경우 서버 API로 저장
            const existingImages = executionRecord.images || [];
            const updatedImages = [...existingImages, ...newImages];

            try {
              await updateExecutionRecordInAPI(selectedId, { images: updatedImages });
              toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
            } catch (error) {
              console.error('이미지 저장 실패:', error);
              toast.error('이미지 저장에 실패했습니다');
            }
          }
        } else {
          // 결제요청 레코드인 경우 로컬 저장소에 저장
          const existingImages = paymentRecordImages[selectedId] || [];
          setPaymentRecordImages(prev => ({
            ...prev,
            [selectedId]: [...existingImages, ...newImages]
          }));
          toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
        }
      }).catch(error => {
        console.error('이미지 처리 중 오류:', error);
        toast.error('이미지 추가 중 오류가 발생했습니다');
      });

      // input 초기화 (같은 파일 재선택 가능하도록)
      e.target.value = '';
    } catch (error) {
      console.error('파일 선택 처리 중 오류:', error);
      toast.error('파일 선택 중 오류가 발생했습니다');
    }
  };

  // 이미지 삭제
  const removeImage = async (index: number) => {
    if (!selectedRecord) return;

    // type_id 형식에서 type과 id 분리
    const { type: selectedType, id: selectedId } = parseSelectedRecord(selectedRecord);
    if (!selectedType || !selectedId) return;

    if (selectedType === 'manual') {
      const record = executionRecords.find(r => r.id === selectedId);
      if (record) {
        const updatedImages = record.images?.filter((_, i) => i !== index) || [];
        try {
          await updateExecutionRecordInAPI(selectedId, { images: updatedImages });
        } catch (error) {
          console.error('이미지 삭제 실패:', error);
        }
      }
    } else {
      // 결제요청 레코드인 경우
      setPaymentRecordImages(prev => ({
        ...prev,
        [selectedId]: prev[selectedId]?.filter((_, i) => i !== index) || []
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
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    // 모든 이미지를 Promise로 처리 (압축 포함)
    Promise.all(
      imageFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
    ).then(async newImages => {
      // type_id 형식에서 type과 id 분리
      const { type: selectedType, id: selectedId } = parseSelectedRecord(selectedRecord);
      if (!selectedType || !selectedId) {
        toast.error('레코드를 찾을 수 없습니다');
        return;
      }

      // 실행내역인 경우 서버에 저장
      if (selectedType === 'manual') {
        const record = executionRecords.find(r => r.id === selectedId);
        if (record) {
          const updatedImages = [...(record.images || []), ...newImages];
          try {
            await updateExecutionRecordInAPI(selectedId, { images: updatedImages });
          } catch (error) {
            console.error('이미지 저장 실패:', error);
          }
        }
      } else {
        // 결제요청 레코드인 경우 별도 저장소에 저장
        setPaymentRecordImages(prev => ({
          ...prev,
          [selectedId]: [...(prev[selectedId] || []), ...newImages]
        }));
      }
      toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
    }).catch(error => {
      console.error('이미지 처리 중 오류:', error);
      toast.error('이미지 추가 중 오류가 발생했습니다');
    });
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* 모바일에서 프로젝트 선택 */}
      <div className="md:hidden mb-4 space-y-2">
        <select
          value={formData.project}
          onChange={(e) => {
            setFormData({ ...formData, project: e.target.value });
            if (e.target.value) {
              localStorage.setItem('lastSelectedProject', e.target.value);
            }
          }}
          className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
        >
          {projects.map(project => (
            <option key={project.id} value={project.name}>{project.name}</option>
          ))}
          {user?.name !== '안팀' && <option value="기타">기타</option>}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
            className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
          />
          공사완료 현장 포함
        </label>
      </div>

      {/* 모바일에서 탭 표시 */}
      <div className="md:hidden border-b border-gray-200 mb-4">
        <div className="flex items-center justify-between">
          <nav className="flex space-x-4">
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
      </div>

      {/* 메인 컨텐츠 - 3열 레이아웃 (고정 높이로 독립 스크롤) */}
      <div className="execution-container grid grid-cols-1 md:grid-cols-6 ipad:grid-cols-6 ipad-lg:grid-cols-6 ipad-xl:grid-cols-12 ipad-2xl:grid-cols-12 gap-3 md:gap-4 md:h-[calc(100vh-120px)]">

        {/* 입력 폼 (2열) - 모바일에서는 showMobileForm이 true일 때만 표시 */}
        <div className={`execution-form md:col-span-2 ipad:col-span-2 ipad-lg:col-span-2 ipad-xl:col-span-2 ipad-2xl:col-span-2 bg-white rounded-lg border p-3 md:p-4 overflow-y-auto ${
          showMobileForm ? '' : 'hidden md:block'
        }`}>
          <div className="execution-form-inner space-y-4 w-full">
            {/* 프로젝트 선택 */}
            <div className="exec-project space-y-2">
              <select
                value={formData.project}
                onChange={(e) => {
                  setFormData({ ...formData, project: e.target.value });
                  // 선택한 프로젝트 저장
                  if (e.target.value) {
                    localStorage.setItem('lastSelectedProject', e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.name}>{project.name}</option>
                ))}
                {user?.name !== '안팀' && <option value="기타">기타</option>}
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

            {/* 빠른 입력 */}
            <div className="exec-quick-input">
              <textarea
                value={formData.quickText}
                onChange={(e) => setFormData({ ...formData, quickText: e.target.value })}
                onPaste={(e) => {
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
                          setFormData(prev => ({
                            ...prev,
                            quickImages: [...prev.quickImages, base64]
                          }));
                        };
                        reader.readAsDataURL(blob);
                      }
                      break;
                    }
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = Array.from(e.dataTransfer.files);
                  const imageFiles = files.filter(f => f.type.startsWith('image/'));
                  imageFiles.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const base64 = event.target?.result as string;
                      setFormData(prev => ({
                        ...prev,
                        quickImages: [...prev.quickImages, base64]
                      }));
                    };
                    reader.readAsDataURL(file);
                  });
                }}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder={isMobileDevice ? "청구 내역 붙여넣기" : "청구 내역 붙여넣기 (이미지 드래그 또는 Ctrl+V)"}
              />
              {/* 이미지 미리보기 */}
              {formData.quickImages.length > 0 && (
                <div className="mt-2 mb-2 grid grid-cols-3 gap-2">
                  {formData.quickImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img}
                        alt={`이미지 ${idx + 1}`}
                        className="w-full h-20 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            quickImages: prev.quickImages.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* 이미지 추가 & 자동 채우기 버튼 */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setFormData(prev => ({
                            ...prev,
                            quickImages: [...prev.quickImages, base64]
                          }));
                        };
                        reader.readAsDataURL(file);
                      });
                      e.target.value = '';
                    }}
                  />
                  <div className="w-full h-10 flex items-center justify-center bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300">
                    이미지 첨부
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleQuickTextParse}
                  className="h-10 flex items-center justify-center bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
                >
                  자동 채우기
                </button>
              </div>
            </div>

            {/* 날짜 & 공정 */}
            <div className="exec-date-process grid grid-cols-2 gap-2">
              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  날짜 {formData.date && `(${format(new Date(formData.date), 'E', { locale: ko })})`}
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 cursor-pointer text-gray-900"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    backgroundColor: 'white',
                    backgroundImage: 'none'
                  }}
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
            <div className="exec-item-name relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                onFocus={() => setIsItemNameFocused(true)}
                onBlur={() => {
                  // 약간의 딜레이를 줘서 추천 항목 클릭이 가능하도록
                  setTimeout(() => setIsItemNameFocused(false), 200);
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              {/* 항목명 추천 목록 (포커스 상태일 때만 표시) */}
              {isItemNameFocused && itemNameSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {itemNameSuggestions.map((itemName, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, itemName });
                        setItemNameSuggestions([]);
                        setIsItemNameFocused(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                    >
                      <div className="font-medium text-gray-900">{itemName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 금액 입력 */}
            <div className="exec-amounts space-y-2">
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
                <button
                  type="button"
                  className="flex items-center cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!includeVat) {
                      setIncludeTaxDeduction(false);
                    }
                    setIncludeVat(!includeVat);
                  }}
                >
                  <div className={`h-4 w-4 border rounded flex items-center justify-center ${includeVat ? 'bg-gray-600 border-gray-600' : 'border-gray-300'}`}>
                    {includeVat && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="ml-2 text-sm text-gray-700">
                    부가세 포함 (10%)
                  </span>
                </button>
                <button
                  type="button"
                  className="flex items-center cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!includeTaxDeduction) {
                      setIncludeVat(false);
                    }
                    setIncludeTaxDeduction(!includeTaxDeduction);
                  }}
                >
                  <div className={`h-4 w-4 border rounded flex items-center justify-center ${includeTaxDeduction ? 'bg-gray-600 border-gray-600' : 'border-gray-300'}`}>
                    {includeTaxDeduction && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="ml-2 text-sm text-gray-700">
                    3.3% 세금공제
                  </span>
                </button>
              </div>

            </div>

            {/* 총액 및 내역추가 */}
            <div className="exec-total-submit">
              <div className="exec-total pt-2 border-t">
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

              {/* 수정 모드 표시 */}
              {editingRecord && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                  <p className="text-sm text-blue-700 font-medium">수정 중: {editingRecord.itemName}</p>
                </div>
              )}

              {/* 내역추가/수정완료 버튼 */}
              <div className="exec-submit my-6" style={{ marginTop: '20px' }}>
                {editingRecord ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditCancel}
                      className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleEditSave}
                      className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                    >
                      수정 완료
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isSaving ? '저장 중...' : '내역추가'}
                  </button>
                )}
              </div>
            </div>

            {/* 총계 표시 - 태블릿/데스크톱에서만 표시 */}
            <div className="exec-summary hidden md:block bg-gray-50 rounded-lg p-3 md:p-4 space-y-2 md:mt-8 lg:mt-[114.67px]">
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
              <div className="flex justify-between items-center pt-2 border-t border-gray-200" style={{ marginTop: '10px' }}>
                <span className="text-sm font-bold text-gray-900">총 합계:</span>
                <span className="text-base font-bold text-gray-900">{projectTotals.total.toLocaleString()}원</span>
              </div>
            </div>

            {/* 검색 및 공정별 합계 버튼 - 데스크톱 전용 */}
            <div className="exec-search hidden ipad-xl:block mt-4 space-y-2">
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
              <button
                onClick={() => setShowProcessSummary(true)}
                className="w-full px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
              >
                공정별 합계
              </button>
            </div>
          </div>
        </div>

        {/* 중앙: 실행내역 목록 - 테이블 형식 (6열) */}
        <div className={`execution-list md:col-span-4 ipad:col-span-4 ipad-lg:col-span-4 ipad-xl:col-span-6 ipad-2xl:col-span-6 bg-white rounded-lg border overflow-hidden flex flex-col ${
          mobileView !== 'list' ? 'hidden md:flex' : ''
        }`}>
          {/* 모바일 상단: 합계, 공정별 합계 버튼 */}
          {mobileView === 'list' && (
            <div className="md:hidden border-b bg-gray-50 p-2 space-y-2">
              {/* 합계 정보 - 컴팩트 2행 */}
              <div className="bg-white rounded-lg px-3 py-2 border text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">자재비 <span className="font-medium text-gray-900">{projectTotals.material.toLocaleString()}</span></span>
                  <span className="text-gray-500">인건비 <span className="font-medium text-gray-900">{projectTotals.labor.toLocaleString()}</span></span>
                  <span className="text-gray-500">부가세 <span className="font-medium text-gray-900">{projectTotals.vat.toLocaleString()}</span></span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-100">
                  <span className="font-bold text-gray-900">총 합계</span>
                  <span className="font-bold text-gray-900">{projectTotals.total.toLocaleString()}원</span>
                </div>
              </div>

              {/* 공정별 합계 버튼 */}
              <button
                onClick={() => setShowProcessSummary(true)}
                className="w-full py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                공정별 합계
              </button>
            </div>
          )}

          {/* 모바일: 카드 형식, 데스크톱: 테이블 형식 */}
          <div className="flex-1 overflow-auto">
            {filteredRecords.length > 0 ? (
              <>
                {/* 태블릿/데스크톱 테이블 뷰 */}
                <table className="hidden md:table w-full">
                <thead className="bg-gray-50 sticky top-0 exec-table-header">
                  <tr className="text-left text-sm text-gray-700 border-b">
                    <th className="px-3 py-3 font-medium exec-th-author">작성자</th>
                    <th className="px-3 py-3 font-medium exec-th-date">날짜</th>
                    <th className="px-3 py-3 font-medium exec-th-process">공정</th>
                    <th className="px-3 py-3 font-medium exec-th-item">항목명</th>
                    <th className="px-3 py-3 font-medium text-right exec-th-material">자재비</th>
                    <th className="px-3 py-3 font-medium text-right exec-th-labor">인건비</th>
                    <th className="px-3 py-3 font-medium text-right exec-th-vat">부가세</th>
                    <th className="px-3 py-3 font-medium text-right exec-th-total">총액</th>
                    <th className="px-2 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record) => {
                    const recordKey = getRecordKey(record);
                    return (
                    <tr
                      key={recordKey}
                      data-record-id={recordKey}
                      className={`group hover:bg-gray-50 cursor-pointer text-sm ${selectedRecord === recordKey ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        setSelectedRecord(recordKey);
                        // 미분할 항목 선택 시 자동으로 금액분할 모드 열기
                        if (record.type === 'payment' && !appliedPaymentIds.includes(record.id)) {
                          setSplitModeRecord(recordKey);
                          setSplitMaterialCost(record.totalAmount || 0);
                          setSplitLaborCost(0);
                        }
                      }}
                    >
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap exec-author-col">
                        {record.author || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-600 exec-date-col">
                        <span className="exec-date-full">{format(new Date(record.date), 'yyyy-MM-dd (EEE)', { locale: ko })}</span>
                        <span className="exec-date-short whitespace-nowrap">{format(new Date(record.date), 'MM-dd (EEE)', { locale: ko })}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-600 exec-process-col">
                        {record.process || '-'}
                      </td>
                      <td className="px-3 py-3 font-medium exec-item-col">
                        {record.itemName}
                      </td>
                      <td className="px-3 py-3 text-right exec-material-col">
                        {(record.materialCost || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right exec-labor-col">
                        {(record.laborCost || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right exec-vat-col">
                        {(record.vatAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold exec-total-col">
                        <span className="exec-total-full">{(record.totalAmount || 0).toLocaleString()}원</span>
                        <span className="exec-total-short">{(record.totalAmount || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-2 py-3 text-center relative">
                        {/* 미분할 배지 - 호버 시 숨김, 절대 위치로 셀 높이 영향 없음 */}
                        {record.type === 'payment' && !appliedPaymentIds.includes(record.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded group-hover:opacity-0 transition-opacity">
                            미분할
                          </span>
                        )}
                        {/* 수정/삭제 버튼 - 호버 시 표시, 절대 위치로 배지 위에 겹침 */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEditClick(record as ExecutionRecord, e)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(recordKey, e)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>

              {/* 모바일 카드 뷰 - 컴팩트 레이아웃 */}
              <div className="md:hidden space-y-1.5 p-2">
                {filteredRecords.map((record) => {
                  const recordKey = getRecordKey(record);
                  return (
                  <div
                    key={recordKey}
                    data-record-id={recordKey}
                    className={`border rounded-lg px-3 py-2 relative ${
                      selectedRecord === recordKey ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    }`}
                    onClick={() => {
                      setSelectedRecord(recordKey);
                      setMobileView('image');
                      // 미분할 항목 선택 시 자동으로 금액분할 모드 열기
                      if (record.type === 'payment' && !appliedPaymentIds.includes(record.id)) {
                        setSplitModeRecord(recordKey);
                        setSplitMaterialCost(record.totalAmount || 0);
                        setSplitLaborCost(0);
                      }
                    }}
                  >
                    {/* 1행: 항목명 + 총액 + 미분할배지/더보기 */}
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-gray-900 text-sm truncate flex-1 mr-2">{record.itemName}</p>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold text-gray-900 shrink-0">
                          {(record.totalAmount || 0).toLocaleString()}원
                        </p>
                        {record.type === 'payment' && !appliedPaymentIds.includes(record.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded shrink-0">
                            미분할
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(actionMenuId === recordKey ? null : recordKey);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* 2행: 공정, 작성자, 날짜 + 자재비/인건비/부가세 */}
                    <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                      <span>{record.process || '-'} · {record.author || '-'} · {format(new Date(record.date), 'MM.dd', { locale: ko })}</span>
                      <span className="text-[10px] text-gray-400">
                        자재비 {(record.materialCost || 0).toLocaleString()} · 인건비 {(record.laborCost || 0).toLocaleString()} · 부가세 {(record.vatAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    {/* 액션 메뉴 */}
                    {actionMenuId === recordKey && (
                      <div className="absolute right-2 top-8 bg-white border rounded-lg shadow-lg z-10 py-1">
                        <button
                          onClick={(e) => handleEditClick(record as ExecutionRecord, e)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          수정
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(recordKey, e)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                실행내역이 없습니다
              </div>
            )}
          </div>

          {/* 하단 검색 및 공정별 합계 버튼 영역 - 태블릿 전용 (데스크톱은 왼쪽 카드에 표시) */}
          <div className="hidden md:block ipad-xl:hidden border-t bg-gray-50 p-3">
            <div className="flex flex-row items-center gap-3">
              {/* 태블릿/데스크톱 검색 입력창 */}
              <div className="flex-1 max-w-sm">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm md:text-sm lg:text-base"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* 버튼들 */}
              <div className="flex items-center justify-end gap-2">
                {selectedRecord && (
                  <button
                    onClick={async () => {
                      // type과 id 분리
                      const { type, id } = parseSelectedRecord(selectedRecord);
                      if (!type || !id) {
                        toast.error('삭제할 수 없는 항목입니다');
                        return;
                      }

                      if (type === 'manual') {
                        // 실행내역 삭제
                        if (confirm('선택한 실행내역을 삭제하시겠습니까?')) {
                          try {
                            await deleteExecutionRecordFromAPI(id);
                            setSelectedRecord(null);
                            toast.success('실행내역이 삭제되었습니다');
                          } catch (error) {
                            console.error('실행내역 삭제 실패:', error);
                            toast.error('실행내역 삭제에 실패했습니다');
                          }
                        }
                      } else if (type === 'payment') {
                        // payment 타입(결제요청)은 실행내역에서만 숨김
                        if (confirm('이 결제요청을 실행내역에서 숨기시겠습니까?\n(결제요청 자체는 삭제되지 않습니다)')) {
                          setHiddenPaymentIds(prev => [...prev, id]);
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
                  className="px-3 py-2 text-sm md:px-3 lg:px-4 lg:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium whitespace-nowrap"
                >
                  공정별 합계
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 이미지 업로드 및 뷰어 (4열) */}
        <div
          className={`execution-images md:col-span-6 ipad:col-span-6 ipad-lg:col-span-6 ipad-xl:col-span-4 ipad-2xl:col-span-4 bg-white rounded-lg border flex flex-col overflow-hidden ${
            mobileView !== 'image' ? 'hidden md:flex' : ''
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
            // type_id 형식으로 레코드 찾기
            const record = allRecords.find(r => getRecordKey(r) === selectedRecord);
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900">
                        ₩{(record.totalAmount || 0).toLocaleString()}
                      </p>
                      {record.type === 'payment' && !appliedPaymentIds.includes(record.id) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">
                          미분할
                        </span>
                      )}
                    </div>
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
              // 이미지나 삭제 버튼, 입력 필드 클릭이 아닌 경우에만 파일 선택 다이얼로그 열기
              const target = e.target as HTMLElement;
              if (!target.closest('img') && !target.closest('button') && !target.closest('textarea') && !target.closest('input') && !target.closest('label') && selectedRecord) {
                const images = (() => {
                  // type_id 형식에서 레코드 찾기
                  const fullRecord = allRecords.find(r => getRecordKey(r) === selectedRecord);
                  const { type: selectedType, id: selectedId } = parseSelectedRecord(selectedRecord);
                  const record = selectedType === 'manual' && selectedId
                    ? executionRecords.find(r => r.id === selectedId)
                    : null;
                  // allRecords의 images에 이미 paymentRecordImages가 포함되어 있음
                  return fullRecord?.images || record?.images || [];
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
              // type_id 형식에서 type과 id 분리
              const { type: selectedType, id: selectedId } = parseSelectedRecord(selectedRecord);
              const record = selectedType === 'manual' && selectedId
                ? executionRecords.find(r => r.id === selectedId)
                : null;
              // allRecords에서 type과 id 모두 일치하는 레코드 찾기
              const fullRecord = allRecords.find(r => getRecordKey(r) === selectedRecord);
              // allRecords의 images에 이미 paymentRecordImages가 포함되어 있음
              const images = fullRecord?.images || record?.images || [];

              // 디버깅: 선택된 레코드의 이미지 상태
              const originalPayment = selectedType === 'payment' && selectedId
                ? payments.find(p => p.id === selectedId)
                : null;
              console.log('[ExecutionHistory] 선택된 레코드:', {
                selectedRecord,
                selectedType,
                selectedId,
                fullRecordExists: !!fullRecord,
                fullRecordType: fullRecord?.type,
                fullRecordImages: fullRecord?.images?.length || 0,
                recordExists: !!record,
                recordImages: record?.images?.length || 0,
                originalPaymentExists: !!originalPayment,
                originalPaymentImages: originalPayment?.images?.length || 0,
                paymentRecordImagesForId: selectedId ? paymentRecordImages[selectedId]?.length || 0 : 0,
                finalImagesCount: images.length
              });

              return (
                <div className="h-full flex flex-col">
                  {/* 결제요청 금액 분할 기능 - 해당 레코드가 적용 완료 목록에 있으면 숨김 */}
                  {fullRecord?.type === 'payment' && !appliedPaymentIds.includes(fullRecord.id) && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {/* 결제요청 금액 정보 + 100% 버튼 */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">결제요청 금액:</p>
                          <p className="text-sm text-gray-700">
                            총 {fullRecord.totalAmount?.toLocaleString()}원
                            {fullRecord.itemName && ` (${fullRecord.itemName})`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSplitModeRecord(selectedRecord);
                              setSplitMaterialCost(fullRecord.totalAmount || 0);
                              setSplitLaborCost(0);
                            }}
                            className="px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            자재비 100%
                          </button>
                          <button
                            onClick={() => {
                              setSplitModeRecord(selectedRecord);
                              setSplitMaterialCost(0);
                              setSplitLaborCost(fullRecord.totalAmount || 0);
                            }}
                            className="px-2 py-1 text-[10px] font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            인건비 100%
                          </button>
                        </div>
                      </div>

                      {/* 금액 분할 입력 영역 - 항상 표시 */}
                      {splitModeRecord === selectedRecord && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-900 mb-1">자재비</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={splitMaterialCost === '' ? '' : splitMaterialCost.toLocaleString()}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                  const numValue = value === '' ? '' : parseInt(value, 10);
                                  setSplitMaterialCost(numValue);
                                  // 인건비 자동 계산
                                  const totalAmount = fullRecord.totalAmount || 0;
                                  if (numValue !== '') {
                                    setSplitLaborCost(Math.max(0, totalAmount - numValue));
                                  } else {
                                    setSplitLaborCost('');
                                  }
                                }}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-900 mb-1">인건비</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={splitLaborCost === '' ? '' : splitLaborCost.toLocaleString()}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                  const numValue = value === '' ? '' : parseInt(value, 10);
                                  setSplitLaborCost(numValue);
                                  // 자재비 자동 계산
                                  const totalAmount = fullRecord.totalAmount || 0;
                                  if (numValue !== '') {
                                    setSplitMaterialCost(Math.max(0, totalAmount - numValue));
                                  } else {
                                    setSplitMaterialCost('');
                                  }
                                }}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const materialValue = splitMaterialCost === '' ? 0 : splitMaterialCost;
                                const laborValue = splitLaborCost === '' ? 0 : splitLaborCost;

                                // fullRecord.id는 순수 ID (allRecords에서 가져온 원본 ID)
                                console.log('[금액분할] 적용 시도:', {
                                  fullRecordId: fullRecord.id,
                                  materialValue,
                                  laborValue
                                });

                                // 금액 분할 UI만 숨기기 (레코드 선택은 유지)
                                setSplitModeRecord(null);
                                setSplitMaterialCost('');
                                setSplitLaborCost('');

                                // 해당 결제요청 ID를 적용 완료 목록에 추가
                                const newAppliedIds = [...appliedPaymentIds, fullRecord.id];
                                setAppliedPaymentIds(newAppliedIds);
                                localStorage.setItem('executionHistory_appliedPaymentIds', JSON.stringify(newAppliedIds));

                                try {
                                  // 결제요청 금액만 업데이트 (새로운 PATCH API 사용)
                                  console.log('[금액분할] API 호출 시작...');
                                  console.log('[금액분할] fullRecord 정보:', {
                                    id: fullRecord.id,
                                    totalAmount: fullRecord.totalAmount,
                                    includesVAT: (fullRecord as any).includesVAT
                                  });
                                  const result = await paymentService.updatePaymentAmounts(
                                    fullRecord.id,
                                    materialValue,
                                    laborValue
                                  );
                                  console.log('[금액분할] API 호출 성공:', result);

                                  // 결제요청 목록 다시 로드
                                  console.log('[금액분할] 결제요청 목록 다시 로드...');
                                  await loadPaymentsFromAPI();
                                  console.log('[금액분할] 로드 완료');

                                  toast.success('금액이 적용되었습니다.');
                                } catch (error: any) {
                                  console.error('금액 적용 실패:', error);
                                  console.error('에러 상세:', error?.response?.data || error?.message);
                                  toast.error('금액 적용에 실패했습니다.');
                                }
                              }}
                              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              입력 적용
                            </button>
                            <button
                              onClick={() => {
                                setSplitModeRecord(null);
                                setSplitMaterialCost('');
                                setSplitLaborCost('');
                              }}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 메모 입력 필드 추가 */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">메모</label>
                    <textarea
                      value={executionMemos[selectedRecord] !== undefined
                        ? executionMemos[selectedRecord]
                        : ((fullRecord as any)?.quickText || fullRecord?.notes || '')}
                      onChange={(e) => {
                        setExecutionMemos(prev => ({
                          ...prev,
                          [selectedRecord]: e.target.value
                        }));
                      }}
                      placeholder="메모를 입력하세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none"
                      rows={12}
                    />
                  </div>

                  {/* 이미지 그리드 - 모바일 2열, 데스크탑 3열 */}
                  {images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                      {images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img}
                            alt={`증빙 ${index + 1}`}
                            className="w-full aspect-square object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity border bg-gray-100"
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
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                            {index + 1}/{images.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 이미지 추가 버튼 */}
                  <label
                    htmlFor="image-file-input"
                    className={`block cursor-pointer ${images.length > 0 ? '' : 'flex-1'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors flex flex-col items-center justify-center ${
                        isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                      } ${images.length > 0 ? 'min-h-[80px]' : 'min-h-[200px]'}`}
                    >
                      <Upload className={`mx-auto text-gray-400 mb-1 ${images.length > 0 ? 'h-6 w-6' : 'h-10 w-10 mb-2'}`} />
                      <p className="text-sm font-medium text-gray-700">
                        {images.length > 0 ? '이미지 첨부' : '클릭하여 선택'}
                      </p>
                      {images.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">또는 이미지를 드래그하거나 Ctrl+V로 붙여넣기</p>
                      )}
                    </div>
                  </label>
                </div>
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
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            // 데스크탑에서만 배경 클릭 시 닫기 (768px 이상)
            if (window.innerWidth >= 768 && e.target === e.currentTarget) {
              setShowProcessSummary(false);
            }
          }}
        >
          <div className="bg-white rounded-t-2xl md:rounded-lg w-full md:max-w-4xl max-h-[85vh] md:max-h-[80vh] overflow-hidden md:m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 md:p-5 lg:p-6 border-b">
              <h2 className="text-lg md:text-lg lg:text-xl font-bold text-gray-900">공정별 합계</h2>
              <button
                onClick={() => setShowProcessSummary(false)}
                className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 md:p-5 lg:p-6 overflow-y-auto max-h-[calc(85vh-120px)] md:max-h-[calc(80vh-120px)]">
              {getProcessSummary().length > 0 ? (
                <>
                  {/* 태블릿/데스크톱 테이블 뷰 */}
                  <table className="hidden md:table w-full">
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
                  <div className="md:hidden space-y-3">
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
          <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
                  {PAYMENT_PROCESS_LIST.map((process) => (
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

          {/* 태블릿/데스크톱: 버튼 근처 팝업 */}
          <div className="hidden md:block fixed inset-0 z-40" onClick={() => setShowProcessPicker(false)}>
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
                  {PAYMENT_PROCESS_LIST.map((process) => (
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

      {/* 삭제 확인 팝업 */}
      {deleteConfirm && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDeleteConfirm(null)}
          />
          {/* 팝업 */}
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[160px]"
            style={{
              left: Math.min(deleteConfirm.position.x, window.innerWidth - 180),
              top: Math.min(deleteConfirm.position.y, window.innerHeight - 100)
            }}
          >
            <p className="text-sm text-gray-700 mb-3">정말 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
              >
                삭제
              </button>
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
            {modalImage ? (
              <img
                src={modalImage}
                alt="원본 이미지"
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
                onError={() => {
                  toast.error('이미지를 불러올 수 없습니다');
                  setShowImageModal(false);
                }}
              />
            ) : (
              <div className="text-white text-center p-4">
                <p>이미지를 불러올 수 없습니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">실행내역 수정</h3>
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingRecord(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 공정 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공정</label>
                <select
                  value={editFormData.process}
                  onChange={(e) => setEditFormData({ ...editFormData, process: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택</option>
                  {PAYMENT_PROCESS_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {/* 항목명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
                <input
                  type="text"
                  value={editFormData.itemName}
                  onChange={(e) => setEditFormData({ ...editFormData, itemName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 자재비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자재비</label>
                <input
                  type="number"
                  value={editFormData.materialCost}
                  onChange={(e) => setEditFormData({ ...editFormData, materialCost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 인건비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">인건비</label>
                <input
                  type="number"
                  value={editFormData.laborCost}
                  onChange={(e) => setEditFormData({ ...editFormData, laborCost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingRecord(null);
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionHistory;