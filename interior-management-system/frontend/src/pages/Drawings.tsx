import { useState, useRef, useEffect } from 'react';
import { useDataStore } from '../store/dataStore';
import { FileImage, Plus, Trash2, Move } from 'lucide-react';

// 도면 종류
const DRAWING_TYPES = [
  '평면도',
  '3D도면',
  '철거도면',
  '전기도면',
  '설비도면',
  '목공도면',
  '타일도면',
  '금속도면',
  '가구도면',
  '세라믹도면',
  '디테일도면',
  '천장도면'
];

// 전기 심볼 종류
const ELECTRIC_SYMBOLS = [
  { id: 'outlet-1', name: '콘센트 1구', symbol: 'C1', count: 1, color: '#ef4444', category: 'outlet' },
  { id: 'outlet-2', name: '콘센트 2구', symbol: 'C2', count: 2, color: '#ef4444', category: 'outlet' },
  { id: 'outlet-3', name: '콘센트 3구', symbol: 'C3', count: 3, color: '#ef4444', category: 'outlet' },
  { id: 'outlet-4', name: '콘센트 4구', symbol: 'C4', count: 4, color: '#ef4444', category: 'outlet' },
  { id: 'switch-1', name: '스위치 1구', symbol: 'S1', count: 1, color: '#3b82f6', category: 'switch' },
  { id: 'switch-2', name: '스위치 2구', symbol: 'S2', count: 2, color: '#3b82f6', category: 'switch' },
  { id: 'switch-3', name: '스위치 3구', symbol: 'S3', count: 3, color: '#3b82f6', category: 'switch' },
  { id: 'switch-4', name: '스위치 4구', symbol: 'S4', count: 4, color: '#3b82f6', category: 'switch' },
  { id: 'switch-5', name: '스위치 5구', symbol: 'S5', count: 5, color: '#3b82f6', category: 'switch' },
  { id: 'switch-6', name: '스위치 6구', symbol: 'S6', count: 6, color: '#3b82f6', category: 'switch' },
  { id: 'switch-7', name: '스위치 7구', symbol: 'S7', count: 7, color: '#3b82f6', category: 'switch' },
  { id: 'switch-8', name: '스위치 8구', symbol: 'S8', count: 8, color: '#3b82f6', category: 'switch' },
  { id: 'light', name: '조명', symbol: '●', count: 1, color: '#f59e0b', category: 'light' }
];

interface Marker {
  id: string;
  x: number;
  y: number;
  type: string;
  label: string;
  details?: string;
}

interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  markers: Marker[];
  lastModified: Date;
}

