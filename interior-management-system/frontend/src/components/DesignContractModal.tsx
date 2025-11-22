import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DesignContractModalProps {
  projectName: string;
  onClose: () => void;
}

const DesignContractModal = ({ projectName, onClose }: DesignContractModalProps) => {
  const [formData, setFormData] = useState({
    clientName: '',
    phoneNumber: '',
    address: '',
    startDate: '',
    endDate: '',
    area: '',
    designFee: '',
    bankAccount: '국민은행 487102-01-264798 김상준',
    companyAddress: '서울시 양천구 목동서로277 대림아크로빌 109호',
    representative: '김 상 준'
  });

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: string) => {
    const num = Number(amount.replace(/,/g, ''));
    return isNaN(num) ? '' : num.toLocaleString();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:relative print:bg-white">
        <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto print:max-h-none print:mx-0 print:rounded-none">
          {/* 헤더 - 인쇄 시 숨김 */}
          <div className="flex items-center justify-between p-4 border-b print:hidden">
            <h2 className="text-lg font-bold text-gray-900">디자인 작업 의뢰서</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* 입력 폼 - 인쇄 시 숨김 */}
          <div className="p-6 space-y-4 print:hidden">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성함</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="고객명을 입력하세요"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="010-0000-0000"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">공사장소</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="주소를 입력하세요"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공사시작일</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공사종료일</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">공사면적</label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="예: 21.9평(공급72.37m2)"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">디자인비</label>
              <input
                type="text"
                value={formatCurrency(formData.designFee)}
                onChange={(e) => {
                  const value = e.target.value.replace(/,/g, '');
                  if (/^\d*$/.test(value)) {
                    setFormData({ ...formData, designFee: value });
                  }
                }}
                placeholder="금액을 입력하세요"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <button
              onClick={handlePrint}
              disabled={!formData.clientName || !formData.phoneNumber || !formData.address}
              className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              인쇄하기
            </button>
          </div>

          {/* 디자인 계약서 출력 양식 - 인쇄 시만 표시 */}
          <div className="hidden print:block p-12">
            <div className="space-y-8">
              {/* 제목 */}
              <h1 className="text-3xl font-bold text-gray-900">디자인 작업 의뢰서</h1>

              {/* 계약 내용 */}
              <div className="space-y-6 text-base">
                <div className="flex items-baseline py-3">
                  <span className="font-medium w-40">1. 성      함 :</span>
                  <span className="flex-1">{formData.clientName}</span>
                </div>

                <div className="flex items-baseline py-3">
                  <span className="font-medium w-40">2. 전화번호 :</span>
                  <span className="flex-1">{formData.phoneNumber}</span>
                </div>

                <div className="flex items-baseline py-3">
                  <span className="font-medium w-40">3. 공사장소 :</span>
                  <span className="flex-1">{formData.address}</span>
                </div>

                <div className="flex items-baseline py-3">
                  <span className="font-medium w-40">3. 공사기간 :</span>
                  <span className="flex-1">
                    {formData.startDate && formData.endDate ? (
                      <>
                        {format(new Date(formData.startDate), 'yyyy년    MM월    dd일', { locale: ko })} ~ {format(new Date(formData.endDate), 'yyyy년    MM월    dd일', { locale: ko })} (미정)
                      </>
                    ) : '미정'}
                  </span>
                </div>

                <div className="flex items-baseline py-3">
                  <span className="font-medium w-40">5. 공사면적 :</span>
                  <span className="flex-1">{formData.area}</span>
                </div>

                <div className="flex items-baseline py-3">
                  <span className="font-medium w-40">6. 디자인비 :</span>
                  <span className="flex-1">
                    {formData.designFee ? `${formatCurrency(formData.designFee)}원` : ''} (부가세별도)
                    {formData.bankAccount && (
                      <div className="mt-2 ml-40">{formData.bankAccount}</div>
                    )}
                  </span>
                </div>
              </div>

              {/* 도급자 */}
              <div className="mt-12 space-y-2">
                <div className="text-lg font-bold">* 도 급 자</div>
                <div className="ml-6 space-y-1">
                  <div>주 소 : {formData.address}</div>
                  <div className="flex items-center gap-8">
                    <span>성 명 : {formData.clientName}</span>
                    <span>(인)</span>
                  </div>
                </div>
              </div>

              {/* 수급자 */}
              <div className="mt-8 space-y-2">
                <div className="text-lg font-bold">* 수 급 자</div>
                <div className="ml-6 space-y-1">
                  <div>주 소 : {formData.companyAddress}</div>
                  <div>상 호 : HV LAB (에이치브이랩)</div>
                  <div className="flex items-center gap-8">
                    <span>대 표 : {formData.representative}</span>
                    <div className="inline-block w-12 h-12 border border-red-500 text-red-500 flex items-center justify-center text-xs font-bold">
                      (인)
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 경계선 */}
              <div className="border-t-2 border-gray-900 mt-16 pt-8 flex justify-between items-end">
                <div className="text-2xl font-bold">
                  H<span className="inline-block w-8 border-b-4 border-gray-900 mx-1"></span>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm">ARCHITECTURE & INTERIOR</div>
                  <div className="text-2xl font-bold">HV LAB</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:relative {
            position: relative !important;
            background: white !important;
          }
        }
      `}</style>
    </>
  );
};

export default DesignContractModal;
