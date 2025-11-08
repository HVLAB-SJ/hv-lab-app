import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CashReceiptModalProps {
  projectName: string;
  onClose: () => void;
}

const CashReceiptModal = ({ projectName, onClose }: CashReceiptModalProps) => {
  const [formData, setFormData] = useState({
    receiptDate: format(new Date(), 'yyyy-MM-dd'),
    customerName: '',
    amount: '',
    purpose: '인테리어 공사대금',
    receivedBy: '',
  });

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: string) => {
    const num = Number(amount.replace(/,/g, ''));
    return isNaN(num) ? '' : num.toLocaleString();
  };

  const numberToKorean = (num: number): string => {
    if (num === 0) return '영';

    const units = ['', '만', '억', '조'];
    const smallUnits = ['', '십', '백', '천'];
    const numbers = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

    let result = '';
    let unitIndex = 0;

    while (num > 0) {
      const part = num % 10000;
      if (part > 0) {
        let partStr = '';
        let tempPart = part;
        let smallUnitIndex = 0;

        while (tempPart > 0) {
          const digit = tempPart % 10;
          if (digit > 0) {
            partStr = numbers[digit] + smallUnits[smallUnitIndex] + partStr;
          }
          tempPart = Math.floor(tempPart / 10);
          smallUnitIndex++;
        }

        result = partStr + units[unitIndex] + result;
      }
      num = Math.floor(num / 10000);
      unitIndex++;
    }

    return result + '원정';
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:relative print:bg-white">
        <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto print:max-h-none print:mx-0 print:rounded-none">
          {/* 헤더 - 인쇄 시 숨김 */}
          <div className="flex items-center justify-between p-4 border-b print:hidden">
            <h2 className="text-lg font-bold text-gray-900">현금수령증</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">수령일자</label>
              <input
                type="date"
                value={formData.receiptDate}
                onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">고객명</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="고객명을 입력하세요"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
              <input
                type="text"
                value={formatCurrency(formData.amount)}
                onChange={(e) => {
                  const value = e.target.value.replace(/,/g, '');
                  if (/^\d*$/.test(value)) {
                    setFormData({ ...formData, amount: value });
                  }
                }}
                placeholder="금액을 입력하세요"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              {formData.amount && (
                <p className="text-sm text-gray-600 mt-1">
                  {numberToKorean(Number(formData.amount))}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내역</label>
              <input
                type="text"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수령인</label>
              <input
                type="text"
                value={formData.receivedBy}
                onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                placeholder="수령인명을 입력하세요"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <button
              onClick={handlePrint}
              disabled={!formData.customerName || !formData.amount || !formData.receivedBy}
              className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              인쇄하기
            </button>
          </div>

          {/* 현금수령증 출력 양식 - 인쇄 시만 표시 */}
          <div className="hidden print:block p-12">
            <div className="border-4 border-double border-gray-900 p-8">
              <h1 className="text-center text-3xl font-bold mb-8">현 금 수 령 증</h1>

              <div className="space-y-6 text-lg">
                <div className="flex items-baseline border-b border-gray-300 pb-2">
                  <span className="font-medium w-32">수령일자:</span>
                  <span className="flex-1 receipt-date">{format(new Date(formData.receiptDate), 'yyyy년 MM월 dd일', { locale: ko })}</span>
                </div>

                <div className="flex items-baseline border-b border-gray-300 pb-2">
                  <span className="font-medium w-32">고객명:</span>
                  <span className="flex-1">{formData.customerName}</span>
                </div>

                <div className="flex items-baseline border-b border-gray-300 pb-2">
                  <span className="font-medium w-32">프로젝트:</span>
                  <span className="flex-1">{projectName}</span>
                </div>

                <div className="flex items-baseline border-b border-gray-300 pb-2">
                  <span className="font-medium w-32">금액:</span>
                  <span className="flex-1 font-bold receipt-amount">
                    ₩{Number(formData.amount).toLocaleString()}원
                  </span>
                </div>

                <div className="flex items-baseline border-b border-gray-300 pb-2">
                  <span className="font-medium w-32">금액(한글):</span>
                  <span className="flex-1">{numberToKorean(Number(formData.amount))}</span>
                </div>

                <div className="flex items-baseline border-b border-gray-300 pb-2">
                  <span className="font-medium w-32">내역:</span>
                  <span className="flex-1">{formData.purpose}</span>
                </div>
              </div>

              <div className="mt-12 text-center">
                <p className="text-lg mb-8">위 금액을 정히 수령하였습니다.</p>

                <div className="space-y-2">
                  <p className="text-lg receipt-date">{format(new Date(formData.receiptDate), 'yyyy년 MM월 dd일', { locale: ko })}</p>
                  <p className="text-xl font-medium mt-8">
                    수령인: {formData.receivedBy} <span className="ml-4">(인)</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default CashReceiptModal;
