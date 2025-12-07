import { useState, useEffect, useMemo, useCallback } from 'react';
import React from 'react';
import { Calendar, momentLocalizer, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import moment from 'moment';
import ScheduleModal from '../components/ScheduleModal';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { formatTimeKorean } from '../utils/formatters';

// 드래그앤드롭 캘린더 컴포넌트
const DragAndDropCalendar = withDragAndDrop(Calendar);

// 공정 타입 정의
interface ProcessItem {
  id: number;
  name: string;
  sort_order: number;
  is_active: number;
}

// 기본 공정 목록 (API 로딩 실패 시 fallback)
const DEFAULT_PROCESS_LIST = [
  '현장점검', '가설', '철거', '방수', '단열', '설비', '전기배선', '인터넷선',
  '에어컨배관', '전열교환기', '소방', '창호', '현관문교체', '목공', '조명타공',
  '금속', '타일', '도장', '마루', '필름', '도배', '중문', '가구', '상판',
  '욕실집기', '조명', '이노솔', '유리', '실리콘', '도어락', '커튼/블라인드',
  '청소', '마감', '준공검사', '가전입고', '스타일링', '촬영', '이사', '기타'
];

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
  projectName: string;  // 표시용 (축약형)
  originalProjectName?: string;  // 필터링용 (원본 프로젝트명)
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

// 인라인 추가 입력 컴포넌트 (로컬 상태 관리로 중복 입력 방지)
const InlineAddInput = React.memo(({
  onSave,
  onCancel
}: {
  onSave: (title: string) => void;
  onCancel: () => void;
}) => {
  const [localTitle, setLocalTitle] = useState('');

  // 세로 레이아웃 감지 (태블릿 또는 세로방향 데스크탑)
  const checkVerticalLayout = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return (width >= 768 && width < 1024) || (width >= 1024 && height > width);
  };
  const [useVerticalLayout, setUseVerticalLayout] = useState(checkVerticalLayout);

  useEffect(() => {
    const handleResize = () => setUseVerticalLayout(checkVerticalLayout());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 최종 표시와 동일한 폰트 크기 사용
  const fontSize = useVerticalLayout ? '16px' : '18px';

  return (
    <div
      className="w-full"
      onClick={(e) => e.stopPropagation()}
      style={{ padding: useVerticalLayout ? '2px 3px' : '6px 0', minHeight: useVerticalLayout ? '28px' : '32px' }}
    >
      <input
        type="text"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={() => {
          if (localTitle.trim()) {
            onSave(localTitle.trim());
          } else {
            onCancel();
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            if (localTitle.trim()) {
              onSave(localTitle.trim());
            } else {
              onCancel();
            }
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder=""
        className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0"
        autoFocus
        style={{
          fontSize: fontSize,
          fontWeight: 500,
          color: '#374151',
          padding: 0,
          margin: 0,
          lineHeight: '1.3',
          caretColor: '#374151'
        }}
      />
    </div>
  );
});

// 프로젝트명 축약 함수 (이미 축약된 형식이면 그대로 반환)
const shortenProjectName = (projectName: string): string => {
  if (!projectName) return projectName;
  // 이미 "XX_숫자" 형식이면 그대로 반환
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

  // 오늘 날짜 동그라미 색상 (요일에 맞게)
  let todayCircleColor = '#d1d5db'; // 평일: 연한 회색
  if (isHoliday || isSunday) {
    todayCircleColor = '#fecaca'; // 일요일/공휴일: 연한 빨강
  } else if (isSaturday) {
    todayCircleColor = '#bfdbfe'; // 토요일: 연한 파랑
  }

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
    paddingLeft: isTwoDigit ? '0px' : '4px', // 두 자리는 0px, 한 자리는 4px
    // 오늘 날짜 동그라미 스타일
    ...(isToday && {
      backgroundColor: todayCircleColor,
      borderRadius: '50%',
      width: '21px',
      height: '21px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: '0px'
    })
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
const CustomEvent = React.memo(({
  event,
  user,
  filterProject,
  isEditing,
  editTitle,
  onEditTitleChange,
  onEditSave,
  onEditDelete,
  onEditCancel,
  onHoverDelete,
  onDeleteAction
}: {
  event: ScheduleEvent;
  user: { id: string; name: string; role: string } | null;
  filterProject?: string;
  isEditing?: boolean;
  editTitle?: string;
  onEditTitleChange?: (value: string) => void;
  onEditSave?: () => void;
  onEditDelete?: () => void;
  onEditCancel?: () => void;
  onHoverDelete?: () => void;
  onDeleteAction?: () => void;
}) => {
  const isSpecificProject = filterProject && filterProject !== 'all';
  const attendees = event.assignedTo || [];
  // 호버 상태
  const [isHovered, setIsHovered] = useState(false);
  const deleteButtonRef = React.useRef<HTMLButtonElement>(null);
  // 태블릿 또는 세로방향 데스크탑 모니터 감지
  const checkVerticalLayout = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // 태블릿 (768~1024) 또는 세로방향 데스크탑 (height > width이고 width >= 768)
    return (width >= 768 && width < 1024) || (width >= 1024 && height > width);
  };
  const [useVerticalLayout, setUseVerticalLayout] = useState(checkVerticalLayout);
  const [showTooltip, setShowTooltip] = useState(false);
  // 디바운스 타이머 ref
  const saveTimerRef = React.useRef<number | null>(null);
  // 한글 IME 조합 상태 추적
  const isComposingRef = React.useRef(false);

  // 사용자 이름에서 성 제거
  const userNameWithoutSurname = user?.name ? user.name.slice(-2) : null;

  // 현재 사용자가 팀에 속하는지 확인
  const isUserInFieldTeam = userNameWithoutSurname && ['재천', '민기'].includes(userNameWithoutSurname);
  const isUserInDesignTeam = userNameWithoutSurname && ['신애', '재성', '재현'].includes(userNameWithoutSurname);

  // 현재 사용자가 담당자인지 확인 (팀 소속 포함)
  const isUserAssigned = user?.name && (
    attendees.includes(user.name) ||
    attendees.includes('HV LAB') ||
    (attendees.includes('디자인팀') && isUserInDesignTeam) ||
    (attendees.includes('현장팀') && isUserInFieldTeam)
  );

  useEffect(() => {
    const handleResize = () => {
      setUseVerticalLayout(checkVerticalLayout());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 인라인 편집 모드일 때 - 기존 디자인 유지하면서 텍스트만 수정
  // 타이핑 중에는 저장하지 않고, 편집 완료 시에만 저장
  const handleEditChange = (value: string) => {
    if (onEditTitleChange) {
      onEditTitleChange(value);
    }
  };

  const handleEditBlur = () => {
    // 편집 완료 시에만 저장
    if (editTitle?.trim() && onEditSave) {
      onEditSave();
    }
    if (onEditCancel) {
      onEditCancel();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  // 태블릿 또는 세로방향 데스크탑에서는 세로 레이아웃으로 표시
  if (useVerticalLayout) {
    return (
      <div
        className="w-full relative block"
        onMouseEnter={() => { setShowTooltip(true); setIsHovered(true); }}
        onMouseLeave={() => { setShowTooltip(false); setIsHovered(false); }}
        style={{
          padding: isSpecificProject ? '2px 3px' : '1px 3px',
          minHeight: isSpecificProject ? '28px' : '30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start'
        }}
      >
        {/* 호버 시 삭제 아이콘 - 클릭 시 바로 삭제 (Ctrl+Z로 복원 가능) */}
        {isHovered && isSpecificProject && onHoverDelete && !event.isASVisit && !event.isExpectedPayment && (
          <div className="absolute top-0 right-0 z-20" style={{ padding: '4px' }}>
            <button
              ref={deleteButtonRef}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // 삭제 액션 플래그 설정 (onSelectEvent 방지)
                if (onDeleteAction) onDeleteAction();
                // 바로 삭제 실행
                onHoverDelete();
              }}
              className="p-1 text-gray-500 hover:text-red-500"
              style={{ fontSize: '14px', lineHeight: 1 }}
              title="삭제 (Ctrl+Z로 복원)"
            >
              ✕
            </button>
          </div>
        )}
        {/* 첫번째 줄: 프로젝트명 + 담당자 (개별 프로젝트 선택 시 프로젝트명 숨김) */}
        <div className="flex items-center justify-between w-full" style={{ fontSize: isSpecificProject ? '13px' : '10px', opacity: 0.8, marginBottom: '1px', lineHeight: '1.2' }}>
          {!isSpecificProject && !event.isASVisit && event.projectName ? (
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
          {!isSpecificProject && attendees.length > 0 && (
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

        {/* 두번째~세번째 줄: 일정 제목 (2줄까지 표시) 또는 인라인 편집 */}
        {isEditing ? (
          <input
            type="text"
            value={editTitle || ''}
            onChange={(e) => handleEditChange(e.target.value)}
            onBlur={handleEditBlur}
            onKeyDown={handleEditKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full bg-transparent border-none outline-none"
            style={{
              fontWeight: 500,
              fontSize: isSpecificProject ? '16px' : '11px',
              lineHeight: '1.3',
              color: 'inherit',
              padding: 0,
              margin: 0
            }}
          />
        ) : (
          <div
            style={{
              fontWeight: 500,
              fontSize: isSpecificProject ? '16px' : '11px',
              lineHeight: '1.3',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'keep-all',
              textOverflow: 'ellipsis',
              textDecoration: isUserAssigned ? 'underline' : 'none',
              textDecorationColor: isUserAssigned ? '#e57373' : 'transparent',
              textDecorationThickness: '2px',
              textUnderlineOffset: '2px'
            }}
            title={event.title}
          >
            {event.title}
          </div>
        )}

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
    <div
      className="flex items-center justify-between w-full gap-1.5 overflow-hidden relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minHeight: isSpecificProject ? '32px' : '18px',
        padding: isSpecificProject ? '6px 0' : '0'
      }}
    >
      <div className="flex items-center gap-1.5 overflow-hidden flex-1">
        {/* AS 일정이 아닐 때만 프로젝트명 표시 (개별 프로젝트 선택 시 숨김) */}
        {!isSpecificProject && !event.isASVisit && event.projectName && (
          <span className="text-xs opacity-70 flex-shrink-0">
            [{shortenProjectName(event.projectName)}]
          </span>
        )}
        {isEditing ? (
          <input
            type="text"
            value={editTitle || ''}
            onChange={(e) => handleEditChange(e.target.value)}
            onBlur={handleEditBlur}
            onKeyDown={handleEditKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="font-medium bg-transparent border-none outline-none flex-1"
            style={{
              fontSize: isSpecificProject ? '18px' : '12px',
              color: 'inherit',
              padding: 0,
              margin: 0,
              minWidth: 0
            }}
          />
        ) : (
          <span
            className="font-medium truncate"
            style={{
              fontSize: isSpecificProject ? '18px' : '12px',
              textDecoration: isUserAssigned ? 'underline' : 'none',
              textDecorationColor: isUserAssigned ? '#e57373' : 'transparent',
              textDecorationThickness: '2px',
              textUnderlineOffset: '2px'
            }}
          >
            {event.title}
          </span>
        )}
      </div>
      {/* 개별 프로젝트 선택 시 담당자 숨김 */}
      {!isSpecificProject && attendees.length > 0 && (
        <span
          className="opacity-80 flex-shrink-0 ml-auto"
          style={{ fontSize: '11px' }}
        >
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
      {/* 호버 시 삭제 아이콘 - 클릭 시 바로 삭제 (Ctrl+Z로 복원 가능) */}
      {isHovered && isSpecificProject && onHoverDelete && !event.isASVisit && !event.isExpectedPayment && (
        <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20" style={{ padding: '2px' }}>
          <button
            ref={deleteButtonRef}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // 삭제 액션 플래그 설정 (onSelectEvent 방지)
              if (onDeleteAction) onDeleteAction();
              // 바로 삭제 실행
              onHoverDelete();
            }}
            className="p-1 text-gray-500 hover:text-red-500"
            style={{ fontSize: '14px', lineHeight: 1 }}
            title="삭제 (Ctrl+Z로 복원)"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
});

const Schedule = () => {
  const {
    schedules,
    setSchedules,
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

  // 삭제된 일정 스택 (Ctrl+Z 되돌리기용)
  const [deletedScheduleStack, setDeletedScheduleStack] = useState<ScheduleEvent[]>([]);

  // Ctrl+Z 되돌리기 핸들러
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        // 입력 필드에서는 브라우저 기본 동작 사용
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        if (deletedScheduleStack.length > 0) {
          e.preventDefault();
          const lastDeleted = deletedScheduleStack[deletedScheduleStack.length - 1];

          try {
            // 삭제된 일정 복원 (Schedule 타입에 맞게 변환)
            const scheduleType = lastDeleted.type === 'as_visit' || lastDeleted.type === 'expected_payment'
              ? 'other'
              : lastDeleted.type;

            await addScheduleToAPI({
              id: '',
              title: lastDeleted.originalTitle || lastDeleted.title,
              start: lastDeleted.start,
              end: lastDeleted.end,
              type: scheduleType as 'construction' | 'material' | 'inspection' | 'meeting' | 'other',
              project: lastDeleted.originalProjectName || lastDeleted.projectName,
              attendees: lastDeleted.assignedTo || [],
              time: lastDeleted.time,
              description: lastDeleted.description
            });

            // 스택에서 제거
            setDeletedScheduleStack(prev => prev.slice(0, -1));
            loadSchedulesFromAPI();
            toast.success('일정이 복원되었습니다');
          } catch (error) {
            console.error('일정 복원 실패:', error);
            toast.error('일정 복원에 실패했습니다');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletedScheduleStack, addScheduleToAPI, loadSchedulesFromAPI]);

  // 공정 목록 상태
  const [processList, setProcessList] = useState<ProcessItem[]>([]);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');
  const [editingProcess, setEditingProcess] = useState<ProcessItem | null>(null);
  const [editProcessName, setEditProcessName] = useState('');
  const [processLoading, setProcessLoading] = useState(false);
  // 공정 드래그 상태
  const [draggedProcessIndex, setDraggedProcessIndex] = useState<number | null>(null);
  const [dragOverProcessIndex, setDragOverProcessIndex] = useState<number | null>(null);

  // 공정 목록 불러오기
  const loadProcessList = useCallback(async () => {
    setProcessLoading(true);
    try {
      const response = await fetch('/api/processes');
      if (response.ok) {
        const data = await response.json();
        setProcessList(data);
      } else {
        console.error('공정 목록 로딩 실패');
        toast.error('공정 목록을 불러올 수 없습니다');
      }
    } catch (error) {
      console.error('공정 목록 로딩 오류:', error);
      toast.error('서버 연결에 실패했습니다');
    } finally {
      setProcessLoading(false);
    }
  }, []);

  // 공정 목록 로딩
  useEffect(() => {
    loadProcessList();
  }, [loadProcessList]);

  // 공정 목록 (이름만 추출)
  const PROCESS_LIST = useMemo(() => {
    if (processList.length > 0) {
      return processList.map(p => p.name);
    }
    return DEFAULT_PROCESS_LIST;
  }, [processList]);

  // 공정 추가
  const handleAddProcess = async () => {
    if (!newProcessName.trim()) return;
    try {
      const response = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProcessName.trim() })
      });
      if (response.ok) {
        setNewProcessName('');
        loadProcessList();
        toast.success('공정이 추가되었습니다');
      } else {
        const error = await response.json();
        toast.error(error.error || '공정 추가 실패');
      }
    } catch (error) {
      console.error('공정 추가 오류:', error);
      toast.error('공정 추가 실패');
    }
  };

  // 공정 수정
  const handleUpdateProcess = async () => {
    if (!editingProcess || !editProcessName.trim()) return;
    try {
      const response = await fetch(`/api/processes/${editingProcess.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editProcessName.trim() })
      });
      if (response.ok) {
        setEditingProcess(null);
        setEditProcessName('');
        loadProcessList();
        toast.success('공정이 수정되었습니다');
      } else {
        const error = await response.json();
        toast.error(error.error || '공정 수정 실패');
      }
    } catch (error) {
      console.error('공정 수정 오류:', error);
      toast.error('공정 수정 실패');
    }
  };

  // 공정 삭제
  const handleDeleteProcess = async (processId: number) => {
    if (!confirm('정말 이 공정을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/processes/${processId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadProcessList();
        toast.success('공정이 삭제되었습니다');
      } else {
        const error = await response.json();
        toast.error(error.error || '공정 삭제 실패');
      }
    } catch (error) {
      console.error('공정 삭제 오류:', error);
      toast.error('공정 삭제 실패');
    }
  };

  // 공정 순서 변경 (드래그앤드롭)
  const handleProcessDragStart = (index: number) => {
    setDraggedProcessIndex(index);
  };

  const handleProcessDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedProcessIndex !== null && draggedProcessIndex !== index) {
      setDragOverProcessIndex(index);
    }
  };

  const handleProcessDragEnd = async () => {
    if (draggedProcessIndex !== null && dragOverProcessIndex !== null && draggedProcessIndex !== dragOverProcessIndex) {
      // 새 순서로 배열 재정렬
      const newList = [...processList];
      const [draggedItem] = newList.splice(draggedProcessIndex, 1);
      newList.splice(dragOverProcessIndex, 0, draggedItem);

      // 낙관적 업데이트
      setProcessList(newList);

      // API 호출
      try {
        const response = await fetch('/api/processes/reorder/bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: newList.map(p => ({ id: p.id })) })
        });
        if (!response.ok) {
          // 실패 시 원복
          loadProcessList();
          toast.error('순서 변경 실패');
        }
      } catch (error) {
        console.error('순서 변경 오류:', error);
        loadProcessList();
        toast.error('순서 변경 실패');
      }
    }
    setDraggedProcessIndex(null);
    setDragOverProcessIndex(null);
  };

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
      const project = projects.find(p => p.name === schedule.project);
      // 프로젝트가 있으면 축약형 표기 생성 (프로젝트명 앞2글자_호수)
      let displayProjectName = schedule.project === '비공개' ? '[개인일정]' : schedule.project;
      if (project && schedule.project !== '비공개') {
        const prefix = project.name.length > 2 ? project.name.substring(0, 2) : project.name;
        // location에서 호수 추출 (예: "2105호", "B114호" 등)
        const location = project.location || '';
        const unitMatch = location.match(/([A-Za-z]?\d+)호/);
        const unitNumber = unitMatch ? unitMatch[1] : '';
        displayProjectName = unitNumber ? `${prefix}_${unitNumber}` : prefix;
      }
      const scheduleTime = schedule.time;
      // 시간이 있고 "-"가 아닌 경우에만 시간 텍스트 추가
      const timeText = (scheduleTime && scheduleTime !== '-') ? ` - ${formatTime(scheduleTime)}` : '';

      // 사용자 일정 여부 확인 (여기서 직접 확인)
      const attendees = schedule.attendees || [];

      return {
        id: schedule.id,
        title: schedule.title + timeText,
        originalTitle: schedule.title,  // 원본 제목 저장
        start: schedule.start,
        end: schedule.end,
        projectId: project?.id || '',
        projectName: displayProjectName || '',
        originalProjectName: schedule.project || '',  // 필터링용 원본 프로젝트명
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
      // 프로젝트 축약형 표기 생성 (프로젝트명 앞2글자_호수)
      let asDisplayProjectName = req.project;
      if (asProject) {
        const prefix = asProject.name.length > 2 ? asProject.name.substring(0, 2) : asProject.name;
        const location = asProject.location || '';
        const unitMatch = location.match(/([A-Za-z]?\d+)호/);
        const unitNumber = unitMatch ? unitMatch[1] : '';
        asDisplayProjectName = unitNumber ? `${prefix}_${unitNumber}` : prefix;
      }
      const originalASTitle = `[AS] ${asDisplayProjectName}`;
      return {
        id: `as-${req.id}`,
        title: originalASTitle + timeText,
        originalTitle: originalASTitle,  // 원본 제목 저장
        start: req.scheduledVisitDate!,
        end: req.scheduledVisitDate!,
        projectId: asProject?.id || '',
        projectName: asDisplayProjectName,
        originalProjectName: req.project,  // 필터링용 원본 프로젝트명
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

  // 사용자가 담당자인지 확인하는 함수
  const isUserAssignedEvent = useCallback((event: ScheduleEvent): boolean => {
    if (!user?.name) return false;
    const attendees = event.assignedTo || [];
    const shortName = user.name.slice(-2);
    const isInFieldTeam = ['재천', '민기'].includes(shortName);
    const isInDesignTeam = ['신애', '재성', '재현'].includes(shortName);

    return (
      attendees.includes(user.name) ||
      attendees.includes('HV LAB') ||
      (attendees.includes('디자인팀') && isInDesignTeam) ||
      (attendees.includes('현장팀') && isInFieldTeam)
    );
  }, [user?.name]);

  // 같은 날, 같은 프로젝트의 일정을 그룹화하는 함수 (전체 프로젝트 보기에서만 병합)
  const groupEventsByProjectAndDate = (events: ScheduleEvent[], shouldMerge: boolean): ScheduleEvent[] => {
    // 개별 프로젝트 선택 시에는 병합하지 않고 그대로 반환
    if (!shouldMerge) {
      return [...events].sort((a, b) => {
        // 사용자 담당 일정 우선
        const aUserAssigned = isUserAssignedEvent(a);
        const bUserAssigned = isUserAssignedEvent(b);
        if (aUserAssigned && !bUserAssigned) return -1;
        if (!aUserAssigned && bUserAssigned) return 1;
        // 같은 날짜 내에서 시간순
        return a.start.getTime() - b.start.getTime();
      });
    }

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

    // 사용자 담당 일정 우선, 그 다음 시간순 정렬
    return finalEvents.sort((a, b) => {
      // 사용자 담당 일정 우선
      const aUserAssigned = isUserAssignedEvent(a);
      const bUserAssigned = isUserAssignedEvent(b);
      if (aUserAssigned && !bUserAssigned) return -1;
      if (!aUserAssigned && bUserAssigned) return 1;
      // 같은 날짜 내에서 시간순
      return a.start.getTime() - b.start.getTime();
    });
  };

  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  // 프로젝트 필터 상태 (사용자별 localStorage에서 복원)
  const filterStorageKey = `schedule_filterProject_${user?.id || 'guest'}`;
  const [filterProject, setFilterProject] = useState<string>(() => {
    // 사용자별 localStorage에서 저장된 프로젝트 필터 복원
    const savedFilter = localStorage.getItem(filterStorageKey);
    if (savedFilter) {
      return savedFilter;
    }
    // 안팀 사용자는 기본적으로 첫 번째 프로젝트를 선택, 다른 사용자는 'all'
    if (user?.name === '안팀' && projects.length > 0) {
      return projects[0].name;
    }
    return 'all';
  });

  // filterProject 변경 시 사용자별 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(filterStorageKey, filterProject);
  }, [filterProject, filterStorageKey]);

  // 일정표 인쇄 핸들러
  const handlePrintSchedule = useCallback(() => {
    // 인쇄 모드 클래스 추가
    document.body.classList.add('printing-schedule');

    // 선택된 프로젝트명 가져오기
    const projectName = filterProject === 'all' ? '전체 프로젝트' : filterProject;
    const monthYear = moment(date).format('YYYY년 MM월');

    // 인쇄 제목 설정
    const originalTitle = document.title;
    document.title = `${projectName} - ${monthYear} 일정표`;

    // 잠시 후 인쇄 (DOM 업데이트 대기)
    setTimeout(() => {
      window.print();

      // 인쇄 후 원래 상태로 복원
      document.body.classList.remove('printing-schedule');
      document.title = originalTitle;
    }, 100);
  }, [filterProject, date]);

  // 그룹화 적용 (전체 프로젝트 보기에서만 병합)
  const events = groupEventsByProjectAndDate(allEvents, filterProject === 'all');
  // 모바일에서는 오늘 날짜를 기본 선택
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    window.innerWidth < 768 ? new Date() : null
  );

  // 드래그 중인 공정 (사이드바에서 드래그)
  const [draggedProcess, setDraggedProcess] = useState<string | null>(null);
  // 드래그 드롭 처리 중 플래그 (중복 방지)
  const isProcessingDropRef = React.useRef(false);
  // 공정 드롭 직후 플래그 (인라인 모드 방지)
  const justDroppedProcessRef = React.useRef(false);
  // Ctrl 키 상태 추적 (드래그 시 복사용)
  const isCtrlPressedRef = React.useRef(false);

  // Ctrl 키 상태 추적
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        isCtrlPressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        isCtrlPressedRef.current = false;
      }
    };
    // 창이 포커스를 잃으면 Ctrl 상태 초기화
    const handleBlur = () => {
      isCtrlPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // 드래그 중 날짜 셀 하이라이트 효과
  useEffect(() => {
    if (!draggedProcess) return;

    let lastHighlightedCell: HTMLElement | null = null;

    const handleDragOver = (e: DragEvent) => {
      // 가장 가까운 날짜 셀 찾기
      const target = e.target as HTMLElement;
      const dayBg = target.closest('.rbc-day-bg') as HTMLElement;

      // 이전 하이라이트 제거
      if (lastHighlightedCell && lastHighlightedCell !== dayBg) {
        lastHighlightedCell.style.backgroundColor = '';
      }

      // 새 하이라이트 적용
      if (dayBg) {
        dayBg.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
        lastHighlightedCell = dayBg;
      }
    };

    const handleDragEnd = () => {
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
        lastHighlightedCell = null;
      }
    };

    const handleDrop = () => {
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
        lastHighlightedCell = null;
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop);
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
      }
    };
  }, [draggedProcess]);

  // 인라인 편집 상태 (개별 프로젝트 선택 시)
  const [inlineAddDate, setInlineAddDate] = useState<Date | null>(null);
  const [inlineEditEvent, setInlineEditEvent] = useState<ScheduleEvent | null>(null);
  const [inlineEditTitle, setInlineEditTitle] = useState('');

  // 드래그 프리뷰 상태
  const [draggingEvent, setDraggingEvent] = useState<ScheduleEvent | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // 드래그 중 마우스 위치 추적 (거리 임계값 적용)
  const dragThreshold = 8; // 최소 8px 이동해야 드래그로 인식
  useEffect(() => {
    if (!draggingEvent) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
      // 시작 위치에서 일정 거리 이상 이동해야 드래그로 인식
      const dx = Math.abs(e.clientX - dragStartPosition.x);
      const dy = Math.abs(e.clientY - dragStartPosition.y);
      if (dx > dragThreshold || dy > dragThreshold) {
        setIsDragging(true);
      }
    };

    const handleMouseUp = () => {
      setDraggingEvent(null);
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingEvent, dragStartPosition]);

  // 삭제 액션 진행 중 플래그 (onSelectEvent 방지용)
  const deleteActionRef = React.useRef<boolean>(false);

  // 기존 일정 드래그하여 날짜 이동/복사 핸들러 (Ctrl+드래그 = 복사)
  const onEventDrop = useCallback(async ({ event, start, end }: { event: ScheduleEvent; start: Date | string; end: Date | string }) => {
    // AS 방문이나 수금 일정은 이동 불가
    if (event.isASVisit || event.isExpectedPayment) {
      toast.error('이 일정은 이동할 수 없습니다');
      return;
    }

    // 날짜를 Date 객체로 변환
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);

    // Ctrl 키가 눌린 상태면 복사, 아니면 이동
    const isCopy = isCtrlPressedRef.current;

    if (isCopy) {
      // 복사 모드: 새 일정 생성
      try {
        // 병합된 일정인 경우 모든 일정을 복사
        const eventIds = event.mergedEventIds || [event.id];
        const originalSchedules = schedules.filter(s => eventIds.includes(s.id));

        for (const originalSchedule of originalSchedules) {
          await addScheduleToAPI({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: originalSchedule.title,
            start: startDate,
            end: endDate,
            project: originalSchedule.project,
            attendees: originalSchedule.attendees || [],
            time: originalSchedule.time,
            priority: originalSchedule.priority || 'medium'
          });
        }
        toast.success('일정이 복사되었습니다');
        loadSchedulesFromAPI();
      } catch (error: any) {
        console.error('일정 복사 실패:', error);
        toast.error('일정 복사 실패');
      }
    } else {
      // 이동 모드: 기존 로직
      const eventIds = event.mergedEventIds || [event.id];

      // 낙관적 업데이트: 로컬 상태 즉시 변경
      const previousSchedules = [...schedules];
      setSchedules(schedules.map(s =>
        eventIds.includes(s.id)
          ? { ...s, start: startDate, end: endDate }
          : s
      ));

      // 백그라운드에서 API 호출
      try {
        for (const eventId of eventIds) {
          await updateScheduleInAPI(eventId, {
            start: startDate,
            end: endDate
          });
        }
      } catch (error: any) {
        // 실패 시 원래 상태로 복구
        setSchedules(previousSchedules);
        console.error('일정 이동 실패:', error);
        toast.error('일정 이동 실패');
      }
    }
  }, [schedules, setSchedules, updateScheduleInAPI, addScheduleToAPI, loadSchedulesFromAPI]);

  // 드래그 시작 핸들러
  const onDragStart = useCallback(({ event, action }: { event: ScheduleEvent; action: string }) => {
    if (event.isASVisit || event.isExpectedPayment || event.id === '__inline_add__') {
      return;
    }
    // 드래그 시작 시 해당 이벤트 요소의 위치 찾기
    const eventElements = document.querySelectorAll('.rbc-event');
    for (const el of eventElements) {
      if (el.textContent?.includes(event.originalTitle || event.title)) {
        const rect = el.getBoundingClientRect();
        setDragStartPosition({ x: rect.left, y: rect.top });
        setDragPosition({ x: rect.left, y: rect.top });
        break;
      }
    }
    setIsDragging(false);
    setDraggingEvent(event);
  }, []);

  // 사이드바에서 공정을 드래그하여 날짜에 드롭했을 때 핸들러
  const handleProcessDrop = useCallback(async (processName: string, dropDate: Date) => {
    // 이미 처리 중이면 중복 실행 방지
    if (isProcessingDropRef.current) {
      return;
    }

    if (filterProject === 'all') {
      toast.error('프로젝트를 먼저 선택해주세요');
      return;
    }

    isProcessingDropRef.current = true;

    try {
      await addScheduleToAPI({
        id: Date.now().toString(),
        title: processName,
        start: dropDate,
        end: dropDate,
        type: 'construction',
        project: filterProject,
        location: '',
        attendees: user?.name ? [user.name] : [],
        description: ''
      });
      await loadSchedulesFromAPI();
    } catch (error) {
      console.error('일정 추가 실패:', error);
      toast.error('일정 추가에 실패했습니다');
    } finally {
      // 약간의 딜레이 후 플래그 해제 (연속 드롭 방지)
      setTimeout(() => {
        isProcessingDropRef.current = false;
      }, 500);
    }
  }, [filterProject, addScheduleToAPI, loadSchedulesFromAPI, user]);

  // 외부에서 드래그해서 캘린더에 드롭할 때 핸들러
  const onDropFromOutside = useCallback(({ start }: { start: Date; end: Date; allDay: boolean }) => {
    if (draggedProcess && filterProject !== 'all' && !isProcessingDropRef.current) {
      // 드롭 직후 플래그 설정 (인라인 모드 방지)
      justDroppedProcessRef.current = true;
      setTimeout(() => {
        justDroppedProcessRef.current = false;
      }, 500);

      // 인라인 추가/편집 모드 즉시 클리어
      setInlineAddDate(null);
      setInlineEditEvent(null);
      setInlineEditTitle('');

      const processToAdd = draggedProcess;
      setDraggedProcess(null); // 먼저 상태 클리어
      handleProcessDrop(processToAdd, start);
    }
  }, [draggedProcess, filterProject, handleProcessDrop]);

  // 드래그 가능한 외부 아이템 접근자 (dragFromOutsideItem)
  const dragFromOutsideItem = useCallback(() => {
    return draggedProcess ? { title: draggedProcess } : null;
  }, [draggedProcess]);

  // 인라인 일정 추가 저장 (title을 파라미터로 받음)
  const handleInlineAdd = useCallback(async (title: string) => {
    if (!title.trim() || !inlineAddDate || filterProject === 'all') {
      setInlineAddDate(null);
      return;
    }

    try {
      await addScheduleToAPI({
        id: Date.now().toString(),
        title: title.trim(),
        start: inlineAddDate,
        end: inlineAddDate,
        type: 'construction',
        project: filterProject,
        location: '',
        attendees: user?.name ? [user.name] : [],
        description: ''
      });
      loadSchedulesFromAPI();
    } catch (error) {
      console.error('일정 추가 실패:', error);
      toast.error('일정 추가에 실패했습니다');
    }

    setInlineAddDate(null);
  }, [inlineAddDate, filterProject, addScheduleToAPI, loadSchedulesFromAPI, user]);

  // 인라인 추가 취소
  const handleInlineAddCancel = useCallback(() => {
    setInlineAddDate(null);
  }, []);

  // 인라인 일정 수정 저장
  const handleInlineEditSave = useCallback(async () => {
    if (!inlineEditEvent || !inlineEditTitle.trim()) {
      setInlineEditEvent(null);
      setInlineEditTitle('');
      return;
    }

    try {
      // 병합된 일정인 경우 첫 번째 이벤트만 수정
      const eventId = inlineEditEvent.mergedEventIds?.[0] || inlineEditEvent.id;
      await updateScheduleInAPI(eventId, {
        title: inlineEditTitle.trim()
      });
      loadSchedulesFromAPI();
    } catch (error) {
      console.error('일정 수정 실패:', error);
      toast.error('일정 수정에 실패했습니다');
    }

    setInlineEditEvent(null);
    setInlineEditTitle('');
  }, [inlineEditEvent, inlineEditTitle, updateScheduleInAPI, loadSchedulesFromAPI]);

  // 인라인 일정 삭제 (확인 없이 바로 삭제, Ctrl+Z로 복원 가능)
  const handleInlineDelete = useCallback(async (event: ScheduleEvent) => {
    try {
      // 삭제 전에 스택에 저장 (되돌리기용)
      setDeletedScheduleStack(prev => [...prev, event]);

      // 병합된 일정인 경우 모든 이벤트 삭제
      const eventIds = event.mergedEventIds || [event.id];
      for (const eventId of eventIds) {
        await deleteScheduleFromAPI(eventId);
      }
      loadSchedulesFromAPI();
      toast.success('삭제됨 (Ctrl+Z로 복원)', { duration: 2000 });
    } catch (error) {
      console.error('일정 삭제 실패:', error);
      toast.error('일정 삭제에 실패했습니다');
      // 실패 시 스택에서 제거
      setDeletedScheduleStack(prev => prev.slice(0, -1));
    }

    setInlineEditEvent(null);
    setInlineEditTitle('');
  }, [deleteScheduleFromAPI, loadSchedulesFromAPI]);

  // 필터링된 이벤트를 먼저 정의 (useEffect보다 먼저 와야 함)
  // 이미 groupEventsByProjectAndDate에서 사용자 일정의 시간을 조정했으므로 여기서는 필터링만
  // originalProjectName으로 필터링 (없으면 projectName 사용)
  const filteredEventsRaw = (filterProject === 'all'
    ? events
    : events.filter(e => (e.originalProjectName || e.projectName) === filterProject));

  // 각 날짜별로 일정 정렬
  // - 전체 프로젝트: 사용자 일정을 최상단에 배치
  // - 개별 프로젝트: 작성 순서(ID 순)대로 배치
  const filteredEventsSorted = React.useMemo(() => {
    const isSpecificProject = filterProject !== 'all';

    // 날짜별로 그룹화
    const eventsByDate = new Map<string, ScheduleEvent[]>();

    filteredEventsRaw.forEach(event => {
      const dateKey = moment(event.start).format('YYYY-MM-DD');
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey)!.push(event);
    });

    const result: ScheduleEvent[] = [];

    eventsByDate.forEach((dayEvents) => {
      if (isSpecificProject) {
        // 개별 프로젝트: ID순으로 정렬 (작성 순서)
        const sortedByCreation = [...dayEvents].sort((a, b) => {
          // ID가 숫자인 경우 숫자 비교, 아니면 문자열 비교
          const aId = parseInt(a.id) || 0;
          const bId = parseInt(b.id) || 0;
          return aId - bId;
        });

        sortedByCreation.forEach((event, idx) => {
          const adjustedStart = moment(event.start).startOf('day').add(idx, 'milliseconds').toDate();
          result.push({
            ...event,
            start: adjustedStart,
            allDay: false
          });
        });
      } else {
        // 전체 프로젝트: 사용자 일정과 비사용자 일정 분리
        const userEvents: ScheduleEvent[] = [];
        const otherEvents: ScheduleEvent[] = [];

        dayEvents.forEach(event => {
          if (isUserAssignedEvent(event)) {
            userEvents.push(event);
          } else {
            otherEvents.push(event);
          }
        });

        // 사용자 일정의 시작 시간을 00:00:00.xxx로 설정하여 먼저 표시되게 함
        userEvents.forEach((event, idx) => {
          const adjustedStart = moment(event.start).startOf('day').add(idx, 'milliseconds').toDate();
          result.push({
            ...event,
            start: adjustedStart,
            allDay: false
          });
        });

        // 비사용자 일정은 00:00:01.xxx부터 시작하도록 설정
        otherEvents.forEach((event, idx) => {
          const adjustedStart = moment(event.start).startOf('day').add(1000 + idx, 'milliseconds').toDate();
          result.push({
            ...event,
            start: adjustedStart,
            allDay: false
          });
        });
      }
    });

    // 최종 시간순 정렬
    return result.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [filteredEventsRaw, isUserAssignedEvent, filterProject]);

  // 인라인 추가 이벤트 포함 (날짜 셀에 직접 입력 필드 표시)
  // 해당 날짜의 마지막 일정 다음에 위치하도록 시간 조정
  const filteredEvents = React.useMemo(() => {
    if (inlineAddDate && filterProject !== 'all') {
      // 해당 날짜의 기존 일정 개수 확인
      const dateKey = moment(inlineAddDate).format('YYYY-MM-DD');
      const eventsOnSameDay = filteredEventsSorted.filter(e =>
        moment(e.start).format('YYYY-MM-DD') === dateKey
      );
      // 마지막 일정 다음 위치에 배치 (밀리초 단위로 조정)
      const lastEventTime = eventsOnSameDay.length > 0
        ? Math.max(...eventsOnSameDay.map(e => e.start.getTime()))
        : moment(inlineAddDate).startOf('day').valueOf();
      const inlineAddStart = new Date(lastEventTime + 1);

      const inlineAddEvent: ScheduleEvent = {
        id: '__inline_add__',
        title: '',
        start: inlineAddStart,
        end: inlineAddStart,
        projectId: '',
        projectName: filterProject,
        type: 'other',
        phase: '',
        assignedTo: [],
        priority: 'medium',
        allDay: false  // 시간 기반 정렬을 위해 false
      };
      return [...filteredEventsSorted, inlineAddEvent];
    }
    return filteredEventsSorted;
  }, [filteredEventsSorted, inlineAddDate, filterProject]);

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

  // 이벤트 클릭 - 개별 프로젝트 선택 시 인라인 편집, 그 외 모달 열기
  const onSelectEvent = (event: ScheduleEvent) => {
    // 삭제 액션 진행 중이면 무시
    if (deleteActionRef.current) {
      deleteActionRef.current = false;
      return;
    }

    // 인라인 추가 이벤트는 무시 (자체 입력 필드가 있음)
    if (event.id === '__inline_add__') {
      return;
    }

    // 이벤트가 클릭되었음을 표시 (onSelectSlot보다 먼저 실행됨)
    eventClickedRef.current = true;

    // 이전 타이머가 있으면 클리어
    if (eventClickTimerRef.current) {
      clearTimeout(eventClickTimerRef.current);
    }

    // 개별 프로젝트 선택 시 & AS/수금 일정이 아닐 때 인라인 편집
    const isSpecificProject = filterProject !== 'all';
    const isMobile = window.innerWidth < 768;

    if (isSpecificProject && !isMobile && !event.isASVisit && !event.isExpectedPayment) {
      // 인라인 추가 모드 닫기
      setInlineAddDate(null);
      // 인라인 편집 모드 열기
      setInlineEditEvent(event);
      setInlineEditTitle(event.originalTitle || event.title);
    } else {
      // 기존 모달 방식
      const eventForModal = {
        ...event,
        title: event.originalTitle || event.title
      };
      setSelectedSlot(null);
      setSelectedEvent(eventForModal);
      setShowModal(true);
    }

    // 충분한 시간 후 플래그 리셋
    eventClickTimerRef.current = setTimeout(() => {
      eventClickedRef.current = false;
      eventClickTimerRef.current = null;
    }, 300);
  };

  // 빈 슬롯 선택 (날짜 선택)
  const onSelectSlot = (slotInfo: { start: Date; end: Date; action: string }) => {
    const windowWidth = window.innerWidth;
    const isMobile = windowWidth < 768;
    const isTablet = windowWidth >= 768 && windowWidth < 1024;
    const isAllProjects = filterProject === 'all';

    // 공정 드롭 직후라면 슬롯 선택 무시 (인라인 모드 방지)
    if (justDroppedProcessRef.current) {
      return;
    }

    // 모바일에서는 날짜 선택 처리
    if (isMobile) {
      if (slotInfo.start) {
        setSelectedDate(slotInfo.start);
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
      return;
    }

    // 전체 프로젝트 모드: 모달 방식으로 일정 추가
    if (isAllProjects) {
      // 이벤트 클릭 플래그 초기화
      eventClickedRef.current = false;
      // 인라인 편집 모드 닫기
      setInlineEditEvent(null);
      setInlineEditTitle('');
      setInlineAddDate(null);
      // 모달 열기
      setSelectedSlot(slotInfo);
      setSelectedEvent(null);
      setShowModal(true);
      return;
    }

    // 개별 프로젝트 모드: 이벤트 클릭 직후면 무시
    if (eventClickedRef.current) {
      return;
    }

    // 개별 프로젝트 선택 시 인라인 추가 모드
    // 인라인 편집 모드 닫기
    setInlineEditEvent(null);
    setInlineEditTitle('');
    // 인라인 추가 모드 열기
    setInlineAddDate(slotInfo.start);
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
    } catch (error) {
      console.error('Failed to add schedule:', error);
      toast.error('일정 추가에 실패했습니다');
    }
  };

  // 커스텀 이벤트 스타일 (프로젝트별 색상 적용)
  const eventStyleGetter = (event: ScheduleEvent) => {
    // 인라인 추가 이벤트는 흰색 배경
    if (event.id === '__inline_add__') {
      return {
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          color: '#1f2937',
          border: '1px solid #d1d5db',
          display: 'block',
          fontSize: '0.8125rem',
          padding: '0',
          fontWeight: '400',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          overflow: 'visible'
        } as React.CSSProperties
      };
    }

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
    const isMobile = window.innerWidth < 768;

    let className = '';
    if (isSelected) className += 'selected-date ';
    if (isHoliday) className += 'holiday-date ';

    // 모바일에서는 모든 배경색 제거
    const style: React.CSSProperties = isMobile ? {
      backgroundColor: 'transparent',
      background: 'transparent'
    } : {};

    return {
      className: className.trim(),
      style
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
    // 인라인 추가 이벤트일 때 별도 컴포넌트 사용 (중복 입력 방지)
    if (event.id === '__inline_add__') {
      return (
        <InlineAddInput
          onSave={handleInlineAdd}
          onCancel={handleInlineAddCancel}
        />
      );
    }

    const isThisEditing = inlineEditEvent?.id === event.id ||
      (inlineEditEvent?.mergedEventIds && inlineEditEvent.mergedEventIds.includes(event.id));

    return (
      <CustomEvent
        event={event}
        user={user}
        filterProject={filterProject}
        isEditing={isThisEditing}
        editTitle={isThisEditing ? inlineEditTitle : undefined}
        onEditTitleChange={isThisEditing ? setInlineEditTitle : undefined}
        onEditSave={isThisEditing ? handleInlineEditSave : undefined}
        onEditDelete={isThisEditing ? () => handleInlineDelete(event) : undefined}
        onEditCancel={isThisEditing ? () => { setInlineEditEvent(null); setInlineEditTitle(''); } : undefined}
        onHoverDelete={() => handleInlineDelete(event)}
        onDeleteAction={() => { deleteActionRef.current = true; }}
      />
    );
  }, [user, filterProject, inlineEditEvent, inlineEditTitle, handleInlineEditSave, handleInlineDelete, handleInlineAdd, handleInlineAddCancel]);

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
        <div className={`calendar-toolbar flex flex-col bg-white border-b border-gray-200 ${isMobile ? 'px-2 py-1' : 'px-3 md:px-5 py-2'}`}>
          {/* 첫 번째 행: 날짜 네비게이션과 프로젝트 필터 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onNavigate('PREV')}
                className="px-2 py-1.5 text-2xl md:text-3xl text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-bold print-hide"
              >
                ‹
              </button>
              <div
                className="text-base md:text-lg font-bold text-gray-900 hover:bg-gray-50 px-2 md:px-3 py-1 rounded-lg transition-colors cursor-pointer print-title"
                onClick={handleOpenMonthPicker}
              >
                <span>{moment(date).format('YYYY년 MM월')}</span>
                {/* 인쇄 시 프로젝트명 표시 */}
                <span className="print-project-name hidden"> - {filterProject === 'all' ? '전체 프로젝트' : filterProject}</span>
              </div>
              <button
                onClick={() => onNavigate('NEXT')}
                className="px-2 py-1.5 text-2xl md:text-3xl text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-bold print-hide"
              >
                ›
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {/* 프로젝트 필터 */}
              <select
                className="px-3 md:px-4 py-1.5 md:py-2 bg-white text-gray-700 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 border border-gray-300 print-hide"
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
      const isSpecificProjectView = filterProject && filterProject !== 'all';
      const baseHeight = 100; // 기본 높이
      const eventHeight = isSpecificProjectView ? 60 : 18; // 일정 하나당 높이 (개별 프로젝트: 패딩 포함)
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
  }, [filteredEvents, date, isMobileView, selectedDate, filterProject]);

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
          <div className="flex gap-3">
            {/* 공정 사이드바 (프로젝트 선택 시에만 표시, 데스크톱만) */}
            {filterProject !== 'all' && !isMobileView && (
              <div className="hidden lg:block flex-shrink-0 print-hide">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 sticky top-4">
                  {/* 설정 버튼 */}
                  <button
                    onClick={() => setShowProcessModal(true)}
                    className="w-full mb-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    공정 관리
                  </button>
                  <div className="flex flex-col gap-0.5">
                    {PROCESS_LIST.map((process) => (
                      <div
                        key={process}
                        draggable
                        onDragStart={(e) => {
                          setDraggedProcess(process);
                          e.dataTransfer.setData('text/plain', process);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => setDraggedProcess(null)}
                        className={`px-3 py-1 text-xs rounded cursor-grab active:cursor-grabbing transition-colors text-center font-medium whitespace-nowrap ${
                          draggedProcess === process
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {process}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 캘린더 */}
            <div
              className={`schedule-calendar bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm calendar-container flex-1 ${filterProject !== 'all' ? 'specific-project-view' : ''}`}
              style={{ paddingBottom: 0 }}
            >
              <DragAndDropCalendar
                key={`calendar-${filterProject}-${selectedDate?.getTime() || 'no-selection'}`}
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
                onEventDrop={filterProject !== 'all' ? onEventDrop : undefined}
                onDragStart={filterProject !== 'all' ? onDragStart : undefined}
                onDropFromOutside={filterProject !== 'all' ? onDropFromOutside : undefined}
                dragFromOutsideItem={filterProject !== 'all' ? dragFromOutsideItem : undefined}
                draggableAccessor={(event: ScheduleEvent) => filterProject !== 'all' && event.id !== '__inline_add__'}
                resizable={false}
                selectable={true}
                longPressThreshold={1}
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
              <div className="max-h-[25vh] overflow-y-auto">
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
                            {event.projectName && filterProject === 'all' && (
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

              {/* 모바일 공정 버튼들 - 개별 프로젝트 선택 시에만 표시 */}
              {isMobileView && filterProject !== 'all' && (
                <div className="border-t border-gray-200 p-3 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-2">공정을 탭하여 일정 추가</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROCESS_LIST.map((processName) => (
                      <button
                        key={processName}
                        onClick={async () => {
                          // 선택된 날짜에 해당 공정으로 일정 추가
                          const targetDate = selectedDate || new Date();
                          if (filterProject !== 'all') {
                            const newScheduleId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                            const newSchedule: Schedule = {
                              id: newScheduleId,
                              title: processName,
                              start: targetDate,
                              end: targetDate,
                              project: filterProject,
                              attendees: user?.name ? [user.name] : [],
                              type: 'construction'
                            };

                            // 낙관적 업데이트: 즉시 UI에 반영
                            setSchedules([...schedules, newSchedule]);

                            // 백그라운드에서 API 호출
                            addScheduleToAPI(newSchedule).catch(error => {
                              console.error('일정 추가 실패:', error);
                              // 실패 시 롤백
                              setSchedules(schedules.filter(s => s.id !== newScheduleId));
                            });
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors font-medium"
                      >
                        {processName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  } else {
                    // 단일 일정 삭제
                    await deleteScheduleFromAPI(eventId);
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

        {/* 드래그 프리뷰 - 원본 위치에서 떨어져 나오는 효과 */}
        {draggingEvent && (
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              // 드래그 시작 시에는 원본 위치, 이동 중에는 마우스 위치
              left: isDragging ? dragPosition.x - 50 : dragStartPosition.x,
              top: isDragging ? dragPosition.y - 15 : dragStartPosition.y,
              backgroundColor: draggingEvent.color || '#F3F4F6',
              borderRadius: '6px',
              color: '#1f2937',
              padding: '4px 8px',
              fontWeight: 500,
              fontSize: '16px',
              maxWidth: '250px'
            }}
          >
            {draggingEvent.originalTitle || draggingEvent.title}
          </div>
        )}

        {/* 공정 관리 모달 */}
        {showProcessModal && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]"
            onClick={() => {
              setShowProcessModal(false);
              setEditingProcess(null);
              setNewProcessName('');
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">공정 관리</h2>
                <button
                  onClick={() => {
                    setShowProcessModal(false);
                    setEditingProcess(null);
                    setNewProcessName('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                >
                  ✕
                </button>
              </div>

              {/* 새 공정 추가 */}
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <label className="block text-xs text-gray-500 mb-2">새 공정 추가</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProcessName}
                    onChange={(e) => setNewProcessName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddProcess()}
                    placeholder="공정명 입력"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-300 focus:border-gray-400 bg-white"
                  />
                  <button
                    onClick={handleAddProcess}
                    disabled={!newProcessName.trim()}
                    className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 공정 목록 */}
              <div className="overflow-y-auto max-h-[50vh]">
                {processLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full mb-2"></div>
                    <p>불러오는 중...</p>
                  </div>
                ) : processList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p className="mb-2">등록된 공정이 없습니다</p>
                    <p className="text-xs">위에서 새 공정을 추가해주세요</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {processList.map((process, index) => (
                      <div
                        key={process.id}
                        draggable={editingProcess?.id !== process.id}
                        onDragStart={() => handleProcessDragStart(index)}
                        onDragOver={(e) => handleProcessDragOver(e, index)}
                        onDragEnd={handleProcessDragEnd}
                        onDragLeave={() => setDragOverProcessIndex(null)}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group transition-all ${
                          draggedProcessIndex === index ? 'opacity-50 bg-gray-100' : ''
                        } ${
                          dragOverProcessIndex === index ? 'border-t-2 border-gray-400' : ''
                        } ${
                          editingProcess?.id !== process.id ? 'cursor-grab active:cursor-grabbing' : ''
                        }`}
                      >
                        {editingProcess?.id === process.id ? (
                          <>
                            <input
                              type="text"
                              value={editProcessName}
                              onChange={(e) => setEditProcessName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateProcess();
                                if (e.key === 'Escape') {
                                  setEditingProcess(null);
                                  setEditProcessName('');
                                }
                              }}
                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                              autoFocus
                            />
                            <button
                              onClick={handleUpdateProcess}
                              className="px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-700"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => {
                                setEditingProcess(null);
                                setEditProcessName('');
                              }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-300 text-xs select-none">☰</span>
                            <span className="text-gray-300 text-xs w-5 text-right select-none">{index + 1}</span>
                            <span className="flex-1 text-sm text-gray-700 select-none">{process.name}</span>
                            <button
                              onClick={() => {
                                setEditingProcess(process);
                                setEditProcessName(process.name);
                              }}
                              className="px-2 py-1 text-gray-400 hover:text-gray-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteProcess(process.id)}
                              className="px-2 py-1 text-gray-400 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 푸터 */}
              {processList.length > 0 && (
                <div className="p-3 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400">
                  드래그하여 순서 변경 · 호버하여 수정/삭제
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  );
};

export default Schedule;