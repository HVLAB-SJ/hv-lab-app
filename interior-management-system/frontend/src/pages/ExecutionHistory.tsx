import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataStore, type ExecutionRecord } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { Navigate } from 'react-router-dom';
import { Search, Trash2, ImageIcon, X, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import paymentService from '../services/paymentService';
import { getAllImages, saveImages, migrateFromLocalStorage } from '../utils/imageStorage';

// 이미지 압축 함수 (용량 줄이기)
const compressImage = (base64: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // 최대 너비를 넘으면 비율에 맞게 축소
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      // JPEG로 압축 (용량 절약)
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(base64); // 실패 시 원본 반환
    img.src = base64;
  });
};

// localStorage 안전하게 저장하는 함수
const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error('localStorage 저장 실패:', e);
    // 용량 초과 시 오래된 데이터 정리 시도
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        // paymentRecordImages가 너무 크면 일부 삭제
        const stored = localStorage.getItem('paymentRecordImages');
        if (stored) {
          const data = JSON.parse(stored);
          const keys = Object.keys(data);
          if (keys.length > 5) {
            // 오래된 5개 항목 삭제
            const toRemove = keys.slice(0, keys.length - 5);
            toRemove.forEach(k => delete data[k]);
            localStorage.setItem('paymentRecordImages', JSON.stringify(data));
            // 다시 시도
            localStorage.setItem(key, value);
            return true;
          }
        }
      } catch {
        // 정리도 실패하면 포기
      }
    }
    return false;
  }
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

