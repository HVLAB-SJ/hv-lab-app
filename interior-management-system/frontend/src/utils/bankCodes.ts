/**
 * 은행 코드 매핑
 * 오픈뱅킹 표준 은행 코드
 */
export const BANK_CODES: Record<string, string> = {
  'KB국민은행': '004',
  '국민은행': '004',
  'KB': '004',

  '신한은행': '088',
  '신한': '088',

  '우리은행': '020',
  '우리': '020',

  'NH농협은행': '011',
  '농협은행': '011',
  '농협': '011',
  'NH': '011',

  '하나은행': '081',
  '하나': '081',

  'IBK기업은행': '003',
  '기업은행': '003',
  'IBK': '003',

  'SC제일은행': '023',
  '제일은행': '023',
  'SC': '023',

  '한국씨티은행': '027',
  '씨티은행': '027',
  '씨티': '027',
  'Citi': '027',

  '경남은행': '039',
  '광주은행': '034',
  '대구은행': '031',
  '부산은행': '032',
  '전북은행': '037',
  '제주은행': '035',

  '케이뱅크': '089',
  'K뱅크': '089',
  'Kbank': '089',

  '카카오뱅크': '090',
  '카뱅': '090',

  '토스뱅크': '092',
  '토스': '092',
  'Toss': '092',

  '산업은행': '002',
  'KDB': '002',

  '수협은행': '007',
  '수협': '007',

  '저축은행': '050',
  '새마을금고': '045',
  '신협': '048',
  '우체국': '071',
  '산림조합': '064'
};

/**
 * 은행명으로 은행 코드 조회
 */
export function getBankCode(bankName: string): string {
  if (!bankName) return '';

  // 정확한 매칭 시도
  if (BANK_CODES[bankName]) {
    return BANK_CODES[bankName];
  }

  // 부분 매칭 시도 (띄어쓰기 제거)
  const normalizedName = bankName.replace(/\s/g, '');
  for (const [key, code] of Object.entries(BANK_CODES)) {
    if (key.replace(/\s/g, '') === normalizedName) {
      return code;
    }
  }

  // 포함 여부로 매칭
  for (const [key, code] of Object.entries(BANK_CODES)) {
    if (bankName.includes(key) || key.includes(bankName)) {
      return code;
    }
  }

  console.warn(`Unknown bank name: ${bankName}`);
  return '';
}

/**
 * 은행 코드로 은행명 조회
 */
export function getBankName(bankCode: string): string {
  const entry = Object.entries(BANK_CODES).find(([, code]) => code === bankCode);
  return entry ? entry[0] : bankCode;
}

/**
 * 지원되는 은행 목록
 */
export function getSupportedBanks(): Array<{code: string, name: string}> {
  // 주요 은행만 반환 (중복 제거)
  const mainBanks = [
    { code: '004', name: 'KB국민은행' },
    { code: '088', name: '신한은행' },
    { code: '020', name: '우리은행' },
    { code: '011', name: 'NH농협은행' },
    { code: '081', name: '하나은행' },
    { code: '003', name: 'IBK기업은행' },
    { code: '023', name: 'SC제일은행' },
    { code: '027', name: '한국씨티은행' },
    { code: '089', name: '케이뱅크' },
    { code: '090', name: '카카오뱅크' },
    { code: '092', name: '토스뱅크' },
    { code: '039', name: '경남은행' },
    { code: '034', name: '광주은행' },
    { code: '031', name: '대구은행' },
    { code: '032', name: '부산은행' },
    { code: '037', name: '전북은행' },
    { code: '035', name: '제주은행' },
  ];

  return mainBanks;
}

/**
 * 계좌번호 포맷팅 (하이픈 자동 추가)
 */
export function formatAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '';

  // 숫자만 추출
  const numbers = accountNumber.replace(/\D/g, '');

  // 은행별 계좌번호 포맷
  // 대부분의 은행은 XXX-XXXXXX-XXXXX 형식
  if (numbers.length >= 10) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, -5)}-${numbers.slice(-5)}`;
  }

  return numbers;
}
