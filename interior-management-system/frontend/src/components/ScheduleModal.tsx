import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDataStore } from '../store/dataStore';

interface ScheduleEvent {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  projectId?: string;
  projectName?: string;
  assignedTo?: string[];
  attendees?: string[];
  description?: string;
  time?: string;
  originalTitle?: string;
  mergedEventIds?: string[];
  isASVisit?: boolean;
}

interface SlotInfo {
  start: Date;
  end: Date;
}

interface ScheduleFormData {
  projectId: string;
  title: string;
  date: string;
  description?: string;
}

interface ScheduleModalProps {
  event: ScheduleEvent | null;
  slotInfo: SlotInfo | null;
  defaultProjectName?: string;
  onClose: () => void;
  onSave: (event: ScheduleEvent) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

const TEAM_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현', '안팀'];

const ScheduleModal = ({ event, slotInfo, defaultProjectName, onClose, onSave, onDelete }: ScheduleModalProps) => {
  const [isSaving, setIsSaving] = useState(false); // 중복 저장 방지

  // localStorage에서 마지막 선택한 프로젝트 ID 가져오기
  const getLastProjectId = () => {
    const lastProjectId = localStorage.getItem('lastSelectedProjectId');
    return lastProjectId || '';
  };

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm({
    defaultValues: {
      projectId: '', // 빈칸을 기본값으로
      title: '',
      date: '',
      description: ''
    }
  });
  const { projects } = useDataStore();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customMember, setCustomMember] = useState('');
  const [hasTime, setHasTime] = useState<boolean>(false);
  const [timePeriod, setTimePeriod] = useState<'오전' | '오후'>('오전');
  const [timeHour, setTimeHour] = useState<number>(9);
  const [timeMinute, setTimeMinute] = useState<number>(0);
  const [customProjectName, setCustomProjectName] = useState('');

  const selectedProjectId = watch('projectId');