const ExecutionHistory = () => {
  const {
    payments,
    executionRecords,
    loadPaymentsFromAPI,
    loadExecutionRecordsFromAPI,
    addExecutionRecordToAPI,
    deleteExecutionRecordFromAPI,
    updateExecutionRecordInAPI
  } = useDataStore();
  const { user } = useAuth();
  const projects = useFilteredProjects(); // 안팀 사용자는 담당 프로젝트만 표시

  // 로그인 체크만 수행 (모든 로그인 사용자 접근 가능)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
  // 항목명 추천
  const [itemNameSuggestions, setItemNameSuggestions] = useState<string[]>([]);
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
    images: [] as string[],
    quickText: '',
    quickImages: [] as string[]
  });

  // 실행내역별 메모 저장을 위한 상태
  const [executionMemos, setExecutionMemos] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem('executionMemos');
    return stored ? JSON.parse(stored) : {};
  });

  // 금액 분할 모드 상태
  const [splitModeRecord, setSplitModeRecord] = useState<string | null>(null);
  const [splitMaterialCost, setSplitMaterialCost] = useState<number | ''>('');
  const [splitLaborCost, setSplitLaborCost] = useState<number | ''>('');

  // 초기 데이터 로드 및 프로젝트 설정
  useEffect(() => {
    loadPaymentsFromAPI().catch(error => {
      console.error('Failed to load payments:', error);
    });

    // 실행내역 API에서 로드
    loadExecutionRecordsFromAPI().catch(error => {
      console.error('Failed to load execution records:', error);
    });

    // 모바일 여부 확인
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 768);
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
  }, [loadPaymentsFromAPI, loadExecutionRecordsFromAPI, projects]);

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

  // executionMemos가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('executionMemos', JSON.stringify(executionMemos));
  }, [executionMemos]);

  // 항목명 입력 시 기존 실행내역에서 추천
  useEffect(() => {
    if (formData.itemName && formData.itemName.trim().length >= 1) {
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
  }, [formData.itemName, executionRecords]);

  // 클립보드 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!selectedRecord) {
      toast.error('먼저 실행내역을 선택해주세요');
      return;
    }

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
      // 실제 레코드에 이미지 추가
      const record = executionRecords.find(r => r.id === selectedRecord);
      if (record) {
        const updatedImages = [...(record.images || []), ...newImages];
        try {
          await updateExecutionRecordInAPI(selectedRecord, { images: updatedImages });
        } catch (error) {
          console.error('이미지 저장 실패:', error);
        }
      } else {
        // 결제요청 레코드인 경우 별도 저장소에 저장
        setPaymentRecordImages(prev => ({
          ...prev,
          [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
        }));
      }
      toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
    }).catch(error => {
      console.error('이미지 처리 중 오류:', error);
      toast.error('이미지 추가 중 오류가 발생했습니다');
    });
  }, [selectedRecord, executionRecords, updateExecutionRecordInAPI]);

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
        images: payment.images || paymentRecordImages[payment.id] || [],  // 서버 이미지 우선
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
  const manualRecords = executionRecords
    .filter(record => user?.name !== '안팀' || filteredProjectNames.includes(record.project))
    .map(record => ({
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
    for (const process of PROCESS_LIST) {
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

    try {
      const savedRecord = await addExecutionRecordToAPI(newRecord);
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

      // 모바일에서는 리스트 뷰로 전환하고 새 레코드 선택
      if (isMobileDevice) {
        setSelectedRecord(savedRecord.id);
        setMobileView('list');
      }
    } catch (error) {
      console.error('실행내역 저장 실패:', error);
      toast.error('실행내역 저장에 실패했습니다');
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
        // 실제 레코드에 이미지 추가
        const record = executionRecords.find(r => r.id === selectedRecord);
        if (record) {
          const updatedImages = [...(record.images || []), ...newImages];
          try {
            await updateExecutionRecordInAPI(selectedRecord, { images: updatedImages });
          } catch (error) {
            console.error('이미지 저장 실패:', error);
          }
        } else {
          // 결제요청 레코드인 경우 별도 저장소에 저장
          setPaymentRecordImages(prev => ({
            ...prev,
            [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
          }));
        }
        toast.success(`${newImages.length}개의 이미지가 추가되었습니다`);
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

    const record = executionRecords.find(r => r.id === selectedRecord);
    if (record) {
      const updatedImages = record.images?.filter((_, i) => i !== index) || [];
      try {
        await updateExecutionRecordInAPI(selectedRecord, { images: updatedImages });
      } catch (error) {
        console.error('이미지 삭제 실패:', error);
      }
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
      // 실제 레코드에 이미지 추가
      const record = executionRecords.find(r => r.id === selectedRecord);
      if (record) {
        const updatedImages = [...(record.images || []), ...newImages];
        try {
          await updateExecutionRecordInAPI(selectedRecord, { images: updatedImages });
        } catch (error) {
          console.error('이미지 저장 실패:', error);
        }
      } else {
        // 결제요청 레코드인 경우 별도 저장소에 저장
        setPaymentRecordImages(prev => ({
          ...prev,
          [selectedRecord]: [...(prev[selectedRecord] || []), ...newImages]
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
      <div className="md:hidden mb-4">
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
          {projects.filter(p => p.status !== 'completed').map(project => (
            <option key={project.id} value={project.name}>{project.name}</option>
          ))}
        </select>
      </div>

      {/* 모바일에서 탭 표시 */}
      <div className="md:hidden border-b border-gray-200 mb-4">
        <div className="flex items-center justify-between">
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
          {/* 검색 입력 */}
          <div className="relative mr-1">
            <input
              type="text"
              placeholder="검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-28 pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 - 태블릿: 수직 배치, 데스크톱: 3열 레이아웃 */}
      <div className="flex flex-col desktop:grid desktop:grid-cols-12 gap-3 md:gap-4">

        {/* 입력 폼 - 태블릿: 전체 너비, 데스크톱: 2열 */}
        <div className={`bg-white rounded-lg border p-3 md:p-4 flex flex-col overflow-hidden w-full desktop:col-span-2 ${
          mobileView !== 'form' ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="space-y-4 overflow-y-auto flex-shrink-0">
            {/* 프로젝트 - 태블릿/데스크톱에서만 표시 */}
            <div className="hidden md:block">
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
                {/* 빈칸 옵션 제거 - 모든 환경에서 */}
                {projects.filter(p => p.status !== 'completed').map(project => (
                  <option key={project.id} value={project.name}>{project.name}</option>
                ))}
              </select>
            </div>

            {/* 빠른 입력 */}
            <div>
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
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder={isMobileDevice ? "내역 붙여넣기" : "내역 붙여넣기 (이미지 드래그 또는 Ctrl+V)"}
              />
              {/* 이미지 미리보기 */}
              {formData.quickImages.length > 0 && (
                <div className="mt-2 mb-2 grid grid-cols-3 gap-2">
                  {formData.quickImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img}
                        alt={`이미지 ${idx + 1}`}
                        className="w-full h-16 object-cover rounded-lg border"
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
                  <div className="w-full h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300">
                    이미지 추가
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleQuickTextParse}
                  className="h-9 flex items-center justify-center bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
                >
                  자동 채우기
                </button>
              </div>
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
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
              <div className="my-6" style={{ marginTop: '20px' }}>
                <button
                  onClick={handleSave}
                  className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  내역추가
                </button>
              </div>
            </div>

            {/* 총계 표시 - 태블릿/데스크톱에서만 표시 */}
            <div className="hidden md:block bg-gray-50 rounded-lg p-3 md:p-4 space-y-2 md:mt-8 lg:mt-[114.67px]">
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
          </div>
        </div>

        {/* 중앙: 실행내역 목록 - 테이블 형식 (6열) */}
        <div className={`bg-white rounded-lg border overflow-hidden flex flex-col w-full desktop:col-span-6 ${
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
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-sm text-gray-700 border-b">
                    <th className="px-3 py-3 font-medium w-[6%]">작성자</th>
                    <th className="px-3 py-3 font-medium w-[13%]">날짜</th>
                    <th className="px-3 py-3 font-medium w-[10%]">공정</th>
                    <th className="px-3 py-3 font-medium w-[19%]">항목명</th>
                    <th className="px-3 py-3 font-medium text-right w-[13%]">자재비</th>
                    <th className="px-3 py-3 font-medium text-right w-[13%]">인건비</th>
                    <th className="px-3 py-3 font-medium text-right w-[13%]">부가세</th>
                    <th className="px-3 py-3 font-medium text-right w-[13%]">총액</th>
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
                        <span className="portrait:block landscape:hidden ipad-xl:hidden">{format(new Date(record.date), 'MM-dd', { locale: ko })}</span>
                        <span className="portrait:hidden landscape:inline ipad-xl:!inline">{format(new Date(record.date), 'yyyy-MM-dd (EEE)', { locale: ko })}</span>
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
                        <span className="portrait:inline landscape:hidden ipad-xl:hidden">{(record.totalAmount || 0).toLocaleString()}</span>
                        <span className="portrait:hidden landscape:inline ipad-xl:!inline">{(record.totalAmount || 0).toLocaleString()}원</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 모바일 카드 뷰 - 컴팩트 레이아웃 */}
              <div className="md:hidden space-y-1.5 p-2">
                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`border rounded-lg px-3 py-2 ${
                      selectedRecord === record.id ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    }`}
                    onClick={() => {
                      setSelectedRecord(record.id);
                      setMobileView('image');
                    }}
                  >
                    {/* 1행: 항목명 + 총액 */}
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-gray-900 text-sm truncate flex-1 mr-2">{record.itemName}</p>
                      <p className="text-sm font-bold text-gray-900 shrink-0">
                        {(record.totalAmount || 0).toLocaleString()}원
                      </p>
                    </div>
                    {/* 2행: 공정, 작성자, 날짜 + 자재비/인건비/부가세 */}
                    <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                      <span>{record.process || '-'} · {record.author || '-'} · {format(new Date(record.date), 'MM.dd', { locale: ko })}</span>
                      <span className="text-[10px] text-gray-400">
                        자재비 {(record.materialCost || 0).toLocaleString()} · 인건비 {(record.laborCost || 0).toLocaleString()} · 부가세 {(record.vatAmount || 0).toLocaleString()}
                      </span>
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

          {/* 하단 검색 및 공정별 합계 버튼 영역 - 태블릿/데스크톱 전용 */}
          <div className="hidden md:block border-t bg-gray-50 p-3">
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
                      // executionRecords에 있는 레코드 찾기
                      const execRecord = executionRecords.find(r => r.id === selectedRecord);

                      // allRecords에서 선택된 레코드 찾기
                      const selectedItem = allRecords.find(r => r.id === selectedRecord);

                      if (execRecord) {
                        // executionRecords에 있는 레코드는 삭제 가능
                        if (confirm('선택한 실행내역을 삭제하시겠습니까?')) {
                          try {
                            await deleteExecutionRecordFromAPI(selectedRecord);
                            setSelectedRecord(null);
                            toast.success('실행내역이 삭제되었습니다');
                          } catch (error) {
                            console.error('실행내역 삭제 실패:', error);
                            toast.error('실행내역 삭제에 실패했습니다');
                          }
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
          className={`bg-white rounded-lg border flex flex-col overflow-hidden w-full desktop:col-span-4 ${
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
                  const fullRecord = allRecords.find(r => r.id === selectedRecord);
                  // fullRecord.images (서버 이미지) 우선
                  return fullRecord?.images || record?.images || paymentRecordImages[selectedRecord] || [];
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
              const fullRecord = allRecords.find(r => r.id === selectedRecord);
              // fullRecord.images (서버 이미지) 우선, 없으면 로컬 이미지 사용
              const images = fullRecord?.images || record?.images || paymentRecordImages[selectedRecord] || [];

              return (
                <div className="h-full flex flex-col">
                  {/* 결제요청 금액 분할 기능 */}
                  {fullRecord?.type === 'payment' && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {/* 결제요청 금액 정보 */}
                      <p className="text-sm font-semibold text-gray-900 mb-1">결제요청 금액:</p>
                      <p className="text-sm text-gray-700 mb-2">
                        총 {fullRecord.totalAmount?.toLocaleString()}원
                        {fullRecord.itemName && ` (${fullRecord.itemName})`}
                      </p>

                      {/* 금액 분할 입력 영역 */}
                      {splitModeRecord === selectedRecord ? (
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

                                try {
                                  // 결제요청 금액만 업데이트 (새로운 PATCH API 사용)
                                  await paymentService.updatePaymentAmounts(
                                    fullRecord.id,
                                    materialValue,
                                    laborValue
                                  );

                                  // 결제요청 목록 다시 로드
                                  await loadPaymentsFromAPI();

                                  // 분할 모드 종료
                                  setSplitModeRecord(null);
                                  setSplitMaterialCost('');
                                  setSplitLaborCost('');

                                  toast.success('금액이 적용되었습니다.');
                                } catch (error) {
                                  console.error('금액 적용 실패:', error);
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
                      ) : (
                        <button
                          onClick={() => {
                            // 금액 분할 모드 시작
                            const totalAmount = fullRecord.totalAmount || 0;
                            const quickText = (fullRecord as any).quickText || fullRecord.itemName || '';

                            // 자재비/인건비 키워드 확인
                            const hasMaterial = quickText.includes('자재') || quickText.includes('재료');
                            const hasLabor = quickText.includes('인건') || quickText.includes('노무') || quickText.includes('인건비');

                            // 기본 비율 (자재비 70%, 인건비 30%)
                            let materialRatio = 0.7;
                            let laborRatio = 0.3;

                            // 키워드에 따른 비율 조정
                            if (hasMaterial && !hasLabor) {
                              materialRatio = 1;
                              laborRatio = 0;
                            } else if (!hasMaterial && hasLabor) {
                              materialRatio = 0;
                              laborRatio = 1;
                            }

                            setSplitMaterialCost(Math.round(totalAmount * materialRatio));
                            setSplitLaborCost(Math.round(totalAmount * laborRatio));
                            setSplitModeRecord(selectedRecord);
                          }}
                          className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          금액 분할
                        </button>
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
                            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border"
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
                        {images.length > 0 ? '이미지 추가' : '클릭하여 선택'}
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg w-full md:max-w-4xl max-h-[85vh] md:max-h-[80vh] overflow-hidden md:m-4">
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
    </div>
  );
};

export default ExecutionHistory;