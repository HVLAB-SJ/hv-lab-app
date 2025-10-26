function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Interior Management System
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          인테리어 회사 통합 업무 관리 시스템
        </p>
        <div className="space-y-4">
          <div className="card max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">시스템 상태</h2>
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span>프론트엔드</span>
                <span className="text-green-600">✓ 실행중</span>
              </div>
              <div className="flex items-center justify-between">
                <span>백엔드</span>
                <span className="text-green-600">✓ 실행중</span>
              </div>
              <div className="flex items-center justify-between">
                <span>MongoDB</span>
                <span className="text-red-600">✗ 연결안됨</span>
              </div>
            </div>
          </div>

          <button className="btn btn-primary">
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;