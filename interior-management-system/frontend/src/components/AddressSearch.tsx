import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface AddressSearchProps {
  value: string;
  detailValue?: string;
  onChange: (address: string, detailAddress?: string) => void;
  onDetailChange?: (detail: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

interface AddressResult {
  roadAddr: string;      // 도로명주소
  jibunAddr: string;    // 지번주소
  zipNo: string;        // 우편번호
  bdNm?: string;        // 건물명
  siNm?: string;        // 시도명
  sggNm?: string;       // 시군구명
  emdNm?: string;       // 읍면동명
  rn?: string;          // 도로명
}

interface KakaoAddressData {
  roadAddress: string;
  jibunAddress?: string;
  autoJibunAddress?: string;
  zonecode: string;
  buildingName?: string;
  sido?: string;
  sigungu?: string;
  bname?: string;
  roadname?: string;
}

interface KakaoPostcode {
  open: () => void;
  embed: (element: HTMLElement | null) => void;
}

interface KakaoPostcodeOptions {
  oncomplete: (data: KakaoAddressData) => void;
  width?: string;
  height?: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: KakaoPostcodeOptions) => KakaoPostcode;
    };
  }
}

const AddressSearch = ({
  value,
  detailValue = '',
  onChange,
  onDetailChange,
  placeholder = '주소 검색',
  error
}: AddressSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(value);
  const [detailAddress, setDetailAddress] = useState(detailValue);
  const modalRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // value prop 변경 시 상태 업데이트
  useEffect(() => {
    setSelectedAddress(value);
  }, [value]);

  useEffect(() => {
    setDetailAddress(detailValue);
  }, [detailValue]);


  // Kakao Postcode 스크립트 로드
  const loadKakaoPostcode = () => {
    return new Promise((resolve, reject) => {
      if (window.daum && window.daum.Postcode) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Kakao Postcode 스크립트 로드 실패'));
      document.head.appendChild(script);
    });
  };


  // 주소 선택
  const handleSelectAddress = (address: AddressResult) => {
    const fullAddress = address.roadAddr || address.jibunAddr;
    setSelectedAddress(fullAddress);
    onChange(fullAddress, detailAddress);
    setIsOpen(false);
  };

  // 상세주소 변경
  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const detail = e.target.value;
    setDetailAddress(detail);
    if (onDetailChange) {
      onDetailChange(detail);
    }
    // 기본주소와 상세주소를 함께 전달
    if (selectedAddress) {
      onChange(selectedAddress, detail);
    }
  };

  // Kakao 주소검색 팝업 열기
  const openKakaoSearch = async () => {
    try {
      // Kakao 주소 검색 스크립트가 로드되어 있는지 확인
      if (!window.daum || !window.daum.Postcode) {
        await loadKakaoPostcode();
      }

      if (window.daum) {
        new window.daum.Postcode({
          oncomplete: function(data: KakaoAddressData) {
            const result: AddressResult = {
              roadAddr: data.roadAddress,
              jibunAddr: data.jibunAddress || data.autoJibunAddress || '',
              zipNo: data.zonecode,
              bdNm: data.buildingName,
              siNm: data.sido,
              sggNm: data.sigungu,
              emdNm: data.bname,
              rn: data.roadname
            };

            handleSelectAddress(result);
          }
        }).open();
      }
    } catch (error) {
      console.error('주소 검색 오류:', error);
      alert('주소 검색 서비스를 사용할 수 없습니다. 직접 입력해주세요.');
    }
  };

  return (
    <div className="space-y-2">
      {/* 주소 검색 입력 필드 */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={selectedAddress}
              onClick={() => openKakaoSearch()}
              onChange={(e) => {
                setSelectedAddress(e.target.value);
                onChange(e.target.value, detailAddress);
              }}
              placeholder={placeholder}
              className={`input pr-8 cursor-pointer ${error ? 'border-red-500' : ''}`}
              readOnly
            />
            <Search
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            />
          </div>
          <button
            type="button"
            onClick={openKakaoSearch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            주소 검색
          </button>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* 상세주소 입력 필드 */}
      <div>
        <input
          type="text"
          value={detailAddress}
          onChange={handleDetailChange}
          placeholder="상세주소 (동/호수 등)"
          className="input"
          disabled={!selectedAddress}
        />
      </div>

      {/* 전체 주소 미리보기 */}
      {selectedAddress && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-medium">전체 주소:</span>{' '}
            {selectedAddress}
            {detailAddress && `, ${detailAddress}`}
          </p>
        </div>
      )}

      {/* 임베디드 검색 컨테이너 (숨김) */}
      <div
        id="address-search-container"
        style={{ display: 'none', width: '100%', height: '400px' }}
      />
    </div>
  );
};

export default AddressSearch;