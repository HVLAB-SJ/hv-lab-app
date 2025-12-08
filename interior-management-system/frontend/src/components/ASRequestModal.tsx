import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useFilteredProjects } from '../hooks/useFilteredProjects';

interface ASRequest {
  id: string;
  project: string;
  client: string;
  requestDate: Date;
  siteAddress: string;
  entrancePassword: string;
  description: string;
  scheduledVisitDate?: Date;
  scheduledVisitTime?: string;
  assignedTo?: string[];
  completionDate?: Date;
  notes?: string;
}

interface ASRequestFormData {
  project: string;
  client: string;
  requestDate: Date;
  siteAddress: string;
  entrancePassword?: string;
  description?: string;
  scheduledVisitDate?: Date;
  scheduledVisitTime?: string;
  assignedTo?: string[];
}

interface ASRequestModalProps {
  request: ASRequest | null;
  onClose: () => void;
  onSave: (data: ASRequestFormData) => void;
}

const TEAM_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현', '안팀'];

const ASRequestModal = ({ request, onClose, onSave }: ASRequestModalProps) => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm();
  const projects = useFilteredProjects();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customMember, setCustomMember] = useState('');
  const [visitTimePeriod, setVisitTimePeriod] = useState<'오전' | '오후'>('오전');
  const [visitTimeHour, setVisitTimeHour] = useState<number>(9);
  const [visitTimeMinute, setVisitTimeMinute] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // 공사완료된 프로젝트만 필터링
  const completedProjects = projects.filter(p => p.status === 'completed');

  useEffect(() => {
    if (request) {
      setValue('project', request.project);
      setValue('client', request.client);
      setValue('siteAddress', request.siteAddress);
      setValue('entrancePassword', request.entrancePassword);
      setValue('description', request.description);
      if (request.requestDate) {
        setValue('requestDate', request.requestDate.toISOString().split('T')[0]);
      }
      if (request.scheduledVisitDate) {
        setValue('scheduledVisitDate', request.scheduledVisitDate.toISOString().split('T')[0]);
      }
      if (request.scheduledVisitTime) {
        // Parse existing time (HH:mm format)
        const [hoursStr, minutesStr] = request.scheduledVisitTime.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (hours >= 12) {
          setVisitTimePeriod('오후');
          setVisitTimeHour(hours === 12 ? 12 : hours - 12);
        } else {
          setVisitTimePeriod('오전');
          setVisitTimeHour(hours === 0 ? 12 : hours);
        }
        setVisitTimeMinute(minutes);
      }
      setSelectedMembers(request.assignedTo || []);
    } else {
      setSelectedMembers([]);
      // Reset to default values
      setVisitTimePeriod('오전');
      setVisitTimeHour(9);
      setVisitTimeMinute(0);
    }
  }, [request, setValue]);

  const toggleMember = (member: string) => {
    setSelectedMembers(prev =>
      prev.includes(member)
        ? prev.filter(m => m !== member)
        : [...prev, member]
    );
  };

  const addCustomMember = () => {
    if (customMember.trim() && !selectedMembers.includes(customMember.trim())) {
      setSelectedMembers(prev => [...prev, customMember.trim()]);
      setCustomMember('');
    }
  };

  const removeMember = (member: string) => {
    setSelectedMembers(prev => prev.filter(m => m !== member));
  };

  const onSubmit = async (data: ASRequestFormData) => {
    if (isSaving) return;
    setIsSaving(true);

    // Convert time to HH:mm format
    let hours24 = visitTimeHour;
    if (visitTimePeriod === '오후' && visitTimeHour !== 12) {
      hours24 = visitTimeHour + 12;
    } else if (visitTimePeriod === '오전' && visitTimeHour === 12) {
      hours24 = 0;
    }
    const timeString = `${hours24.toString().padStart(2, '0')}:${visitTimeMinute.toString().padStart(2, '0')}`;

    const formData = {
      ...data,
      requestDate: new Date(data.requestDate),
      scheduledVisitDate: data.scheduledVisitDate ? new Date(data.scheduledVisitDate) : undefined,
      scheduledVisitTime: timeString,
      assignedTo: selectedMembers,
    };
    try {
      await onSave(formData);
    } catch (error) {
      setIsSaving(false);
      throw error;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">
            {request ? 'AS 요청 수정' : 'AS 요청 추가'}
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
          {/* Project & Client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트명 * (공사완료 현장)
              </label>
              <select
                {...register('project', { required: '프로젝트를 선택하세요' })}
                className="input"
                onChange={(e) => {
                  const selectedProject = completedProjects.find(p => p.name === e.target.value);
                  if (selectedProject) {
                    setValue('client', selectedProject.client);
                    setValue('siteAddress', selectedProject.location);
                    setValue('entrancePassword', selectedProject.entrancePassword || '');
                  }
                }}
              >
                <option value="">선택하세요</option>
                {completedProjects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
              {errors.project && (
                <p className="mt-1 text-sm text-red-600">{String(errors.project.message)}</p>
              )}
              {completedProjects.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">공사완료된 프로젝트가 없습니다</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                고객명 *
              </label>
              <input
                {...register('client', { required: '고객명을 입력하세요' })}
                type="text"
                className="input"
              />
              {errors.client && (
                <p className="mt-1 text-sm text-red-600">{String(errors.client.message)}</p>
              )}
            </div>
          </div>

          {/* Site Address & Entrance Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                현장주소 *
              </label>
              <input
                {...register('siteAddress', { required: '현장주소를 입력하세요' })}
                type="text"
                className="input"
              />
              {errors.siteAddress && (
                <p className="mt-1 text-sm text-red-600">{String(errors.siteAddress.message)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                공동현관 비밀번호
              </label>
              <input
                {...register('entrancePassword')}
                type="text"
                className="input"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="input"
            />
          </div>

          {/* Assigned Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당자 (중복 선택 가능)
            </label>

            {/* 기본 팀원 버튼 및 선택된 커스텀 멤버 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {/* 기본 팀원 버튼 */}
              {TEAM_MEMBERS.map((member) => (
                <button
                  key={member}
                  type="button"
                  onClick={() => toggleMember(member)}
                  className={`px-2.5 py-1.5 rounded border transition-colors text-sm ${
                    selectedMembers.includes(member)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {member}
                </button>
              ))}

              {/* 커스텀 멤버 버튼 (기본 팀원이 아닌 선택된 멤버들) */}
              {selectedMembers
                .filter(member => !TEAM_MEMBERS.includes(member))
                .map((member) => (
                  <button
                    key={member}
                    type="button"
                    onClick={() => removeMember(member)}
                    className="px-2.5 py-1.5 rounded border transition-colors text-sm bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                  >
                    {member} ×
                  </button>
                ))
              }
            </div>

            {/* 직접 입력 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customMember}
                onChange={(e) => setCustomMember(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomMember();
                  }
                }}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <button
                type="button"
                onClick={addCustomMember}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {/* Request Date & Scheduled Visit Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                요청일
              </label>
              <input
                {...register('requestDate')}
                type="date"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                방문예정일
              </label>
              <input
                {...register('scheduledVisitDate')}
                type="date"
                className="input"
              />
            </div>
          </div>

          {/* Scheduled Visit Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              방문 시간
            </label>
            <div className="flex items-center gap-2">
              {/* AM/PM 선택 */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setVisitTimePeriod('오전')}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    visitTimePeriod === '오전'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  오전
                </button>
                <button
                  type="button"
                  onClick={() => setVisitTimePeriod('오후')}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    visitTimePeriod === '오후'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  오후
                </button>
              </div>

              {/* Hour 선택 */}
              <select
                value={visitTimeHour}
                onChange={(e) => setVisitTimeHour(parseInt(e.target.value))}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}시
                  </option>
                ))}
              </select>

              {/* Minute 선택 (10분 단위) */}
              <select
                value={visitTimeMinute}
                onChange={(e) => setVisitTimeMinute(parseInt(e.target.value))}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {[0, 10, 20, 30, 40, 50].map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}분
                  </option>
                ))}
              </select>
            </div>
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
              disabled={isSaving}
              className="btn btn-primary disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : (request ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ASRequestModal;