  // 선택된 프로젝트의 팀 정보 디버깅
  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p =>
        p.id === selectedProjectId ||
        p.id === parseInt(selectedProjectId) ||
        p.id.toString() === selectedProjectId.toString()
      );
      console.log('🔴 Selected project:', selectedProject?.name);
      console.log('🔴 Project team:', selectedProject?.team);
      console.log('🔴 Current selectedMembers:', selectedMembers);
    }
  }, [selectedProjectId, projects, selectedMembers]);

  // 모달이 처음 마운트될 때 한 번만 초기화 (시간 상태는 제외)
  useEffect(() => {
    // 초기 상태 설정 (시간 관련 상태는 사용자가 설정할 때까지 유지)
    console.log('🟡 Modal mount - initializing states');
    setSelectedMembers([]);
    setCustomProjectName('');
    setCustomMember('');
  }, []); // Empty dependency array - only run once on mount

  // 모달이 열릴 때 초기 설정
  useEffect(() => {
    console.log('🟢 ScheduleModal useEffect triggered:', {
      hasEvent: !!event,
      eventId: event?.id,
      hasSlotInfo: !!slotInfo,
      hasMergedEvents: !!(event?.mergedEventIds)
    });

    // event가 있으면 기존 일정 수정 모드
    if (event && event.id) {
      console.log('🟢 ScheduleModal processing event:', {
        title: event.title,
        projectId: event.projectId,
        projectName: event.projectName,
        start: event.start,
        assignedTo: event.assignedTo,
        time: event.time
      });

      // 폼 필드 설정 - originalTitle이 있으면 사용 (시간 텍스트가 제거된 원본 제목)
      const titleToUse = event.originalTitle || event.title;
      // 혹시 title에 시간 텍스트가 포함되어 있으면 제거
      const timePattern = / - (오전|오후) \d{1,2}시$/;
      const cleanTitle = titleToUse.replace(timePattern, '');

      setValue('title', cleanTitle, { shouldValidate: false, shouldDirty: false });
      setValue('date', format(event.start, 'yyyy-MM-dd'), { shouldValidate: false, shouldDirty: false });
      setValue('description', event.description || '', { shouldValidate: false, shouldDirty: false });

      // projectId 설정
      if (event.projectId && event.projectId !== '' && event.projectId !== 'undefined') {
        console.log('🔵 Setting projectId from event:', event.projectId);
        setValue('projectId', event.projectId, { shouldValidate: false, shouldDirty: false });
        setCustomProjectName(''); // Clear custom project name
      } else if (event.projectName) {
        // If no valid projectId but has projectName, try to find matching project
        const project = projects.find(p => p.name === event.projectName);
        console.log('🔵 Finding project by name:', event.projectName, 'found:', project);
        if (project) {
          console.log('🔵 Setting projectId from found project:', project.id);
          setValue('projectId', project.id, { shouldValidate: false, shouldDirty: false });
          setCustomProjectName(''); // Clear custom project name
        } else {
          // Project not found - leave empty
          console.log('🔵 Project not found, leaving empty');
          setValue('projectId', '', { shouldValidate: false, shouldDirty: false });
          setCustomProjectName('');
        }
      } else {
        // No projectId and no projectName - empty project (allowed)
        console.log('🔵 No project info, leaving empty');
        setValue('projectId', '', { shouldValidate: false, shouldDirty: false });
        setCustomProjectName('');
      }
      // assignedTo와 attendees 둘 다 확인
      const members = event.assignedTo || event.attendees || [];
      console.log('🟢 Setting selectedMembers to:', members);
      setSelectedMembers(Array.isArray(members) ? members : []);

      // Check if event has time information
      if (event.time && event.time !== '-') {
        console.log('🟢 Setting time from event:', {
          eventTime: event.time,
          parsedHours: event.time.split(':')[0],
          parsedMinutes: event.time.split(':')[1]
        });
        setHasTime(true);
        const [hoursStr, minutesStr] = event.time.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (hours >= 12) {
          setTimePeriod('오후');
          setTimeHour(hours === 12 ? 12 : hours - 12);
        } else {
          setTimePeriod('오전');
          setTimeHour(hours === 0 ? 12 : hours);
        }
        setTimeMinute(minutes);

        console.log('🟢 Time state set:', {
          hasTime: true,
          period: hours >= 12 ? '오후' : '오전',
          hour: hours >= 12 ? (hours === 12 ? 12 : hours - 12) : (hours === 0 ? 12 : hours),
          minute: minutes
        });
      } else {
        console.log('🟢 No time in event, setting hasTime to false');
        setHasTime(false);
        // 시간이 없을 때 기본값 설정
        setTimePeriod('오전');
        setTimeHour(9);
        setTimeMinute(0);
      }
    } else if (slotInfo && !event) {
      // 새로운 일정 추가 모드 (event가 없고 slotInfo만 있을 때)
      console.log('🟢 New schedule from slot:', slotInfo);

      // 폼 리셋 (프로젝트는 빈칸으로)
      reset({
        projectId: '',
        title: '',
        date: format(slotInfo.start, 'yyyy-MM-dd'),
        description: ''
      });

      console.log('🟡 New schedule - resetting selectedMembers to empty array');
      setSelectedMembers([]);
      setCustomProjectName('');
      // 시간 상태는 초기화하지 않음 - 사용자가 설정한 값 유지

      // Set default project if provided
      if (defaultProjectName) {
        const defaultProject = projects.find(p => p.name === defaultProjectName);
        if (defaultProject) {
          setValue('projectId', defaultProject.id, { shouldValidate: false, shouldDirty: false });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]); // Only re-run when event.id changes, NOT on slotInfo changes

  // 프로젝트 선택 시 자동으로 해당 프로젝트의 팀원을 담당자로 설정
  // 이 기능은 비활성화되었습니다 - 사용자가 직접 담당자를 선택하도록 함
  // useEffect(() => {
  //   // 새 일정 추가 모드이고, 사용자가 아직 담당자를 수동으로 변경하지 않았을 때만 작동
  //   if (!event?.id && !userModifiedMembers && selectedProjectId && selectedProjectId !== '') {
  //     const selectedProject = projects.find(p =>
  //       p.id === selectedProjectId ||
  //       p.id === parseInt(selectedProjectId) ||
  //       p.id.toString() === selectedProjectId.toString()
  //     );

  //     if (selectedProject && selectedProject.team && selectedProject.team.length > 0) {
  //       console.log('🔵 Auto-setting team members from project:', selectedProject.name, selectedProject.team);
  //       setSelectedMembers(selectedProject.team);
  //     }
  //   }
  // }, [selectedProjectId, projects, event?.id, userModifiedMembers]);

  const toggleMember = (member: string) => {
    console.log('🔵 toggleMember called with:', member);
    console.log('🔵 Current selectedMembers before toggle:', selectedMembers);
    setSelectedMembers(prev => {
      console.log('🔵 Previous members in setState:', prev);
      const newMembers = prev.includes(member)
        ? prev.filter(m => m !== member)
        : [...prev, member];
      console.log('🔵 Updated members after toggle:', newMembers);
      return newMembers;
    });
  };

  // HV LAB 토글 함수 (단일 담당자로 처리, 안팀 제외)
  const toggleHVLab = () => {
    const hvLabMember = 'HV LAB';
    if (selectedMembers.includes(hvLabMember)) {
      setSelectedMembers(prev => prev.filter(m => m !== hvLabMember));
    } else {
      // HV LAB 추가 시 안팀은 제외
      setSelectedMembers(prev => [...prev.filter(m => m !== '안팀'), hvLabMember]);
    }
  };

  // 현장팀 토글 함수 (단일 멤버)
  const toggleFieldTeam = () => {
    const fieldTeamMember = '현장팀';
    if (selectedMembers.includes(fieldTeamMember)) {
      setSelectedMembers(prev => prev.filter(m => m !== fieldTeamMember));
    } else {
      setSelectedMembers(prev => [...prev, fieldTeamMember]);
    }
  };

  // 디자인팀 토글 함수 (단일 담당자로 처리)
  const toggleDesignTeam = () => {
    const designTeamMember = '디자인팀';
    if (selectedMembers.includes(designTeamMember)) {
      setSelectedMembers(prev => prev.filter(m => m !== designTeamMember));
    } else {
      setSelectedMembers(prev => [...prev, designTeamMember]);
    }
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

  const onSubmit = async (data: ScheduleFormData) => {
    console.log('🔴 Form onSubmit called with data:', data);
    console.log('🔴 selectedMembers:', selectedMembers);
    console.log('🔴 hasTime state:', hasTime);
    console.log('🔴 timePeriod:', timePeriod, 'timeHour:', timeHour, 'timeMinute:', timeMinute);
    console.log('🔴 Available projects:', projects.map(p => ({ id: p.id, name: p.name, idType: typeof p.id })));
    console.log('🔴 Merged event IDs:', event?.mergedEventIds);

    // 제목에서 시간 텍스트 제거 (혹시 남아있을 경우를 대비)
    const timePattern = / - (오전|오후) \d{1,2}시$/;
    const cleanedTitle = data.title.replace(timePattern, '').trim();

    let projectName = '';
    let projectId = '';

    if (data.projectId) {
      // 기존 프로젝트를 선택한 경우
      // ID는 문자열 또는 숫자일 수 있으므로 둘 다 비교
      const selectedProject = projects.find(p =>
        p.id === data.projectId ||
        p.id === parseInt(data.projectId) ||
        p.id.toString() === data.projectId.toString()
      );
      console.log('🔴 Looking for project with id:', data.projectId, 'type:', typeof data.projectId);
      console.log('🔴 Found project:', selectedProject);
      projectName = selectedProject?.name || '';
      projectId = data.projectId;
    } else {
      // 프로젝트를 선택하지 않은 경우 (빈칸)
      projectName = '';
      projectId = '';
    }

    console.log('🔴 Final projectId:', projectId, 'projectName:', projectName, 'cleanedTitle:', cleanedTitle);

    const eventDate = new Date(data.date);

    // Calculate time - only include if time has been set
    let timeString = '-'; // Default value when no time is set
    if (hasTime) {
      let hours24 = timeHour;
      if (timePeriod === '오후' && timeHour !== 12) {
        hours24 = timeHour + 12;
      } else if (timePeriod === '오전' && timeHour === 12) {
        hours24 = 0;
      }
      timeString = `${hours24.toString().padStart(2, '0')}:${timeMinute.toString().padStart(2, '0')}`;
      console.log('🔴 Time calculated:', timeString);
    } else {
      console.log('🔴 No time set (hasTime is false)');
    }

    // 병합된 이벤트나 단일 이벤트 처리
    const newEvent: ScheduleEvent = {
      ...event,
      title: cleanedTitle,  // 정리된 제목 사용
      start: eventDate,
      end: eventDate,
      projectId: projectId,
      projectName: projectName,
      assignedTo: selectedMembers,
      description: data.description || '',
      time: timeString,
      mergedEventIds: event?.mergedEventIds // 병합된 ID들 유지
    };

    // 중복 저장 방지
    if (isSaving) return;
    setIsSaving(true);

    console.log('🔴 Calling onSave with newEvent:', newEvent);
    try {
      await onSave(newEvent);
      console.log('🔴 onSave completed successfully');
    } catch (error) {
      console.error('🔴 onSave failed:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  console.log('🔶 Rendering ScheduleModal with selectedMembers:', selectedMembers);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b">
          <h2 className="text-lg md:text-xl font-semibold">
            {event ? '일정 수정' : '새 일정 추가'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6 space-y-3 md:space-y-4">
          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              프로젝트
            </label>
            <select
              {...register('projectId')}
              className="input w-full"
            >
              <option value=""></option>
              {projects
                .filter(project => {
                  // AS 일정인 경우 모든 프로젝트 표시, 아니면 진행중인 프로젝트만
                  if (event?.isASVisit) {
                    return true;
                  }
                  return project.status !== 'completed';
                })
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              일정 제목 *
            </label>
            <input
              {...register('title', { required: '제목을 입력하세요' })}
              type="text"
              className="input w-full"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{String(errors.title.message)}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              날짜 *
            </label>
            <input
              {...register('date', { required: '날짜를 선택하세요' })}
              type="date"
              className="input w-full"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{String(errors.date.message)}</p>
            )}
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시간
            </label>

            {/* Time Toggle */}
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setHasTime(!hasTime)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  hasTime
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {hasTime ? '시간 설정됨' : '시간 미설정 (-)'}
              </button>
            </div>

            {/* Time Selectors - Only show when hasTime is true */}
            {hasTime && (
              <div className="flex flex-wrap items-center gap-2">
                {/* AM/PM Selection */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTimePeriod('오전')}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      timePeriod === '오전'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    오전
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimePeriod('오후')}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      timePeriod === '오후'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    오후
                  </button>
                </div>

                {/* Hour Selection */}
                <select
                  value={timeHour}
                  onChange={(e) => setTimeHour(parseInt(e.target.value))}
                  className="flex-1 min-w-[80px] max-w-[120px] px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}시
                    </option>
                  ))}
                </select>

                {/* Minute Selection (10분 단위) */}
                <select
                  value={timeMinute}
                  onChange={(e) => setTimeMinute(parseInt(e.target.value))}
                  className="flex-1 min-w-[80px] max-w-[120px] px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {[0, 10, 20, 30, 40, 50].map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}분
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Assigned Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당자 (중복 선택 가능)
            </label>

            {/* 기본 팀원 버튼 및 선택된 커스텀 멤버 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {/* HV LAB 버튼 (전체 팀원) */}
              <button
                type="button"
                onClick={toggleHVLab}
                className={`px-2.5 py-1.5 rounded border transition-colors text-sm ${
                  selectedMembers.includes('HV LAB')
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                HV LAB
              </button>

              {/* 현장팀 버튼 */}
              <button
                type="button"
                onClick={toggleFieldTeam}
                className={`px-2.5 py-1.5 rounded border transition-colors text-sm ${
                  selectedMembers.includes('현장팀')
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                현장팀
              </button>

              {/* 디자인팀 버튼 */}
              <button
                type="button"
                onClick={toggleDesignTeam}
                className={`px-2.5 py-1.5 rounded border transition-colors text-sm ${
                  selectedMembers.includes('디자인팀')
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                디자인팀
              </button>

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

              {/* 커스텀 멤버 버튼 (기본 팀원이 아닌 선택된 멤버들, 팀 이름 제외) */}
              {selectedMembers
                .filter(member => !TEAM_MEMBERS.includes(member) && member !== 'HV LAB' && member !== '현장팀' && member !== '디자인팀')
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              {...register('description')}
              rows={2}
              className="input w-full text-sm md:text-base"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0 pt-4 border-t">
            <div>
              {event && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('이 일정을 삭제하시겠습니까?')) {
                      onDelete(event.id);
                    }
                  }}
                  className="btn btn-outline text-red-600 hover:bg-red-50 flex items-center w-full sm:w-auto justify-center text-sm md:text-base"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </button>
              )}
            </div>
            <div className="flex gap-2 sm:space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline flex-1 sm:flex-none text-sm md:text-base"
              >
                취소
              </button>
              <button type="submit" disabled={isSaving} className="btn btn-primary flex-1 sm:flex-none text-sm md:text-base disabled:opacity-50">
                {isSaving ? '저장 중...' : (event ? '수정' : '추가')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleModal;