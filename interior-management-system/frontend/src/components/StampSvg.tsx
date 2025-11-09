// 직인 SVG 컴포넌트 - 인쇄 시에도 확실히 표시되도록 인라인 SVG 사용
export const StampSvg = () => {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="stamp-svg"
      style={{
        position: 'absolute',
        top: '50%',
        left: 'calc(50% + 25px)',
        transform: 'translate(-50%, -50%)',
        opacity: 0.7,
        zIndex: 20,
        pointerEvents: 'none'
      }}
    >
      {/* 빨간 사각형 테두리 */}
      <rect
        x="5"
        y="5"
        width="90"
        height="90"
        fill="none"
        stroke="red"
        strokeWidth="3"
      />

      {/* 에이치브이랩 텍스트 */}
      <text
        x="50"
        y="30"
        textAnchor="middle"
        fill="red"
        fontSize="11"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        에이치브이랩
      </text>

      {/* 김상준 텍스트 */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        fill="red"
        fontSize="14"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        김상준
      </text>

      {/* 대표 텍스트 */}
      <text
        x="50"
        y="70"
        textAnchor="middle"
        fill="red"
        fontSize="11"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        대표
      </text>
    </svg>
  );
};