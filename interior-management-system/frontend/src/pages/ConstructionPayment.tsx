import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Edit } from 'lucide-react';
import { useDataStore, type ConstructionPayment } from '../store/dataStore';
import additionalWorkService from '../services/additionalWorkService';
import toast from 'react-hot-toast';
import type { PaymentType, PaymentRecord } from '../types/forms';
import { stampBase64 } from '../assets/stampBase64';
import { StampSvg } from '../components/StampSvg';

interface PaymentRecord {
  id: string;
  project: string;
  client: string;
  totalAmount: number; // 순수 공사금액
  vatType: 'percentage' | 'amount'; // 부가세 입력 방식
  vatPercentage: number; // 부가세 발행 비율 (0-100%)
  vatAmount: number; // 부가세 발행 금액
  payments: {
    type: string; // 쉼표로 구분된 타입들 ('계약금', '계약금, 착수금' 등)
    amount: number;
    date: Date;
    method: string;
    notes?: string;
  }[];
}

const ConstructionPayment = () => {
  const {
    projects,
    constructionPayments,
    loadConstructionPaymentsFromAPI,
    addConstructionPaymentToAPI,
    updateConstructionPaymentInAPI,
    deleteConstructionPaymentFromAPI,
    executionRecords,
    payments
  } = useDataStore();
  const [records, setRecords] = useState<PaymentRecord[]>(constructionPayments);
  const [additionalWorks, setAdditionalWorks] = useState<Array<{ _id: string; project: string; amount: number }>>([]);
  const [showCashReceiptModal, setShowCashReceiptModal] = useState(false);
  const [cashReceiptData, setCashReceiptData] = useState({
    project: '',
    client: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    clientSignature: '',
    totalContractAmount: 0,
    previousAmount: 0,
    remainingAmount: 0,
    startDate: '',
    endDate: ''
  });

  // Load construction payments from API on mount
  useEffect(() => {
    console.log('💰 ConstructionPayment: Loading payments from API...');
    loadConstructionPaymentsFromAPI()
      .then(() => {
        console.log('💰 ConstructionPayment: Payments loaded successfully');
      })
      .catch(error => {
        console.error('💰 ConstructionPayment: Failed to load construction payments:', error);
        toast.error('공사대금 데이터를 불러오는데 실패했습니다');
      });
  }, [loadConstructionPaymentsFromAPI]);

  // Load additional works from API
  useEffect(() => {
    console.log('💰 ConstructionPayment: Loading additional works from API...');
    additionalWorkService.getAllAdditionalWorks()
      .then(works => {
        console.log('💰 ConstructionPayment: Additional works loaded:', works);
        setAdditionalWorks(works.map(work => ({
          _id: work._id,
          project: work.project,
          amount: work.amount
        })));
      })
      .catch(error => {
        console.error('💰 ConstructionPayment: Failed to load additional works:', error);
      });
  }, []);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      handleAddProject();
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

  // Sync local state with dataStore, normalize data, and remove orphaned records
  useEffect(() => {
    console.log('💰 ConstructionPayment: Syncing with dataStore');
    console.log('💰 constructionPayments:', constructionPayments);
    console.log('💰 projects:', projects);

    // Get valid project names
    const validProjectNames = projects.map(p => p.name);
    console.log('💰 Valid project names:', validProjectNames);

    // Filter out records that don't have corresponding projects
    const validRecords = constructionPayments.filter(record =>
      validProjectNames.includes(record.project)
    );
    console.log('💰 Valid records after filtering:', validRecords);

    // Normalize the valid records
    const normalizedRecords = validRecords.map(record => ({
      ...record,
      vatType: record.vatType || 'percentage',
      vatPercentage: record.vatPercentage ?? 100,
      vatAmount: record.vatAmount ?? 0,
      payments: record.payments.map((payment: PaymentRecord) => ({
        ...payment,
        // Convert old 'types' format to new 'type' format
        type: payment.type || payment.types?.[0] || '계약금'
      }))
    }));
    console.log('💰 Normalized records:', normalizedRecords);

    // If orphaned records were found, delete them from the store
    if (validRecords.length < constructionPayments.length) {
      // Find orphaned records
      const orphanedRecords = constructionPayments.filter(
        record => !validProjectNames.includes(record.project)
      );

      // Delete each orphaned record from the store
      orphanedRecords.forEach(async (record) => {
        try {
          await deleteConstructionPaymentFromAPI(record.id);
        } catch (error) {
          console.error('Failed to delete orphaned record:', error);
        }
      });

      console.log('Removed orphaned construction payment records:',
        orphanedRecords.map(r => `${r.project} (${r.id})`));
    }

    setRecords(normalizedRecords);
  }, [constructionPayments, projects, deleteConstructionPaymentFromAPI]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'remaining'>('remaining');
  const [newProject, setNewProject] = useState({
    projectId: '',
    totalAmount: 0,
    vatType: 'percentage' as 'percentage' | 'amount',
    vatPercentage: 100,
    vatAmount: 0
  });
  const [newPayment, setNewPayment] = useState({
    types: [] as ('계약금' | '착수금' | '중도금' | '잔금' | '추가금')[],
    percentage: 0,
    amount: 0,
    date: '',
    method: '계좌이체',
    notes: ''
  });

  // 각 구분별 기본 비율
  const DEFAULT_PERCENTAGES = {
    '계약금': 10,
    '착수금': 40,
    '중도금': 40,
    '잔금': 10,
    '추가금': 0  // 추가금은 기본 0%
  };

  // 선택된 타입들의 비율 합산
  const calculateTotalPercentage = (selectedTypes: string[]) => {
    return selectedTypes.reduce((sum, type) => {
      return sum + (DEFAULT_PERCENTAGES[type as keyof typeof DEFAULT_PERCENTAGES] || 0);
    }, 0);
  };

  // 공사 날짜 기반으로 자동 날짜 계산 (우선순위: 계약금 > 착수금 > 중도금 > 잔금 > 추가금)
  const calculatePaymentDate = (types: ('계약금' | '착수금' | '중도금' | '잔금' | '추가금')[], projectId?: string) => {
    const currentProject = projectId
      ? projects.find(p => p.id === projectId)
      : (selectedRecord ? projects.find(p => p.name === selectedRecord.project) : null);

    if (!currentProject || types.length === 0) return '';
    if (!currentProject.startDate || !currentProject.endDate) return '';

    const startDate = new Date(currentProject.startDate);
    const endDate = new Date(currentProject.endDate);

    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';

    // 우선순위에 따라 날짜 결정
    if (types.includes('계약금')) {
      // 계약금은 날짜를 비워둠 (사용자가 직접 입력)
      return '';
    } else if (types.includes('착수금')) {
      // 착수금은 공사 시작 1주일 전
      const oneWeekBefore = new Date(startDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      return format(oneWeekBefore, 'yyyy-MM-dd');
    } else if (types.includes('중도금')) {
      // 중도금은 공사 시작과 종료 중간
      const middleTime = startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2;
      return format(new Date(middleTime), 'yyyy-MM-dd');
    } else if (types.includes('잔금') || types.includes('추가금')) {
      // 잔금과 추가금은 공사 종료일
      return format(endDate, 'yyyy-MM-dd');
    }

    return '';
  };

  // 프로젝트의 예상 수금 일정 계산
  const calculatePaymentSchedule = (record: PaymentRecord) => {
    const project = projects.find(p => p.name === record.project);
    if (!project) return [];
    if (!project.startDate || !project.endDate) return [];

    const totalAmount = calculateTotalContractAmount(record);
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);

    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return [];

    const schedule: Array<{
      type: string;
      date: Date | null;
      amount: number;
      percentage: number;
      status: string;
      actualDate?: Date;
      actualAmount?: number;
    }> = [];

    // 계약금 - 날짜 미정
    schedule.push({
      type: '계약금',
      date: null,
      amount: Math.round(totalAmount * 0.1),
      percentage: 10,
      status: 'pending'
    });

    // 착수금 - 공사 시작 1주일 전
    const oneWeekBefore = new Date(startDate);
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
    schedule.push({
      type: '착수금',
      date: oneWeekBefore,
      amount: Math.round(totalAmount * 0.4),
      percentage: 40,
      status: oneWeekBefore <= new Date() ? 'overdue' : 'pending'
    });

    // 중도금 - 공사 중간
    const middleTime = startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2;
    const middleDate = new Date(middleTime);
    schedule.push({
      type: '중도금',
      date: middleDate,
      amount: Math.round(totalAmount * 0.4),
      percentage: 40,
      status: middleDate <= new Date() ? 'overdue' : 'pending'
    });

    // 잔금 - 공사 종료일
    schedule.push({
      type: '잔금',
      date: endDate,
      amount: Math.round(totalAmount * 0.1),
      percentage: 10,
      status: endDate <= new Date() ? 'overdue' : 'pending'
    });

    // 실제 수금 내역과 비교하여 상태 업데이트
    record.payments.forEach(payment => {
      const types = payment.type?.split(', ') || [];
      types.forEach(type => {
        const scheduleItem = schedule.find(s => s.type === type.trim());
        if (scheduleItem) {
          scheduleItem.status = 'completed';
          scheduleItem.actualDate = payment.date;
          scheduleItem.actualAmount = payment.amount;
        }
      });
    });

    return schedule;
  };

  const handleAddProject = () => {
    setShowProjectModal(true);
  };

  const handleSaveProject = async () => {
    console.log('💰 handleSaveProject called');
    console.log('💰 newProject:', newProject);
    console.log('💰 projects:', projects);

    // ID 타입 안전하게 비교 (문자열/숫자 모두 처리)
    const selectedProject = projects.find(p =>
      p.id === newProject.projectId ||
      p.id === parseInt(newProject.projectId) ||
      p.id.toString() === newProject.projectId.toString()
    );
    console.log('💰 selectedProject:', selectedProject);
    console.log('💰 totalAmount:', newProject.totalAmount, 'type:', typeof newProject.totalAmount);

    if (!selectedProject) {
      alert('프로젝트를 선택하세요');
      return;
    }

    if (newProject.totalAmount <= 0) {
      alert('총 공사금액을 입력하세요 (0보다 커야 합니다)');
      return;
    }

    try {
      const newRecord: Partial<ConstructionPayment> = {
        id: '',
        project_id: selectedProject.id,  // Add project_id for backend
        project: selectedProject.name,
        client: selectedProject.client,
        totalAmount: newProject.totalAmount,
        vatType: newProject.vatType,
        vatPercentage: newProject.vatPercentage,
        vatAmount: newProject.vatAmount,
        payments: []
      };

      console.log('📤 Sending to API:', newRecord);
      await addConstructionPaymentToAPI(newRecord);
      toast.success('프로젝트가 추가되었습니다');
      setShowProjectModal(false);
      setNewProject({ projectId: '', totalAmount: 0, vatType: 'percentage', vatPercentage: 100, vatAmount: 0 });
    } catch (error) {
      console.error('Failed to add construction payment:', error);
      toast.error('프로젝트 추가에 실패했습니다');
    }
  };

  const handleAddPayment = () => {
    setEditingPaymentIndex(null);
    setNewPayment({
      types: [],
      percentage: 0,
      amount: 0,
      date: '',
      method: '계좌이체',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleEditPayment = (index: number) => {
    const payment = selectedRecord?.payments[index];
    if (!payment) return;

    setEditingPaymentIndex(index);
    // type이 쉼표로 구분된 문자열인 경우 처리
    const paymentTypes = payment.type
      ? payment.type.split(',').map(t => t.trim()) as ('계약금' | '착수금' | '중도금' | '잔금' | '추가금')[]
      : [];
    setNewPayment({
      types: paymentTypes,
      percentage: calculateTotalPercentage(paymentTypes),
      amount: payment.amount,
      date: format(payment.date, 'yyyy-MM-dd'),
      method: payment.method,
      notes: payment.notes || ''
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!selectedRecord || !newPayment.date || newPayment.amount <= 0 || newPayment.types.length === 0) {
      alert('모든 필드를 입력하세요');
      return;
    }

    try {
      let updatedPayments;
      if (editingPaymentIndex !== null) {
        // 수정 모드
        updatedPayments = selectedRecord.payments.map((payment, idx) =>
          idx === editingPaymentIndex
            ? {
                type: newPayment.types.join(', '),  // 여러 타입을 쉼표로 구분하여 저장
                amount: newPayment.amount,
                date: new Date(newPayment.date),
                method: newPayment.method,
                notes: newPayment.notes
              }
            : payment
        );
      } else {
        // 추가 모드
        updatedPayments = [
          ...selectedRecord.payments,
          {
            type: newPayment.types.join(', '),  // 여러 타입을 쉼표로 구분하여 저장
            amount: newPayment.amount,
            date: new Date(newPayment.date),
            method: newPayment.method,
            notes: newPayment.notes
          }
        ];
      }

      const updatedRecord = {
        ...selectedRecord,
        payments: updatedPayments
      };

      // Update in API
      await updateConstructionPaymentInAPI(selectedRecord.id, updatedRecord);
      toast.success(editingPaymentIndex !== null ? '입금이 수정되었습니다' : '입금이 추가되었습니다');

      // Update local state
      const updatedRecords = records.map(record =>
        record.id === selectedRecord.id ? updatedRecord : record
      );
      setRecords(updatedRecords);
      setSelectedRecord(updatedRecord);
      setShowPaymentModal(false);
      setEditingPaymentIndex(null);
      setNewPayment({
        types: [],
        percentage: 0,
        amount: 0,
        date: '',
        method: '계좌이체',
        notes: ''
      });
    } catch (error) {
      console.error('Failed to save payment:', error);
      toast.error('입금 저장에 실패했습니다');
    }
  };

  // 총 합계 계산 (공사금액 + 부가세) - 추가내역 제외
  const calculateTotalContractAmount = (record: PaymentRecord) => {
    const baseAmount = record.totalAmount;  // 추가내역 제외

    if (record.vatType === 'amount') {
      return baseAmount + (record.vatAmount || 0);
    } else {
      const vatAmount = baseAmount * ((record.vatPercentage ?? 100) / 100) * 0.1;
      return baseAmount + vatAmount;
    }
  };

  // 미수금 계산용 총 금액 (공사금액 + 추가내역 + 부가세)
  const calculateTotalAmountWithAdditional = (record: PaymentRecord) => {
    const additionalWorkAmount = calculateAdditionalWorkTotal(record.project);
    const baseAmount = record.totalAmount + additionalWorkAmount;

    if (record.vatType === 'amount') {
      return baseAmount + (record.vatAmount || 0);
    } else {
      const vatAmount = baseAmount * ((record.vatPercentage ?? 100) / 100) * 0.1;
      return baseAmount + vatAmount;
    }
  };

  // 부가세 금액 계산
  const getVatAmount = (record: PaymentRecord) => {
    if (record.vatType === 'amount') {
      return record.vatAmount || 0;
    } else {
      return record.totalAmount * ((record.vatPercentage ?? 100) / 100) * 0.1;
    }
  };

  // 퍼센트에 따라 금액 자동 계산 (총 합계 기준)
  const calculateAmountFromPercentage = (percentage: number) => {
    if (!selectedRecord) return 0;
    const totalContractAmount = calculateTotalContractAmount(selectedRecord);
    return Math.round((totalContractAmount * percentage) / 100);
  };

  const calculateReceived = (record: PaymentRecord) => {
    return record.payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const calculateRemaining = (record: PaymentRecord) => {
    // 미수금 계산시에는 추가내역 포함
    const totalWithAdditional = calculateTotalAmountWithAdditional(record);
    return totalWithAdditional - calculateReceived(record);
  };

  // 프로젝트별 실행내역 총 합계 계산 (승인/완료된 결제요청 포함)
  const calculateExecutionTotal = (projectName: string) => {
    // 실행내역 합계
    const executionTotal = executionRecords
      .filter(record => record.project === projectName)
      .reduce((sum, record) => sum + (record.totalAmount || 0), 0);

    // 승인/완료된 결제요청 합계 (부가세 포함 금액 그대로 사용)
    const paymentTotal = payments
      .filter(p => (p.status === 'approved' || p.status === 'completed') && p.project === projectName)
      .reduce((sum, payment) => sum + payment.amount, 0);

    return executionTotal + paymentTotal;
  };

  // 프로젝트별 추가내역 총 합계 계산
  const calculateAdditionalWorkTotal = (projectName: string) => {
    return additionalWorks
      .filter(work => work.project === projectName)
      .reduce((sum, work) => sum + work.amount, 0);
  };

  // 검색 및 탭 필터링
  const filteredRecords = records
    .filter(record =>
      (record.project || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.client || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(record => {
      if (activeTab === 'all') return true;
      const remaining = calculateRemaining(record);
      if (activeTab === 'completed') return remaining === 0;
      if (activeTab === 'remaining') return remaining > 0;
      return true;
    });

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Tabs and Add Button */}
      <div className="border-b border-gray-200 flex items-center justify-between">
        <nav className="flex space-x-4 md:space-x-8 overflow-x-auto">
          {[
            { id: 'remaining' as const, label: '미수금', count: records.filter(r => calculateRemaining(r) > 0).length },
            { id: 'completed' as const, label: '완납', count: records.filter(r => calculateRemaining(r) === 0).length },
            { id: 'all' as const, label: '전체', count: records.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-gray-700 text-gray-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1 md:ml-2 py-0.5 px-1.5 md:px-2 rounded-full text-[10px] md:text-xs font-semibold ${
                activeTab === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
        <button
          onClick={handleAddProject}
          className="btn btn-primary px-4 py-2 whitespace-nowrap"
        >
          +프로젝트
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="프로젝트 또는 고객명 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
        />
      </div>

      {/* Records List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredRecords.map((record) => {
              const received = calculateReceived(record);
              const remaining = calculateRemaining(record);
              const totalContractAmount = calculateTotalContractAmount(record);
              const percentage = (received / totalContractAmount) * 100;

              return (
                <div key={record.id} className="card hover:border-gray-400 transition-colors">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-gray-900">{record.project}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const received = calculateReceived(record);
                        const totalContract = calculateTotalContractAmount(record);
                        // 추가내역을 제외한 잔여금액 계산
                        const remainingWithoutAdditional = totalContract - received;

                        // 프로젝트 정보에서 기간 가져오기
                        const projectInfo = projects.find(p => p.name === record.project);

                        setCashReceiptData({
                          project: record.project,
                          client: record.client,
                          amount: '',
                          date: format(new Date(), 'yyyy-MM-dd'),
                          clientSignature: '',
                          totalContractAmount: totalContract,
                          previousAmount: received,
                          remainingAmount: remainingWithoutAdditional,
                          startDate: projectInfo?.startDate ? format(new Date(projectInfo.startDate), 'yyyy-MM-dd') : '',
                          endDate: projectInfo?.endDate ? format(new Date(projectInfo.endDate), 'yyyy-MM-dd') : ''
                        });
                        setShowCashReceiptModal(true);
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors"
                    >
                      현금수령증
                    </button>
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              </div>

              {/* Total Amount */}
              <div className="mb-4">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">계약금액</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ₩{record.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500 mb-1">
                        총 합계
                      </p>
                      <p className="text-sm font-semibold text-gray-700">
                        ₩{totalContractAmount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        (부가세 {record.vatType === 'percentage' ? `${record.vatPercentage ?? 100}%` : `₩${(record.vatAmount || 0).toLocaleString()}`} 포함)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">수령률</span>
                  <span className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full">
                  <div
                    className="bg-gray-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Received, Execution Total, Additional Work & Remaining */}
              <div className="mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">수령금액</p>
                    <p className="text-base font-bold text-gray-800">
                      ₩{received.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">실행내역 합계</p>
                    <p className="text-base font-bold text-gray-800">
                      ₩{calculateExecutionTotal(record.project).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">추가내역 합계</p>
                    <p className="text-base font-bold text-gray-800">
                      ₩{calculateAdditionalWorkTotal(record.project).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">미수금</p>
                    <p className="text-base font-bold text-gray-800">
                      ₩{remaining.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Latest Payment */}
              {record.payments.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 mb-2">수령금액</p>
                  {record.payments.slice(-2).reverse().map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">
                        {payment.type || '미분류'} - {format(payment.date, 'MM/dd')}
                      </span>
                      <span className="font-medium text-gray-900">
                        ₩{payment.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
              );
            })}
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{selectedRecord.project}</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Payment Schedule */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">수금 일정</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="space-y-3">
                    {calculatePaymentSchedule(selectedRecord).map((schedule, idx) => {
                      // 수금 타입에 따른 필드명 매핑
                      const typeFieldMap: { [key: string]: 'contract' | 'start' | 'middle' | 'final' } = {
                        '계약금': 'contract',
                        '착수금': 'start',
                        '중도금': 'middle',
                        '잔금': 'final'
                      };
                      const fieldName = typeFieldMap[schedule.type];

                      return (
                        <div key={idx} className="flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-3 flex-1">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              schedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                              schedule.status === 'overdue' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {schedule.type}
                            </span>
                            {schedule.status !== 'completed' ? (
                              <input
                                type="date"
                                value={selectedRecord.expectedPaymentDates?.[fieldName]
                                  ? format(new Date(selectedRecord.expectedPaymentDates[fieldName]!), 'yyyy-MM-dd')
                                  : schedule.date ? format(schedule.date, 'yyyy-MM-dd') : ''}
                                onChange={async (e) => {
                                  const newDate = e.target.value ? new Date(e.target.value) : null;
                                  const updatedDates = {
                                    ...selectedRecord.expectedPaymentDates,
                                    [fieldName]: newDate
                                  };
                                  const updatedRecord = {
                                    ...selectedRecord,
                                    expectedPaymentDates: updatedDates
                                  };
                                  setSelectedRecord(updatedRecord);
                                  try {
                                    await updateConstructionPaymentInAPI(selectedRecord.id, {
                                      expectedPaymentDates: updatedDates
                                    });
                                    const updatedRecords = records.map(r =>
                                      r.id === selectedRecord.id ? updatedRecord : r
                                    );
                                    setRecords(updatedRecords);
                                    toast.success('수금 일정이 수정되었습니다');
                                  } catch (error) {
                                    console.error('Failed to update payment date:', error);
                                    toast.error('일정 수정에 실패했습니다');
                                  }
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-600"
                              />
                            ) : (
                              <span className="text-sm text-gray-700">
                                {schedule.date ? format(schedule.date, 'yyyy년 MM월 dd일') : '날짜 미정'}
                                {schedule.actualDate && (
                                  <span className="text-green-600 ml-2">
                                    (실제: {format(schedule.actualDate, 'MM/dd')})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              ₩{schedule.amount.toLocaleString()}
                              <span className="text-xs text-gray-500 ml-1">({schedule.percentage}%)</span>
                            </p>
                            {schedule.status === 'completed' && schedule.actualAmount && (
                              <p className="text-xs text-green-600">
                                실제: ₩{schedule.actualAmount.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">예상 총액</span>
                      <span className="font-bold text-gray-900">
                        ₩{calculateTotalContractAmount(selectedRecord).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      순수 공사금액 (₩)
                    </label>
                    <input
                      type="number"
                      value={selectedRecord.totalAmount || ''}
                      onChange={async (e) => {
                        const newTotalAmount = e.target.value === '' ? 0 : Number(e.target.value);
                        const updatedRecord = {
                          ...selectedRecord,
                          totalAmount: newTotalAmount
                        };
                        setSelectedRecord(updatedRecord);
                        try {
                          await updateConstructionPaymentInAPI(selectedRecord.id, updatedRecord);
                          const updatedRecords = records.map(r =>
                            r.id === selectedRecord.id ? updatedRecord : r
                          );
                          setRecords(updatedRecords);
                        } catch (error) {
                          console.error('Failed to update total amount:', error);
                          toast.error('금액 수정에 실패했습니다');
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                      placeholder="50000000"
                      min="0"
                    />
                    <p className="mt-2 text-xs text-gray-500">부가세를 제외한 순수 공사금액</p>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">
                      총 합계 (부가세 {selectedRecord.vatType === 'percentage' ? `${selectedRecord.vatPercentage ?? 100}%` : `₩${(selectedRecord.vatAmount || 0).toLocaleString()}`} 포함)
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      ₩{calculateTotalContractAmount(selectedRecord).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* VAT Edit */}
                <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    부가세 입력 방식
                  </label>

                  {/* 입력 방식 선택 */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const updatedRecord = {
                          ...selectedRecord,
                          vatType: 'percentage' as 'percentage' | 'amount'
                        };
                        setSelectedRecord(updatedRecord);
                        try {
                          await updateConstructionPaymentInAPI(selectedRecord.id, updatedRecord);
                          const updatedRecords = records.map(r =>
                            r.id === selectedRecord.id ? updatedRecord : r
                          );
                          setRecords(updatedRecords);
                        } catch (error) {
                          console.error('Failed to update VAT type:', error);
                          toast.error('부가세 방식 변경에 실패했습니다');
                        }
                      }}
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg font-medium transition-colors ${
                        selectedRecord.vatType === 'percentage'
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      비율 (%)
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const updatedRecord = {
                          ...selectedRecord,
                          vatType: 'amount' as 'percentage' | 'amount'
                        };
                        setSelectedRecord(updatedRecord);
                        try {
                          await updateConstructionPaymentInAPI(selectedRecord.id, updatedRecord);
                          const updatedRecords = records.map(r =>
                            r.id === selectedRecord.id ? updatedRecord : r
                          );
                          setRecords(updatedRecords);
                        } catch (error) {
                          console.error('Failed to update VAT type:', error);
                          toast.error('부가세 방식 변경에 실패했습니다');
                        }
                      }}
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg font-medium transition-colors ${
                        selectedRecord.vatType === 'amount'
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      금액 (₩)
                    </button>
                  </div>

                  {/* 비율 입력 */}
                  {selectedRecord.vatType === 'percentage' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        부가세 발행 비율 (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={selectedRecord.vatPercentage}
                          onChange={async (e) => {
                            const newVatPercentage = Number(e.target.value);
                            const updatedRecord = {
                              ...selectedRecord,
                              vatPercentage: newVatPercentage
                            };
                            setSelectedRecord(updatedRecord);
                            try {
                              await updateConstructionPaymentInAPI(selectedRecord.id, updatedRecord);
                              const updatedRecords = records.map(r =>
                                r.id === selectedRecord.id ? updatedRecord : r
                              );
                              setRecords(updatedRecords);
                            } catch (error) {
                              console.error('Failed to update VAT percentage:', error);
                              toast.error('부가세 비율 수정에 실패했습니다');
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                          placeholder="100"
                          min="0"
                          max="100"
                        />
                        <div className="text-xs text-gray-600">
                          <p>부가세: ₩{getVatAmount(selectedRecord).toLocaleString()}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        0%: 부가세 없음 | 100%: 전체 금액에 부가세 발행 | 50%: 절반만 부가세 발행
                      </p>
                    </div>
                  )}

                  {/* 금액 입력 */}
                  {selectedRecord.vatType === 'amount' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        부가세 발행 금액 (₩)
                      </label>
                      <input
                        type="number"
                        value={selectedRecord.vatAmount}
                        onChange={async (e) => {
                          const newVatAmount = Number(e.target.value);
                          const updatedRecord = {
                            ...selectedRecord,
                            vatAmount: newVatAmount
                          };
                          setSelectedRecord(updatedRecord);
                          try {
                            await updateConstructionPaymentInAPI(selectedRecord.id, updatedRecord);
                            const updatedRecords = records.map(r =>
                              r.id === selectedRecord.id ? updatedRecord : r
                            );
                            setRecords(updatedRecords);
                          } catch (error) {
                            console.error('Failed to update VAT amount:', error);
                            toast.error('부가세 금액 수정에 실패했습니다');
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                        placeholder="5000000"
                        min="0"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        부가세로 발행할 금액을 직접 입력하세요
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">수령금액</p>
                    <p className="text-lg font-bold text-gray-800">
                      ₩{calculateReceived(selectedRecord).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">실행내역 합계</p>
                    <p className="text-lg font-bold text-gray-800">
                      ₩{calculateExecutionTotal(selectedRecord.project).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">추가내역 합계</p>
                    <p className="text-lg font-bold text-gray-800">
                      ₩{calculateAdditionalWorkTotal(selectedRecord.project).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">미수금</p>
                    <p className="text-lg font-bold text-gray-800">
                      ₩{calculateRemaining(selectedRecord).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">입금 내역</h3>
                  <button onClick={handleAddPayment} className="btn btn-primary btn-sm">
                    + 입금 추가
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">입금일</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">방법</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">수정</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedRecord.payments.map((payment, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                              {payment.type || '미분류'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            ₩{payment.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {format(payment.date, 'yyyy년 MM월 dd일')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {payment.method}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.notes || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleEditPayment(idx)}
                              className="text-gray-600 hover:text-gray-700 transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-between">
              <button
                onClick={async () => {
                  if (!selectedRecord) return;

                  if (!window.confirm('이 공사대금 기록을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) {
                    return;
                  }

                  try {
                    await deleteConstructionPaymentFromAPI(selectedRecord.id);
                    toast.success('공사대금이 삭제되었습니다');
                    setSelectedRecord(null);
                  } catch (error) {
                    console.error('Failed to delete construction payment:', error);
                    toast.error('삭제에 실패했습니다');
                  }
                }}
                className="btn btn-outline text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                삭제
              </button>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-outline"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Add Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">새 프로젝트 추가</h2>
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프로젝트 선택 *
                </label>
                <select
                  value={newProject.projectId}
                  onChange={(e) => setNewProject({ ...newProject, projectId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                >
                  <option value="">선택하세요</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {project.client}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  총 공사금액 *
                </label>
                <input
                  type="number"
                  value={newProject.totalAmount || ''}
                  onChange={(e) => setNewProject({ ...newProject, totalAmount: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  placeholder="50000000"
                />
                <p className="mt-1 text-xs text-gray-500">순수 공사금액 (부가세 제외)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  부가세 입력 방식 *
                </label>

                {/* 입력 방식 선택 */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, vatType: 'percentage' })}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg font-medium transition-colors ${
                      newProject.vatType === 'percentage'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    비율 (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, vatType: 'amount' })}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg font-medium transition-colors ${
                      newProject.vatType === 'amount'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    금액 (₩)
                  </button>
                </div>

                {/* 비율 입력 */}
                {newProject.vatType === 'percentage' && (
                  <div>
                    <input
                      type="number"
                      value={newProject.vatPercentage ?? 100}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 100 : Number(e.target.value);
                        setNewProject({ ...newProject, vatPercentage: value });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                      placeholder="100"
                      min="0"
                      max="100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      0%: 부가세 없음 | 100%: 전체 금액에 부가세 발행 | 50%: 절반만 부가세 발행
                    </p>
                  </div>
                )}

                {/* 금액 입력 */}
                {newProject.vatType === 'amount' && (
                  <div>
                    <input
                      type="number"
                      value={newProject.vatAmount ?? 0}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                        setNewProject({ ...newProject, vatAmount: value });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                      placeholder="5000000"
                      min="0"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      부가세로 발행할 금액을 직접 입력하세요
                    </p>
                  </div>
                )}

                {/* 계산 미리보기 */}
                {newProject.totalAmount > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">총 합계 (부가세 포함)</p>
                    <p className="text-xl font-bold text-gray-900">
                      ₩{(newProject.totalAmount + (newProject.vatType === 'percentage'
                        ? (newProject.totalAmount * ((newProject.vatPercentage ?? 100) / 100) * 0.1)
                        : (newProject.vatAmount ?? 0))).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      = 공사금액 ₩{newProject.totalAmount.toLocaleString()} + 부가세 ₩{(newProject.vatType === 'percentage'
                        ? (newProject.totalAmount * ((newProject.vatPercentage ?? 100) / 100) * 0.1)
                        : (newProject.vatAmount ?? 0)).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowProjectModal(false)}
                className="btn btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleSaveProject}
                className="btn btn-primary"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Add/Edit Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {editingPaymentIndex !== null ? '입금 수정' : '입금 추가'}
                </h2>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setEditingPaymentIndex(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* 구분 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  구분 * (중복 선택 가능)
                </label>
                <div className="space-y-2">
                  {['계약금', '착수금', '중도금', '잔금', '추가금'].map((type) => {
                    const percentage = DEFAULT_PERCENTAGES[type as keyof typeof DEFAULT_PERCENTAGES];
                    return (
                      <label key={type} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPayment.types.includes(type as PaymentType)}
                          onChange={(e) => {
                            let updatedTypes: typeof newPayment.types;
                            if (e.target.checked) {
                              updatedTypes = [...newPayment.types, type as PaymentType];
                            } else {
                              updatedTypes = newPayment.types.filter(t => t !== type);
                            }

                            // 비율 자동 계산
                            const totalPercentage = calculateTotalPercentage(updatedTypes);
                            const calculatedAmount = calculateAmountFromPercentage(totalPercentage);

                            // 날짜 자동 계산
                            const autoDate = calculatePaymentDate(updatedTypes);

                            setNewPayment({
                              ...newPayment,
                              types: updatedTypes,
                              percentage: totalPercentage,
                              amount: calculatedAmount,
                              date: autoDate || newPayment.date  // 날짜가 없으면 기존 날짜 유지
                            });
                          }}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-600"
                        />
                        <span className="text-sm text-gray-900">
                          {type}
                          <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                          {type === '계약금' && <span className="text-xs text-gray-400 ml-1">(날짜 직접 입력)</span>}
                          {type === '착수금' && <span className="text-xs text-gray-400 ml-1">(공사 시작 1주일 전)</span>}
                          {type === '중도금' && <span className="text-xs text-gray-400 ml-1">(공사 중간)</span>}
                          {type === '잔금' && <span className="text-xs text-gray-400 ml-1">(공사 종료일)</span>}
                          {type === '추가금' && <span className="text-xs text-gray-400 ml-1">(공사 종료일)</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {newPayment.types.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-xs text-gray-700">
                      선택된 구분: {newPayment.types.join(' + ')} = 총 {newPayment.percentage}%
                    </p>
                  </div>
                )}
              </div>

              {/* 결제 방법 (버튼) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  결제 방법 *
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewPayment({ ...newPayment, method: '계좌이체' })}
                    className={`flex-1 px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                      newPayment.method === '계좌이체'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    계좌이체
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPayment({ ...newPayment, method: '현금' })}
                    className={`flex-1 px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                      newPayment.method === '현금'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    현금
                  </button>
                </div>
              </div>

              {/* 퍼센트 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계약금액 대비 비율 (%)
                </label>
                <input
                  type="number"
                  value={newPayment.percentage || ''}
                  onChange={(e) => {
                    const percentage = Number(e.target.value);
                    const calculatedAmount = calculateAmountFromPercentage(percentage);
                    setNewPayment({
                      ...newPayment,
                      percentage,
                      amount: calculatedAmount
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  placeholder="10"
                  min="0"
                  max="100"
                />
                {selectedRecord && newPayment.percentage > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-700 mb-1">계산 방식</p>
                    <p className="text-xs text-gray-900">
                      총 합계(부가세 {selectedRecord.vatPercentage}% 포함) ₩{calculateTotalContractAmount(selectedRecord).toLocaleString()} × {newPayment.percentage}%
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      = ₩{calculateAmountFromPercentage(newPayment.percentage).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  입금 금액 *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={newPayment.amount || ''}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    placeholder="5000000"
                    min="0"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {newPayment.percentage > 0
                      ? '위의 비율에 따라 자동 계산되었지만 직접 수정 가능합니다'
                      : '입금 금액을 직접 입력하세요'}
                  </p>
                </div>
              </div>

              {/* 입금일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  입금일 *
                </label>
                <input
                  type="date"
                  value={newPayment.date}
                  onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  구분 선택 시 자동으로 날짜가 입력되며, 직접 수정 가능합니다
                </p>
              </div>

              {/* 비고 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비고
                </label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  placeholder="추가 메모를 입력하세요"
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-between">
              <div>
                {editingPaymentIndex !== null && (
                  <button
                    onClick={async () => {
                      if (!selectedRecord) return;

                      if (!window.confirm('이 입금 내역을 삭제하시겠습니까?')) {
                        return;
                      }

                      try {
                        // Remove the payment from the array
                        const updatedPayments = selectedRecord.payments.filter((_, idx) => idx !== editingPaymentIndex);

                        const updatedRecord = {
                          ...selectedRecord,
                          payments: updatedPayments
                        };

                        // Update in API
                        await updateConstructionPaymentInAPI(selectedRecord.id, {
                          payments: updatedPayments
                        });

                        // Update local state
                        setSelectedRecord(updatedRecord);
                        const updatedRecords = records.map(r =>
                          r.id === selectedRecord.id ? updatedRecord : r
                        );
                        setRecords(updatedRecords);

                        // Close modal
                        setShowPaymentModal(false);
                        setEditingPaymentIndex(null);

                        toast.success('입금 내역이 삭제되었습니다');
                      } catch (error) {
                        console.error('Failed to delete payment:', error);
                        toast.error('삭제에 실패했습니다');
                      }
                    }}
                    className="btn btn-outline text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    삭제
                  </button>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setEditingPaymentIndex(null);
                  }}
                  className="btn btn-outline"
                >
                  취소
                </button>
                <button
                  onClick={handleSavePayment}
                  className="btn btn-primary"
                >
                  {editingPaymentIndex !== null ? '수정' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Receipt Modal */}
      {showCashReceiptModal && (
        <>
        <style>
          {`
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              /* 직인 이미지가 인쇄 시에도 보이도록 보장 */
              img[alt="직인"] {
                display: inline-block !important;
                visibility: visible !important;
                opacity: 0.8 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            @page {
              size: A4;
              margin: 20mm;
            }
          `}
        </style>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:bg-white print:relative print:p-0">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none">
            <div className="p-6 print:p-8">
              <div className="flex items-center justify-end mb-6 print:hidden">
                <button
                  onClick={() => setShowCashReceiptModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 print:space-y-0">
                {/* Receipt Content */}
                <div className="border border-black p-8 bg-white print:border print:p-12">
                  {/* 제목 */}
                  <div className="p-3 mb-8">
                    <h3 className="text-center text-2xl font-bold">현금수령증</h3>
                  </div>

                  {/* 테이블 형식의 정보 */}
                  <table className="w-full mb-8 border-collapse">
                    <colgroup>
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '70%' }} />
                    </colgroup>
                    <tbody>
                      <tr className="border border-black">
                        <td className="border-r border-black py-3 px-4 bg-white font-medium whitespace-nowrap">프로젝트명</td>
                        <td className="py-3 px-4 print:py-3 text-center">
                          <span className="print:hidden">{cashReceiptData.project}</span>
                          <input
                            type="text"
                            value={cashReceiptData.project}
                            className="hidden print:block w-full bg-transparent border-none outline-none p-0 text-center"
                            readOnly
                          />
                        </td>
                      </tr>
                      <tr className="border border-t-0 border-black">
                        <td className="border-r border-black py-3 px-4 bg-white font-medium whitespace-nowrap">공사기간</td>
                        <td className="py-3 px-4 text-center">
                          {cashReceiptData.startDate && cashReceiptData.endDate ? (
                            <span>{format(new Date(cashReceiptData.startDate), 'yyyy.MM.dd')} ~ {format(new Date(cashReceiptData.endDate), 'yyyy.MM.dd')}</span>
                          ) : (
                            <span className="text-gray-400 print:hidden">-</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border border-t-0 border-black">
                        <td className="border-r border-black py-3 px-4 bg-white font-medium whitespace-nowrap">총공사금액</td>
                        <td className="py-3 px-4 text-right pr-4">{cashReceiptData.totalContractAmount.toLocaleString()} 원</td>
                      </tr>
                      <tr className="border border-t-0 border-black">
                        <td className="border-r border-black py-3 px-4 bg-white font-medium whitespace-nowrap">이전수령금액</td>
                        <td className="py-3 px-4 text-right pr-4">{cashReceiptData.previousAmount.toLocaleString()} 원</td>
                      </tr>
                      <tr className="border border-t-0 border-black">
                        <td className="border-r border-black py-3 px-4 bg-white font-medium whitespace-nowrap">당일수령금액</td>
                        <td className="py-3 px-4 text-right pr-4">
                          <span className="print:hidden flex items-center justify-end gap-1">
                            <input
                              type="text"
                              value={cashReceiptData.amount}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                const formatted = value ? parseInt(value).toLocaleString() : '';
                                setCashReceiptData({...cashReceiptData, amount: formatted});
                              }}
                              placeholder="금액 입력"
                              className="w-full text-right border border-gray-300 rounded px-2 py-1"
                            />
                            <span>원</span>
                          </span>
                          <span className="hidden print:inline">{cashReceiptData.amount} 원</span>
                        </td>
                      </tr>
                      <tr className="border border-t-0 border-black">
                        <td className="border-r border-black py-3 px-4 bg-white font-medium whitespace-nowrap">
                          잔여금액 <span className="text-xs">(추가금액 제외)</span>
                        </td>
                        <td className="py-3 px-4 text-right pr-4">
                          {(() => {
                            const todayAmount = cashReceiptData.amount ? parseInt(cashReceiptData.amount.replace(/,/g, '')) : 0;
                            const remaining = cashReceiptData.remainingAmount - todayAmount;
                            return remaining.toLocaleString();
                          })()} 원
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* 확인 문구 */}
                  <div className="text-center mb-12">
                    <p className="text-base">* 위와 같이 현금으로 지급 받았음을 확인 합니다.</p>
                  </div>

                  {/* 날짜 */}
                  <div className="text-center mb-12">
                    <p className="text-base">
                      <span className="print:hidden">
                        <input
                          type="date"
                          value={cashReceiptData.date}
                          onChange={(e) => setCashReceiptData({...cashReceiptData, date: e.target.value})}
                          className="border border-gray-300 rounded px-2 py-1"
                        />
                      </span>
                      <span className="hidden print:inline">{format(new Date(cashReceiptData.date), 'yyyy년 MM월 dd일')}</span>
                    </p>
                  </div>

                  {/* 서명란 */}
                  <div className="space-y-8">
                    <div className="grid grid-cols-4 items-center border-b border-gray-300 pb-2">
                      <span className="font-medium">[수령인]</span>
                      <span>에이치브이랩 대표</span>
                      <span className="text-xl font-bold text-right pr-4">김 상 준</span>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-sm">(인)</span>
                        {/* 직인 이미지 - 원본 직인.png 사용 */}
                        <img
                          src={stampBase64}
                          alt="직인"
                          style={{
                            display: 'inline-block',
                            width: '56px',
                            height: '56px',
                            marginLeft: '-25px',
                            marginRight: '10px',
                            opacity: 0.8,
                            printColorAdjust: 'exact',
                            WebkitPrintColorAdjust: 'exact',
                            colorAdjust: 'exact'
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center border-b border-gray-300 pb-2">
                      <span className="font-medium">[지급인]</span>
                      <span>{cashReceiptData.project.split('_')[0]}</span>
                      <span className="text-xl text-right pr-4">&nbsp;</span>
                      <div className="flex items-center justify-end">
                        <span className="text-sm">(인)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 print:hidden">
                  <button
                    onClick={() => {
                      if (!cashReceiptData.amount) {
                        toast.error('수령금액을 입력해주세요');
                        return;
                      }

                      // 프린트 기능
                      window.print();
                      toast.success('현금수령증이 생성되었습니다');
                    }}
                    className="flex-1 px-4 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    인쇄하기
                  </button>
                  <button
                    onClick={() => setShowCashReceiptModal(false)}
                    className="px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default ConstructionPayment;
