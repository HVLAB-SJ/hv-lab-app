import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { Calendar, momentLocalizer, type View } from 'react-big-calendar';
import moment from 'moment';
import ScheduleModal from '../components/ScheduleModal';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { formatTimeKorean } from '../utils/formatters';

// Moment 한국어 로케일 설정
moment.updateLocale('ko', {
  months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthsShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  weekdays: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  weekdaysShort: ['일', '월', '화', '수', '목', '금', '토'],
  weekdaysMin: ['일', '월', '화', '수', '목', '금', '토'],
  longDateFormat: {
    LT: 'A h:mm',
    LTS: 'A h:mm:ss',
    L: 'YYYY.MM.DD.',
    LL: 'YYYY년 MMMM D일',
    LLL: 'YYYY년 MMMM D일 A h:mm',
    LLLL: 'YYYY년 MMMM D일 dddd A h:mm',
  },
  meridiem: (hour: number) => {
    return hour < 12 ? '오전' : '오후';
  },
  week: {
    dow: 0,
    doy: 1
  }
});
moment.locale('ko');
const localizer = momentLocalizer(moment);

interface ScheduleEvent {
  id: string;
  title: string;
  originalTitle?: string;  // 시간이 포함되지 않은 원본 제목
  start: Date;
  end: Date;
  projectId: string;
  projectName: string;
  type: 'construction' | 'material' | 'inspection' | 'meeting' | 'other' | 'as_visit' | 'expected_payment';
  phase: string;
  assignedTo: string[];
  priority: 'low' | 'medium' | 'high';
  allDay: boolean;
  color?: string;
  isASVisit?: boolean;
  isExpectedPayment?: boolean;
  time?: string;
  description?: string;  // 설명 필드 추가
  mergedEventIds?: string[]; // 병합된 이벤트 ID들
}

// 프로젝트별 색상 할당 (무채색)
const projectColors = [
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
  '#F3F4F6', // 연한 회색
];

// 프로젝트명 축약 함수 (언더스코어 앞부분만 두 글자로)
const shortenProjectName = (projectName: string): string => {
  if (!projectName) return projectName;
  const parts = projectName.split('_');
  if (parts.length > 1 && parts[0].length > 2) {
    // 언더스코어가 있고 앞부분이 2글자보다 길면 축약
    return parts[0].substring(0, 2) + '_' + parts.slice(1).join('_');
  }
  return projectName;
};

// 한국 공휴일 데이터
const holidays: { [key: string]: string } = {
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체공휴일',
  '2025-05-05': '어린이날',
  '2025-05-06': '부처님오신날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',
};

// 커스텀 날짜 헤더 컴포넌트를 밖으로 이동
const CustomDateHeader = React.memo(({
  date,
  label,
  filteredEvents,
  selectedDate,
  user,
  isMobileView
}: {
  date: Date;
  label: string;
  filteredEvents: ScheduleEvent[];
  selectedDate: Date | null;
  user: { id: string; name: string; role: string } | null;
  isMobileView: boolean;
}) => {
  const dateKey = moment(date).format('YYYY-MM-DD');
  const holidayName = holidays[dateKey];
  const isHoliday = !!holidays[dateKey];
  const isSelected = selectedDate && moment(date).isSame(selectedDate, 'day');

  // 해당 날짜의 일정 개수 계산
  const eventsOnDate = filteredEvents.filter(event =>
    moment(event.start).isSame(date, 'day')
  );
  const eventCount = eventsOnDate.length;

  // 사용자가 담당자인 일정 개수 계산 (모바일용)
  const userAssignedCount = eventsOnDate.filter(event =>
    event.assignedTo && event.assignedTo.includes(user?.name || '')
  ).length;
  const otherEventsCount = eventCount - userAssignedCount;

  // 앞의 0 제거 (예: "01" -> "1")
  const displayLabel = label.replace(/^0/, '');

  // 날짜가 일요일인지 확인 (0 = 일요일)
  const isSunday = date.getDay() === 0;

  // 날짜가 토요일인지 확인 (6 = 토요일)
  const isSaturday = date.getDay() === 6;

  // 날짜 색상 결정
  let dateColor = '#000000'; // 기본 검정
  if (isHoliday || isSunday) {
    dateColor = '#dc2626'; // 공휴일과 일요일은 채도 낮은 빨강
  } else if (isSaturday) {
    dateColor = '#3b82f6'; // 토요일은 파랑
  }

  // 오늘 날짜인지 확인
  const isToday = moment(date).isSame(moment(), 'day');

  // 날짜 스타일 (항상 같은 크기 유지)
  // 두 자리 숫자일 때 패딩 0px
  const isTwoDigit = displayLabel.length === 2;
  const dateStyle: React.CSSProperties = isMobileView ? {
    backgroundColor: 'transparent',
    color: dateColor,
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: isToday ? '700' : '400', // 오늘 날짜는 굵게
    border: isSelected ? '1px solid #1f2937' : '1px solid transparent',
    boxSizing: 'border-box',
    gap: '1px'
  } : {
    color: dateColor,
    fontWeight: isToday ? '700' : '400', // 오늘 날짜는 굵게
    paddingLeft: isTwoDigit ? '0px' : '4px' // 두 자리는 0px, 한 자리는 4px
  };

  // 데스크톱: 날짜와 공휴일을 같은 라인에 배치 (요일과 같은 라인)
  // 모바일: 날짜 원 내부에 점 표시
  return (
    <div
      className={isMobileView ? "flex flex-col items-center" : "flex items-center gap-2"}
      style={{ overflow: 'visible', position: 'relative', zIndex: 10 }}
    >
      {isMobileView ? (
        // 모바일: 날짜 숫자와 점을 원 안에 함께 표시
        <span style={dateStyle}>
          <span style={{ fontSize: '13px', lineHeight: '1' }}>{displayLabel}</span>
          {/* 일정 개수만큼 점 표시 - 원 내부 */}
          {eventCount > 0 && (
            <div className="flex gap-0.5" style={{ minHeight: '4px', marginTop: '1px' }}>
              {/* 사용자가 담당자인 일정 - 채도 낮은 녹색 */}
              {Array.from({ length: userAssignedCount }).map((_, i) => (
                <div
                  key={`user-${i}`}
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: '#66BB6A', // 채도 낮은 녹색
                    flexShrink: 0
                  }}
                />
              ))}
              {/* 그 외 일정 - 회색 */}
              {Array.from({ length: otherEventsCount }).map((_, i) => (
                <div
                  key={`other-${i}`}
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: '#757575', // 회색
                    flexShrink: 0
                  }}
                />
              ))}
            </div>
          )}
        </span>
      ) : (
        // 데스크톱: 기존 방식
        <>
          <span style={dateStyle}>{displayLabel}</span>
          {holidayName && (
            <span className="text-xs font-medium" style={{ color: '#ef4444' }}>
              {holidayName}
            </span>
          )}
        </>
      )}
    </div>
  );
});

// 커스텀 이벤트 컴포넌트도 밖으로 이동
const CustomEvent = React.memo(({ event, user }: { event: ScheduleEvent; user: { id: string; name: string; role: string } | null }) => {
  const attendees = event.assignedTo || [];
  // 태블릿 또는 세로방향 데스크탑 모니터 감지
  const checkVerticalLayout = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // 태블릿 (768~1024) 또는 세로방향 데스크탑 (height > width이고 width >= 768)
    return (width >= 768 && width < 1024) || (width >= 1024 && height > width);
  };
  const [useVerticalLayout, setUseVerticalLayout] = useState(checkVerticalLayout);
  const [showTooltip, setShowTooltip] = useState(false);

  // 사용자 이름에서 성 제거
  const userNameWithoutSurname = user?.name ? user.name.slice(-2) : null;

  // 현재 사용자가 팀에 속하는지 확인
  const isUserInFieldTeam = userNameWithoutSurname && ['재천', '민기'].includes(userNameWithoutSurname);
  const isUserInDesignTeam = userNameWithoutSurname && ['신애', '재성', '재현'].includes(userNameWithoutSurname);

  useEffect(() => {
    const handleResize = () => {
      setUseVerticalLayout(checkVerticalLayout());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 태블릿 또는 세로방향 데스크탑에서는 세로 레이아웃으로 표시
  if (useVerticalLayout) {
    return (
      <div
        className="w-full relative block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          padding: '1px 3px',
          minHeight: '30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start'
        }}
      >
        {/* 첫번째 줄: 프로젝트명 + 담당자 */}
        <div className="flex items-center justify-between w-full" style={{ fontSize: '10px', opacity: 0.8, marginBottom: '1px', lineHeight: '1.2' }}>
          {!event.isASVisit && event.projectName ? (
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60%',
              flexShrink: 0
            }}>
              [{shortenProjectName(event.projectName)}]
            </span>
          ) : (
            <span></span>
          )}
          {attendees.length > 0 && (
            <span style={{ flexShrink: 0, fontSize: '10px', marginLeft: 'auto' }}>
              {attendees.map((attendee, index) => {
                const isBold = attendee === 'HV LAB' ||
                  (attendee === '현장팀' && isUserInFieldTeam) ||
                  (attendee === '디자인팀' && isUserInDesignTeam) ||
                  attendee === user?.name;
                return (
                  <React.Fragment key={attendee}>
                    <span style={{ fontWeight: isBold ? 'bold' : 'normal' }}>
                      {attendee}
                    </span>
                    {index < attendees.length - 1 && '·'}
                  </React.Fragment>
                );
              })}
            </span>
          )}
        </div>

        {/* 두번째~세번째 줄: 일정 제목 (2줄까지 표시) */}
        <div
          style={{
            fontWeight: 500,
            fontSize: '11px',
            lineHeight: '1.3',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'keep-all',
            textOverflow: 'ellipsis'
          }}
          title={event.title}
        >
          {event.title}
        </div>

        {/* 툴팁 */}
        {showTooltip && (
          <div
            className="absolute z-50 bg-gray-900 text-white text-xs rounded p-2 shadow-lg"
            style={{
              bottom: '100%',
              left: '0',
              marginBottom: '4px',
              minWidth: '200px',
              maxWidth: '300px'
            }}
          >
            <div className="font-semibold mb-1">{event.title}</div>
            {event.projectName && (
              <div className="opacity-90">프로젝트: {event.projectName}</div>
            )}
            {attendees.length > 0 && (
              <div className="opacity-90 mt-1">담당자: {attendees.join(', ')}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 데스크톱과 모바일 레이아웃 (기존 코드)
  return (
    <div className="flex items-center justify-between w-full gap-1.5 overflow-hidden">
      <div className="flex items-center gap-1.5 overflow-hidden flex-1">
        {/* AS 일정이 아닐 때만 프로젝트명 표시 */}
        {!event.isASVisit && event.projectName && (
          <span className="text-xs opacity-70 flex-shrink-0">
            [{shortenProjectName(event.projectName)}]
          </span>
        )}
        <span className="font-medium truncate">{event.title}</span>
      </div>
      {attendees.length > 0 && (
        <span className="text-xs opacity-80 flex-shrink-0 ml-auto">
          {attendees.map((attendee, index) => {
            const isBold = attendee === 'HV LAB' ||
              (attendee === '현장팀' && isUserInFieldTeam) ||
              (attendee === '디자인팀' && isUserInDesignTeam) ||
              attendee === user?.name;
            return (
              <React.Fragment key={attendee}>
                <span className={isBold ? 'font-bold' : ''}>
                  {attendee}
                </span>
                {index < attendees.length - 1 && '·'}
              </React.Fragment>
            );
          })}
        </span>
      )}
    </div>
  );
});

const Schedule = () => {
  const {
    schedules,
    loadSchedulesFromAPI,
    addScheduleToAPI,
    updateScheduleInAPI,
    deleteScheduleFromAPI,
    asRequests,
    updateASRequestInAPI,
    loadASRequestsFromAPI,
    constructionPayments,
    updateConstructionPaymentInAPI
  } = useDataStore();
  const { user } = useAuth();
  const projects = useFilteredProjects();

  // 세로모드 감지 (세로모드에서 간단한 시간 포맷 사용)
  const [isPortraitMode, setIsPortraitMode] = useState(false);

  useEffect(() => {
    const checkPortraitMode = () => {
      const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth >= 1024;
      setIsPortraitMode(isPortrait);
    };
    checkPortraitMode();
    window.addEventListener('resize', checkPortraitMode);
    return () => window.removeEventListener('resize', checkPortraitMode);
  }, []);

  // 세로모드용 간단한 시간 포맷 함수
  const formatTime = (time: string) => {
    if (!time || time === '-') return '';
    // 세로모드에서는 원본 HH:mm 형식 그대로 사용
    if (isPortraitMode) {
      return time;
    }
    // 일반 모드에서는 한국어 포맷 사용
    return formatTimeKorean(time);
  };

  // 사용자 이름에서 성 제거 (마지막 2글자만 사용)
  const userNameWithoutSurname = user?.name ? user.name.slice(-2) : null;

  // 디버깅: 사용자 정보 로그
  console.log('👤 Current user:', user?.name, 'Short name:', userNameWithoutSurname);

  // Load schedules from API on mount
  useEffect(() => {
    loadSchedulesFromAPI().catch(error => {
      console.error('Failed to load schedules:', error);
      toast.error('일정을 불러오는데 실패했습니다');
    });
  }, [loadSchedulesFromAPI]);

  // 프로젝트별 색상 매핑
  const getProjectColor = (projectName: string) => {
    const index = projects.findIndex(p => p.name === projectName);
    return index >= 0 ? projectColors[index % projectColors.length] : '#e8e2ea';
  };

  // Store 데이터를 Calendar 이벤트 형식으로 변환
  // AS 요청 관련 일정은 제외 (asVisitEvents에서 별도로 처리)
  // 안팀 사용자의 경우 담당 프로젝트의 일정만 필터링
  const filteredProjectNames = projects.map(p => p.name);
  const scheduleEvents: ScheduleEvent[] = schedules
    .filter(schedule => !schedule.asRequestId) // AS 요청 관련 일정 제외
    .filter(schedule => {
      // 안팀 사용자는 담당 프로젝트의 일정만 보기
      if (user?.name === '안팀') {
        return schedule.project === '비공개' || filteredProjectNames.includes(schedule.project);
      }
      return true;
    })
    .map(schedule => {
      // 비공개 일정은 "[개인일정]"으로 표시
      const displayProjectName = schedule.project === '비공개' ? '[개인일정]' : schedule.project;
      const project = projects.find(p => p.name === schedule.project);
      const scheduleTime = schedule.time;
      // 시간이 있고 "-"가 아닌 경우에만 시간 텍스트 추가
      const timeText = (scheduleTime && scheduleTime !== '-') ? ` - ${formatTime(scheduleTime)}` : '';

      // 사용자 일정 여부 확인 (여기서 직접 확인)
      const attendees = schedule.attendees || [];
      const isUserSchedule = attendees.includes('상준') ||  // 직접 "상준" 체크
                             attendees.includes(user?.name || '') ||  // 전체 이름 체크
                             (userNameWithoutSurname && attendees.includes(userNameWithoutSurname));  // 짧은 이름 체크

      // 사용자 일정은 시작 시간을 6시간 앞당김
      const adjustedStart = isUserSchedule
        ? new Date(schedule.start.getTime() - 21600000)  // 6시간 빼기
        : schedule.start;

      if (isUserSchedule) {
        console.log(`✅ User schedule found: ${schedule.title}, attendees:`, attendees);
      }

      return {
        id: schedule.id,
        title: schedule.title + timeText,
        originalTitle: schedule.title,  // 원본 제목 저장
        start: adjustedStart,  // 조정된 시작 시간 사용
        end: schedule.end,
        projectId: project?.id || '',
        projectName: displayProjectName || '',
        type: (schedule.type as ScheduleEvent['type']) || 'other',
        phase: '',
        assignedTo: attendees,
        priority: 'medium',
        allDay: !scheduleTime || scheduleTime === '-',
        color: getProjectColor(schedule.project || ''),
        isASVisit: false,
        time: scheduleTime,
        description: schedule.description
      };
    });

  // AS 방문 예정일을 캘린더 이벤트로 변환
  const asVisitEvents: ScheduleEvent[] = asRequests
    .filter(req => req.scheduledVisitDate) // 방문예정일이 있는 AS 요청만
    .filter(req => {
      // 안팀 사용자는 담당 프로젝트의 AS 요청만 보기
      if (user?.name === '안팀') {
        return filteredProjectNames.includes(req.project);
      }
      return true;
    })
    .map(req => {
      const visitTime = req.scheduledVisitTime;
      const timeText = (visitTime && visitTime !== '-') ? ` - ${formatTime(visitTime)}` : '';
      const asProject = projects.find(p => p.name === req.project);
      const originalASTitle = `[AS] ${req.project}`;
      return {
        id: `as-${req.id}`,
        title: originalASTitle + timeText,
        originalTitle: originalASTitle,  // 원본 제목 저장
        start: req.scheduledVisitDate!,
        end: req.scheduledVisitDate!,
        projectId: asProject?.id || '',
        projectName: req.project,
        type: 'as_visit' as const,
        phase: '',
        assignedTo: req.assignedTo
          ? (Array.isArray(req.assignedTo)
              ? req.assignedTo
              : req.assignedTo.split(',').map(s => s.trim()))
          : [],
        priority: 'high' as const,
        allDay: !visitTime || visitTime === '-',
        color: '#FEF3C7', // 연한 노란색 배경
        isASVisit: true,
        time: visitTime,
        description: req.description
      };
    });

  // 수금 일정을 캘린더 이벤트로 변환 (manager만 볼 수 있음)
  const expectedPaymentEvents: ScheduleEvent[] = user?.role === 'manager'
    ? constructionPayments.flatMap(cp => {
        const project = projects.find(p => p.name === cp.project);
        if (!project) {
          // 프로젝트가 없으면 프로젝트 정보 없이도 표시
          const events: ScheduleEvent[] = [];
          const totalContractAmount = cp.totalAmount + (
            cp.vatType === 'percentage'
              ? cp.totalAmount * (cp.vatPercentage / 100)
              : cp.vatAmount
          );

          // 이미 수령한 타입들
          const receivedTypes = new Set(
            cp.payments.flatMap(p => p.type?.split(', ').map(t => t.trim()) || [])
          );

          // 계약금
          if (!receivedTypes.has('계약금') && cp.expectedPaymentDates?.contract) {
            events.push({
              id: `payment-${cp.id}-contract`,
              title: `[수금일정] 계약금`,
              originalTitle: `[수금일정] 계약금`,
              start: new Date(cp.expectedPaymentDates.contract),
              end: new Date(cp.expectedPaymentDates.contract),
              projectId: '',
              projectName: cp.project,
              type: 'expected_payment' as const,
              phase: '',
              assignedTo: [],
              priority: 'medium' as const,
              allDay: true,
              color: '#DBEAFE',
              isExpectedPayment: true,
              description: `계약금 (10%): ${Math.round(totalContractAmount * 0.1).toLocaleString()}원`
            });
          }

          // 착수금
          if (!receivedTypes.has('착수금') && cp.expectedPaymentDates?.start) {
            events.push({
              id: `payment-${cp.id}-start`,
              title: `[수금일정] 착수금`,
              originalTitle: `[수금일정] 착수금`,
              start: new Date(cp.expectedPaymentDates.start),
              end: new Date(cp.expectedPaymentDates.start),
              projectId: '',
              projectName: cp.project,
              type: 'expected_payment' as const,
              phase: '',
              assignedTo: [],
              priority: 'medium' as const,
              allDay: true,
              color: '#DBEAFE',
              isExpectedPayment: true,
              description: `착수금 (40%): ${Math.round(totalContractAmount * 0.4).toLocaleString()}원`
            });
          }

          // 중도금
          if (!receivedTypes.has('중도금') && cp.expectedPaymentDates?.middle) {
            events.push({
              id: `payment-${cp.id}-middle`,
              title: `[수금일정] 중도금`,
              originalTitle: `[수금일정] 중도금`,
              start: new Date(cp.expectedPaymentDates.middle),
              end: new Date(cp.expectedPaymentDates.middle),
              projectId: '',
              projectName: cp.project,
              type: 'expected_payment' as const,
              phase: '',
              assignedTo: [],
              priority: 'medium' as const,
              allDay: true,
              color: '#DBEAFE',
              isExpectedPayment: true,
              description: `중도금 (40%): ${Math.round(totalContractAmount * 0.4).toLocaleString()}원`
            });
          }

          // 잔금
          if (!receivedTypes.has('잔금') && cp.expectedPaymentDates?.final) {
            events.push({
              id: `payment-${cp.id}-final`,
              title: `[수금일정] 잔금`,
              originalTitle: `[수금일정] 잔금`,
              start: new Date(cp.expectedPaymentDates.final),
              end: new Date(cp.expectedPaymentDates.final),
              projectId: '',
              projectName: cp.project,
              type: 'expected_payment' as const,
              phase: '',
              assignedTo: [],
              priority: 'medium' as const,
              allDay: true,
              color: '#DBEAFE',
              isExpectedPayment: true,
              description: `잔금 (10%): ${Math.round(totalContractAmount * 0.1).toLocaleString()}원`
            });
          }

          return events;
        }

        if (!project.startDate || !project.endDate) {
          return [];
        }

        // 계약 금액 + 부가세
        const totalContractAmount = cp.totalAmount + (
          cp.vatType === 'percentage'
            ? cp.totalAmount * (cp.vatPercentage / 100)
            : cp.vatAmount
        );

        // 이미 수령한 타입들
        const receivedTypes = new Set(
          cp.payments.flatMap(p => p.type?.split(', ').map(t => t.trim()) || [])
        );

        const events: ScheduleEvent[] = [];

        // 계약금
        if (!receivedTypes.has('계약금') && cp.expectedPaymentDates?.contract) {
          events.push({
            id: `payment-${cp.id}-contract`,
            title: `[수금일정] 계약금`,
            originalTitle: `[수금일정] 계약금`,
            start: new Date(cp.expectedPaymentDates.contract),
            end: new Date(cp.expectedPaymentDates.contract),
            projectId: project.id || '',
            projectName: cp.project,
            type: 'expected_payment' as const,
            phase: '',
            assignedTo: [],
            priority: 'medium' as const,
            allDay: true,
            color: '#DBEAFE',
            isExpectedPayment: true,
            description: `계약금 (10%): ${Math.round(totalContractAmount * 0.1).toLocaleString()}원`
          });
        }

        // 착수금
        if (!receivedTypes.has('착수금') && cp.expectedPaymentDates?.start) {
          events.push({
            id: `payment-${cp.id}-start`,
            title: `[수금일정] 착수금`,
            originalTitle: `[수금일정] 착수금`,
            start: new Date(cp.expectedPaymentDates.start),
            end: new Date(cp.expectedPaymentDates.start),
            projectId: project.id || '',
            projectName: cp.project,
            type: 'expected_payment' as const,
            phase: '',
            assignedTo: [],
            priority: 'medium' as const,
            allDay: true,
            color: '#DBEAFE',
            isExpectedPayment: true,
            description: `착수금 (40%): ${Math.round(totalContractAmount * 0.4).toLocaleString()}원`
          });
        }

        // 중도금
        if (!receivedTypes.has('중도금') && cp.expectedPaymentDates?.middle) {
          events.push({
            id: `payment-${cp.id}-middle`,
            title: `[수금일정] 중도금`,
            originalTitle: `[수금일정] 중도금`,
            start: new Date(cp.expectedPaymentDates.middle),
            end: new Date(cp.expectedPaymentDates.middle),
            projectId: project.id || '',
            projectName: cp.project,
            type: 'expected_payment' as const,
            phase: '',
            assignedTo: [],
            priority: 'medium' as const,
            allDay: true,
            color: '#DBEAFE',
            isExpectedPayment: true,
            description: `중도금 (40%): ${Math.round(totalContractAmount * 0.4).toLocaleString()}원`
          });
        }

        // 잔금
        if (!receivedTypes.has('잔금') && cp.expectedPaymentDates?.final) {
          events.push({
            id: `payment-${cp.id}-final`,
            title: `[수금일정] 잔금`,
            originalTitle: `[수금일정] 잔금`,
            start: new Date(cp.expectedPaymentDates.final),
            end: new Date(cp.expectedPaymentDates.final),
            projectId: project.id || '',
            projectName: cp.project,
            type: 'expected_payment' as const,
            phase: '',
            assignedTo: [],
            priority: 'medium' as const,
            allDay: true,
            color: '#DBEAFE',
            isExpectedPayment: true,
            description: `잔금 (10%): ${Math.round(totalContractAmount * 0.1).toLocaleString()}원`
          });
        }

        return events;
      })
    : [];

  // 모든 이벤트 합치기
  const allEvents = [...scheduleEvents, ...asVisitEvents, ...expectedPaymentEvents];

  // 같은 날, 같은 프로젝트의 일정을 그룹화하는 함수
  const groupEventsByProjectAndDate = (events: ScheduleEvent[]): ScheduleEvent[] => {
    const grouped = new Map<string, ScheduleEvent[]>();

    events.forEach(event => {
      // AS 방문과 수금 일정은 그룹화하지 않음
      if (event.isASVisit || event.isExpectedPayment) {
        const key = `single_${event.id}`;
        grouped.set(key, [event]);
      } else {
        // 일반 일정은 날짜, 프로젝트, 담당자로 그룹화
        const dateKey = event.start.toISOString().split('T')[0];
        // 담당자 배열을 정렬해서 문자열로 변환 (순서 무관하게 같은 사람들이면 같은 키가 되도록)
        const assigneesKey = [...event.assignedTo].sort().join(',');
        const groupKey = `${dateKey}_${event.projectName}_${assigneesKey}`;

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey)!.push(event);
      }
    });

    // 그룹화된 이벤트를 최종 이벤트로 변환
    const finalEvents: ScheduleEvent[] = [];

    grouped.forEach((groupEvents) => {
      if (groupEvents.length === 1) {
        // 단일 이벤트는 그대로 추가
        finalEvents.push(groupEvents[0]);
      } else {
        // 여러 이벤트를 하나로 병합
        const firstEvent = groupEvents[0];
        const titles = groupEvents.map(e => e.originalTitle || e.title);
        const uniqueTitles = [...new Set(titles)]; // 중복 제거

        // 시간 정보가 있는 이벤트들의 시간 수집
        const times = groupEvents
          .filter(e => e.time && e.time !== '-')
          .map(e => e.time);
        const timeText = times.length > 0 ? ` - ${times.join(', ')}` : '';

        // 모든 공정명을 표시 (프로젝트명 제거)
        const processNames = groupEvents.map(event => {
          const title = event.originalTitle || event.title;
          // 이미 프로젝트명이 포함된 경우 제거
          if (title.startsWith(firstEvent.projectName + ' - ')) {
            return title.substring(firstEvent.projectName.length + 3); // "프로젝트명 - " 부분 제거
          }
          return title;
        });

        // 중복 제거
        const uniqueProcessNames = [...new Set(processNames)];

        const mergedEvent: ScheduleEvent = {
          ...firstEvent,
          id: groupEvents[0].id, // 첫 번째 이벤트의 ID 사용
          title: `${uniqueProcessNames.join(', ')}${timeText}`,
          originalTitle: uniqueTitles.join(', '),
          description: groupEvents.map(e => e.description || e.originalTitle || e.title).join('\n'),
          assignedTo: [...new Set(groupEvents.flatMap(e => e.assignedTo))], // 중복 제거된 담당자
          mergedEventIds: groupEvents.map(e => e.id), // 병합된 이벤트 ID들 저장
        };

        finalEvents.push(mergedEvent);
      }
    });

    // 시간순 정렬 (사용자 일정은 이미 scheduleEvents에서 시간이 조정됨)
    return finalEvents.sort((a, b) => {
      return a.start.getTime() - b.start.getTime();
    });
  };

  // 그룹화 적용
  const events = groupEventsByProjectAndDate(allEvents);

  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  // 안팀 사용자는 기본적으로 첫 번째 프로젝트를 선택, 다른 사용자는 'all'
  const [filterProject, setFilterProject] = useState<string>(() => {
    if (user?.name === '안팀' && projects.length > 0) {
      return projects[0].name;
    }
    return 'all';
  });
  // 모바일에서는 오늘 날짜를 기본 선택
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    window.innerWidth < 768 ? new Date() : null
  );

  // 필터링된 이벤트를 먼저 정의 (useEffect보다 먼저 와야 함)
  // 이미 groupEventsByProjectAndDate에서 사용자 일정의 시간을 조정했으므로 여기서는 필터링만
  const filteredEventsRaw = (filterProject === 'all'
    ? events
    : events.filter(e => e.projectName === filterProject));

  // 각 날짜별로 로그인한 사용자의 일정을 최상단에 배치
  const filteredEvents = React.useMemo(() => {
    return [...filteredEventsRaw].sort((a, b) => {
      // 먼저 날짜순 정렬
      const dateA = moment(a.start).startOf('day').valueOf();
      const dateB = moment(b.start).startOf('day').valueOf();
      if (dateA !== dateB) return dateA - dateB;

      // 같은 날짜 내에서 사용자 일정 우선 (본인 이름이 직접 포함된 경우만)
      const aHasUser = (a.assignedTo && userNameWithoutSurname && a.assignedTo.includes(userNameWithoutSurname)) ||
        (a.assignedTo && user?.name && a.assignedTo.includes(user.name));

      const bHasUser = (b.assignedTo && userNameWithoutSurname && b.assignedTo.includes(userNameWithoutSurname)) ||
        (b.assignedTo && user?.name && b.assignedTo.includes(user.name));

      // 사용자 일정을 먼저
      if (aHasUser && !bHasUser) return -1;
      if (!aHasUser && bHasUser) return 1;

      // 같은 우선순위면 시간순
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [filteredEventsRaw, user, userNameWithoutSurname]);

  // 안팀 사용자의 경우 프로젝트 목록이 변경되면 필터 업데이트
  useEffect(() => {
    if (user?.name === '안팀' && projects.length > 0) {
      // 현재 선택된 프로젝트가 유효하지 않으면 첫 번째 프로젝트로 변경
      if (filterProject === 'all' || !projects.find(p => p.name === filterProject)) {
        setFilterProject(projects[0].name);
      }
    }
  }, [projects, user]);

  // 더보기 버튼과 팝업 오버레이 강제 숨김
  useEffect(() => {
    const hideShowMoreAndOverlays = () => {
      // 더보기 버튼 숨기기
      const showMoreButtons = document.querySelectorAll('.rbc-show-more, .rbc-button-link');
      showMoreButtons.forEach(button => {
        (button as HTMLElement).style.display = 'none';
        (button as HTMLElement).style.visibility = 'hidden';
        (button as HTMLElement).style.pointerEvents = 'none';
      });

      // 팝업 오버레이 숨기기
      const overlays = document.querySelectorAll('.rbc-overlay, .rbc-overlay-header, .rbc-popup, [class*="rbc-overlay"]');
      overlays.forEach(overlay => {
        (overlay as HTMLElement).style.display = 'none';
        (overlay as HTMLElement).style.visibility = 'hidden';
        (overlay as HTMLElement).style.opacity = '0';
        (overlay as HTMLElement).style.pointerEvents = 'none';
        (overlay as HTMLElement).style.position = 'absolute';
        (overlay as HTMLElement).style.left = '-9999px';
        (overlay as HTMLElement).style.top = '-9999px';
        (overlay as HTMLElement).style.zIndex = '-1';
      });
    };

    // 초기 실행
    hideShowMoreAndOverlays();

    // DOM 변경 감지
    const observer = new MutationObserver(hideShowMoreAndOverlays);
    const calendarContainer = document.querySelector('.rbc-calendar');

    if (calendarContainer) {
      observer.observe(calendarContainer, {
        childList: true,
        subtree: true
      });
    }

    // body에도 옵저버 추가 (오버레이가 body 직접 자식으로 추가될 수 있음)
    const bodyObserver = new MutationObserver(hideShowMoreAndOverlays);
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      bodyObserver.disconnect();
    };
  }, [view, date]);

  // 인라인 입력 상태
  const [inlineEdit, setInlineEdit] = useState<{
    date: Date | null;
    projectId: string;
    title: string;
  }>({
    date: null,
    projectId: '',
    title: ''
  });

  // 이벤트 클릭 플래그 - onSelectSlot과의 충돌 방지
  const eventClickedRef = React.useRef(false);
  const eventClickTimerRef = React.useRef<number | null>(null);

  // 이벤트 클릭 - 모바일/데스크톱 모두 모달 열기
  const onSelectEvent = (event: ScheduleEvent) => {
    // 이벤트가 클릭되었음을 표시 (onSelectSlot보다 먼저 실행됨)
    eventClickedRef.current = true;

    // 이전 타이머가 있으면 클리어
    if (eventClickTimerRef.current) {
      clearTimeout(eventClickTimerRef.current);
    }

    // 빈 슬롯 정보 초기화하고 이벤트 설정
    // 원본 제목을 사용하도록 event 객체 수정
    const eventForModal = {
      ...event,
      title: event.originalTitle || event.title  // 원본 제목이 있으면 사용
    };

    setSelectedSlot(null);
    setSelectedEvent(eventForModal);
    setShowModal(true);

    // 충분한 시간 후 플래그 리셋 (1500ms로 증가 - 태블릿 대응 강화)
    eventClickTimerRef.current = setTimeout(() => {
      eventClickedRef.current = false;
      eventClickTimerRef.current = null;
    }, 1500);
  };

  // 빈 슬롯 선택 (날짜 선택)
  const onSelectSlot = (slotInfo: { start: Date; end: Date; action: string }) => {
    // 이벤트가 방금 클릭되었다면 슬롯 선택 무시
    if (eventClickedRef.current) {
      return;
    }

    const windowWidth = window.innerWidth;
    const isMobile = windowWidth < 768;
    const isTablet = windowWidth >= 768 && windowWidth < 1024;

    // 모바일에서는 날짜 선택 처리
    if (isMobile) {
      // slotInfo.start가 존재하면 날짜 선택으로 처리
      if (slotInfo.start) {
        setSelectedDate(slotInfo.start);

        // 하단 일정 목록으로 즉시 스크롤
        const scheduleSection = document.querySelector('.md\\:hidden.mt-3.bg-white');
        if (scheduleSection) {
          scheduleSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      return;
    }

    // 태블릿에서 box 선택(드래그)이 아닌 단순 클릭인지 확인
    const isSimpleClick = slotInfo.action === 'click' || slotInfo.action === 'select';

    if (isTablet && !isSimpleClick) {
      // 태블릿에서 드래그 선택인 경우에만 새 일정 추가 모달 열기
      return;
    } else if (!isMobile) {
      // 데스크톱 & 태블릿 단순 클릭: 모달 열기
      setSelectedSlot(slotInfo);
      setSelectedEvent(null);
      setShowModal(true);
    }
  };

  // 인라인 입력 저장
  const handleInlineSave = async () => {
    if (!inlineEdit.projectId || !inlineEdit.title.trim()) {
      alert('프로젝트와 제목을 입력하세요');
      return;
    }

    const selectedProject = projects.find(p => p.id === inlineEdit.projectId);
    if (!selectedProject || !inlineEdit.date) return;

    try {
      await addScheduleToAPI({
        id: Date.now().toString(),
        title: inlineEdit.title,
        start: inlineEdit.date,
        end: inlineEdit.date,
        type: 'other',
        project: selectedProject.name,
        location: '',
        attendees: [],
        description: ''
      });

      setInlineEdit({ date: null, projectId: '', title: '' });
      setSelectedDate(null);
      toast.success('일정이 추가되었습니다');
    } catch (error) {
      console.error('Failed to add schedule:', error);
      toast.error('일정 추가에 실패했습니다');
    }
  };

  // 커스텀 이벤트 스타일 (프로젝트별 색상 적용)
  const eventStyleGetter = (event: ScheduleEvent) => {
    let bgColor = event.color || '#E0E7FF'; // 연한 인디고/보라색 (기본값)
    let textColor = '#1f2937';

    // AS 방문 일정은 녹색 배경
    if (event.isASVisit) {
      bgColor = '#E8F5E9';
      textColor = '#1f2937';
    } else {
      // 로그인한 사용자가 담당자에 포함된 일정은 노란색
      // 팀 담당자인 경우 해당 팀원들에게 노란색으로 표시
      const isHVLabAssigned = event.assignedTo && event.assignedTo.includes('HV LAB');
      const isFieldTeamAssigned = event.assignedTo && event.assignedTo.includes('현장팀') &&
        userNameWithoutSurname && ['재천', '민기'].includes(userNameWithoutSurname);
      const isDesignTeamAssigned = event.assignedTo && event.assignedTo.includes('디자인팀') &&
        userNameWithoutSurname && ['신애', '재성', '재현'].includes(userNameWithoutSurname);
      const isUserAssigned = event.assignedTo && event.assignedTo.includes(user?.name || '');

      if (isUserAssigned || isHVLabAssigned || isFieldTeamAssigned || isDesignTeamAssigned) {
        bgColor = '#FEF3C7';
        textColor = '#1f2937';
      } else if (!event.color) {
        // 프로젝트가 없고 내 이름이 포함되지 않은 일정은 연한 보라색
        bgColor = '#e8e2ea';
      }
    }

    return {
      style: {
        backgroundColor: bgColor,
        '--event-bg-color': bgColor,
        borderRadius: '6px',
        color: textColor,
        border: 'none',
        display: 'block',
        fontSize: '0.8125rem',
        padding: '4px 8px',
        fontWeight: '500',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      } as React.CSSProperties
    };
  };

  // 날짜 셀 스타일 (선택된 날짜 표시 및 공휴일)
  const dayPropGetter = React.useCallback((date: Date) => {
    const dateKey = moment(date).format('YYYY-MM-DD');
    const isHoliday = !!holidays[dateKey];
    const isSelected = selectedDate && moment(date).isSame(selectedDate, 'day');

    let className = '';
    if (isSelected) className += 'selected-date ';
    if (isHoliday) className += 'holiday-date ';

    return {
      className: className.trim(),
      style: {}
    };
  }, [selectedDate]);

  // 모바일 감지 state 추가
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 헤더 + 버튼 클릭 이벤트 리스너 (모바일용)
  useEffect(() => {
    const handleHeaderAddClick = () => {
      // 선택된 날짜가 있으면 그 날짜로, 없으면 오늘 날짜로 일정 추가
      const targetDate = selectedDate || new Date();
      setSelectedSlot({ start: targetDate, end: targetDate });
      setSelectedEvent(null);
      setShowModal(true);
    };

    window.addEventListener('headerAddButtonClick', handleHeaderAddClick);
    return () => window.removeEventListener('headerAddButtonClick', handleHeaderAddClick);
  }, [selectedDate]);

  // 커스텀 날짜 헤더 래퍼 컴포넌트 (props 전달용)
  const CustomDateHeaderWrapper = React.useCallback(({ date, label }: { date: Date; label: string }) => {
    return (
      <CustomDateHeader
        date={date}
        label={label}
        filteredEvents={filteredEvents}
        selectedDate={selectedDate}
        user={user}
        isMobileView={isMobileView}
      />
    );
  }, [filteredEvents, selectedDate, user, isMobileView]);

  // 커스텀 이벤트 래퍼 컴포넌트 (props 전달용)
  const CustomEventWrapper = React.useCallback(({ event }: { event: ScheduleEvent }) => {
    return <CustomEvent event={event} user={user} />;
  }, [user]);

  // 커스텀 툴바
  const CustomToolbar = ({ onNavigate }: { onNavigate: (action: string) => void }) => {
    const [showMonthPicker, setShowMonthPicker] = React.useState(false);
    const [tempYear, setTempYear] = React.useState(moment(date).year());
    const [tempMonth, setTempMonth] = React.useState(moment(date).month());
    const isMobile = window.innerWidth < 768;

    // 모달이 열릴 때 현재 날짜로 임시 상태 초기화
    const handleOpenMonthPicker = () => {
      setTempYear(moment(date).year());
      setTempMonth(moment(date).month());
      setShowMonthPicker(true);
    };

    // 확인 버튼 클릭 시 실제 날짜 변경
    const handleConfirm = () => {
      setDate(moment().year(tempYear).month(tempMonth).toDate());
      setShowMonthPicker(false);
    };

    return (
      <>
        <div className={`flex flex-col bg-white border-b border-gray-200 ${isMobile ? 'px-2 py-1' : 'px-3 md:px-5 py-2'}`}>
          {/* 첫 번째 행: 날짜 네비게이션과 프로젝트 필터 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onNavigate('PREV')}
                className="px-2 py-1.5 text-2xl md:text-3xl text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-bold"
              >
                ‹
              </button>
              <div
                className="text-base md:text-lg font-bold text-gray-900 hover:bg-gray-50 px-2 md:px-3 py-1 rounded-lg transition-colors cursor-pointer"
                onClick={handleOpenMonthPicker}
              >
                <span>{moment(date).format('YYYY년 MM월')}</span>
              </div>
              <button
                onClick={() => onNavigate('NEXT')}
                className="px-2 py-1.5 text-2xl md:text-3xl text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-bold"
              >
                ›
              </button>
            </div>

            {/* 프로젝트 필터 */}
            <select
              className="px-3 md:px-4 py-1.5 md:py-2 bg-white text-gray-700 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 border border-gray-300"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              style={{
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '1.25rem',
                paddingRight: '2.5rem'
              }}
            >
              {/* 안팀 사용자는 전체 프로젝트 옵션을 보지 못함 */}
              {user?.name !== '안팀' && <option value="all">전체 프로젝트</option>}
              {projects
                .filter(project => project.status !== 'completed')
                .map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* 커스텀 월 선택 모달 */}
        {showMonthPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-sm shadow-xl">
              {/* 헤더 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">월 선택</h3>
                <button
                  onClick={() => setShowMonthPicker(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 연도 선택 */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setTempYear(tempYear - 1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xl font-bold text-gray-900">
                    {tempYear}년
                  </span>
                  <button
                    onClick={() => setTempYear(tempYear + 1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 월 그리드 */}
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                    const isSelectedMonth = tempMonth === month - 1;
                    const isToday = moment().year() === tempYear && moment().month() === month - 1;
                    return (
                      <button
                        key={month}
                        onClick={() => setTempMonth(month - 1)}
                        className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                          isSelectedMonth
                            ? 'bg-gray-900 text-white'
                            : isToday
                            ? 'bg-gray-100 text-gray-900 border-2 border-gray-900'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {month}월
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 하단 버튼 */}
              <div className="p-4 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => {
                    setDate(new Date());
                    setShowMonthPicker(false);
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  오늘
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // 더보기 버튼을 렌더링하지 않는 커스텀 컴포넌트
  const CustomShowMore = () => null;

  // Calendar 컴포넌트에 전달할 components prop을 메모이제이션
  const calendarComponents = useMemo(() => ({
    toolbar: CustomToolbar,
    event: CustomEventWrapper,
    month: {
      dateHeader: CustomDateHeaderWrapper,
      showMore: CustomShowMore
    }
  }), [CustomDateHeaderWrapper, CustomEventWrapper]);

  // 선택된 날짜의 일정 필터링 및 정렬 (모바일: 당일만, 태블릿: 주 단위)
  const selectedDateEvents = React.useMemo(() => {
    if (!selectedDate) return [];

    let filtered;

    if (isMobileView) {
      // 모바일: 선택한 날짜의 일정만 표시
      filtered = filteredEvents.filter(event => {
        const eventDate = moment(event.start);
        return eventDate.isSame(selectedDate, 'day');
      });
    } else {
      // 태블릿/데스크톱: 선택된 날짜가 속한 주의 시작일과 종료일 계산
      const weekStart = moment(selectedDate).startOf('week'); // 일요일
      const weekEnd = moment(selectedDate).endOf('week'); // 토요일

      filtered = filteredEvents.filter(event => {
        const eventDate = moment(event.start);
        return eventDate.isSameOrAfter(weekStart, 'day') && eventDate.isSameOrBefore(weekEnd, 'day');
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      // 사용자 할당 여부 확인
      const aHasHVLab = a.assignedTo && a.assignedTo.includes('HV LAB');
      const aHasFieldTeam = a.assignedTo && a.assignedTo.includes('현장팀') &&
        userNameWithoutSurname && ['재천', '민기'].includes(userNameWithoutSurname);
      const aHasDesignTeam = a.assignedTo && a.assignedTo.includes('디자인팀') &&
        userNameWithoutSurname && ['신애', '재성', '재현'].includes(userNameWithoutSurname);
      const aHasUser = (a.assignedTo && userNameWithoutSurname && a.assignedTo.includes(userNameWithoutSurname)) ||
        (a.assignedTo && user?.name && a.assignedTo.includes(user.name)) ||
        aHasHVLab || aHasFieldTeam || aHasDesignTeam;

      const bHasHVLab = b.assignedTo && b.assignedTo.includes('HV LAB');
      const bHasFieldTeam = b.assignedTo && b.assignedTo.includes('현장팀') &&
        userNameWithoutSurname && ['재천', '민기'].includes(userNameWithoutSurname);
      const bHasDesignTeam = b.assignedTo && b.assignedTo.includes('디자인팀') &&
        userNameWithoutSurname && ['신애', '재성', '재현'].includes(userNameWithoutSurname);
      const bHasUser = (b.assignedTo && userNameWithoutSurname && b.assignedTo.includes(userNameWithoutSurname)) ||
        (b.assignedTo && user?.name && b.assignedTo.includes(user.name)) ||
        bHasHVLab || bHasFieldTeam || bHasDesignTeam;

      // 사용자 일정을 먼저 표시 (우선순위 1)
      if (aHasUser && !bHasUser) return -1;
      if (!aHasUser && bHasUser) return 1;

      // 둘 다 사용자 일정이거나, 둘 다 아닌 경우 시간순 (우선순위 2)
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    console.log('Sorted events:', sorted.map(e => ({
      title: e.title,
      assignedTo: e.assignedTo,
      user: user?.name,
      userShort: userNameWithoutSurname
    })));

    return sorted;
  }, [selectedDate, filteredEvents, user, userNameWithoutSurname, isMobileView]);

  // 날짜 셀에 일정 개수 data attribute 추가 및 선택된 날짜 스타일 적용
  useEffect(() => {
    const updateDateCellsWithEventCount = () => {
      // 모바일에서는 날짜 셀(td) 전체를 찾고, 데스크톱에서는 date-cell 클래스를 찾음
      const dateCells = isMobileView
        ? document.querySelectorAll('.rbc-month-view td.rbc-date-cell')
        : document.querySelectorAll('.rbc-date-cell');

      // 주별 최대 일정 개수 계산
      const monthRows = document.querySelectorAll('.rbc-month-row');
      const weekMaxEvents: number[] = [];

      monthRows.forEach((row, weekIndex) => {
        const cellsInWeek = row.querySelectorAll('.rbc-date-cell');
        let maxEventsInWeek = 0;

        cellsInWeek.forEach((cell) => {
          const dateButton = cell.querySelector('button');
          let dateText = dateButton?.textContent;
          if (!dateText) {
            const dateSpan = cell.querySelector('span');
            dateText = dateSpan?.textContent;
          }

          if (dateText && !isNaN(parseInt(dateText))) {
            const cellDate = moment(date).date(parseInt(dateText));
            const eventsOnDate = filteredEvents.filter(event =>
              moment(event.start).isSame(cellDate, 'day')
            );
            maxEventsInWeek = Math.max(maxEventsInWeek, eventsOnDate.length);
          }
        });

        weekMaxEvents.push(maxEventsInWeek);
      });

      // 동적 높이 계산 및 적용
      const baseHeight = 100; // 기본 높이
      const eventHeight = 18; // 일정 하나당 높이
      const dateHeaderHeight = 25; // 날짜 숫자 영역
      const maxEventsPerRow = Math.floor((baseHeight - dateHeaderHeight) / eventHeight); // 약 4개

      const totalWeeks = weekMaxEvents.length;
      const totalAvailableHeight = baseHeight * totalWeeks;

      // 각 주의 필요 높이 계산
      const requiredHeights = weekMaxEvents.map(count => {
        if (count <= maxEventsPerRow) {
          return baseHeight;
        }
        return dateHeaderHeight + (count * eventHeight) + 10; // 여유 공간 10px
      });

      const totalRequiredHeight = requiredHeights.reduce((sum, h) => sum + h, 0);

      // 전체 높이를 유지하면서 재분배
      if (totalRequiredHeight > totalAvailableHeight) {
        // 넘치는 주들의 필요 높이를 보장하고, 나머지 주들을 줄임
        const overflowWeeks = requiredHeights.map((h, i) => ({ index: i, height: h, overflow: h > baseHeight }));
        const overflowHeight = overflowWeeks.filter(w => w.overflow).reduce((sum, w) => sum + (w.height - baseHeight), 0);
        const normalWeeks = overflowWeeks.filter(w => !w.overflow);

        if (normalWeeks.length > 0) {
          const remainingHeight = totalAvailableHeight - overflowHeight - (normalWeeks.length * baseHeight);
          const adjustedBaseHeight = Math.max(50, baseHeight + (remainingHeight / normalWeeks.length));

          monthRows.forEach((row, index) => {
            const isOverflow = requiredHeights[index] > baseHeight;
            const newHeight = isOverflow ? requiredHeights[index] : adjustedBaseHeight;
            (row as HTMLElement).style.height = `${newHeight}px`;
            (row as HTMLElement).style.minHeight = `${newHeight}px`;
          });
        } else {
          // 모든 주가 넘치는 경우, 비율대로 재분배
          const heightRatio = totalAvailableHeight / totalRequiredHeight;
          monthRows.forEach((row, index) => {
            const newHeight = Math.max(80, requiredHeights[index] * heightRatio);
            (row as HTMLElement).style.height = `${newHeight}px`;
            (row as HTMLElement).style.minHeight = `${newHeight}px`;
          });
        }
      } else {
        // 전체가 넘치지 않으면 필요한 높이만 할당하고 나머지 균등 분배
        const usedHeight = requiredHeights.reduce((sum, h) => sum + (h > baseHeight ? h : 0), 0);
        const normalWeeksCount = requiredHeights.filter(h => h <= baseHeight).length;
        const remainingHeight = totalAvailableHeight - usedHeight;
        const normalWeekHeight = normalWeeksCount > 0 ? remainingHeight / normalWeeksCount : baseHeight;

        monthRows.forEach((row, index) => {
          const newHeight = requiredHeights[index] > baseHeight ? requiredHeights[index] : normalWeekHeight;
          (row as HTMLElement).style.height = `${newHeight}px`;
          (row as HTMLElement).style.minHeight = `${newHeight}px`;
        });
      }

      dateCells.forEach((cell) => {
        // 날짜 버튼 찾기
        const dateButton = cell.querySelector('button');

        // 날짜 텍스트 추출 (버튼이 없으면 셀 텍스트에서 직접 추출)
        let dateText = dateButton?.textContent;
        if (!dateText) {
          // CustomDateHeader에서 날짜 추출 시도
          const dateSpan = cell.querySelector('span');
          dateText = dateSpan?.textContent;
        }

        if (!dateText || isNaN(parseInt(dateText))) return;

        // 현재 보이는 달의 날짜 계산
        const cellDate = moment(date).date(parseInt(dateText));

        // 해당 날짜의 일정 개수 계산
        const eventsOnDate = filteredEvents.filter(event =>
          moment(event.start).isSame(cellDate, 'day')
        );

        // data attribute 설정
        if (eventsOnDate.length > 0) {
          cell.setAttribute('data-event-count', eventsOnDate.length.toString());
        } else {
          cell.removeAttribute('data-event-count');
        }

        // 선택된 날짜에 클래스 추가 (모바일/데스크톱 모두)
        const clickDate = cellDate.clone().toDate();
        if (selectedDate && moment(clickDate).isSame(selectedDate, 'day')) {
          cell.classList.add('selected-date');
        } else {
          cell.classList.remove('selected-date');
        }

        // 모바일에서 셀 전체에 클릭 이벤트 추가
        if (isMobileView) {
          // 기존 이벤트 리스너 제거 (중복 방지)
          const cellWithHandler = cell as HTMLElement & { _mobileClickHandler?: (e: Event) => void };
          const existingHandler = cellWithHandler._mobileClickHandler;
          if (existingHandler) {
            cell.removeEventListener('click', existingHandler);
          }

          // 새 이벤트 리스너 추가
          const clickHandler = (e: Event) => {
            // 이벤트가 일정 클릭인지 확인
            const target = e.target as HTMLElement;
            if (target.closest('.rbc-event')) {
              return; // 일정 클릭은 처리하지 않음
            }

            const targetDate = cellDate.clone().toDate();

            // 날짜 선택 상태 즉시 업데이트
            setSelectedDate(targetDate);

            // 하단 일정 목록으로 즉시 스크롤
            const scheduleSection = document.querySelector('.md\\:hidden.mt-3.bg-white');
            if (scheduleSection) {
              scheduleSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          };

          // 이벤트 리스너 저장 (나중에 제거할 수 있도록)
          cellWithHandler._mobileClickHandler = clickHandler;

          // click 이벤트만 등록 (즉시 반응하도록)
          cell.addEventListener('click', clickHandler, true);

          // 셀 스타일 조정 (터치 가능하게)
          (cell as HTMLElement).style.cursor = 'pointer';
          (cell as HTMLElement).style.touchAction = 'manipulation';
        }
      });
    };

    // 초기 로드 및 이벤트/날짜 변경 시 업데이트
    const timer = setTimeout(updateDateCellsWithEventCount, 200);

    // cleanup: 모바일 이벤트 리스너 제거
    return () => {
      clearTimeout(timer);
      if (isMobileView) {
        const dateCells = document.querySelectorAll('.rbc-month-view td.rbc-date-cell');
        dateCells.forEach(cell => {
          const cellWithHandler = cell as Element & { _mobileClickHandler?: (e: Event) => void };
          const handler = cellWithHandler._mobileClickHandler;
          if (handler) {
            cell.removeEventListener('click', handler);
            delete cellWithHandler._mobileClickHandler;
          }
        });
      }
    };
  }, [filteredEvents, date, isMobileView, selectedDate]);

  return (
      <div className="schedule-container space-y-3 md:space-y-2">
        {/* 인라인 입력 폼 */}
        {inlineEdit.date && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
              <div className="text-xs md:text-sm font-semibold text-gray-900 md:min-w-[80px]">
                {moment(inlineEdit.date).format('MM월 DD일')}
              </div>
              <select
                value={inlineEdit.projectId}
                onChange={(e) => setInlineEdit({ ...inlineEdit, projectId: e.target.value })}
                className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {projects
                  .filter(project => project.status !== 'completed')
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={inlineEdit.title}
                onChange={(e) => setInlineEdit({ ...inlineEdit, title: e.target.value })}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleInlineSave();
                  }
                }}
                placeholder="일정 제목을 입력하세요..."
                className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleInlineSave}
                  className="flex-1 md:flex-none px-4 md:px-5 py-2 bg-gray-900 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setInlineEdit({ date: null, projectId: '', title: '' });
                    setSelectedDate(null);
                  }}
                  className="flex-1 md:flex-none px-4 md:px-5 py-2 bg-white border border-gray-300 text-gray-700 text-xs md:text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 캘린더 컨테이너 */}
        <div className="schedule-main flex flex-col md:block">
          <div className="schedule-calendar bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm calendar-container" style={{ paddingBottom: 0 }}>
            <Calendar
              key={`calendar-${selectedDate?.getTime() || 'no-selection'}`}
              localizer={localizer}
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onSelectEvent={onSelectEvent}
              onSelectSlot={onSelectSlot}
              selectable={true}
              longPressThreshold={0}
              eventPropGetter={eventStyleGetter}
              dayPropGetter={dayPropGetter}
              components={calendarComponents}
              popup={false}
              doShowMoreDrillDown={false}
              onShowMore={() => {}}
              showAllEvents={true}
              messages={{
                today: '오늘',
                previous: '이전',
                next: '다음',
                month: '월',
                week: '주',
                day: '일',
                agenda: '일정목록',
                date: '날짜',
                time: '시간',
                event: '일정',
                noEventsInRange: '이 기간에 일정이 없습니다',
                showMore: (count: number) => `+${count} 더보기`
              }}
            />
          </div>

          {/* 모바일/태블릿 하단 선택된 주 일정 표시 */}
          {selectedDate && (
            <div className="schedule-events-list desktop:hidden mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* 날짜 헤더 */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {isMobileView
                      ? moment(selectedDate).format('MM월 DD일 (ddd)')
                      : `${moment(selectedDate).startOf('week').format('MM월 DD일')} - ${moment(selectedDate).endOf('week').format('MM월 DD일')}`
                    }
                  </p>
                  {/* 공휴일 표시 */}
                  {holidays[moment(selectedDate).format('YYYY-MM-DD')] && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      {holidays[moment(selectedDate).format('YYYY-MM-DD')]}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 일정 목록 - 날짜별로 그룹핑 */}
              <div className="max-h-[35vh] overflow-y-auto">
                {selectedDateEvents.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-500">일정이 없습니다</p>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      // 날짜별로 그룹핑
                      const eventsByDate = selectedDateEvents.reduce((acc, event) => {
                        const dateKey = moment(event.start).format('YYYY-MM-DD');
                        if (!acc[dateKey]) {
                          acc[dateKey] = [];
                        }
                        acc[dateKey].push(event);
                        return acc;
                      }, {} as Record<string, typeof selectedDateEvents>);

                      // 날짜순으로 정렬
                      const sortedDates = Object.keys(eventsByDate).sort();

                      return sortedDates.map((dateKey) => (
                        <div key={dateKey} className="border-b border-gray-100 last:border-b-0">
                          {/* 날짜 헤더 - 주간 보기에서만 표시 (모바일 일간 보기에서는 상단에 이미 표시됨) */}
                          {!isMobileView && (
                            <div className="px-3 py-2 bg-gray-50 sticky top-0 z-10">
                              <p className="text-xs font-semibold text-gray-700">
                                {moment(dateKey).format('MM월 DD일 (ddd)')}
                              </p>
                            </div>
                          )}
                          {/* 해당 날짜의 일정들 */}
                          <div className="divide-y divide-gray-100">
                            {eventsByDate[dateKey].map((event) => {
                      // 로그인한 사용자가 담당자인지 확인
                      // 팀 담당자인 경우 해당 팀원들에게 노란색으로 표시
                      const isHVLabAssigned = event.assignedTo && event.assignedTo.includes('HV LAB');
                      const isFieldTeamAssigned = event.assignedTo && event.assignedTo.includes('현장팀') &&
                        userNameWithoutSurname && ['재천', '민기'].includes(userNameWithoutSurname);
                      const isDesignTeamAssigned = event.assignedTo && event.assignedTo.includes('디자인팀') &&
                        userNameWithoutSurname && ['신애', '재성', '재현'].includes(userNameWithoutSurname);
                      const isUserAssigned = event.assignedTo && (
                        event.assignedTo.includes(user?.name || '') ||
                        (userNameWithoutSurname && event.assignedTo.includes(userNameWithoutSurname))
                      );
                      const shouldHighlight = isUserAssigned || isHVLabAssigned || isFieldTeamAssigned || isDesignTeamAssigned;

                      // 프로젝트가 없고 사용자에게 할당되지 않은 경우
                      const isUnassignedNoProject = !event.color && !shouldHighlight;

                      return (
                        <div
                          key={event.id}
                          onClick={() => {
                            // 원본 제목을 사용하여 이벤트 선택
                            const eventWithOriginalTitle = {
                              ...event,
                              title: event.originalTitle || event.title
                            };
                            onSelectEvent(eventWithOriginalTitle);
                          }}
                          className={`p-3 transition-colors cursor-pointer ${
                            shouldHighlight
                              ? 'bg-yellow-50 hover:bg-yellow-100 active:bg-yellow-200'
                              : isUnassignedNoProject
                              ? 'hover:bg-purple-50 active:bg-purple-100'
                              : 'hover:bg-gray-50 active:bg-gray-100'
                          }`}
                          style={isUnassignedNoProject ? { backgroundColor: '#f3f0f5' } : undefined}
                        >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-1 h-full rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: shouldHighlight
                                ? '#FEF3C7'
                                : (event.color || '#e8e2ea'),
                              minHeight: '28px'
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {event.title}
                            </p>
                            {event.projectName && (
                              <p className="text-xs text-gray-600 mt-0.5">
                                {event.projectName}
                              </p>
                            )}
                            {event.assignedTo && event.assignedTo.length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {(() => {
                                  // 디자인팀 3명이 모두 포함되어 있으면 "디자인팀"으로 표시
                                  const designTeam = ['신애', '재성', '재현'];
                                  const hasAllDesignTeam = designTeam.every(member =>
                                    event.assignedTo.includes(member)
                                  );
                                  return hasAllDesignTeam ? '디자인팀' : event.assignedTo.join(', ');
                                })()}
                              </p>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showModal && (
          <ScheduleModal
            event={selectedEvent}
            slotInfo={selectedSlot}
            defaultProjectName={filterProject !== 'all' ? filterProject : undefined}
            onClose={() => {
              setShowModal(false);
              setSelectedEvent(null);
              setSelectedSlot(null);
            }}
            onSave={async (newEvent: Partial<ScheduleEvent>) => {
              console.log('📤 Schedule.tsx onSave called with newEvent:', newEvent);
              try {
                if (selectedEvent) {
                  // AS 방문 일정인지 확인 (ID가 'as-'로 시작하는 경우)
                  if (selectedEvent.id.startsWith('as-')) {
                    const asRequestId = selectedEvent.id.replace('as-', '');

                    // AS 요청 업데이트 - 제목과 담당자 변경
                    // assignedTo 처리: 배열을 문자열로 안전하게 변환
                    let assignedToStr = '';
                    if (newEvent.assignedTo && Array.isArray(newEvent.assignedTo) && newEvent.assignedTo.length > 0) {
                      assignedToStr = newEvent.assignedTo.join(', ');
                    } else if (selectedEvent.assignedTo && Array.isArray(selectedEvent.assignedTo)) {
                      assignedToStr = selectedEvent.assignedTo.join(', ');
                    } else if (typeof selectedEvent.assignedTo === 'string') {
                      assignedToStr = selectedEvent.assignedTo;
                    }

                    await updateASRequestInAPI(asRequestId, {
                      project: newEvent.title || selectedEvent.title, // 제목을 프로젝트명으로 사용
                      assignedTo: assignedToStr,
                      scheduledVisitDate: newEvent.start,
                      scheduledVisitTime: newEvent.time || selectedEvent.time
                    });

                    toast.success('AS 방문 일정이 수정되었습니다');
                    // AS 요청 다시 로드
                    await loadASRequestsFromAPI();
                    setShowModal(false);
                  }
                  // 수금 일정인지 확인 (ID가 'payment-'로 시작하는 경우)
                  else if (selectedEvent.id.startsWith('payment-')) {
                    // payment-{cpId}-{type} 형식에서 cpId와 type 추출
                    const parts = selectedEvent.id.split('-');
                    const cpId = parts[1];
                    const paymentType = parts[2]; // contract, start, middle, final

                    // constructionPayment 찾기
                    const cp = constructionPayments.find(cp => cp.id === cpId);
                    if (cp) {
                      // expectedPaymentDates 업데이트
                      const updatedDates = { ...cp.expectedPaymentDates };
                      updatedDates[paymentType as 'contract' | 'start' | 'middle' | 'final'] = newEvent.start;

                      await updateConstructionPaymentInAPI(cpId, {
                        expectedPaymentDates: updatedDates
                      });
                      toast.success('수금 일정이 수정되었습니다');
                    }
                  } else {
                    // 일반 일정 수정
                    console.log('📤 Updating schedule with projectId:', newEvent.projectId, 'projectName:', newEvent.projectName);
                    // title에서 시간 텍스트 제거 (있다면)
                    let cleanTitle = newEvent.title;
                    const timePattern = / - (오전|오후) \d{1,2}시( \d{1,2}분)?$/;
                    cleanTitle = cleanTitle.replace(timePattern, '');

                    // 병합된 일정인 경우 모든 관련 일정을 업데이트
                    if (selectedEvent.mergedEventIds && selectedEvent.mergedEventIds.length > 0) {
                      console.log('📤 Updating merged schedules:', selectedEvent.mergedEventIds);

                      // 병합된 일정들의 원래 제목들 분리
                      const originalTitles = (selectedEvent.originalTitle || selectedEvent.title).split(', ');
                      const newTitles = cleanTitle.split(', ');

                      // 각 병합된 일정을 개별적으로 업데이트
                      for (let i = 0; i < selectedEvent.mergedEventIds.length; i++) {
                        const scheduleId = selectedEvent.mergedEventIds[i];
                        // 새 제목이 있으면 사용, 없으면 원래 제목 유지
                        const individualTitle = newTitles[i] || originalTitles[i] || cleanTitle;

                        await updateScheduleInAPI(scheduleId, {
                          title: individualTitle.trim(),
                          start: newEvent.start,
                          end: newEvent.end,
                          type: 'other',
                          project: newEvent.projectId || newEvent.projectName,
                          location: '',
                          attendees: newEvent.assignedTo || [],
                          description: newEvent.description,
                          time: newEvent.time
                        });
                      }
                      toast.success(`${selectedEvent.mergedEventIds.length}개의 일정이 수정되었습니다`);
                    } else {
                      // 단일 일정 수정
                      await updateScheduleInAPI(selectedEvent.id, {
                        title: cleanTitle,
                        start: newEvent.start,
                        end: newEvent.end,
                        type: 'other',
                        project: newEvent.projectId || newEvent.projectName,
                        location: '',
                        attendees: newEvent.assignedTo || [],
                        description: newEvent.description,
                        time: newEvent.time
                      });
                      toast.success('일정이 수정되었습니다');
                    }

                    // 수정 후 일정 다시 로드
                    await loadSchedulesFromAPI();
                  }
                } else {
                  // 추가
                  console.log('📤 Adding schedule with projectId:', newEvent.projectId, 'projectName:', newEvent.projectName);
                  await addScheduleToAPI({
                    id: Date.now().toString(),
                    title: newEvent.title,
                    start: newEvent.start,
                    end: newEvent.end,
                    type: 'other',
                    project: newEvent.projectId || newEvent.projectName,  // projectId 우선 사용
                    location: '',
                    attendees: newEvent.assignedTo || [],
                    description: newEvent.description,
                    time: newEvent.time
                  });
                  toast.success('일정이 추가되었습니다');
                }
                setShowModal(false);
              } catch (error) {
                console.error('Failed to save schedule:', error);
                toast.error('일정 저장에 실패했습니다');
              }
            }}
            onDelete={async (eventId: string) => {
              try {
                // 수금 일정인지 확인 (ID가 'payment-'로 시작하는 경우)
                if (eventId.startsWith('payment-')) {
                  // payment-{cpId}-{type} 형식에서 cpId와 type 추출
                  const parts = eventId.split('-');
                  const cpId = parts[1];
                  const paymentType = parts[2];

                  // constructionPayment 찾기
                  const cp = constructionPayments.find(cp => cp.id === cpId);
                  if (cp) {
                    // expectedPaymentDates에서 해당 필드 제거
                    const updatedDates = { ...cp.expectedPaymentDates };
                    delete updatedDates[paymentType as 'contract' | 'start' | 'middle' | 'final'];

                    await updateConstructionPaymentInAPI(cpId, {
                      expectedPaymentDates: updatedDates
                    });
                    toast.success('수금 일정이 삭제되었습니다');
                  }
                }
                // AS 방문 일정인지 확인 (ID가 'as-'로 시작하는 경우)
                else if (eventId.startsWith('as-')) {
                  // AS 요청 ID 추출 (예: 'as-2' -> '2')
                  const asRequestId = eventId.replace('as-', '');
                  // AS 요청의 방문 예정일 제거
                  await updateASRequestInAPI(asRequestId, {
                    scheduledVisitDate: null,
                    scheduledVisitTime: null
                  });
                  toast.success('AS 방문 일정이 삭제되었습니다');
                } else {
                  // 일반 일정 삭제
                  // 병합된 일정인 경우 모든 관련 일정 삭제
                  const eventToDelete = events.find(e => e.id === eventId);
                  if (eventToDelete?.mergedEventIds && eventToDelete.mergedEventIds.length > 0) {
                    // 병합된 모든 일정 삭제
                    console.log('Deleting merged schedules:', eventToDelete.mergedEventIds);
                    for (const id of eventToDelete.mergedEventIds) {
                      await deleteScheduleFromAPI(id);
                    }
                    toast.success(`${eventToDelete.mergedEventIds.length}개의 일정이 삭제되었습니다`);
                  } else {
                    // 단일 일정 삭제
                    await deleteScheduleFromAPI(eventId);
                    toast.success('일정이 삭제되었습니다');
                  }
                }
                setShowModal(false);
              } catch (error) {
                console.error('Failed to delete schedule:', error);
                toast.error('일정 삭제에 실패했습니다');
              }
            }}
          />
        )}
      </div>
  );
};

export default Schedule;