const Drawings = () => {
  const { projects } = useDataStore();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDrawingType, setSelectedDrawingType] = useState('전기도면');
  const [selectedSymbol, setSelectedSymbol] = useState(ELECTRIC_SYMBOLS[0].id);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 업로드
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 캔버스 클릭 - 마커 추가
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!uploadedImage || isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const symbolInfo = ELECTRIC_SYMBOLS.find(s => s.id === selectedSymbol);
    const newMarker: Marker = {
      id: `marker-${Date.now()}`,
      x,
      y,
      type: selectedSymbol,
      label: symbolInfo?.name || '',
      details: ''
    };

    setMarkers([...markers, newMarker]);
  };

  // 마커 드래그 시작
  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDraggedMarkerId(markerId);
  };

  // 마커 드래그 - 스냅(자석) 기능 추가
  const handleMarkerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !draggedMarkerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // 스냅 임계값 (2% 이내면 스냅)
    const snapThreshold = 2;

    // 다른 마커들과의 정렬 체크
    const otherMarkers = markers.filter(m => m.id !== draggedMarkerId);

    for (const marker of otherMarkers) {
      // X축 정렬
      if (Math.abs(x - marker.x) < snapThreshold) {
        x = marker.x;
      }
      // Y축 정렬
      if (Math.abs(y - marker.y) < snapThreshold) {
        y = marker.y;
      }
    }

    setMarkers(markers.map(m =>
      m.id === draggedMarkerId ? { ...m, x, y } : m
    ));
  };

  // 마커 드래그 종료
  const handleMarkerMouseUp = () => {
    setIsDragging(false);
    setDraggedMarkerId(null);
  };

  // 마커 삭제
  const handleDeleteMarker = (markerId: string) => {
    setMarkers(markers.filter(m => m.id !== markerId));
  };

  // 수량 계산
  const getSymbolCount = (symbolId: string) => {
    return markers.filter(m => m.type === symbolId).length;
  };

  return (
    <div className="h-full flex flex-col">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-6 py-3 flex-shrink-0">
        <div className="w-80">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="input w-full"
          >
            <option value="">프로젝트를 선택하세요</option>
            {projects
              .filter(p => p.status !== 'completed')
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {selectedProject && (
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측: 도면 종류 선택 */}
          <div className="w-48 bg-white border-r flex-shrink-0 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">도면 종류</h3>
              <div className="space-y-1">
                {DRAWING_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedDrawingType(type)}
                    className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors ${
                      selectedDrawingType === type
                        ? 'bg-gray-900 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 중앙: 작업 영역 */}
          <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 상단 툴바 */}
              <div className="bg-white border-b px-6 py-3 flex items-center justify-between flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">{selectedDrawingType}</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-outline text-sm"
                >
                  <FileImage className="w-4 h-4 mr-2" />
                  평면도 업로드
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* 캔버스 영역 */}
              <div className="flex-1 overflow-auto p-6">
                {uploadedImage ? (
                  <div
                    ref={canvasRef}
                    className="relative cursor-crosshair bg-white rounded-lg shadow-lg w-full h-full"
                    onClick={handleCanvasClick}
                    onMouseMove={handleMarkerMove}
                    onMouseUp={handleMarkerMouseUp}
                    onMouseLeave={handleMarkerMouseUp}
                  >
                    <img
                      src={uploadedImage}
                      alt="평면도"
                      className="w-full h-full object-contain pointer-events-none select-none"
                      draggable={false}
                    />

                    {/* 마커들 */}
                    {markers.map((marker) => {
                      const symbolInfo = ELECTRIC_SYMBOLS.find(s => s.id === marker.type);
                      return (
                        <div
                          key={marker.id}
                          onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move group"
                          style={{
                            left: `${marker.x}%`,
                            top: `${marker.y}%`
                          }}
                        >
                          {symbolInfo?.category === 'light' ? (
                            // 조명은 원형, 테두리 없음
                            <div
                              className="flex items-center justify-center rounded-full shadow-md transition-transform group-hover:scale-110"
                              style={{
                                backgroundColor: symbolInfo.color,
                                color: 'white',
                                width: '16px',
                                height: '16px',
                                fontSize: '12px',
                                fontWeight: '700'
                              }}
                            >
                              {symbolInfo.symbol}
                            </div>
                          ) : (
                            // 콘센트/스위치는 사각형, 테두리 있음
                            <div
                              className="flex items-center justify-center bg-white rounded shadow-md transition-transform group-hover:scale-110"
                              style={{
                                borderColor: symbolInfo?.color,
                                color: symbolInfo?.color,
                                border: '1.5px solid',
                                padding: '2px 4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                minWidth: '20px',
                                minHeight: '20px'
                              }}
                            >
                              {symbolInfo?.symbol}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMarker(marker.id);
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg shadow-lg text-gray-500">
                    <FileImage className="w-20 h-20 mb-4 text-gray-400" />
                    <p className="text-base mb-2">평면도 이미지를 업로드하세요</p>
                    <p className="text-sm text-gray-400">이미지를 클릭하여 마커를 추가할 수 있습니다</p>
                  </div>
                )}
              </div>

              {/* 하단 툴바 */}
              {selectedDrawingType === '전기도면' && uploadedImage && (
                <div className="bg-white border-t px-6 py-3 flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700 mr-2">심볼:</span>
                    {ELECTRIC_SYMBOLS.map((symbol) => (
                      <button
                        key={symbol.id}
                        onClick={() => setSelectedSymbol(symbol.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                          selectedSymbol === symbol.id
                            ? 'bg-gray-900 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-900'
                        }`}
                        style={{
                          borderColor: selectedSymbol === symbol.id ? undefined : symbol.color,
                          borderWidth: selectedSymbol === symbol.id ? undefined : '1.5px'
                        }}
                      >
                        <span className="text-sm font-semibold" style={{ color: selectedSymbol === symbol.id ? 'white' : symbol.color }}>
                          {symbol.symbol}
                        </span>
                        <span>{symbol.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 수량 집계 */}
          <div className="w-80 bg-white border-l flex-shrink-0 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">수량 집계</h3>
              {selectedDrawingType === '전기도면' && (
                <div className="space-y-2">
                  {ELECTRIC_SYMBOLS.map((symbol) => {
                    const count = getSymbolCount(symbol.id);
                    if (count === 0) return null;
                    return (
                      <div
                        key={symbol.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                        style={{ borderColor: symbol.color, borderWidth: '1.5px' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-base font-semibold px-2 py-1 bg-white rounded"
                            style={{
                              color: symbol.color,
                              border: `1.5px solid ${symbol.color}`
                            }}
                          >
                            {symbol.symbol}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{symbol.name}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{count}개</span>
                      </div>
                    );
                  })}

                  {markers.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-12">
                      평면도에 마커를 추가하면<br />자동으로 수량이 집계됩니다
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedProject && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <FileImage className="w-20 h-20 mx-auto mb-4 text-gray-400" />
            <p className="text-lg text-gray-600 mb-2">프로젝트를 선택하여 시작하세요</p>
            <p className="text-sm text-gray-500">도면을 업로드하고 전기/설비 위치를 표시할 수 있습니다</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drawings;
