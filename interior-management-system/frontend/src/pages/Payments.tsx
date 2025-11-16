import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataStore, type Payment } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';

type PaymentRequest = Payment;
import { Search, Trash2, ImageIcon, X, Upload, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import contractorService from '../services/contractorService';
import CashReceiptModal from '../components/CashReceiptModal';

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
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentRequest | null>(null);
  const [showCashReceiptModal, setShowCashReceiptModal] = useState(false);
  const [cashReceiptProject, setCashReceiptProject] = useState<string>('');

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
    amount: '' as number | string,
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    images: [] as string[],
    quickText: '' // 빠른 입력을 위한 텍스트
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

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      console.log('[자동 새로고침] 결제 내역 업데이트 중...');
      loadPaymentsFromAPI().catch(error => {
        console.error('[자동 새로고침] 실패:', error);
      });
    }, 30000); // 30초

    return () => clearInterval(autoRefreshInterval);
  }, [loadPaymentsFromAPI]);

  // URL 파라미터로 송금완료 자동 처리
  useEffect(() => {
    const handleAutoComplete = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const completeId = urlParams.get('complete') || urlParams.get('c'); // 짧은 파라미터 'c' 지원

      if (completeId) {
        console.log('[자동 송금완료] URL 파라미터 확인:', completeId);

        // 로그인 확인
        if (!user) {
          console.log('[자동 송금완료] 로그인 필요 - 대기 중');
          return;
        }

        // 모바일에서 내역 화면으로 전환
        setMobileView('list');
        setStatusFilter('pending');

        try {
          await loadPaymentsFromAPI();
          await updatePaymentInAPI(String(completeId), { status: 'completed' });

          toast.success('송금완료 처리되었습니다');
          setStatusFilter('completed');
          window.history.replaceState({}, '', '/payments');
          await loadPaymentsFromAPI();
        } catch (error: any) {
          console.error('[자동 송금완료] 처리 실패:', error);

          let errorMessage = '송금완료 처리에 실패했습니다';
          if (error.response?.status === 401) {
            errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요';
          } else if (error.response?.status === 404) {
            errorMessage = '결제 요청을 찾을 수 없습니다 (ID: ' + completeId + ')';
          } else if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
          } else if (error.message) {
            errorMessage += ': ' + error.message;
          }

          toast.error(errorMessage);
          window.history.replaceState({}, '', '/payments');
        }
      }
    };

    handleAutoComplete();
  }, [loadPaymentsFromAPI, updatePaymentInAPI, user]);

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

  // 텍스트에서 금액 파싱 (자재비/인건비 구분)
  const parseAmountFromText = (text: string): { material?: number; labor?: number; total?: number } => {
    const result: { material?: number; labor?: number; total?: number } = {};

    // 자재비 패턴 찾기
    const materialMatch = text.match(/자재비?\s*[:：]?\s*(\d+(?:,\d+)*)\s*만?\s*원/i);
    if (materialMatch) {
      const number = parseInt(materialMatch[1].replace(/,/g, ''));
      result.material = materialMatch[0].includes('만') ? number * 10000 : number;
    }

    // 인건비 패턴 찾기
    const laborMatch = text.match(/(?:인건비?|노무비?)\s*[:：]?\s*(\d+(?:,\d+)*)\s*만?\s*원/i);
    if (laborMatch) {
      const number = parseInt(laborMatch[1].replace(/,/g, ''));
      result.labor = laborMatch[0].includes('만') ? number * 10000 : number;
    }

    // 둘 다 없으면 일반 금액 찾기
    if (!result.material && !result.labor) {
      // "숫자+만원" 패턴 찾기
      const match = text.match(/(\d+(?:,\d+)*)\s*만\s*원/);
      if (match) {
        const number = parseInt(match[1].replace(/,/g, ''));
        result.total = number * 10000;
      } else {
        // "숫자원" 패턴 찾기
        const directMatch = text.match(/(\d+(?:,\d+)*)\s*원/);
        if (directMatch) {
          result.total = parseInt(directMatch[1].replace(/,/g, ''));
        }
      }
    }

    return result;
  };

  // 스마트 텍스트 분석 함수
  const smartTextAnalysis = (text: string): {
    amounts: { material?: number; labor?: number; total?: number };
    bankInfo: { bankName?: string; accountNumber?: string; accountHolder?: string };
    vendor?: string | null;
    itemName?: string;
    includeVat?: boolean;
  } => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const result = {
      amounts: {} as { material?: number; labor?: number; total?: number },
      bankInfo: {} as { bankName?: string; accountNumber?: string; accountHolder?: string },
      vendor: null as string | null,
      itemName: undefined as string | undefined,
      includeVat: false
    };

    // 각 줄을 분석하여 역할 추정
    lines.forEach((line, index) => {
      // 0-1. 부가세 포함 체크
      if (line.includes('부가세포함') || line.includes('부가세 포함') || line.includes('(부가세포함)')) {
        result.includeVat = true;
      }

      // 0-2. "만원" 단위 우선 처리
      const manwonMatch = line.match(/(\d+)\s*만\s*원/);
      if (manwonMatch) {
        const amount = parseInt(manwonMatch[1]) * 10000;
        // 자재비/인건비 키워드 확인
        if (line.includes('자재') || line.includes('재료')) {
          result.amounts.material = amount;
        } else if (line.includes('인건') || line.includes('노무')) {
          result.amounts.labor = amount;
        } else if (!result.amounts.total) {
          result.amounts.total = amount;
        }
        // "만원" 처리된 라인은 이후 처리에서 제외하기 위해 표시
        line = line.replace(/(\d+)\s*만\s*원/g, '');
      }

      // 1-1. 계좌번호 패턴 우선 체크 (더 유연한 패턴)
      // 슬래시로 구분된 정보에서 계좌번호와 예금주 추출
      if (line.includes('/')) {
        const parts = line.split('/');
        parts.forEach(part => {
          const trimmedPart = part.trim();
          // 숫자와 하이픈만 있는 패턴 (계좌번호)
          if (/^[\d\-]+$/.test(trimmedPart) && trimmedPart.replace(/\-/g, '').length >= 10) {
            if (!result.bankInfo.accountNumber) {
              result.bankInfo.accountNumber = trimmedPart;
            }
          }
          // 한글 이름 패턴 (예금주) - 부가세포함 등 제외
          else if (/^[가-힣]{2,5}$/.test(trimmedPart)) {
            // 절대 예금주가 될 수 없는 단어들
            const excludedWords = ['부가세포함', '부가세', '포함', '만원', '천원', '백원', '원'];
            if (!excludedWords.includes(trimmedPart) && !result.bankInfo.accountHolder) {
              result.bankInfo.accountHolder = trimmedPart;
            }
          }
        });
      }

      // 다양한 계좌번호 패턴 (4-3-6, 3-6-5, 4-4-5 등)
      const accountPatterns = [
        /\d{3,4}[\s\-]+\d{3,4}[\s\-]+\d{3,4}[\s\-]+\d{3,4}/, // 기존 패턴
        /\d{3,4}[\s\-]+\d{2,6}[\s\-]+\d{4,7}/, // 더 유연한 패턴
        /\d{10,}/ // 연속된 숫자
      ];

      for (const pattern of accountPatterns) {
        const accountMatch = line.match(pattern);
        if (accountMatch && !result.bankInfo.accountNumber) {
          result.bankInfo.accountNumber = accountMatch[0].trim().replace(/\s+/g, '-');
          break;
        }
      }

      // 1-2. 숫자 패턴 분석 (금액 인식)
      const numberPatterns = line.match(/[\d,]+/g);
      if (numberPatterns) {
        numberPatterns.forEach(numStr => {
          const num = parseInt(numStr.replace(/,/g, ''));

          // 계좌번호 가능성 (연속된 10자리 이상 숫자)
          if (!result.bankInfo.accountNumber && numStr.replace(/,/g, '').length >= 10 && numStr.replace(/,/g, '').length <= 20) {
            result.bankInfo.accountNumber = numStr.replace(/,/g, '');
          }
          // 금액 가능성 (1000 이상)
          else if (num >= 1000 && !manwonMatch) {  // 만원 처리된 경우 제외
            // 자재비/인건비 키워드 확인
            if (line.includes('자재') || line.includes('재료')) {
              result.amounts.material = num;
            } else if (line.includes('인건') || line.includes('노무')) {
              result.amounts.labor = num;
            } else if (!result.amounts.total) {
              result.amounts.total = num;
            }
          }
        });
      }

      // 2. 은행 추정 (은행/뱅크 키워드 또는 알려진 은행명)
      const bankKeywords = ['은행', '뱅크', '금고', '신협'];
      const knownBanks = {
        '국민': 'KB국민은행', 'KB': 'KB국민은행',
        '신한': '신한은행', '하나': '하나은행',
        '우리': '우리은행', '기업': 'IBK기업은행', 'IBK': 'IBK기업은행',
        '농협': 'NH농협은행', 'NH': 'NH농협은행',
        '카카오': '카카오뱅크', '카뱅': '카카오뱅크', '토스': '토스뱅크',
        '케이': '케이뱅크', 'K뱅크': '케이뱅크',
        '산업': 'KDB산업은행', 'KDB': 'KDB산업은행',
        '수협': '수협은행', '대구': '대구은행',
        '부산': '부산은행', '경남': '경남은행',
        '광주': '광주은행', '전북': '전북은행',
        '제일': 'SC제일은행', 'SC': 'SC제일은행',
        '씨티': '한국씨티은행', '우체국': '우체국',
        '새마을': '새마을금고', '신협': '신협'
      };

      // 알려진 은행 찾기 (특별 처리: 은행명 + 이름 패턴)
      for (const [key, value] of Object.entries(knownBanks)) {
        if (line.includes(key)) {
          result.bankInfo.bankName = value;

          // "은행키워드 이름" 패턴 체크 (예: "기업 조민호")
          const bankNamePattern = new RegExp(`${key}\\s+([가-힣]{2,5})`);
          const bankNameMatch = line.match(bankNamePattern);
          if (bankNameMatch) {
            result.bankInfo.accountHolder = bankNameMatch[1];
          }
          break;
        }
      }

      // "XX은행" 패턴으로 새로운 은행 찾기
      if (!result.bankInfo.bankName) {
        const bankMatch = line.match(/([가-힣]+)(은행|뱅크)/);
        if (bankMatch) {
          result.bankInfo.bankName = bankMatch[0];
        }
      }

      // 2-1. 괄호 안 이름 추출 (예: "레브(최승혁)") - 최우선 처리
      const bracketNameMatch = line.match(/\(([가-힣]{2,5})\)/);
      if (bracketNameMatch) {
        // 부가세포함 등은 절대 예금주가 아님
        const excludedWords = ['부가세포함', '부가세', '포함', '만원', '천원', '백원', '원'];
        if (!excludedWords.includes(bracketNameMatch[1])) {
          result.bankInfo.accountHolder = bracketNameMatch[1]; // 무조건 덮어쓰기
        }
      }

      // 3. 한글 이름 추정 (2-5글자) - 괄호 이름이 없고, 슬래시로 처리 안된 경우만
      if (!bracketNameMatch && !result.bankInfo.accountHolder) {
        const namePattern = /[가-힣]{2,5}/g;
        const names = line.match(namePattern);
        if (names) {
          // 같은 줄에 계좌번호가 있는지 확인
          const hasAccountInSameLine = line.match(/\d{10,}/) || line.match(/\d{3,4}[\s\-]+\d{3,4}[\s\-]+\d{3,4}[\s\-]+\d{3,4}/);

          names.forEach(name => {
            // 절대 예금주가 될 수 없는 단어들 체크
            const absoluteExcluded = ['부가세포함', '부가세', '포함', '만원', '천원', '백원', '원'];
            if (absoluteExcluded.includes(name)) {
              return; // 즉시 건너뛰기
            }

            // 금액 관련 단어, 은행 키워드, 공정명이 아닌 경우 예금주로 추정
            const isMoneyRelated = name.includes('금액') || name.includes('가격') || name.includes('비용');
            const isBankKeyword = Object.keys(knownBanks).includes(name);
            const isNotBankOrProcess = !isMoneyRelated && !isBankKeyword && !name.includes('은행') && !name.includes('뱅크') &&
              !['목공', '타일', '도배', '전기', '설비', '청소', '미장', '도장', '아크로텔', '자재', '레브', '필름', '라인조명', '조명'].some(p => name.includes(p));

            if (isNotBankOrProcess) {
              // 괄호로 명시된 이름이 있으면 건너뛰기
              if (bracketNameMatch && name === bracketNameMatch[1]) {
                return; // 이미 처리됨
              }
              // 같은 줄에 계좌번호가 있으면 이 이름을 우선적으로 예금주로 설정 (괄호 이름이 없을 때만)
              if (hasAccountInSameLine && !bracketNameMatch) {
                result.bankInfo.accountHolder = name; // 덮어쓰기 허용
              }
              // 계좌번호가 없는 줄이면 기존 예금주가 없을 때만 설정
              else if (!result.bankInfo.accountHolder) {
                // 계좌번호나 은행명 근처에 있는 이름을 예금주로 추정
                const hasNearbyBankInfo = (index > 0 && (lines[index - 1].match(/\d{10,}/) || lines[index - 1].match(/은행|뱅크/))) ||
                  (index < lines.length - 1 && (lines[index + 1].match(/\d{10,}/) || lines[index + 1].match(/은행|뱅크/))) ||
                  line.match(/은행|뱅크/);

                if (hasNearbyBankInfo) {
                  result.bankInfo.accountHolder = name;
                }
              }
            }
          });
        }
      }

      // 4. 공정/작업 추정 (복합어 포함)
      const workMappings: { [key: string]: string } = {
        '목공': '목공', '목재': '목공', '나무': '목공',
        '타일': '타일', '타일공사': '타일',
        '도배': '도배', '도배지': '도배', '벽지': '도배',
        '전기': '전기', '전기자재': '전기', '전등': '전기', '조명': '전기', '스위치': '전기', '콘센트': '전기',
        '설비': '설비', '배관': '설비', '수도': '설비', '하수': '설비',
        '샤시': '샤시', '창문': '샤시', '창호': '샤시',
        '유리': '유리', '거울': '유리',
        '방수': '방수', '방수공사': '방수',
        '철거': '철거', '철거공사': '철거', '해체': '철거',
        '청소': '청소', '준공청소': '청소', '입주청소': '청소',
        '미장': '미장', '몰탈': '미장', '시멘트': '미장',
        '석공': '석공', '대리석': '석공', '화강석': '석공',
        '도장': '도장', '페인트': '도장', '도색': '도장',
        '필름': '필름', '시트지': '필름', '썬팅': '필름',
        '바닥': '바닥', '마루': '바닥', '장판': '바닥', '데코타일': '바닥',
        '가구': '가구', '붙박이장': '가구', '수납장': '가구',
        '주방': '주방', '싱크대': '주방', '주방가구': '주방',
        '욕실': '욕실', '화장실': '욕실', '변기': '욕실', '세면대': '욕실', '양변기': '욕실',
        '간판': '간판', '사인물': '간판', '현수막': '간판'
      };

      // 각 줄에서 공정 키워드 찾기
      for (const [keyword, process] of Object.entries(workMappings)) {
        if (line.includes(keyword)) {
          result.vendor = process;
          break;  // 첫 번째 매칭된 공정만 사용
        }
      }

      // 5. 항목명 추정 (첫 줄에서 특수문자 제거)
      if (index === 0 && !result.itemName) {
        // 특수문자 제거하고 텍스트만 추출
        const cleanText = line.replace(/[\[\]{}()<>]/g, '').trim();
        if (cleanText) {
          result.itemName = cleanText.substring(0, 50);
        }
      }
    });

    return result;
  };

  // 기존 함수 간소화 (smartTextAnalysis를 활용)
  const parseBankInfoFromText = (text: string): { bankName?: string; accountNumber?: string; accountHolder?: string } => {
    const analysis = smartTextAnalysis(text);
    return analysis.bankInfo;
  };

  // 텍스트에서 공정(업체) 추출
  const parseVendorFromText = (text: string): string | null => {
    // 공정 키워드
    const processKeywords = [
      '목공', '타일', '도배', '전기', '설비', '샤시', '유리', '방수', '철거',
      '청소', '준공청소', '입주청소', '미장', '석공', '도장', '페인트', '필름',
      '바닥', '마루', '장판', '가구', '주방', '욕실', '화장실'
    ];

    // 텍스트에서 공정 키워드 찾기
    for (const keyword of processKeywords) {
      if (text.includes(keyword)) {
        // 협력업체 목록에서 해당 공정 찾기
        const contractor = contractors.find((c: Contractor) =>
          c.process?.includes(keyword) ||
          c.companyName?.includes(keyword)
        );
        if (contractor) {
          return contractor.process || contractor.companyName;
        }
        // 협력업체를 찾지 못해도 키워드 자체를 반환
        return keyword;
      }
    }

    return null;
  };

  // 빠른 입력 텍스트 파싱 (스마트 분석 사용)
  const handleQuickTextParse = () => {
    const text = formData.quickText;
    if (!text.trim()) return;

    // 스마트 텍스트 분석
    const analysis = smartTextAnalysis(text);

    // 파싱된 정보로 폼 업데이트
    const updatedFormData: any = { ...formData };

    // 금액 설정 - 모든 금액을 합쳐서 공사비로 설정
    let totalAmount = 0;
    if (analysis.amounts.material) {
      totalAmount += analysis.amounts.material;
    }
    if (analysis.amounts.labor) {
      totalAmount += analysis.amounts.labor;
    }
    if (analysis.amounts.total && !analysis.amounts.material && !analysis.amounts.labor) {
      totalAmount = analysis.amounts.total;
    }
    if (totalAmount > 0) {
      updatedFormData.amount = totalAmount;
    }

    // 은행 정보 설정
    if (analysis.bankInfo.bankName) {
      updatedFormData.bankName = analysis.bankInfo.bankName;
    }
    if (analysis.bankInfo.accountNumber) {
      updatedFormData.accountNumber = analysis.bankInfo.accountNumber;
    }
    if (analysis.bankInfo.accountHolder) {
      updatedFormData.accountHolder = analysis.bankInfo.accountHolder;
    }

    // 공정(업체) 설정
    if (analysis.vendor) {
      updatedFormData.process = analysis.vendor;
    }

    // 항목명 설정
    if (analysis.itemName) {
      updatedFormData.itemName = analysis.itemName;
    }

    setFormData(updatedFormData);

    // 부가세 포함 체크박스 설정
    if (analysis.includeVat) {
      setIncludeVat(true);
      setIncludeTaxDeduction(false); // 부가세 포함 시 세액공제 해제
    }

    // 파싱 결과 상세 메시지
    let successDetails = [];
    if (analysis.amounts.material || analysis.amounts.labor || analysis.amounts.total) {
      const amountDetails = [];
      if (analysis.amounts.material) amountDetails.push(`자재비: ${analysis.amounts.material.toLocaleString()}원`);
      if (analysis.amounts.labor) amountDetails.push(`인건비: ${analysis.amounts.labor.toLocaleString()}원`);
      if (analysis.amounts.total && !analysis.amounts.material && !analysis.amounts.labor) {
        amountDetails.push(`금액: ${analysis.amounts.total.toLocaleString()}원`);
      }
      successDetails.push(amountDetails.join(', '));
    }

    if (analysis.bankInfo.bankName || analysis.bankInfo.accountHolder) {
      const bankDetails = [];
      if (analysis.bankInfo.bankName) bankDetails.push(analysis.bankInfo.bankName);
      if (analysis.bankInfo.accountHolder) bankDetails.push(analysis.bankInfo.accountHolder);
      if (analysis.bankInfo.accountNumber) bankDetails.push(analysis.bankInfo.accountNumber);
      if (bankDetails.length > 0) {
        successDetails.push(`계좌: ${bankDetails.join(' ')}`);
      }
    }

    if (analysis.vendor) {
      successDetails.push(`공정: ${analysis.vendor}`);
    }

    if (analysis.includeVat) {
      successDetails.push(`부가세 포함 설정됨`);
    }

    if (successDetails.length > 0) {
      toast.success(`자동 인식 완료!\n${successDetails.join('\n')}`, {
        duration: 4000,
        style: { whiteSpace: 'pre-line' }
      });
    } else {
      toast.info('텍스트를 분석 중... 더 명확한 정보를 입력해주세요.');
    }
  };

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
    const matchesProject = projectFilter === 'all' || record.project === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
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
    console.log('💰 handleSave called');
    console.log('💰 Current user:', user);
    console.log('💰 Form data:', formData);

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

    try {
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
          category: 'material' as const,
          urgency: 'normal' as const,
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

        console.log('💰 Updating payment:', updatedPayment);
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
          category: 'material' as const,
          urgency: 'normal' as const,
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
          attachments: [],
          createdAt: now,
          updatedAt: now
        };

        console.log('💰 Creating payment:', newPayment);
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
        images: [],
        quickText: ''
      }));
      setIncludeVat(false);
      setIncludeTaxDeduction(false);
      setSelectedContractorId(null);

      // 모바일에서는 리스트로 전환
      if (isMobileDevice) {
        setMobileView('list');
      }
    } catch (error) {
      console.error('💰 Payment save error:', error);
      toast.error('결제요청 저장에 실패했습니다: ' + (error as Error).message);
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

  // 즉시송금 - 토스 앱 실행
  const handleInstantTransfer = async (payment: PaymentRequest) => {
    try {
      // 필수 정보 확인 - bankInfo 객체 또는 개별 필드 사용
      const accountHolder = payment.bankInfo?.accountHolder || payment.accountHolder;
      const bankName = payment.bankInfo?.bankName || payment.bank;
      const accountNumber = payment.bankInfo?.accountNumber || payment.accountNumber;

      if (!accountHolder || !bankName || !accountNumber) {
        toast.error('계좌 정보가 없습니다. 결제 요청 정보를 확인해주세요.');
        return;
      }

      // 이체 정보 확인
      const confirmed = window.confirm(
        `토스 앱으로 이체하시겠습니까?\n\n` +
        `받는분: ${accountHolder}\n` +
        `은행: ${bankName}\n` +
        `계좌: ${accountNumber}\n` +
        `금액: ${payment.amount.toLocaleString()}원`
      );

      if (!confirmed) return;

      const cleanAccountNumber = accountNumber.replace(/-/g, '');

      // 은행명을 토스 인식 형식으로 변환
      const bankNameMap: Record<string, string> = {
        'KB국민은행': '국민은행',
        '국민은행': '국민은행',
        '신한은행': '신한은행',
        '우리은행': '우리은행',
        '하나은행': '하나은행',
        'NH농협은행': '농협은행',
        '농협은행': '농협은행',
        'IBK기업은행': '기업은행',
        '기업은행': '기업은행',
        'SC제일은행': 'SC제일은행',
        '한국씨티은행': '씨티은행',
        '씨티은행': '씨티은행',
        '새마을금고': '새마을금고',
        '신협': '신협',
        '우체국': '우체국',
        'KDB산업은행': '산업은행',
        '산업은행': '산업은행',
        '수협은행': '수협은행',
        '대구은행': '대구은행',
        '부산은행': '부산은행',
        '경남은행': '경남은행',
        '광주은행': '광주은행',
        '전북은행': '전북은행',
        '제주은행': '제주은행',
        '카카오뱅크': '카카오뱅크',
        '케이뱅크': '케이뱅크',
        '토스뱅크': '토스뱅크'
      };

      const tossBankName = bankNameMap[bankName] || bankName;

      // 은행 코드 매핑
      const bankCodeMap: Record<string, string> = {
        'KB국민은행': '004',
        '국민은행': '004',
        '신한은행': '088',
        '우리은행': '020',
        '하나은행': '081',
        'NH농협은행': '011',
        '농협은행': '011',
        'IBK기업은행': '003',
        '기업은행': '003',
        'SC제일은행': '023',
        '한국씨티은행': '027',
        '씨티은행': '027',
        '새마을금고': '045',
        '신협': '048',
        '우체국': '071',
        'KDB산업은행': '002',
        '산업은행': '002',
        '수협은행': '007',
        '대구은행': '031',
        '부산은행': '032',
        '경남은행': '039',
        '광주은행': '034',
        '전북은행': '037',
        '제주은행': '035',
        '카카오뱅크': '090',
        '케이뱅크': '089',
        '토스뱅크': '092'
      };

      const bankCode = bankCodeMap[bankName] || '004';

      // 토스 송금 URL 생성 (은행 코드와 은행명을 함께 전달)
      const tossUrl = `supertoss://send?amount=${payment.amount}&bankCode=${bankCode}&bank=${encodeURIComponent(tossBankName)}&accountNo=${cleanAccountNumber}`;

      // 토스 앱 실행 시도
      let appOpened = false;

      try {
        // window.location.href로 앱 실행
        window.location.href = tossUrl;
        appOpened = true;

        toast.success('토스 앱을 실행합니다...', {
          duration: 3000
        });

        // 2초 후 앱이 실행되지 않았다면 안내
        setTimeout(() => {
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
          const isAndroid = /Android/i.test(navigator.userAgent);

          if (isIOS || isAndroid) {
            toast(
              '토스 앱이 설치되어 있지 않거나 실행에 실패했습니다.\n\n' +
              `받는분: ${accountHolder}\n` +
              `계좌: ${accountNumber}\n` +
              `금액: ${payment.amount.toLocaleString()}원\n\n` +
              '토스 앱을 직접 열어 이체해주세요.',
              {
                icon: '💳',
                duration: 8000
              }
            );
          }
        }, 2000);

      } catch (error) {
        console.error('토스 앱 실행 실패:', error);

        // 실패 시 정보 표시
        toast(
          `토스 앱 실행에 실패했습니다.\n\n` +
          `받는분: ${accountHolder}\n` +
          `은행: ${bankName}\n` +
          `계좌: ${accountNumber}\n` +
          `금액: ${payment.amount.toLocaleString()}원\n\n` +
          `토스 앱을 직접 열어 이체해주세요.`,
          {
            icon: '💳',
            duration: 10000
          }
        );
      }

    } catch (error) {
      console.error('즉시송금 오류:', error);
      toast.error(`처리 중 오류가 발생했습니다: ${(error as Error).message}`);
    }
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
    <div className="space-y-3 md:space-y-4">
      {/* 모바일에서 프로젝트 선택 */}
      <div className="lg:hidden mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">프로젝트</label>
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
          <option value="">프로젝트 선택</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">프로젝트 *</label>
              <select
                value={formData.project}
                onChange={(e) => {
                  setFormData({ ...formData, project: e.target.value });
                  if (e.target.value) {
                    localStorage.setItem('lastSelectedProject', e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white cursor-pointer hover:border-gray-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
              >
                <option value="">프로젝트 선택</option>
                {projects.filter(p => p.status !== 'completed').map(project => (
                  <option key={project.id} value={project.name}>{project.name}</option>
                ))}
              </select>
            </div>

            {/* 빠른 입력 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💡 빠른 입력 (스마트 자동 인식)
              </label>
              <textarea
                value={formData.quickText}
                onChange={(e) => setFormData({ ...formData, quickText: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예시: [703호 타일공사]&#10;자재비: 120만원&#10;인건비: 80만원&#10;신한 110-432-160269 박지연&#10;&#10;은행명, 계좌번호, 예금주, 공정, 자재비/인건비를 자동으로 인식합니다."
              />
              <button
                type="button"
                onClick={handleQuickTextParse}
                className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                자동으로 항목 채우기
              </button>
              <p className="mt-2 text-xs text-gray-600">
                ✨ 스마트 인식: 금액(자재비/인건비), 은행명, 계좌번호, 예금주, 공정을 자동 인식합니다<br/>
                • 항목명: [대괄호] 안에 작성<br/>
                • 금액: "40만원", "400000원" 형식<br/>
                • 은행: 국민, 신한, 하나, 우리, 기업, 농협 등<br/>
                • 공정: 목공, 타일, 도배, 전기, 설비 등
              </p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">공사비</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="금액을 입력하세요"
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

              {/* 결제요청/수정완료 버튼 - 모바일 최적화 */}
              <div className="my-6 lg:my-[50px] sticky bottom-0 bg-white pt-4 pb-4 -mb-4 lg:static lg:pb-0" style={{ zIndex: 100 }}>
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
                        images: [],
                        quickText: ''
                      }));
                      setIncludeVat(false);
                      setIncludeTaxDeduction(false);
                      setSelectedContractorId(null);
                      toast.info('수정이 취소되었습니다');
                    }}
                    className="w-full py-2 mb-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 touch-manipulation"
                    style={{ minHeight: '48px' }}
                  >
                    취소
                  </button>
                )}
                <button
                  onClick={(e) => {
                    console.log('💰 Payment button clicked!', e);
                    console.log('💰 Button element:', e.currentTarget);
                    console.log('💰 Form data:', formData);
                    handleSave();
                  }}
                  className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 active:bg-gray-950 touch-manipulation font-medium text-base"
                  style={{ minHeight: '48px', position: 'relative', zIndex: 101, WebkitTapHighlightColor: 'transparent' }}
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
          {/* 상태 탭 + 선택된 프로젝트 필터 */}
          <div className="bg-gray-50 px-4 pt-3 pb-0">
            <div className="flex items-center justify-between gap-4">
              <nav className="flex gap-2 overflow-x-auto flex-1">
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
          </div>
          <div className="border-b border-gray-200"></div>

          <div className="flex-1 overflow-auto p-4">
            {filteredRecords.length > 0 ? (
              <div className="space-y-4">
                {/* 송금완료 탭에서 프로젝트별 그룹화 */}
                {statusFilter === 'completed' ? (
                  (() => {
                    // 프로젝트별로 그룹화
                    const groupedByProject = filteredRecords.reduce((acc, record) => {
                      const project = record.project || '미분류';
                      if (!acc[project]) {
                        acc[project] = [];
                      }
                      acc[project].push(record);
                      return acc;
                    }, {} as Record<string, PaymentRequest[]>);

                    return Object.entries(groupedByProject).map(([project, records]) => {
                      const projectTotal = records.reduce((sum, record) => sum + (record.amount || 0), 0);

                      return (
                        <div key={project} className="border rounded-lg overflow-hidden">
                          {/* 프로젝트 헤더 */}
                          <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900 text-sm">{project}</h3>
                              <p className="text-xs text-gray-500">총 {records.length}건 · {projectTotal.toLocaleString()}원</p>
                            </div>
                          </div>

                          {/* 프로젝트 내 결제 목록 */}
                          <div className="p-2 space-y-2">
                            {records.map((record) => {
                              const totalAmount = record.amount || 0;
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
                                  {/* 기존 카드 내용 */}
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
                                            try {
                                              await deletePaymentFromAPI(record.id);
                                              toast.success('삭제되었습니다');
                                            } catch (error: any) {
                                              console.error('삭제 실패:', error);
                                              if (error.response?.status === 404) {
                                                toast.error('이미 삭제된 항목입니다. 목록을 새로고침합니다.');
                                                await loadPaymentsFromAPI();
                                              } else {
                                                toast.error('삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
                                              }
                                            }
                                          }
                                        }}
                                        className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                        title="삭제"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

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

                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs text-gray-500 truncate flex-1">
                                      {accountInfo}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(record);
                                      }}
                                      className="text-xs text-gray-600 hover:text-gray-900 ml-2 flex-shrink-0"
                                    >
                                      수정
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  /* 대기중 탭 - 기존 방식 */
                  filteredRecords.map((record) => {
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

                      {/* 계좌정보 + 수정 버튼 */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="text-xs text-gray-500 truncate flex-1">
                          {accountInfo}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(record);
                          }}
                          className="text-xs text-gray-600 hover:text-gray-900 ml-2 flex-shrink-0"
                        >
                          수정
                        </button>
                      </div>

                      {/* 버튼 그룹 */}
                      {/* 송금 버튼 (manager 이상만, pending 상태만) */}
                      {statusFilter === 'pending' && user?.role && ['manager', 'admin'].includes(user.role) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (record.status === 'completed') {
                                toast.info('이미 송금완료 처리된 건입니다');
                                return;
                              }
                              handleInstantTransfer(record);
                            }}
                            disabled={record.status === 'completed'}
                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                              record.status === 'completed'
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-700 text-white hover:bg-gray-800'
                            }`}
                          >
                            {record.status === 'completed' ? '송금완료됨' : '즉시송금'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsCompleted(record.id);
                            }}
                            disabled={record.status === 'completed'}
                            className={`flex-1 py-1.5 px-2 text-white rounded text-xs font-medium transition-colors ${
                              record.status === 'completed' ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            style={{ backgroundColor: record.status === 'completed' ? '#9ca3af' : '#5f81a5' }}
                            onMouseEnter={(e) => {
                              if (record.status !== 'completed') {
                                e.currentTarget.style.backgroundColor = '#4a6b8a';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (record.status !== 'completed') {
                                e.currentTarget.style.backgroundColor = '#5f81a5';
                              }
                            }}
                          >
                            송금완료
                          </button>
                        </div>
                      )}
                    </div>
                  );
                  })
                )}
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

      {/* 현금수령증 모달 */}
      {showCashReceiptModal && (
        <CashReceiptModal
          projectName={cashReceiptProject}
          onClose={() => setShowCashReceiptModal(false)}
        />
      )}
    </div>
  );
};

export default Payments;
