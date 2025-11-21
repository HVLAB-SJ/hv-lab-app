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
  { id: 'outlet', name: '콘센트', symbol: '⊕', color: '#ef4444' },
  { id: 'switch', name: '스위치', symbol: '─┤', color: '#3b82f6' },
  { id: 'light', name: '조명', symbol: '◎', color: '#f59e0b' },
  { id: 'panel', name: '배전반', symbol: '▭', color: '#8b5cf6' }
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

  // 마커 드래그
  const handleMarkerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !draggedMarkerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

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
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">공사도면</h1>
        <p className="text-gray-600">프로젝트별 도면을 관리하고 전기/설비 위치를 표시하세요</p>
      </div>

      {/* 프로젝트 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          프로젝트 선택
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="input max-w-md"
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

      {selectedProject && (
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측: 도면 종류 선택 */}
          <div className="col-span-2 bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">도면 종류</h3>
            <div className="space-y-1">
              {DRAWING_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedDrawingType(type)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedDrawingType === type
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 중앙: 작업 영역 */}
          <div className="col-span-7 bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                {uploadedImage ? (
                  <div
                    ref={canvasRef}
                    className="relative cursor-crosshair"
                    onClick={handleCanvasClick}
                    onMouseMove={handleMarkerMove}
                    onMouseUp={handleMarkerMouseUp}
                    onMouseLeave={handleMarkerMouseUp}
                    style={{ minHeight: '600px' }}
                  >
                    <img
                      src={uploadedImage}
                      alt="평면도"
                      className="w-full h-auto pointer-events-none select-none"
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
                          <div
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 shadow-lg text-lg font-bold transition-transform group-hover:scale-110"
                            style={{ borderColor: symbolInfo?.color, color: symbolInfo?.color }}
                          >
                            {symbolInfo?.symbol}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMarker(marker.id);
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-gray-500">
                    <FileImage className="w-16 h-16 mb-4 text-gray-400" />
                    <p className="text-sm mb-2">평면도 이미지를 업로드하세요</p>
                    <p className="text-xs text-gray-400">이미지를 클릭하여 마커를 추가할 수 있습니다</p>
                  </div>
                )}
              </div>

              {/* 하단 툴바 */}
              {selectedDrawingType === '전기도면' && uploadedImage && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">심볼 선택:</span>
                    {ELECTRIC_SYMBOLS.map((symbol) => (
                      <button
                        key={symbol.id}
                        onClick={() => setSelectedSymbol(symbol.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedSymbol === symbol.id
                            ? 'bg-gray-900 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-900'
                        }`}
                      >
                        <span className="text-lg mr-2" style={{ color: selectedSymbol === symbol.id ? 'white' : symbol.color }}>
                          {symbol.symbol}
                        </span>
                        {symbol.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 수량 집계 */}
          <div className="col-span-3 bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">수량 집계</h3>
            {selectedDrawingType === '전기도면' && (
              <div className="space-y-3">
                {ELECTRIC_SYMBOLS.map((symbol) => {
                  const count = getSymbolCount(symbol.id);
                  return (
                    <div
                      key={symbol.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl" style={{ color: symbol.color }}>
                          {symbol.symbol}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{symbol.name}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{count}개</span>
                    </div>
                  );
                })}

                {markers.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-8">
                    평면도에 마커를 추가하면<br />자동으로 수량이 집계됩니다
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedProject && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileImage className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">프로젝트를 선택하여 시작하세요</p>
          <p className="text-sm text-gray-500">도면을 업로드하고 전기/설비 위치를 표시할 수 있습니다</p>
        </div>
      )}
    </div>
  );
};

export default Drawings;
