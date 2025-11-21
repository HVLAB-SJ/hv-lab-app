import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Upload, Image as ImageIcon, FileText, Trash2, AlertCircle } from 'lucide-react';
import { useDataStore, type Payment } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import contractorService from '../services/contractorService';
import type { PaymentRequestFormData, Contractor } from '../types/forms';

interface PaymentRequestModalProps {
  payment: Payment | null;
  onClose: () => void;
  onSave: (data: PaymentRequestFormData) => void;
}

// List of Korean position titles (same as in Contractors.tsx)
const positions = [
  '대표이사', '부사장', '전무', '상무', '이사', '실장', '부장', '차장', '과장', '대리',
  '주임', '사원', '팀장', '소장', '대표', '사장', '회장', '반장', '현장', '본부장',
  '팀원', '파트장', '조장', '감독', '기사', '수석', '책임'
];

// Remove position from name (same logic as Contractors.tsx)
const removePosition = (name: string): string => {
  if (!name) return name;

  // Remove "님" suffix first if present
  const cleanName = name.replace(/님$/g, '').trim();

  // Check if position is separated by space
  const parts = cleanName.split(' ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    for (const position of positions) {
      if (lastPart === position) {
        // Return everything except the last part (position)
        return parts.slice(0, -1).join(' ').trim();
      }
    }
  }

  // Remove position if found at the end (attached to name)
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      return cleanName.substring(0, cleanName.length - position.length).trim();
    }
  }

  return cleanName;
};

