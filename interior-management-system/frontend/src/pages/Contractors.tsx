import React, { useState, useEffect } from 'react';
import { type Contractor } from '../store/dataStore';
import { X, Edit2, Trash2, Search } from 'lucide-react';
import contractorService from '../services/contractorService';
import { removePosition, extractPosition } from '../utils/formatters';

export default function Contractors() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    rank: '',
    companyName: '',
    name: '',
    position: '',
    process: '',
    contact: '',
    bankName: '',
    accountNumber: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load contractors from API
  useEffect(() => {
    loadContractors();
  }, []);

  // 헤더의 + 버튼 클릭 이벤트 수신
  useEffect(() => {
    const handleHeaderAddButton = () => {
      handleOpenModal();
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddButton);
  }, []);

  const loadContractors = async () => {
    try {
      // 데이터가 없을 때만 로딩 표시
      if (contractors.length === 0) {
        setLoading(true);
      }
      setError(null);
      const data = await contractorService.getAllContractors();
      setContractors(data.map((c) => ({
        id: c._id,
        rank: c.rank,
        companyName: c.companyName,
        name: c.name,
        position: c.position,
        process: c.process,
        contact: c.contact,
        accountNumber: c.accountNumber,
        notes: c.notes,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
      })));
    } catch (err) {
      console.error('Failed to load contractors:', err);
      const errorMessage = err instanceof Error && (err as Error & { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(errorMessage || '협력업체 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Migrate localStorage data to API (unused but kept for potential future use)
  // @ts-expect-error - Keeping this function for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMigrateData = async () => {
    try {
      const localStorageData = localStorage.getItem('interior-management-storage');
      if (!localStorageData) {
        alert('localStorage에 저장된 데이터가 없습니다.');
        return;
      }

      const parsedData = JSON.parse(localStorageData);
      const localContractors = parsedData.state?.contractors || [];

      if (localContractors.length === 0) {
        alert('마이그레이션할 협력업체 데이터가 없습니다.');
        return;
      }

      if (!window.confirm(`${localContractors.length}개의 협력업체 데이터를 데이터베이스로 마이그레이션하시겠습니까?`)) {
        return;
      }

      setLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const contractor of localContractors) {
        try {
          await contractorService.createContractor({
            rank: contractor.rank,
            companyName: contractor.companyName,
            name: contractor.name,
            process: contractor.process,
            contact: contractor.contact,
            accountNumber: contractor.accountNumber,
            notes: contractor.notes
          });
          successCount++;
        } catch (err) {
          console.error('Failed to migrate contractor:', contractor.name, err);
          failCount++;
        }
      }

      await loadContractors();
      alert(`마이그레이션 완료!\n성공: ${successCount}개\n실패: ${failCount}개`);
    } catch (err) {
      console.error('Migration error:', err);
      alert('데이터 마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (contractor?: Contractor) => {
    if (contractor) {
      setEditingContractor(contractor);
      // 기존 계좌번호에서 은행명과 계좌번호 분리
      let bankName = '';
      let accountNum = contractor.accountNumber || '';

      if (contractor.accountNumber) {
        // 은행명 목록
        const bankNames = [
          'KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행',
          'KEB하나은행', 'SC제일은행', '한국씨티은행', '부산은행', '대구은행', '경남은행',
          '광주은행', '전북은행', '제주은행', '산업은행', '수협은행', '우체국',
          '새마을금고', '신협', '저축은행', '카카오뱅크', '케이뱅크', '토스뱅크',
          'NH투자증권', '미래에셋증권', '한국투자증권', '키움증권', '삼성증권',
          'KB증권', '신한투자증권', '하이투자증권'
        ];

        // 은행명이 포함되어 있는지 확인
        for (const bank of bankNames) {
          if (contractor.accountNumber.startsWith(bank)) {
            bankName = bank;
            accountNum = contractor.accountNumber.substring(bank.length).trim();
            break;
          }
        }
      }

      // 이름에서 직책 분리
      let cleanName = contractor.name;
      let position = contractor.position || '';

      // 이름에 직책이 포함된 경우 분리
      if (!position) {
        // 이름에서 직책 추출
        position = extractPosition(contractor.name);
        // 이름에서 직책 제거
        cleanName = removePosition(contractor.name);
      }

      setFormData({
        rank: contractor.rank || '',
        companyName: contractor.companyName || '',
        name: cleanName,
        position: position,
        process: contractor.process,
        contact: contractor.contact || '',
        bankName: bankName,
        accountNumber: accountNum,
        notes: contractor.notes || ''
      });
    } else {
      setEditingContractor(null);
      setFormData({ rank: '', companyName: '', name: '', position: '', process: '', contact: '', bankName: '', accountNumber: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContractor(null);
    setFormData({ rank: '', companyName: '', name: '', position: '', process: '', contact: '', bankName: '', accountNumber: '', notes: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    // 은행명과 계좌번호를 하나의 문자열로 합치기
    const fullAccountNumber = formData.bankName && formData.accountNumber
      ? `${formData.bankName} ${formData.accountNumber}`
      : formData.accountNumber;

    try {
      const contractorData = {
        rank: formData.rank,
        companyName: formData.companyName,
        name: formData.name,
        position: formData.position,
        process: formData.process,
        contact: formData.contact,
        accountNumber: fullAccountNumber,
        notes: formData.notes
      };

      if (editingContractor) {
        await contractorService.updateContractor(editingContractor.id, contractorData);
      } else {
        await contractorService.createContractor(contractorData);
      }

      await loadContractors();
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save contractor:', err);
      const errorMessage = err instanceof Error && (err as Error & { response?: { data?: { message?: string } } }).response?.data?.message;
      alert(errorMessage || '협력업체 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('정말 이 협력업체를 삭제하시겠습니까?')) {
      try {
        await contractorService.deleteContractor(id);
        await loadContractors();
      } catch (err) {
        console.error('Failed to delete contractor:', err);
        const errorMessage = err instanceof Error && (err as Error & { response?: { data?: { message?: string } } }).response?.data?.message;
        alert(errorMessage || '협력업체 삭제에 실패했습니다.');
      }
    }
  };

  // 평가 순위 정렬 우선순위 함수
  // 평가 순위별 색상 반환 함수 (무채색)
  const getRankColor = (): string => {
    return 'border-gray-200 text-gray-600 bg-gray-50';
  };

  const getRankPriority = (rank?: string): number => {
    if (!rank) return 999; // 평가 없음은 맨 뒤로
    if (rank === '1순위') return 1;
    if (rank === '1순위(ㅁㅇ)') return 2;
    if (rank === '2순위') return 3;
    if (rank === '2순위(ㅁㅇ)') return 4;
    if (rank === '3순위') return 5;
    if (rank === '3순위(ㅁㅇ)') return 6;
    if (rank === '신규') return 100;
    if (rank === '불용') return 200;
    return 999;
  };

  const filteredContractors = contractors
    .filter(
      (contractor) =>
        contractor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contractor.process.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contractor.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contractor.contact && contractor.contact.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contractor.rank && contractor.rank.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contractor.companyName && contractor.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      // 1. 평가 순위로 먼저 정렬
      const rankDiff = getRankPriority(a.rank) - getRankPriority(b.rank);
      if (rankDiff !== 0) return rankDiff;

      // 2. 같은 순위면 공정으로 정렬
      const processDiff = a.process.localeCompare(b.process, 'ko');
      if (processDiff !== 0) return processDiff;

      // 3. 같은 공정이면 이름으로 정렬
      return a.name.localeCompare(b.name, 'ko');
    });

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => handleOpenModal()}
          className="hidden md:inline-flex btn btn-primary px-3 md:px-4 py-2"
        >
          + 새 협력업체
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
        <input
          type="text"
          placeholder="업체명, 공정, 계좌번호로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 md:pl-10 pr-4 py-2 text-sm md:text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>

      {/* Desktop Table View */}
      <div className="contractors-table hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  평가
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공정
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  협력업체 이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직책
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연락처
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  계좌번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  비고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500">로딩 중...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="space-y-4">
                      <p className="text-red-500">{error}</p>
                      <button
                        onClick={loadContractors}
                        className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        다시 시도
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredContractors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500">
                      {searchTerm ? '검색 결과가 없습니다.' : '등록된 협력업체가 없습니다.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredContractors.map((contractor) => (
                  <tr key={contractor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium border rounded ${getRankColor(contractor.rank)}`}>
                        {contractor.rank || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-700">
                        {contractor.process}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contractor.companyName || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{removePosition(contractor.name)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contractor.position || extractPosition(contractor.name) || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contractor.contact || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contractor.accountNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {contractor.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenModal(contractor)}
                        className="text-gray-600 hover:text-gray-900 mr-3"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contractor.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">로딩 중...</div>
        ) : error ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={loadContractors}
              className="inline-block px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              다시 시도
            </button>
          </div>
        ) : filteredContractors.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {searchTerm ? '검색 결과가 없습니다.' : '등록된 협력업체가 없습니다.'}
          </div>
        ) : (
          filteredContractors.map((contractor) => (
            <div key={contractor.id} className="card p-3 space-y-2">
              {/* 헤더 */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {contractor.rank && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium border rounded ${getRankColor(contractor.rank)}`}>
                        {contractor.rank}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded">
                      {contractor.process}
                    </span>
                  </div>
                  {contractor.companyName && (
                    <p className="text-xs text-gray-600 mb-0.5">{contractor.companyName}</p>
                  )}
                  <p className="font-semibold text-gray-900 text-sm">{removePosition(contractor.name)}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={() => handleOpenModal(contractor)}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contractor.id)}
                    className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 상세 정보 */}
              <div className="space-y-1 text-xs">
                {(contractor.position || extractPosition(contractor.name)) && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-14 flex-shrink-0">직책:</span>
                    <span className="text-gray-900">{contractor.position || extractPosition(contractor.name)}</span>
                  </div>
                )}
                {contractor.contact && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-14 flex-shrink-0">연락처:</span>
                    <span className="text-gray-900">{contractor.contact}</span>
                  </div>
                )}
                <div className="flex items-start">
                  <span className="text-gray-500 w-14 flex-shrink-0">계좌:</span>
                  <span className="text-gray-900 break-all">{contractor.accountNumber}</span>
                </div>
                {contractor.notes && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-14 flex-shrink-0">비고:</span>
                    <span className="text-gray-600">{contractor.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingContractor ? '협력업체 수정' : '새 협력업체 등록'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    평가 순위
                  </label>
                  <select
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  >
                    <option value="">선택하세요</option>
                    <option value="1순위">1순위</option>
                    <option value="2순위">2순위</option>
                    <option value="3순위">3순위</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    협력업체 이름
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    직책
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    공정 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.process}
                    onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    은행명
                  </label>
                  <select
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계좌번호
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    비고
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? '저장 중...' : (editingContractor ? '수정' : '등록')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
