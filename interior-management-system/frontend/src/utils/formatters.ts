/**
 * 공통 포맷팅 유틸리티 함수
 */

/**
 * 시간 문자열을 한국어 형식으로 변환
 * @param time "HH:mm" 형식의 시간 문자열
 * @returns "오전/오후 N시 M분" 형식의 문자열
 */
export const formatTimeKorean = (time: string): string => {
  if (!time || time === '-') return '';
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const period = hours >= 12 ? '오후' : '오전';
  const displayHours = hours % 12 || 12;
  return minutes > 0
    ? `${period} ${displayHours}시 ${minutes}분`
    : `${period} ${displayHours}시`;
};

/**
 * 직책 목록
 */
const positions = [
  '대표이사', '부사장', '전무', '상무', '이사', '실장', '부장', '차장',
  '과장', '대리', '주임', '사원', '팀장', '소장', '대표', '사장', '회장',
  '반장', '현장', '본부장', '팀원', '파트장', '조장', '감독', '기사', '수석', '책임'
];

/**
 * 이름에서 직책을 제거
 * @param name 직책이 포함된 이름 문자열
 * @returns 직책이 제거된 순수 이름
 */
export const removePosition = (name: string): string => {
  if (!name) return name;

  // "님" 제거
  const cleanName = name.replace(/님$/g, '').trim();

  // 공백으로 분리
  const parts = cleanName.split(' ');

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    for (const position of positions) {
      if (lastPart === position) {
        return parts.slice(0, -1).join(' ').trim();
      }
    }
  }

  // 직책이 이름에 붙어있는 경우
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      return cleanName.substring(0, cleanName.length - position.length).trim() || cleanName;
    }
  }

  return cleanName;
};

/**
 * 이름에서 직책을 추출
 * @param name 직책이 포함된 이름 문자열
 * @returns 추출된 직책 또는 빈 문자열
 */
export const extractPosition = (name: string): string => {
  const cleanName = name.replace(/님$/g, '').trim();

  // 공백으로 분리된 경우
  const parts = cleanName.split(' ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    for (const position of positions) {
      if (lastPart === position) {
        return position;
      }
    }
  }

  // 직책이 이름에 붙어있는 경우
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      return position;
    }
  }

  return '';
};

/**
 * 숫자를 원화 형식으로 포맷팅
 * @param amount 금액
 * @returns "1,234,567원" 형식의 문자열
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
};

/**
 * 날짜를 한국어 형식으로 포맷팅
 * @param date Date 객체 또는 날짜 문자열
 * @returns "YYYY년 MM월 DD일" 형식의 문자열
 */
export const formatDateKorean = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};
