import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useDataStore } from '../store/dataStore';

interface AdditionalWork {
  id: string;
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
}

interface AdditionalWorkFormData {
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
}

interface AdditionalWorkModalProps {
  work: AdditionalWork | null;
  onClose: () => void;
  onSave: (data: AdditionalWorkFormData) => void;
}

const AdditionalWorkModal = ({ work, onClose, onSave }: AdditionalWorkModalProps) => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm();
  const { projects } = useDataStore();

  useEffect(() => {
    if (work) {
      setValue('project', work.project);
      setValue('description', work.description);
      setValue('amount', work.amount);
      setValue('date', work.date.toISOString().split('T')[0]);
      setValue('notes', work.notes || '');
    } else {
      // 새 추가내역 시 오늘 날짜를 기본값으로 설정
      const today = new Date().toISOString().split('T')[0];
      setValue('date', today);
    }
  }, [work, setValue]);

  const onSubmit = (data: AdditionalWorkFormData) => {
    const formData = {
      ...data,
      amount: Number(data.amount),
      date: new Date(data.date),
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
              className="input"
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
