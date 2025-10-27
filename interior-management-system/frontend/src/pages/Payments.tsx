import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataStore, type Payment } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';

type PaymentRequest = Payment;
import { Search, Trash2, ImageIcon, X, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import contractorService from '../services/contractorService';

// 협력업체 타입 정의
interface Contractor {
  id?: string;
  _id?: string;
  rank?: number;
  companyName: string;
  name: string;
  process: string;
  contact?: string;
  accountNumber?: string;
  bankName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// List of Korean position titles
const positions = [
  '대표이사', '부사장', '전무', '상무', '이사', '실장', '부장', '차장', '과장', '대리',
  '주임', '사원', '팀장', '소장', '대표', '사장', '회장', '반장', '현장', '본부장',
  '팀원', '파트장', '조장', '감독', '기사', '수석', '책임'
];

// Remove position from name
const removePosition = (name: string): string => {
  if (!name) return name;
  const cleanName = name.replace(/님$/g, '').trim();
  const parts = cleanName.split(' ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    for (const position of positions) {
      if (lastPart === position) {
        return parts.slice(0, -1).join(' ').trim();
      }
    }
  }
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      return cleanName.substring(0, cleanName.length - position.length).trim();
    }
  }
  return cleanName;
};

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

const Payments = () => {
  const {
    payments,
    loadPaymentsFromAPI,
    addPaymentToAPI,
    deletePaymentFromAPI,
    updatePaymentInAPI,
    projects
  } = useDataStore();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null); // 수정 모드 추적
  const [isDragging, setIsDragging] = useState(false);
  const [includeVat, setIncludeVat] = useState(false);
  const [includeTaxDeduction, setIncludeTaxDeduction] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');
  const [mobileView, setMobileView] = useState<'form' | 'list' | 'image'>('form');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showProcessPicker, setShowProcessPicker] = useState(false);
  const processButtonRef = useRef<HTMLButtonElement>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed'>('pending');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentRequest | null>(null);

  // 협력업체 관련 상태
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [recommendedContractors, setRecommendedContractors] = useState<Contractor[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);

  // 송금완료 내역에서 계좌정보 추천
  const [accountSuggestions, setAccountSuggestions] = useState<Array<{
    accountHolder: string;
    bankName: string;
    accountNumber: string;
  }>>([]);

  // 항목명 추천
  const [itemNameSuggestions, setItemNameSuggestions] = useState<string[]>([]);
  const [isItemNameFocused, setIsItemNameFocused] = useState(false);

  // 결제요청 레코드의 이미지를 저장하는 별도의 상태
  const [paymentRecordImages, setPaymentRecordImages] = useState<Record<string, string[]>>(() => {
    const stored = localStorage.getItem('paymentRecordImages');
    return stored ? JSON.parse(stored) : {};
  });

  // 마지막 선택된 프로젝트 불러오기
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
    amount: '' as number | string,
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    images: [] as string[]
  });

  // 협력업체 로드
  useEffect(() => {
    const loadContractors = async () => {
      try {
        const data = await contractorService.getAllContractors();
        setContractors(data.map((c: Contractor) => ({
          id: c._id || c.id,
          rank: c.rank,
          companyName: c.companyName,
          name: c.name,
          process: c.process,
          contact: c.contact,
          accountNumber: c.accountNumber,
          bankName: c.bankName,
          notes: c.notes,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt)
        })));
      } catch (err) {
        console.error('Failed to load contractors:', err);
      }
    };
    loadContractors();
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    loadPaymentsFromAPI().catch(error => {
      console.error('Failed to load payments:', error);
    });

    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    if (projects.length > 0 && !formData.project) {
      const initialProject = getInitialProject();
      if (initialProject) {
        setFormData(prev => ({ ...prev, project: initialProject }));
        localStorage.setItem('lastSelectedProject', initialProject);
      }
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, [loadPaymentsFromAPI, projects]);

  // 공정 변경 시 해당 공정의 협력업체 필터링
  useEffect(() => {
    if (formData.process) {
      const paidAccountHolders = new Set(
        payments
          .filter(p => p.status === 'completed' && p.bankInfo?.accountHolder)
          .map(p => p.bankInfo!.accountHolder.trim().toLowerCase())
      );

      const filtered = contractors.filter(contractor => {
        const processMatch =
          contractor.process.toLowerCase().includes(formData.process.toLowerCase()) ||
          formData.process.toLowerCase().includes(contractor.process.toLowerCase());

        if (!processMatch) return false;

        const hasAccountNumber = contractor.accountNumber && contractor.accountNumber.trim() !== '';
        const contractorName = contractor.name.trim().toLowerCase();
        const hasPaidBefore = paidAccountHolders.has(contractorName);

        return hasAccountNumber || hasPaidBefore;
      });

      const sorted = filtered.sort((a, b) => {
        const aHasAccount = a.accountNumber && a.accountNumber.trim() !== '';
        const bHasAccount = b.accountNumber && b.accountNumber.trim() !== '';
        if (aHasAccount && !bHasAccount) return -1;
        if (!aHasAccount && bHasAccount) return 1;
        return 0;
      });

      setRecommendedContractors(sorted);
    } else {
      setRecommendedContractors([]);
    }
  }, [formData.process, contractors, payments]);

  // 예금주 이름 입력 시 송금완료 내역과 협력업체에서 계좌정보 검색
  useEffect(() => {
    if (formData.accountHolder && formData.accountHolder.trim().length >= 1) {
      const searchName = formData.accountHolder.trim().toLowerCase();

      const uniqueAccounts = new Map<string, {
        accountHolder: string;
        bankName: string;
        accountNumber: string;
      }>();

      // 현재 선택된 협력업체의 계좌정보 (중복 추천 방지용)
      let selectedContractorAccount: string | null = null;
      if (selectedContractorId) {
        const selectedContractor = contractors.find(c =>
          (c.id || c._id) === selectedContractorId
        );
        if (selectedContractor && selectedContractor.accountNumber && selectedContractor.bankName) {
          const cleanName = removePosition(selectedContractor.name).trim();
          selectedContractorAccount = `${cleanName}_${selectedContractor.bankName}_${selectedContractor.accountNumber}`;
        }
      }

      // 1. 송금완료된 결제 내역에서 예금주 이름으로 검색
      const completedPayments = payments.filter(p =>
        p.status === 'completed' &&
        p.bankInfo?.accountHolder &&
        p.bankInfo?.bankName &&
        p.bankInfo?.accountNumber
      );

      completedPayments.forEach(p => {
        const holder = p.bankInfo!.accountHolder.trim();
        const holderLower = holder.toLowerCase();

        // 예금주 이름이 포함되어 있으면 추천 목록에 추가
        if (holderLower.includes(searchName) || searchName.includes(holderLower)) {
          const key = `${holder}_${p.bankInfo!.bankName}_${p.bankInfo!.accountNumber}`;

          // 선택된 협력업체와 중복되는 경우 제외
          if (key !== selectedContractorAccount && !uniqueAccounts.has(key)) {
            uniqueAccounts.set(key, {
              accountHolder: holder,
              bankName: p.bankInfo!.bankName,
              accountNumber: p.bankInfo!.accountNumber
            });
          }
        }
      });

      // 2. 협력업체 데이터에서 예금주 이름으로 검색 (선택된 협력업체는 제외)
      contractors.forEach(contractor => {
        // 이미 선택된 협력업체는 제외
        if ((contractor.id || contractor._id) === selectedContractorId) {
          return;
        }

        // 계좌번호와 은행 정보가 있는 협력업체만 추천
        if (contractor.accountNumber && contractor.bankName) {
          const cleanName = removePosition(contractor.name).trim();
          const nameLower = cleanName.toLowerCase();

          // 예금주 이름이 포함되어 있으면 추천 목록에 추가
          if (nameLower.includes(searchName) || searchName.includes(nameLower)) {
            const key = `${cleanName}_${contractor.bankName}_${contractor.accountNumber}`;
            if (!uniqueAccounts.has(key)) {
              uniqueAccounts.set(key, {
                accountHolder: cleanName,
                bankName: contractor.bankName,
                accountNumber: contractor.accountNumber
              });
            }
          }
        }
      });

      setAccountSuggestions(Array.from(uniqueAccounts.values()));
    } else {
      setAccountSuggestions([]);
    }
  }, [formData.accountHolder, payments, contractors, selectedContractorId]);

  // 항목명 입력 시 기존 결제요청 내역에서 추천 (포커스 시에만)
  useEffect(() => {
    if (isItemNameFocused && formData.itemName && formData.itemName.trim().length >= 1) {
      const searchText = formData.itemName.trim().toLowerCase();

      // 모든 결제 내역에서 항목명 추출 (최신순)
      const allItemNames = [...payments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(p => p.itemName)
        .filter(name => name && name.toLowerCase().includes(searchText));

      // 중복 제거
      const uniqueItemNames = Array.from(new Set(allItemNames));

      setItemNameSuggestions(uniqueItemNames.slice(0, 10)); // 최대 10개만 표시
    } else {
      setItemNameSuggestions([]);
    }
  }, [formData.itemName, payments, isItemNameFocused]);

  // 예금주 입력칸 포커스 시 모든 이전 송금내역 표시
  const handleAccountHolderFocus = useCallback(() => {
    // 추천 협력업체에서 선택한 경우는 제외
    if (selectedContractorId) {
      return;
    }

    // 예금주가 비어있을 때만 모든 내역 표시
    if (!formData.accountHolder || formData.accountHolder.trim().length === 0) {
      const uniqueAccounts = new Map<string, {
        accountHolder: string;
        bankName: string;
        accountNumber: string;
      }>();

      // 송금완료된 결제 내역에서 모든 계좌정보 가져오기
      const completedPayments = payments.filter(p =>
        p.status === 'completed' &&
        p.bankInfo?.accountHolder &&
        p.bankInfo?.bankName &&
        p.bankInfo?.accountNumber
      );

      completedPayments.forEach(p => {
        const holder = p.bankInfo!.accountHolder.trim();
        const key = `${holder}_${p.bankInfo!.bankName}_${p.bankInfo!.accountNumber}`;

        if (!uniqueAccounts.has(key)) {
          uniqueAccounts.set(key, {
            accountHolder: holder,
            bankName: p.bankInfo!.bankName,
            accountNumber: p.bankInfo!.accountNumber
          });
        }
      });

      // 협력업체 데이터에서 계좌정보가 있는 업체 추가
      contractors.forEach(contractor => {
        if (contractor.accountNumber && contractor.bankName) {
          const cleanName = removePosition(contractor.name).trim();
          const key = `${cleanName}_${contractor.bankName}_${contractor.accountNumber}`;

          if (!uniqueAccounts.has(key)) {
            uniqueAccounts.set(key, {
              accountHolder: cleanName,
              bankName: contractor.bankName,
              accountNumber: contractor.accountNumber
            });
          }
        }
      });

      setAccountSuggestions(Array.from(uniqueAccounts.values()));
    }
  }, [formData.accountHolder, payments, contractors, selectedContractorId]);

  // paymentRecordImages가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('paymentRecordImages', JSON.stringify(paymentRecordImages));
  }, [paymentRecordImages]);

  // 클립보드 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!selectedRecord) {
      toast.error('먼저 결제요청을 선택해주세요');
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
            setPaymentRecordImages(prev => ({
              ...prev,
              [selectedRecord]: [...(prev[selectedRecord] || []), base64]
            }));
            toast.success('이미지가 추가되었습니다');
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, [selectedRecord]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // 결제요청 레코드 (최신순 정렬)
  const allRecords = [...payments].sort((a, b) =>
    new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
  );

  // 필터링 (대기중/송금완료 탭에서는 모든 프로젝트 표시)
  const filteredRecords = allRecords.filter(record => {
    const matchesSearch = searchTerm === '' ||
      record.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.process?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 협력업체 선택 핸들러
  const handleContractorSelect = (contractor: Contractor) => {
    const contractorId = contractor.id || contractor._id || null;

    // 이미 선택된 협력업체를 다시 클릭하면 선택 해제
    if (selectedContractorId === contractorId) {
      setSelectedContractorId(null);
      // 예금주 필드를 포커스하여 이전 송금내역 표시
      const accountHolderInput = document.querySelector('input[placeholder="예금주명을 입력하세요"]') as HTMLInputElement;
      if (accountHolderInput) {
        setTimeout(() => {
          accountHolderInput.focus();
        }, 100);
      }
      return;
    }

    setSelectedContractorId(contractorId);
    const cleanName = removePosition(contractor.name);

    // accountNumber에서 은행 이름과 계좌번호 분리
    let bankName = contractor.bankName || '';
    let accountNumber = contractor.accountNumber || '';

    // accountNumber에 은행 이름이 포함되어 있는 경우 분리
    if (accountNumber && !bankName) {
      // "은행이름 계좌번호" 형태인 경우
      const parts = accountNumber.trim().split(/\s+/);
      if (parts.length >= 2) {
        // 첫 번째 부분이 은행 이름일 가능성이 높음
        const firstPart = parts[0];
        // 은행 이름으로 끝나는지 확인
        if (firstPart.includes('은행') || firstPart.includes('뱅크') || firstPart.includes('금고') || firstPart.includes('신협') || firstPart.includes('우체국')) {
          bankName = firstPart;
          accountNumber = parts.slice(1).join('');
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      accountHolder: cleanName,
      bankName: bankName,
      accountNumber: accountNumber
    }));
  };

  // 프로젝트별 총계 계산
  const projectTotals = filteredRecords.reduce((acc, record) => {
    const materialCost = record.materialAmount || 0;
    const laborCost = record.laborAmount || 0;
    const totalAmount = record.amount || 0;

    let materialSupplyAmount = materialCost;
    let laborSupplyAmount = laborCost;
    let vatAmount = 0;

    if (materialCost === 0 && laborCost === 0 && totalAmount > 0) {
      if (record.includesVAT) {
        materialSupplyAmount = Math.round(totalAmount / 1.1);
        vatAmount = totalAmount - materialSupplyAmount;
      } else {
        materialSupplyAmount = totalAmount;
        vatAmount = 0;
      }
    } else {
      if (record.includesVAT) {
        if (materialCost > 0) {
          materialSupplyAmount = Math.round(materialCost / 1.1);
        }
        if (laborCost > 0) {
          laborSupplyAmount = Math.round(laborCost / 1.1);
        }
        vatAmount = totalAmount - (materialSupplyAmount + laborSupplyAmount);
      } else {
        vatAmount = 0;
      }
    }

    acc.material += materialSupplyAmount;
    acc.labor += laborSupplyAmount;
    acc.vat += vatAmount;
    acc.total += totalAmount;
    return acc;
  }, { material: 0, labor: 0, vat: 0, total: 0 });

  // 폼 저장
  const handleSave = async () => {
    if (!formData.project) {
      toast.error('프로젝트를 선택해주세요');
      return;
    }
    if (!formData.itemName) {
      toast.error('항목명을 입력해주세요');
      return;
    }

    const materialCost = Number(formData.materialCost) || 0;
    const laborCost = Number(formData.laborCost) || 0;
    const baseAmount = materialCost + laborCost;

    if (baseAmount === 0) {
      toast.error('금액을 입력해주세요');
      return;
    }

    // 3.3% 세금공제 시 각 금액에 0.967 적용
    const finalMaterialCost = includeTaxDeduction ? Math.round(materialCost * 0.967) : materialCost;
    const finalLaborCost = includeTaxDeduction ? Math.round(laborCost * 0.967) : laborCost;
    const totalAmount = finalMaterialCost + finalLaborCost;

    const now = new Date();

    // 수정 모드인 경우
    if (editingPaymentId) {
      const updatedPayment: Partial<PaymentRequest> = {
        project: formData.project,
        requestDate: new Date(formData.date),
        purpose: formData.itemName,
        amount: totalAmount,
        process: formData.process,
        itemName: formData.itemName,
        includesVAT: includeVat,
        applyTaxDeduction: includeTaxDeduction,
        materialAmount: finalMaterialCost,
        laborAmount: finalLaborCost,
        originalLaborAmount: laborCost,
        accountHolder: formData.accountHolder,
        bank: formData.bankName,
        accountNumber: formData.accountNumber,
        bankInfo: formData.accountHolder || formData.bankName || formData.accountNumber ? {
          accountHolder: formData.accountHolder,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber
        } : undefined,
        updatedAt: now
      };

      await updatePaymentInAPI(editingPaymentId, updatedPayment);
      toast.success('결제요청이 수정되었습니다');

      // 수정 모드 해제
      setEditingPaymentId(null);
    } else {
      // 새 결제요청 추가
      const newPayment: PaymentRequest = {
        id: `payment_${Date.now()}`,
        project: formData.project,
        requestDate: new Date(formData.date),
        requestedBy: user?.name || '알 수 없음',
        purpose: formData.itemName,
        amount: totalAmount,
        status: 'pending',
        process: formData.process,
        itemName: formData.itemName,
        includesVAT: includeVat,
        applyTaxDeduction: includeTaxDeduction,
        materialAmount: finalMaterialCost,
        laborAmount: finalLaborCost,
        originalLaborAmount: laborCost,
        accountHolder: formData.accountHolder,
        bank: formData.bankName,
        accountNumber: formData.accountNumber,
        bankInfo: formData.accountHolder || formData.bankName || formData.accountNumber ? {
          accountHolder: formData.accountHolder,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber
        } : undefined,
        createdAt: now,
        updatedAt: now
      };

      await addPaymentToAPI(newPayment);
      toast.success('결제요청이 추가되었습니다');
    }

    // 폼 초기화 (프로젝트는 유지)
    setFormData(prev => ({
      project: prev.project,
      date: format(new Date(), 'yyyy-MM-dd'),
      process: '',
      itemName: '',
      materialCost: '',
      laborCost: '',
      amount: '',
      accountHolder: '',
      bankName: '',
      accountNumber: '',
      images: []
    }));
    setIncludeVat(false);
    setIncludeTaxDeduction(false);
    setSelectedContractorId(null);

    // 모바일에서는 리스트로 전환
    if (isMobileDevice) {
      setMobileView('list');
    }
  };

  // 수정하기
  const handleEdit = (payment: PaymentRequest) => {
    // 원본 금액 사용 (세금공제 적용 전 금액)
    const originalMaterial = payment.originalMaterialAmount !== undefined
      ? payment.originalMaterialAmount
      : payment.materialAmount || 0;
    const originalLabor = payment.originalLaborAmount !== undefined
      ? payment.originalLaborAmount
      : payment.laborAmount || 0;

    // 폼 데이터 채우기
    setFormData({
      project: payment.project,
      date: format(new Date(payment.requestDate), 'yyyy-MM-dd'),
      process: payment.process || '',
      itemName: payment.itemName || payment.purpose || '',
      materialCost: originalMaterial > 0 ? originalMaterial.toString() : '',
      laborCost: originalLabor > 0 ? originalLabor.toString() : '',
      amount: payment.amount?.toString() || '',
      accountHolder: payment.bankInfo?.accountHolder || '',
      bankName: payment.bankInfo?.bankName || '',
      accountNumber: payment.bankInfo?.accountNumber || '',
      images: payment.attachments || []
    });

    // VAT 및 세금공제 체크박스 설정
    setIncludeVat(payment.includesVAT || false);
    setIncludeTaxDeduction(payment.applyTaxDeduction || false);

    // 선택된 레코드 설정
    setSelectedRecord(payment.id);

    // 수정 모드 설정
    setEditingPaymentId(payment.id);

    // 모바일에서는 폼 화면으로 전환
    if (isMobileDevice) {
      setMobileView('form');
    }

    toast.success('수정할 내역을 불러왔습니다');
  };

  // 상세보기
  const handleShowDetail = (payment: PaymentRequest) => {
    setDetailPayment(payment);
    setShowDetailModal(true);
  };

  // 송금완료 처리
  const handleMarkAsCompleted = async (paymentId: string) => {
    try {
      await updatePaymentInAPI(paymentId, { status: 'completed' });
      toast.success('송금완료 처리되었습니다');
      setShowDetailModal(false);
    } catch (error) {
      toast.error('송금완료 처리 실패');
    }
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRecord) {
      toast.error('먼저 결제요청을 선택해주세요');
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
          setPaymentRecordImages(prev => ({
            ...prev,
            [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
          }));
          toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 삭제
  const removeImage = (index: number) => {
    if (!selectedRecord) return;
    setPaymentRecordImages(prev => ({
      ...prev,
      [selectedRecord]: prev[selectedRecord]?.filter((_, i) => i !== index) || []
    }));
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
      toast.error('먼저 결제요청을 선택해주세요');
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
          setPaymentRecordImages(prev => ({
            ...prev,
            [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
          }));
          toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-start">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">결제요청</h1>
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

        {/* 왼쪽: 입력 폼 (2열) */}
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

            {/* 날짜 & 공정 */}
            <div className="grid grid-cols-2 gap-2">
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                onFocus={() => setIsItemNameFocused(true)}
                onBlur={() => setTimeout(() => setIsItemNameFocused(false), 200)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              {/* 항목명 추천 목록 */}
              {itemNameSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {itemNameSuggestions.map((itemName, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, itemName });
                        setItemNameSuggestions([]);
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
            </div>

            {/* 추천 협력업체 */}
            {recommendedContractors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <label className="block text-sm font-medium text-amber-900 mb-2">추천 협력업체</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {recommendedContractors.map((contractor) => {
                    const contractorId = contractor.id || contractor._id;
                    const isSelected = selectedContractorId === contractorId;
                    return (
                      <button
                        key={contractorId}
                        type="button"
                        onClick={() => handleContractorSelect(contractor)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <div className="space-y-1">
                          {/* 이름과 협력업체명 */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">
                              {removePosition(contractor.name)}
                            </span>
                            {contractor.companyName && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span className="text-xs text-gray-600">{contractor.companyName}</span>
                              </>
                            )}
                          </div>
                          {/* 은행 계좌 */}
                          {contractor.accountNumber && contractor.bankName && (
                            <div className="text-xs text-gray-500">
                              {contractor.bankName} {contractor.accountNumber}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 계좌 정보 */}
            <div className="border-t pt-3 space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
                <input
                  type="text"
                  value={formData.accountHolder}
                  onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                  onFocus={handleAccountHolderFocus}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="예금주명을 입력하세요"
                />
              </div>

              {/* 송금완료 내역에서 찾은 계좌정보 추천 - 추천 협력업체에서 선택한 경우 숨김 */}
              {accountSuggestions.length > 0 && !selectedContractorId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-blue-900 mb-2">이전 송금 내역</label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {accountSuggestions.map((account, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            accountHolder: account.accountHolder,
                            bankName: account.bankName,
                            accountNumber: account.accountNumber
                          }));
                          setAccountSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm text-gray-900">
                              {account.accountHolder}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {account.bankName} {account.accountNumber}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">은행</label>
                <select
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <option value="">은행 선택</option>
                  <option value="KB국민은행">KB국민은행</option>
                  <option value="신한은행">신한은행</option>
                  <option value="우리은행">우리은행</option>
                  <option value="하나은행">하나은행</option>
                  <option value="NH농협은행">NH농협은행</option>
                  <option value="IBK기업은행">IBK기업은행</option>
                  <option value="SC제일은행">SC제일은행</option>
                  <option value="한국씨티은행">한국씨티은행</option>
                  <option value="카카오뱅크">카카오뱅크</option>
                  <option value="케이뱅크">케이뱅크</option>
                  <option value="토스뱅크">토스뱅크</option>
                  <option value="새마을금고">새마을금고</option>
                  <option value="신협">신협</option>
                  <option value="우체국">우체국</option>
                  <option value="KDB산업은행">KDB산업은행</option>
                  <option value="수협은행">수협은행</option>
                  <option value="대구은행">대구은행</option>
                  <option value="부산은행">부산은행</option>
                  <option value="경남은행">경남은행</option>
                  <option value="광주은행">광주은행</option>
                  <option value="전북은행">전북은행</option>
                  <option value="제주은행">제주은행</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="계좌번호를 입력하세요"
                />
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

              {/* 결제요청/수정완료 버튼 */}
              <div className="my-6 lg:my-[50px]">
                {editingPaymentId && (
                  <button
                    onClick={() => {
                      setEditingPaymentId(null);
                      setFormData(prev => ({
                        project: prev.project,
                        date: format(new Date(), 'yyyy-MM-dd'),
                        process: '',
                        itemName: '',
                        materialCost: '',
                        laborCost: '',
                        amount: '',
                        accountHolder: '',
                        bankName: '',
                        accountNumber: '',
                        images: []
                      }));
                      setIncludeVat(false);
                      setIncludeTaxDeduction(false);
                      setSelectedContractorId(null);
                      toast.info('수정이 취소되었습니다');
                    }}
                    className="w-full py-2 mb-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    취소
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  {editingPaymentId ? '수정완료' : '결제요청'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 중앙: 결제요청 목록 - 카드 형식 (4열) */}
        <div className={`lg:col-span-4 bg-white rounded-lg border overflow-hidden flex flex-col ${
          mobileView !== 'list' ? 'hidden lg:flex' : ''
        }`}>
          {/* 상태 탭 */}
          <div className="bg-gray-50 px-4 pt-3 pb-0">
            <nav className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === 'pending'
                    ? 'bg-white text-gray-900 shadow-sm border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                대기중
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  statusFilter === 'pending' ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {allRecords.filter(r => r.status === 'pending').length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === 'completed'
                    ? 'bg-white text-gray-900 shadow-sm border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                송금완료
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  statusFilter === 'completed' ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {allRecords.filter(r => r.status === 'completed').length}
                </span>
              </button>
            </nav>
          </div>
          <div className="border-b border-gray-200"></div>

          <div className="flex-1 overflow-auto p-4">
            {filteredRecords.length > 0 ? (
              <div className="space-y-3">
                {filteredRecords.map((record) => {
                  const totalAmount = record.amount || 0;
                  // bankInfo 객체가 있으면 그것을 사용, 없으면 개별 필드 사용
                  const accountHolder = record.bankInfo?.accountHolder || record.accountHolder || '';
                  const bank = record.bankInfo?.bankName || record.bank || '';
                  const accountNumber = record.bankInfo?.accountNumber || record.accountNumber || '';
                  const accountInfo = accountHolder && bank && accountNumber
                    ? `${accountHolder} | ${bank} ${accountNumber}`
                    : '계좌정보 없음';

                  return (
                    <div
                      key={record.id}
                      onClick={() => setSelectedRecord(record.id)}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedRecord === record.id
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 bg-white hover:border-gray-400'
                      }`}
                    >
                      {/* 상단: 항목명, 프로젝트, 금액 */}
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            {record.process && (
                              <span className="text-xs text-gray-500 shrink-0">[{record.process}]</span>
                            )}
                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                              {record.purpose || record.itemName || '-'}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{record.project || '-'}</p>
                        </div>
                        <div className="flex items-start gap-2 ml-3 shrink-0">
                          <div className="text-right">
                            <p className="text-base font-bold text-gray-900">
                              {totalAmount.toLocaleString()}원
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {record.requestedBy || '-'} · {format(new Date(record.requestDate), 'MM/dd', { locale: ko })}
                            </p>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('이 결제요청을 삭제하시겠습니까?')) {
                                await deletePaymentFromAPI(record.id);
                                toast.success('삭제되었습니다');
                              }
                            }}
                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 금액 상세 + 뱃지 */}
                      <div className="flex items-center gap-2 mb-2.5 text-xs">
                        <span className="text-gray-400">자재비 {(record.materialAmount || 0).toLocaleString()}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400">인건비 {(record.laborAmount || 0).toLocaleString()}</span>
                        {record.includesVAT && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded">VAT</span>
                          </>
                        )}
                        {record.applyTaxDeduction && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded">3.3%</span>
                          </>
                        )}
                      </div>

                      {/* 계좌정보 */}
                      <div className="text-xs text-gray-500 mb-2.5 truncate">
                        {accountInfo}
                      </div>

                      {/* 버튼 */}
                      {statusFilter === 'pending' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(record);
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900"
                          >
                            수정
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsCompleted(record.id);
                            }}
                            className="flex-1 py-1.5 px-2 bg-gray-700 text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
                          >
                            즉시송금
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsCompleted(record.id);
                            }}
                            className="flex-1 py-1.5 px-2 text-white rounded text-xs font-medium transition-colors"
                            style={{ backgroundColor: '#5f81a5' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a6b8a'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5f81a5'}
                          >
                            송금완료
                          </button>
                        </div>
                      )}
                      {statusFilter === 'completed' && (
                        <div className="flex">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(record);
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900"
                          >
                            수정
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                결제요청이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 이미지 업로드 및 뷰어 (6열) */}
        <div
          className={`lg:col-span-6 bg-white rounded-lg border flex flex-col overflow-hidden ${
            mobileView !== 'image' ? 'hidden lg:flex' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
                      <p className="font-medium text-gray-900 text-sm">{record.purpose || record.itemName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {record.process || '-'} • {format(new Date(record.requestDate), 'yyyy.MM.dd', { locale: ko })}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      ₩{(record.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div
            className="flex-1 overflow-y-auto p-4 relative"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest('img') && !target.closest('button') && selectedRecord) {
                const images = paymentRecordImages[selectedRecord] || [];
                if (images.length > 0) {
                  document.getElementById('image-file-input')?.click();
                }
              }
            }}
          >
            {selectedRecord ? (() => {
              const images = paymentRecordImages[selectedRecord] || [];

              return images.length > 0 ? (
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
              <div className="h-full flex items-center justify-center min-h-[200px]">
                <div className="text-center text-gray-400">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">결제요청을 선택하세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default Payments;
