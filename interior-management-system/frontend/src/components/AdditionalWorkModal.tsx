import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import toast from 'react-hot-toast';

interface AdditionalWork {
  id: string;
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
  images?: string[];
}

interface AdditionalWorkFormData {
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
  images?: string[];
}

interface AdditionalWorkModalProps {
  work: AdditionalWork | null;
  onClose: () => void;
  onSave: (data: AdditionalWorkFormData) => void;
  initialProject?: string;
}

const AdditionalWorkModal = ({ work, onClose, onSave, initialProject }: AdditionalWorkModalProps) => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm();
  const { projects } = useDataStore();
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (work) {
      setValue('project', work.project);
      setValue('description', work.description);
      setValue('amount', work.amount);
      setValue('date', work.date.toISOString().split('T')[0]);
      setValue('notes', work.notes || '');
      setImages(work.images || []);
      setImagePreview(work.images || []);
    } else {
      // 새 추가내역 시 오늘 날짜를 기본값으로 설정
      const today = new Date().toISOString().split('T')[0];
      setValue('date', today);
      setImages([]);
      setImagePreview([]);
      // initialProject가 있으면 프로젝트를 미리 선택
      if (initialProject) {
        setValue('project', initialProject);
      }
    }
  }, [work, setValue, initialProject]);

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
            setImages(prev => [...prev, base64]);
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
          setImages(prev => [...prev, base64]);
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
          setImages(prev => [...prev, base64]);
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
    setImages(prev => prev.filter((_, i) => i !== index));
    toast.success('이미지가 삭제되었습니다');
  };

  const onSubmit = (data: AdditionalWorkFormData) => {
    const formData = {
      ...data,
      amount: Number(data.amount),
      date: new Date(data.date),
      images: images,
    };
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">
            {work ? '추가내역 수정' : '추가내역 등록'}
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
          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              프로젝트명 *
            </label>
            <select
              {...register('project', { required: '프로젝트를 선택하세요' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="">선택하세요</option>
              {projects.map((project) => (
                <option key={project.id} value={project.name}>
                  {project.name}
                </option>
              ))}
            </select>
            {errors.project && (
              <p className="mt-1 text-sm text-red-600">{String(errors.project.message)}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용 *
            </label>
            <textarea
              {...register('description', { required: '추가내역 내용을 입력하세요' })}
              rows={3}
              className="input"
              placeholder="추가 공사 내용을 입력하세요 (예: 거실 조명 추가 설치)"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{String(errors.description.message)}</p>
            )}
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                금액 (원) *
              </label>
              <input
                {...register('amount', {
                  required: '금액을 입력하세요',
                  min: { value: 0, message: '금액은 0 이상이어야 합니다' }
                })}
                type="number"
                className="input"
                placeholder="예: 500000"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{String(errors.amount.message)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                일자 *
              </label>
              <input
                {...register('date', { required: '일자를 선택하세요' })}
                type="date"
                className="input"
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">{String(errors.date.message)}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비고
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              className="input"
              placeholder="추가 메모 (선택사항)"
            />
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
                  id="file-upload-additional"
                />
                <label
                  htmlFor="file-upload-additional"
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

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {work ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdditionalWorkModal;
