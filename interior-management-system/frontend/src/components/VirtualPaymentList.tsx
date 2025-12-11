import React, { CSSProperties, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, ImageIcon, FileText, Pencil } from 'lucide-react';
import { removePosition } from '../utils/formatters';

interface Payment {
  id: string;
  projectId: string;
  projectName: string;
  companyName: string;
  processType: string;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  paymentTime?: string;
  paymentConfirmed?: boolean;
  notes: string;
  status: string;
  accountNumber: string;
  bankName: string;
  cashReceiptApplied?: boolean;
  taxDeductionApplied?: boolean;
  teamMember?: string;
  images?: string[];
}

interface VirtualPaymentListProps {
  payments: Payment[];
  groupedPayments: Record<string, { payments: Payment[]; total: number }>;
  editingRequest: Payment | null;
  onEdit: (payment: Payment) => void;
  onDelete: (id: string) => void;
  onImageClick: (images: string[]) => void;
  onToggleConfirm: (payment: Payment) => void;
  height: number;
}

interface RowProps {
  index: number;
  style: CSSProperties;
  data: {
    items: (Payment | { type: 'header'; date: string; total: number })[];
    editingRequest: Payment | null;
    onEdit: (payment: Payment) => void;
    onDelete: (id: string) => void;
    onImageClick: (images: string[]) => void;
    onToggleConfirm: (payment: Payment) => void;
  };
}

const Row = memo(({ index, style, data }: RowProps) => {
  const item = data.items[index];

  if ('type' in item && item.type === 'header') {
    return (
      <div style={style} className="sticky top-0 z-10 bg-gray-50 px-4 py-2 border-b">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">
            {format(new Date(item.date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </h3>
          <span className="text-sm text-gray-600 font-medium">
            일일 합계: {item.total.toLocaleString()}원
          </span>
        </div>
      </div>
    );
  }

  const payment = item as Payment;
  const isEditing = data.editingRequest?.id === payment.id;

  return (
    <div style={style} className={`border-b ${isEditing ? 'bg-blue-50' : ''}`}>
      <div className="px-4 py-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">
                {payment.projectName}
              </span>
              {payment.teamMember && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                  {removePosition(payment.teamMember)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{payment.companyName}</span>
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                {payment.processType}
              </span>
              <span>{payment.accountNumber}</span>
              <span>{payment.bankName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {payment.images && payment.images.length > 0 && (
              <button
                onClick={() => data.onImageClick(payment.images!)}
                className="p-1.5 hover:bg-gray-100 rounded"
                title="첨부 이미지 보기"
              >
                <ImageIcon className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-500 ml-1">
                  {payment.images.length}
                </span>
              </button>
            )}
            {payment.cashReceiptApplied && (
              <FileText className="w-4 h-4 text-green-600" title="현금영수증 신청됨" />
            )}
            <button
              onClick={() => data.onEdit(payment)}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="수정"
            >
              <Pencil className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => {
                if (confirm('결제 요청을 삭제하시겠습니까?')) {
                  data.onDelete(payment.id);
                }
              }}
              className="p-1.5 hover:bg-red-50 rounded"
              title="삭제"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              {payment.paymentTime || format(new Date(payment.paymentDate), 'HH:mm')}
            </span>
            <span className={`font-medium ${
              payment.paymentMethod === '계좌이체' ? 'text-blue-600' : 'text-green-600'
            }`}>
              {payment.paymentMethod}
            </span>
            {payment.notes && (
              <span className="text-gray-500 italic">
                {payment.notes}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-900">
              {parseInt(payment.amount).toLocaleString()}원
            </span>
            <button
              onClick={() => data.onToggleConfirm(payment)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                payment.paymentConfirmed
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {payment.paymentConfirmed ? '송금완료' : '송금대기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

Row.displayName = 'PaymentRow';

const VirtualPaymentList: React.FC<VirtualPaymentListProps> = ({
  payments,
  groupedPayments,
  editingRequest,
  onEdit,
  onDelete,
  onImageClick,
  onToggleConfirm,
  height,
}) => {
  // Flatten the grouped payments into a single array with headers
  const items: (Payment | { type: 'header'; date: string; total: number })[] = [];

  Object.entries(groupedPayments).forEach(([date, group]) => {
    items.push({ type: 'header', date, total: group.total });
    items.push(...group.payments);
  });

  const itemData = {
    items,
    editingRequest,
    onEdit,
    onDelete,
    onImageClick,
    onToggleConfirm,
  };

  const getItemSize = (index: number) => {
    const item = items[index];
    if ('type' in item && item.type === 'header') {
      return 48; // Header height
    }
    return 100; // Payment item height
  };

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={getItemSize}
      width="100%"
      itemData={itemData}
    >
      {Row}
    </List>
  );
};

export default VirtualPaymentList;