const PaymentRequestModal = ({ payment, onClose, onSave }: PaymentRequestModalProps) => {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm();
  const { projects, payments } = useDataStore();
  const { user } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['material']);
  const [isUrgent, setIsUrgent] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState('');
  const [recommendedContractors, setRecommendedContractors] = useState<Contractor[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [applyTaxDeduction, setApplyTaxDeduction] = useState(false);
  const [includesVAT, setIncludesVAT] = useState(false);
  const [materialAmount, setMaterialAmount] = useState<number>(0);
  const [laborAmount, setLaborAmount] = useState<number>(0);
  const [originalLaborAmount, setOriginalLaborAmount] = useState<number>(0);
  const [originalMaterialAmount, setOriginalMaterialAmount] = useState<number>(0);
  const [quickText, setQuickText] = useState(''); // 빠른 입력 텍스트

  // 텍스트에서 정보 파싱
  const parseQuickText = (text: string) => {
    if (!text.trim()) return;

    // 계좌번호 추출 먼저 (은행명 앞에서 처리하여 더 정확한 매칭)
    // 다양한 형식 지원: "79525 0008 843", "362-910277-07207", "79525-0008-843" 등
    const accountMatch = text.match(/(\d{3,7}[-\s]+\d{2,8}[-\s]+\d{2,10})/);
    if (accountMatch) {
      setValue('accountNumber', accountMatch[1]);
    }

    // 은행명 추출 (전체 이름 + 축약형)
    const bankFullMatch = text.match(/(KB국민은행|신한은행|우리은행|하나은행|NH농협은행|IBK기업은행|KEB하나은행|SC제일은행|한국씨티은행|부산은행|대구은행|경남은행|광주은행|전북은행|제주은행|산업은행|수협은행|우체국|새마을금고|신협|저축은행|카카오뱅크|케이뱅크|토스뱅크|NH투자증권|미래에셋증권|한국투자증권|키움증권|삼성증권|KB증권|신한투자증권|하이투자증권)/);

    // 축약형 은행명 매칭
    const bankShortMatch = text.match(/\s(국민|신한|우리|하나|농협|기업|제일|씨티|카카오|케이|토스)\s/);

    if (bankFullMatch) {
      setValue('bankName', bankFullMatch[1]);
    } else if (bankShortMatch) {
      // 축약형을 전체 이름으로 변환
      const bankMap: { [key: string]: string } = {
        '국민': 'KB국민은행',
        '신한': '신한은행',
        '우리': '우리은행',
        '하나': '하나은행',
        '농협': 'NH농협은행',
        '기업': 'IBK기업은행',
        '제일': 'SC제일은행',
        '씨티': '한국씨티은행',
        '카카오': '카카오뱅크',
        '케이': '케이뱅크',
        '토스': '토스뱅크'
      };
      const fullBankName = bankMap[bankShortMatch[1]];
      if (fullBankName) {
        setValue('bankName', fullBankName);
      }
    }

    // 예금주 추출 (계좌번호와 은행명 다음에 나오는 한글 이름)
    if (accountMatch) {
      const afterAccount = text.substring(text.indexOf(accountMatch[0]) + accountMatch[0].length);
      // 은행명 이후의 텍스트에서 이름 찾기
      const nameMatch = afterAccount.match(/(?:국민|신한|우리|하나|농협|기업|제일|씨티|카카오|케이|토스)?\s*([가-힣]+)/);
      if (nameMatch) {
        const cleanName = nameMatch[1].trim();
        setValue('accountHolder', cleanName);
      }
    }

    // 금액 추출 ("1,178,100원" 또는 "480,000원" 또는 "40만원")
    const amountMatch = text.match(/(\d+(?:,\d+)*)\s*만?\s*원/);
    if (amountMatch) {
      const amountStr = amountMatch[1].replace(/,/g, '');
      let amount = parseInt(amountStr);

      // "만원" 패턴인 경우
      if (text.includes(amountMatch[0]) && amountMatch[0].includes('만')) {
        amount = amount * 10000;
      }

      setOriginalMaterialAmount(amount);
      setMaterialAmount(amount);
      setValue('materialAmount', amount);
    }

    // 항목명 추출 (대괄호 안의 텍스트 또는 "대금" 앞의 텍스트)
    const itemMatch = text.match(/\[([^\]]+)\]/) || text.match(/([가-힣]+)대금/);
    if (itemMatch) {
      setValue('itemName', itemMatch[1]);
    }
  };

  // Load contractors from MongoDB
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

  useEffect(() => {
    if (payment) {
      // Find project ID from project name
      const projectId = projects.find(p => p.name === payment.project)?.id || payment.project;
      setValue('projectId', projectId);
      setValue('process', payment.process);
      setSelectedProcess(payment.process || '');
      setValue('itemName', payment.itemName);
      setValue('amount', payment.amount);

      // 자재비와 인건비 설정
      const material = payment.materialAmount || 0;
      const labor = payment.laborAmount || 0;

      // 자재비 설정 - 원래 금액과 공제 상태 복원
      if (payment.originalMaterialAmount) {
        setOriginalMaterialAmount(payment.originalMaterialAmount);
        setMaterialAmount(material);
        setValue('materialAmount', material);
      } else {
        setOriginalMaterialAmount(material);
        setMaterialAmount(material);
        setValue('materialAmount', material);
      }

      // 인건비 설정 - 원래 금액과 공제/VAT 상태 복원
      if (payment.originalLaborAmount) {
        setOriginalLaborAmount(payment.originalLaborAmount);
        setLaborAmount(labor);
        setValue('laborAmount', labor);
      } else {
        setOriginalLaborAmount(labor);
        setLaborAmount(labor);
        setValue('laborAmount', labor);
      }

      // 세금 관련 체크박스 상태 복원
      setApplyTaxDeduction(payment.applyTaxDeduction || false);
      setIncludesVAT(payment.includesVAT || false);

      // category가 문자열이면 배열로 변환
      if (typeof payment.category === 'string') {
        setSelectedCategories([payment.category]);
      } else if (Array.isArray(payment.category)) {
        setSelectedCategories(payment.category);
      } else {
        setSelectedCategories(['material']);
      }
      setIsUrgent(payment.urgency === 'urgent');
      setValue('accountHolder', payment.bankInfo?.accountHolder);
      setValue('bankName', payment.bankInfo?.bankName);
      setValue('accountNumber', payment.bankInfo?.accountNumber);
      setValue('notes', payment.notes);
      setValue('requestedBy', payment.requestedBy);

      // 저장된 quickText 불러오기
      if (payment.quickText) {
        setQuickText(payment.quickText);
      }
    } else {
      // Auto-fill requestedBy with logged-in user's name for new payments
      if (user) {
        setValue('requestedBy', user.name);
      }
      setSelectedCategories(['material']);
    }
  }, [payment, setValue, user, projects]);

  // 공정 변경 시 해당 공정의 협력업체 필터링
  // 1. 계좌번호를 등록한 업체
  // 2. 한 번 결제한 적이 있는 업체
  useEffect(() => {
    if (selectedProcess) {
      // 결제한 적이 있는 예금주 목록 (completed 상태인 결제의 예금주)
      const paidAccountHolders = new Set(
        payments
          .filter(p => p.status === 'completed' && p.bankInfo?.accountHolder)
          .map(p => p.bankInfo!.accountHolder.trim().toLowerCase())
      );

      const filtered = contractors.filter(contractor => {
        // 공정이 일치하는지 확인
        const processMatch =
          contractor.process.toLowerCase().includes(selectedProcess.toLowerCase()) ||
          selectedProcess.toLowerCase().includes(contractor.process.toLowerCase());

        if (!processMatch) return false;

        // 계좌번호를 등록한 업체
        const hasAccountNumber = contractor.accountNumber && contractor.accountNumber.trim() !== '';

        // 결제한 적이 있는 업체 (이름으로 매칭)
        const contractorName = contractor.name.trim().toLowerCase();
        const hasPaidBefore = paidAccountHolders.has(contractorName);

        // 계좌번호가 있거나 결제 이력이 있는 업체만 추천
        return hasAccountNumber || hasPaidBefore;
      });

      // 정렬: 1) 계좌번호 있는 업체 우선, 2) 결제 이력 있는 업체
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
  }, [selectedProcess, contractors, payments]);

  // 협력업체 선택 시 계좌 정보 자동 입력
  const handleContractorSelect = (contractor: Contractor) => {
    // 선택된 협력업체 ID 설정
    setSelectedContractorId(contractor.id || contractor._id);

    // 예금주에 이름 입력 (removePosition 함수로 직책 제거)
    const cleanName = removePosition(contractor.name);
    setValue('accountHolder', cleanName);

    // contractor.name에서 직책 추출
    const name = contractor.name || '';
    let position = '';

    // 이름과 직책이 공백으로 분리된 경우
    const parts = name.split(' ');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      for (const pos of positions) {
        if (lastPart === pos) {
          position = pos;
          break;
        }
      }
    }

    // 직책이 공백 없이 붙어있는 경우
    if (!position) {
      for (const pos of positions) {
        if (name.endsWith(pos)) {
          position = pos;
          break;
        }
      }
    }

    // 직책이 '반장'인 경우 항목명이 비어있으면 '인건비'로 자동 입력
    if (position === '반장') {
      const currentItemName = watch('itemName');
      if (!currentItemName || currentItemName.trim() === '') {
        setValue('itemName', '인건비');
      }
    }

    // 계좌번호가 있는 경우 계좌번호에서 은행명과 계좌번호 분리
    if (contractor.accountNumber && contractor.accountNumber.trim() !== '') {
      const bankNames = [
        'KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행',
        'KEB하나은행', 'SC제일은행', '한국씨티은행', '부산은행', '대구은행', '경남은행',
        '광주은행', '전북은행', '제주은행', '산업은행', '수협은행', '우체국',
        '새마을금고', '신협', '저축은행', '카카오뱅크', '케이뱅크', '토스뱅크',
        'NH투자증권', '미래에셋증권', '한국투자증권', '키움증권', '삼성증권',
        'KB증권', '신한투자증권', '하이투자증권'
      ];

      let bankName = '';
      let accountNum = contractor.accountNumber.trim();

      // 은행명이 포함되어 있는지 확인
      for (const bank of bankNames) {
        if (accountNum.startsWith(bank)) {
          bankName = bank;
          accountNum = accountNum.substring(bank.length).trim();
          break;
        }
      }

      if (bankName) {
        setValue('bankName', bankName);
        setValue('accountNumber', accountNum);
      } else {
        // 은행명이 없으면 계좌번호만 입력
        setValue('accountNumber', accountNum);
      }
    } else {
      // 계좌번호가 없는 경우 (결제 이력이 있는 업체)
      // 가장 최근 completed 결제 내역에서 계좌 정보 가져오기
      const recentPayment = payments
        .filter(p =>
          p.status === 'completed' &&
          p.bankInfo?.accountHolder &&
          p.bankInfo.accountHolder.trim().toLowerCase() === name.toLowerCase()
        )
        .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())[0];

      if (recentPayment && recentPayment.bankInfo) {
        setValue('accountHolder', recentPayment.bankInfo.accountHolder);
        setValue('bankName', recentPayment.bankInfo.bankName);
        setValue('accountNumber', recentPayment.bankInfo.accountNumber);
      }
    }
  };

  const handleProcessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedProcess(value);
    setValue('process', value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);

    // 이미지 미리보기
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: Partial<PaymentRequestFormData>) => {
    console.log('💰 Payment form onSubmit called');
    console.log('💰 Form data:', data);
    console.log('💰 Validation errors:', errors);
    console.log('💰 Material amount:', materialAmount);
    console.log('💰 Labor amount:', laborAmount);

    // Calculate total amount from material and labor
    const totalAmount = materialAmount + laborAmount;

    const formData = {
      ...data,
      amount: totalAmount, // Send total as single 'amount' field
      materialAmount: materialAmount, // 자재비 저장
      laborAmount: laborAmount, // 인건비 저장
      originalMaterialAmount: originalMaterialAmount, // 원래 자재비 저장
      originalLaborAmount: originalLaborAmount, // 원래 인건비 저장
      applyTaxDeduction: applyTaxDeduction, // 3.3% 공제 여부 저장
      includesVAT: includesVAT, // 부가세 포함 여부 저장
      quickText: quickText, // 자동으로 항목 채우기에 입력했던 원본 텍스트 저장
      category: selectedCategories.join(', '), // 여러 카테고리를 문자열로 저장
      urgency: isUrgent ? 'urgent' : 'normal', // 긴급 여부를 전송
      requestedBy: data.requestedBy, // Include requestedBy from form
      attachments,
      status: payment ? payment.status : 'pending',
      requestDate: new Date()
    };
    console.log('💰 Final form data:', formData);
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">
            {payment ? '결제 요청 상세' : '새 결제 요청'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Project and Requested By */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트 *
              </label>
              <select
                {...register('projectId', { required: '프로젝트를 선택하세요' })}
                className="input"
                disabled={!!payment}
              >
                <option value="">선택하세요</option>
                {projects
                  .filter(project => project.status !== 'completed')
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
              {errors.projectId && (
                <p className="mt-1 text-sm text-red-600">{String(errors.projectId.message)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                요청자 *
              </label>
              <input
                {...register('requestedBy', { required: '요청자를 입력하세요' })}
                type="text"
                className="input"
                placeholder="요청자 이름"
              />
              {errors.requestedBy && (
                <p className="mt-1 text-sm text-red-600">{String(errors.requestedBy.message)}</p>
              )}
            </div>
          </div>

          {/* Process & Item Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                공정
              </label>
              <select
                {...register('process')}
                onChange={handleProcessChange}
                className="input"
              >
                <option value="">선택하세요</option>
                <option value="가설">가설</option>
                <option value="철거">철거</option>
                <option value="설비/미장">설비/미장</option>
                <option value="전기">전기</option>
                <option value="목공">목공</option>
                <option value="조경">조경</option>
                <option value="가구">가구</option>
                <option value="마루">마루</option>
                <option value="타일">타일</option>
                <option value="욕실">욕실</option>
                <option value="필름">필름</option>
                <option value="도배">도배</option>
                <option value="도장">도장</option>
                <option value="창호">창호</option>
                <option value="에어컨">에어컨</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                항목명
              </label>
              <input
                {...register('itemName')}
                type="text"
                className="input"
              />
            </div>
          </div>

          {/* Recommended Contractors */}
          {recommendedContractors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-900 mb-3">
                추천 협력업체 ({recommendedContractors.length}명)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {recommendedContractors.map((contractor) => {
                  const hasAccountNumber = contractor.accountNumber && contractor.accountNumber.trim() !== '';

                  // contractor.name에서 직책 추출
                  const name = contractor.name || '';
                  let extractedPosition = '';

                  // 이름과 직책이 공백으로 분리된 경우
                  const parts = name.split(' ');
                  if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1];
                    for (const pos of positions) {
                      if (lastPart === pos) {
                        extractedPosition = pos;
                        break;
                      }
                    }
                  }

                  // 직책이 공백 없이 붙어있는 경우
                  if (!extractedPosition) {
                    for (const pos of positions) {
                      if (name.endsWith(pos)) {
                        extractedPosition = pos;
                        break;
                      }
                    }
                  }

                  return (
                    <button
                      key={contractor.id}
                      type="button"
                      onClick={() => handleContractorSelect(contractor)}
                      className={`text-left p-3 bg-white border rounded-lg transition-colors ${
                        selectedContractorId === (contractor.id || contractor._id)
                          ? hasAccountNumber
                            ? 'bg-amber-100 border-amber-400'
                            : 'bg-blue-50 border-blue-300'
                          : hasAccountNumber
                            ? 'border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                            : 'border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">
                          {removePosition(contractor.name)}
                          {extractedPosition && ` (${extractedPosition})`}
                        </div>
                        {hasAccountNumber ? (
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded">계좌등록</span>
                        ) : (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">결제이력</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {contractor.companyName && `${contractor.companyName} · `}
                        {contractor.process}
                      </div>
                      {hasAccountNumber && (
                        <div className="text-xs text-amber-700 mt-1 font-mono">
                          {contractor.accountNumber}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-amber-700 mt-3">
                💡 협력업체를 클릭하면 계좌 정보가 자동으로 입력됩니다
              </p>
              <p className="text-xs text-gray-600 mt-1">
                • <span className="text-amber-800 font-medium">계좌등록</span>: 협력업체 관리에 계좌번호가 등록된 업체
                <br />
                • <span className="text-blue-800 font-medium">결제이력</span>: 과거 송금완료 이력이 있는 업체
              </p>
            </div>
          )}

          {/* Material and Labor Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                자재비 (원)
              </label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={materialAmount || ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : Number(e.target.value);
                  console.log('Material amount input:', e.target.value, '→', value);
                  setOriginalMaterialAmount(value);
                  // 3.3% 공제가 체크되어 있으면 공제 적용
                  if (applyTaxDeduction) {
                    const deductedAmount = Math.round(value * 0.967);
                    setMaterialAmount(deductedAmount);
                    setValue('materialAmount', deductedAmount);
                  } else {
                    setMaterialAmount(value);
                    setValue('materialAmount', value);
                  }
                }}
              />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              인건비 (원)
            </label>
            <input
              type="number"
              className="input"
              placeholder="0"
              value={laborAmount || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : Number(e.target.value);
                console.log('Labor amount input:', e.target.value, '→', value);
                setOriginalLaborAmount(value);
                // 3.3% 공제가 체크되어 있으면 공제 적용
                if (applyTaxDeduction) {
                  const deductedAmount = Math.round(value * 0.967);
                  setLaborAmount(deductedAmount);
                  setValue('laborAmount', deductedAmount);
                } else {
                  setLaborAmount(value);
                  setValue('laborAmount', value);
                }
              }}
            />
          </div>
          </div>

          {/* Tax Options - Applied to both Material and Labor */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">세금 옵션</h4>

            {/* Tax Deduction Checkbox */}
            <div className="mb-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyTaxDeduction}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setApplyTaxDeduction(checked);
                    if (checked) {
                      setIncludesVAT(false); // 3.3% 공제 선택 시 부가세 체크 해제
                      // 자재비 공제 적용
                      if (originalMaterialAmount > 0) {
                        const deductedMaterial = Math.round(originalMaterialAmount * 0.967);
                        setMaterialAmount(deductedMaterial);
                        setValue('materialAmount', deductedMaterial);
                      }
                      // 인건비 공제 적용
                      if (originalLaborAmount > 0) {
                        const deductedLabor = Math.round(originalLaborAmount * 0.967);
                        setLaborAmount(deductedLabor);
                        setValue('laborAmount', deductedLabor);
                      }
                    } else {
                      // 공제 해제 - 원래 금액으로 복원
                      if (originalMaterialAmount > 0) {
                        setMaterialAmount(originalMaterialAmount);
                        setValue('materialAmount', originalMaterialAmount);
                      }
                      if (originalLaborAmount > 0) {
                        setLaborAmount(originalLaborAmount);
                        setValue('laborAmount', originalLaborAmount);
                      }
                    }
                  }}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <span className="text-sm text-gray-700">
                  3.3% 세금공제 - 자재비와 인건비 모두 적용
                </span>
              </label>
              {applyTaxDeduction && (originalMaterialAmount > 0 || originalLaborAmount > 0) && (
                <div className="mt-2 ml-6 text-xs text-amber-700">
                  {originalMaterialAmount > 0 && (
                    <div>자재비: {originalMaterialAmount.toLocaleString()}원 → {materialAmount.toLocaleString()}원 (공제: {(originalMaterialAmount - materialAmount).toLocaleString()}원)</div>
                  )}
                  {originalLaborAmount > 0 && (
                    <div>인건비: {originalLaborAmount.toLocaleString()}원 → {laborAmount.toLocaleString()}원 (공제: {(originalLaborAmount - laborAmount).toLocaleString()}원)</div>
                  )}
                </div>
              )}
            </div>

            {/* VAT Checkbox */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includesVAT}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludesVAT(checked);
                    if (checked) {
                      setApplyTaxDeduction(false); // 부가세 포함 선택 시 3.3% 공제 해제
                      // 3.3% 공제가 적용되어 있었다면 원래 금액으로 복원
                      if (applyTaxDeduction) {
                        if (originalMaterialAmount > 0) {
                          setMaterialAmount(originalMaterialAmount);
                          setValue('materialAmount', originalMaterialAmount);
                        }
                        if (originalLaborAmount > 0) {
                          setLaborAmount(originalLaborAmount);
                          setValue('laborAmount', originalLaborAmount);
                        }
                      }
                    }
                  }}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  부가세 포함 금액
                </span>
              </label>
              {includesVAT && (originalMaterialAmount + originalLaborAmount > 0) && (
                <div className="mt-2 ml-6 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-900">
                  <div>공급가액: {Math.round((originalMaterialAmount + originalLaborAmount) / 1.1).toLocaleString()}원</div>
                  <div>부가세 (10%): {Math.round((originalMaterialAmount + originalLaborAmount) - ((originalMaterialAmount + originalLaborAmount) / 1.1)).toLocaleString()}원</div>
                  <div className="font-medium">합계: {(originalMaterialAmount + originalLaborAmount).toLocaleString()}원</div>
                </div>
              )}
            </div>
          </div>

          {/* Total Amount */}
          {(materialAmount > 0 || laborAmount > 0) && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-purple-900">합계 금액</span>
                <span className="text-2xl font-bold text-purple-900">
                  {(materialAmount + laborAmount).toLocaleString()}원
                </span>
              </div>
              {materialAmount > 0 && laborAmount > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-200 text-sm text-purple-700 space-y-1">
                  <div className="flex justify-between">
                    <span>자재비:</span>
                    <span className="font-medium">{materialAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span>인건비:</span>
                    <span className="font-medium">{laborAmount.toLocaleString()}원</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Text Input */}
          <div className="w-full border-t pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💡 빠른 입력 (텍스트 붙여넣기)
              </label>
              <textarea
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="예시:&#10;[목자재]&#10;➖&#10;하나은행&#10;362-910277-07207&#10;이창훈 창원목재&#10;목재대금 : 1,178,100원&#10;(부가세포함)"
              />
              <button
                type="button"
                onClick={() => parseQuickText(quickText)}
                className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                자동으로 항목 채우기
              </button>
              <p className="mt-2 text-xs text-gray-600">
                * 텍스트에서 은행명, 계좌번호, 예금주, 금액, 항목명을 자동으로 인식합니다
              </p>
            </div>
          </div>

          {/* Bank Info */}
          <div className="w-full">
            <h3 className="text-lg font-medium mb-4">계좌 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예금주 *
                </label>
                <input
                  {...register('accountHolder', { required: '예금주를 입력하세요' })}
                  type="text"
                  className="input w-full"
                  placeholder="홍길동"
                  id="accountHolder"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  은행명 *
                </label>
                <select
                  {...register('bankName', { required: '은행을 선택하세요' })}
                  className="input w-full"
                  id="bankName"
                >
                  <option value="">선택하세요</option>
                  <optgroup label="시중은행">
                    <option value="KB국민은행">KB국민은행</option>
                    <option value="신한은행">신한은행</option>
                    <option value="우리은행">우리은행</option>
                    <option value="하나은행">하나은행</option>
                    <option value="NH농협은행">NH농협은행</option>
                    <option value="IBK기업은행">IBK기업은행</option>
                    <option value="KEB하나은행">KEB하나은행</option>
                    <option value="SC제일은행">SC제일은행</option>
                    <option value="한국씨티은행">한국씨티은행</option>
                  </optgroup>
                  <optgroup label="지방은행">
                    <option value="부산은행">부산은행</option>
                    <option value="대구은행">대구은행</option>
                    <option value="경남은행">경남은행</option>
                    <option value="광주은행">광주은행</option>
                    <option value="전북은행">전북은행</option>
                    <option value="제주은행">제주은행</option>
                  </optgroup>
                  <optgroup label="특수은행">
                    <option value="산업은행">산업은행</option>
                    <option value="수협은행">수협은행</option>
                    <option value="우체국">우체국</option>
                    <option value="새마을금고">새마을금고</option>
                    <option value="신협">신협</option>
                    <option value="저축은행">저축은행</option>
                  </optgroup>
                  <optgroup label="인터넷은행">
                    <option value="카카오뱅크">카카오뱅크</option>
                    <option value="케이뱅크">케이뱅크</option>
                    <option value="토스뱅크">토스뱅크</option>
                  </optgroup>
                  <optgroup label="증권사">
                    <option value="NH투자증권">NH투자증권</option>
                    <option value="미래에셋증권">미래에셋증권</option>
                    <option value="한국투자증권">한국투자증권</option>
                    <option value="키움증권">키움증권</option>
                    <option value="삼성증권">삼성증권</option>
                    <option value="KB증권">KB증권</option>
                    <option value="신한투자증권">신한투자증권</option>
                    <option value="하이투자증권">하이투자증권</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계좌번호 *
                </label>
                <input
                  {...register('accountNumber', { required: '계좌번호를 입력하세요' })}
                  type="text"
                  className="input w-full"
                  placeholder="123-456-789012"
                  id="accountNumber"
                />
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="w-full border-t pt-6">
            <h3 className="text-lg font-medium mb-4">첨부파일 (영수증, 견적서)</h3>

            <div className="w-full mb-4">
              <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition-colors">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    클릭하여 파일 선택 또는 드래그 앤 드롭
                  </span>
                  <span className="text-xs text-gray-500 block mt-1">
                    PNG, JPG, PDF (최대 10MB)
                  </span>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Attachment Preview */}
            {(attachments.length > 0 || imagePreview.length > 0) && (
              <div className="w-full space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {file.type.startsWith('image/') ? (
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <FileText className="h-5 w-5 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Image Previews */}
            {imagePreview.length > 0 && (
              <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {imagePreview.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비고
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="input"
              placeholder="추가 설명이나 특이사항을 입력하세요"
            />
          </div>

          {/* Actions - 모바일 최적화 */}
          <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center pt-4 border-t space-y-2 sm:space-y-0 sm:space-x-2 sticky bottom-0 bg-white pb-4 -mb-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline w-full sm:w-auto touch-manipulation"
              style={{ minHeight: '44px' }}
            >
              취소
            </button>

            {/* 긴급 결제 요청 버튼 - 요청하기 버튼 왼쪽에 작게 */}
            {!payment && (
              <button
                type="button"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center space-x-1 w-full sm:w-auto touch-manipulation ${
                  isUrgent
                    ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                }`}
                style={{ minHeight: '44px' }}
                title={isUrgent ? "긴급 해제" : "긴급 설정"}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{isUrgent ? '긴급' : '일반'}</span>
              </button>
            )}

            {!payment && (
              <button
                type="submit"
                onClick={(e) => {
                  console.log('💰 Submit button clicked!');
                  console.log('💰 Button type:', e.currentTarget.type);
                  console.log('💰 Form errors:', errors);
                }}
                className={`btn w-full sm:w-auto touch-manipulation ${isUrgent ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}`}
                style={{ minHeight: '44px', zIndex: 10, position: 'relative' }}
              >
                {isUrgent ? '긴급 요청하기' : '요청하기'}
              </button>
            )}

            {payment && (
              <button
                type="submit"
                className="btn btn-primary w-full sm:w-auto touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                수정하기
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentRequestModal;