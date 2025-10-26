import { useState, useEffect, useCallback } from 'react';
import { X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDataStore } from '../store/dataStore';
import toast from 'react-hot-toast';

interface ExecutionRecord {
  id?: string;
  project: string;
  date: string | Date;
  process: string;
  itemName: string;
  materialCost: number;
  laborCost: number;
  vatAmount: number;
  notes: string;
  images: string[];
  totalAmount?: number;
  createdAt?: string;
}

interface ExecutionRecordFormData {
  project: string;
  date: string;
  process: string;
  itemName: string;
  materialCost: number;
  laborCost: number;
  vatAmount: number;
  notes: string;
  images: string[];
  totalAmount: number;
  createdAt: string;
}

interface ExecutionRecordModalProps {
  record?: ExecutionRecord;
  onClose: () => void;
  onSave: (data: ExecutionRecordFormData) => void;
}

const ExecutionRecordModal = ({ record, onClose, onSave }: ExecutionRecordModalProps) => {
  const { projects } = useDataStore();
  const [formData, setFormData] = useState({
    project: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    process: '',
    itemName: '',
    materialCost: 0,
    laborCost: 0,
    vatAmount: 0,
    notes: '',
    images: [] as string[]
  });

  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string[]>([]);

  useEffect(() => {
    if (record) {
      setFormData({
        project: record.project || '',
        date: record.date ? format(new Date(record.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        process: record.process || '',
        itemName: record.itemName || '',
        materialCost: record.materialCost || 0,
        laborCost: record.laborCost || 0,
        vatAmount: record.vatAmount || 0,
        notes: record.notes || '',
        images: record.images || []
      });
      setImagePreview(record.images || []);
    }
  }, [record]);

  // 클립보드 붙여넣기 처리
  const handlePaste = useCallback((e: ClipboardEvent) => {
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
            setImagePreview(prev => [...prev, base64]);
            setFormData(prev => ({ ...prev, images: [...prev.images, base64] }));
            toast.success('이미지가 추가되었습니다');
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

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

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setImagePreview(prev => [...prev, base64]);
          setFormData(prev => ({ ...prev, images: [...prev.images, base64] }));
        };
        reader.readAsDataURL(file);
      }
    });

    if (files.length > 0) {
      toast.success(`${files.length}개의 이미지가 추가되었습니다`);
    }
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target?.files || []);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setImagePreview(prev => [...prev, base64]);
          setFormData(prev => ({ ...prev, images: [...prev.images, base64] }));
        };
        reader.readAsDataURL(file);
      }
    });

    if (files.length > 0) {
      toast.success(`${files.length}개의 이미지가 추가되었습니다`);
    }
  };

  // 이미지 삭제
  const removeImage = (index: number) => {
    setImagePreview(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    toast.success('이미지가 삭제되었습니다');
  };

  // VAT 자동 계산
  const calculateVAT = () => {
    const total = formData.materialCost + formData.laborCost;
    const vat = Math.round(total * 0.1);
    setFormData(prev => ({ ...prev, vatAmount: vat }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.project) {
      toast.error('프로젝트를 선택해주세요');
      return;
    }

    if (!formData.itemName) {
      toast.error('항목명을 입력해주세요');
      return;
    }

    const total = formData.materialCost + formData.laborCost + formData.vatAmount;

    onSave({
      ...formData,
      totalAmount: total,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {record ? '실행내역 수정' : '실행내역 추가'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                프로젝트 *
              </label>
              <select
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                required
              >
                <option value="">프로젝트 선택</option>
                {projects.map(project => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                날짜 *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공정
              </label>
              <input
                type="text"
                value={formData.process}
                onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                placeholder="예: 전기, 타일, 도장"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                항목명 *
              </label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                placeholder="예: LED 조명 설치"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                required
              />
            </div>
          </div>

          {/* 금액 정보 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">금액 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  자재비
                </label>
                <input
                  type="number"
                  value={formData.materialCost}
                  onChange={(e) => setFormData({ ...formData, materialCost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  인건비
                </label>
                <input
                  type="number"
                  value={formData.laborCost}
                  onChange={(e) => setFormData({ ...formData, laborCost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  부가세
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.vatAmount}
                    onChange={(e) => setFormData({ ...formData, vatAmount: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <button
                    type="button"
                    onClick={calculateVAT}
                    className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    자동계산
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  총액
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg font-semibold">
                  {(formData.materialCost + formData.laborCost + formData.vatAmount).toLocaleString()}원
                </div>
              </div>
            </div>
          </div>

          {/* 이미지 업로드 섹션 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              증빙 이미지 (Ctrl+V로 붙여넣기 가능)
            </h3>

            <div
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                isDragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  이미지를 드래그하여 놓거나 클릭하여 선택하세요
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  또는 Ctrl+V로 클립보드 이미지 붙여넣기
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  파일 선택
                </label>
              </div>
            </div>

            {/* 이미지 미리보기 */}
            {imagePreview.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {imagePreview.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`증빙 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="추가 메모사항을 입력하세요"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-gray-900 rounded-lg hover:bg-gray-800"
            >
              {record ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExecutionRecordModal;