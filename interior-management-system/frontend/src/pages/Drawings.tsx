import { useState, useRef, useEffect } from 'react';
import { useDataStore } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { FileImage, Trash2, Square, ZoomIn, ArrowLeft, Edit2 } from 'lucide-react';

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

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Marker {
  id: string;
  x: number;
  y: number;
  roomId: string | null;
  roomX?: number;
  roomY?: number;
  type: string;
  label: string;
  details?: string;
}

interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  markers: Marker[];
  rooms: Room[];
  lastModified: Date;
}

const Drawings = () => {
  const { projects } = useDataStore();
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDrawingType, setSelectedDrawingType] = useState('전기도면');
  const [selectedSymbol, setSelectedSymbol] = useState(ELECTRIC_SYMBOLS[0].id);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // 작업 모드
  const [workMode, setWorkMode] = useState<'marker' | 'room'>('marker');
  const [viewMode, setViewMode] = useState<'full' | 'room'>('full');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);

  // 영역 그리기 상태
  const [isDrawingRoom, setIsDrawingRoom] = useState(false);
  const [roomDrawStart, setRoomDrawStart] = useState<{x: number, y: number} | null>(null);
  const [roomDrawCurrent, setRoomDrawCurrent] = useState<{x: number, y: number} | null>(null);

  // 영역 이름 입력 모달
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [pendingRoom, setPendingRoom] = useState<Omit<Room, 'id' | 'name'> | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedInitialProject = useRef(false);

  // Load selected project from localStorage once when projects are available
  useEffect(() => {
    if (user?.id && projects.length > 0 && !hasLoadedInitialProject.current) {
      const savedProjectId = localStorage.getItem(`drawings-selected-project-${user.id}`);
      if (savedProjectId) {
        const projectExists = projects.some(p => p.id === savedProjectId);
        if (projectExists) {
          setSelectedProject(savedProjectId);
        }
      }
      hasLoadedInitialProject.current = true;
    }
  }, [user?.id, projects]);

  // Save selected project to localStorage when it changes
  useEffect(() => {
    if (user?.id && selectedProject) {
      localStorage.setItem(`drawings-selected-project-${user.id}`, selectedProject);
    }
  }, [user?.id, selectedProject]);

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

  // 캔버스 클릭/드래그 처리
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!uploadedImage || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let x, y;

    // 영역 확대 모드일 때 좌표 변환 (letter-boxing 고려)
    if (viewMode === 'room' && selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room) {
        // 영역의 가로세로 비율
        const roomAspect = room.width / room.height;
        const containerAspect = rect.width / rect.height;

        let imageDisplayWidth, imageDisplayHeight, offsetX, offsetY;

        if (containerAspect > roomAspect) {
          // 컨테이너가 더 넓음 - 좌우 여백 발생
          imageDisplayHeight = rect.height;
          imageDisplayWidth = rect.height * roomAspect;
          offsetX = (rect.width - imageDisplayWidth) / 2;
          offsetY = 0;
        } else {
          // 컨테이너가 더 높음 - 상하 여백 발생
          imageDisplayWidth = rect.width;
          imageDisplayHeight = rect.width / roomAspect;
          offsetX = 0;
          offsetY = (rect.height - imageDisplayHeight) / 2;
        }

        // 여백을 제외한 실제 이미지 영역 내 클릭인지 확인
        const adjustedX = clickX - offsetX;
        const adjustedY = clickY - offsetY;

        if (adjustedX < 0 || adjustedX > imageDisplayWidth || adjustedY < 0 || adjustedY > imageDisplayHeight) {
          // 여백 영역 클릭 - 무시
          return;
        }

        // 이미지 내 위치를 백분율로 변환
        const percentX = (adjustedX / imageDisplayWidth) * 100;
        const percentY = (adjustedY / imageDisplayHeight) * 100;

        // 실제 이미지 좌표로 변환
        x = room.x + percentX * room.width / 100;
        y = room.y + percentY * room.height / 100;
      } else {
        return;
      }
    } else {
      // 전체 보기 모드
      x = (clickX / rect.width) * 100;
      y = (clickY / rect.height) * 100;
    }

    if (workMode === 'room') {
      // 영역 그리기 시작
      setIsDrawingRoom(true);
      setRoomDrawStart({ x, y });
      setRoomDrawCurrent({ x, y });
    } else {
      // 마커 추가 모드
      if (isDragging) return;

      const symbolInfo = ELECTRIC_SYMBOLS.find(s => s.id === selectedSymbol);

      let roomId = null;
      let roomX = undefined;
      let roomY = undefined;

      // 선택된 영역이 있으면 해당 영역에 마커 추가
      if (viewMode === 'room' && selectedRoomId) {
        const room = rooms.find(r => r.id === selectedRoomId);
        if (room) {
          roomId = selectedRoomId;
          roomX = ((x - room.x) / room.width) * 100;
          roomY = ((y - room.y) / room.height) * 100;
        }
      }

      const newMarker: Marker = {
        id: `marker-${Date.now()}`,
        x,
        y,
        roomId,
        roomX,
        roomY,
        type: selectedSymbol,
        label: symbolInfo?.name || '',
        details: ''
      };

      setMarkers([...markers, newMarker]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!uploadedImage || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let x, y;

    // 영역 확대 모드일 때 좌표 변환 (letter-boxing 고려)
    if (viewMode === 'room' && selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room) {
        const roomAspect = room.width / room.height;
        const containerAspect = rect.width / rect.height;

        let imageDisplayWidth, imageDisplayHeight, offsetX, offsetY;

        if (containerAspect > roomAspect) {
          imageDisplayHeight = rect.height;
          imageDisplayWidth = rect.height * roomAspect;
          offsetX = (rect.width - imageDisplayWidth) / 2;
          offsetY = 0;
        } else {
          imageDisplayWidth = rect.width;
          imageDisplayHeight = rect.width / roomAspect;
          offsetX = 0;
          offsetY = (rect.height - imageDisplayHeight) / 2;
        }

        const adjustedX = clickX - offsetX;
        const adjustedY = clickY - offsetY;

        const percentX = (adjustedX / imageDisplayWidth) * 100;
        const percentY = (adjustedY / imageDisplayHeight) * 100;

        x = room.x + percentX * room.width / 100;
        y = room.y + percentY * room.height / 100;
      } else {
        return;
      }
    } else {
      x = (clickX / rect.width) * 100;
      y = (clickY / rect.height) * 100;
    }

    if (isDrawingRoom && roomDrawStart) {
      // 영역 그리기 중
      setRoomDrawCurrent({ x, y });
    } else if (isDragging && draggedMarkerId) {
      // 마커 드래그 중
      const draggedMarker = markers.find(m => m.id === draggedMarkerId);
      if (draggedMarker && viewMode === 'room' && selectedRoomId) {
        const room = rooms.find(r => r.id === selectedRoomId);
        if (room) {
          // 영역 내 상대 좌표도 업데이트
          const roomX = ((x - room.x) / room.width) * 100;
          const roomY = ((y - room.y) / room.height) * 100;
          setMarkers(markers.map(m =>
            m.id === draggedMarkerId ? { ...m, x, y, roomX, roomY } : m
          ));
          return;
        }
      }
      setMarkers(markers.map(m =>
        m.id === draggedMarkerId ? { ...m, x, y } : m
      ));
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawingRoom && roomDrawStart && roomDrawCurrent) {
      // 영역 그리기 완료
      const x = Math.min(roomDrawStart.x, roomDrawCurrent.x);
      const y = Math.min(roomDrawStart.y, roomDrawCurrent.y);
      const width = Math.abs(roomDrawCurrent.x - roomDrawStart.x);
      const height = Math.abs(roomDrawCurrent.y - roomDrawStart.y);

      // 최소 크기 체크
      if (width > 2 && height > 2) {
        setPendingRoom({ x, y, width, height });
        setShowRoomNameModal(true);
      }

      setIsDrawingRoom(false);
      setRoomDrawStart(null);
      setRoomDrawCurrent(null);
    }

    setIsDragging(false);
    setDraggedMarkerId(null);
  };

  // 영역 이름 저장
  const handleSaveRoomName = () => {
    if (pendingRoom && newRoomName.trim()) {
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        name: newRoomName.trim(),
        ...pendingRoom
      };
      setRooms([...rooms, newRoom]);
      setShowRoomNameModal(false);
      setNewRoomName('');
      setPendingRoom(null);
      // 영역 그리기 완료 후 자동으로 마커 추가 모드로 전환
      setWorkMode('marker');
    }
  };

  // 마커 드래그 시작
  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDraggedMarkerId(markerId);
  };

  // 마커 삭제
  const handleDeleteMarker = (markerId: string) => {
    setMarkers(markers.filter(m => m.id !== markerId));
  };

  // 영역 삭제
  const handleDeleteRoom = (roomId: string) => {
    setRooms(rooms.filter(r => r.id !== roomId));
    // 해당 영역의 마커도 삭제
    setMarkers(markers.filter(m => m.roomId !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
      setViewMode('full');
    }
  };

  // 영역 클릭 - 확대 보기
  const handleRoomClick = (roomId: string) => {
    setSelectedRoomId(roomId);
    setViewMode('room');
  };

  // 전체 보기로 돌아가기
  const handleBackToFull = () => {
    setViewMode('full');
    setSelectedRoomId(null);
  };

  // 수량 계산
  const getSymbolCount = (symbolId: string, roomId?: string) => {
    if (roomId) {
      return markers.filter(m => m.type === symbolId && m.roomId === roomId).length;
    }
    return markers.filter(m => m.type === symbolId).length;
  };

  // 현재 보여줄 마커 계산
  const getVisibleMarkers = () => {
    if (viewMode === 'room' && selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (!room) return [];

      // 해당 영역의 마커만 반환, 영역 기준 좌표로 변환
      return markers
        .filter(m => m.roomId === selectedRoomId)
        .map(m => ({
          ...m,
          x: room.x + (m.roomX || 0) * room.width / 100,
          y: room.y + (m.roomY || 0) * room.height / 100
        }));
    }
    return markers;
  };

  // 선택된 영역
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="h-full flex flex-col">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
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

          {viewMode === 'room' && selectedRoom && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToFull}
                className="btn btn-outline text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                전체 보기
              </button>
              <span className="text-lg font-semibold text-gray-900">{selectedRoom.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 도면 종류 및 영역 목록 - 항상 표시 */}
        <div className="w-48 bg-white border-r flex-shrink-0 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">도면 종류</h3>
            <div className="space-y-1 mb-6">
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

            {selectedProject && selectedDrawingType === '전기도면' && uploadedImage && (
              <>
                <div className="mb-6">
                  <button
                    onClick={() => setWorkMode('room')}
                    className="w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center bg-green-600 text-white font-medium hover:bg-green-700"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    영역 그리기
                  </button>
                </div>

                {rooms.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">영역 목록</h3>
                    <div className="space-y-1">
                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between group ${
                            selectedRoomId === room.id
                              ? 'bg-purple-600 text-white font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <button
                            onClick={() => handleRoomClick(room.id)}
                            className="flex-1 text-left"
                          >
                            {room.name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRoom(room.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 ml-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {selectedProject ? (
          <>

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
              <div className="flex-1 overflow-hidden p-6">
                {uploadedImage ? (
                  <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
                    <div
                      ref={canvasRef}
                      className={`relative w-full h-full ${
                        workMode === 'room' ? 'cursor-crosshair' : 'cursor-default'
                      }`}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                    >
                      <img
                        ref={imageRef}
                        src={uploadedImage}
                        alt="평면도"
                        className="w-full h-full object-contain pointer-events-none select-none"
                        draggable={false}
                        style={
                          viewMode === 'room' && selectedRoom
                            ? (() => {
                                const scaleX = 100 / selectedRoom.width;
                                const scaleY = 100 / selectedRoom.height;
                                const scale = Math.min(scaleX, scaleY);
                                return {
                                  transform: `scale(${scale}) translate(${-selectedRoom.x}%, ${-selectedRoom.y}%)`,
                                  transformOrigin: '0 0',
                                  clipPath: `inset(${selectedRoom.y}% ${100 - selectedRoom.x - selectedRoom.width}% ${100 - selectedRoom.y - selectedRoom.height}% ${selectedRoom.x}%)`
                                };
                              })()
                            : undefined
                        }
                      />

                    {/* 영역 표시 (전체 보기 모드) */}
                    {viewMode === 'full' && rooms.map((room) => (
                      <div
                        key={room.id}
                        className="absolute border-2 border-purple-500 bg-purple-500 bg-opacity-10 hover:bg-opacity-20 transition-all cursor-pointer group"
                        style={{
                          left: `${room.x}%`,
                          top: `${room.y}%`,
                          width: `${room.width}%`,
                          height: `${room.height}%`
                        }}
                        onClick={() => handleRoomClick(room.id)}
                      >
                        <div className="absolute top-1 left-1 bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-medium">
                          {room.name}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room.id);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {/* 영역 그리기 중 */}
                    {isDrawingRoom && roomDrawStart && roomDrawCurrent && (
                      <div
                        className="absolute border-2 border-dashed border-green-500 bg-green-500 bg-opacity-10"
                        style={{
                          left: `${Math.min(roomDrawStart.x, roomDrawCurrent.x)}%`,
                          top: `${Math.min(roomDrawStart.y, roomDrawCurrent.y)}%`,
                          width: `${Math.abs(roomDrawCurrent.x - roomDrawStart.x)}%`,
                          height: `${Math.abs(roomDrawCurrent.y - roomDrawStart.y)}%`
                        }}
                      />
                    )}

                    {/* 마커들 */}
                    {getVisibleMarkers().map((marker) => {
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
                            <div
                              className="rounded-full shadow-md transition-transform group-hover:scale-110"
                              style={{
                                backgroundColor: symbolInfo.color,
                                width: '16px',
                                height: '16px'
                              }}
                            />
                          ) : (
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
              {selectedDrawingType === '전기도면' && uploadedImage && workMode === 'marker' && (
                <div className="bg-white border-t px-6 py-3 flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700 mr-2">C: 콘센트 / S: 스위치 / ●: 조명</span>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    {ELECTRIC_SYMBOLS.map((symbol) => (
                      <button
                        key={symbol.id}
                        onClick={() => setSelectedSymbol(symbol.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
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
                    const count = getSymbolCount(symbol.id, viewMode === 'room' ? selectedRoomId || undefined : undefined);
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileImage className="w-20 h-20 mx-auto mb-4 text-gray-400" />
              <p className="text-lg text-gray-600 mb-2">프로젝트를 선택하여 시작하세요</p>
              <p className="text-sm text-gray-500">도면을 업로드하고 전기/설비 위치를 표시할 수 있습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* 영역 이름 입력 모달 */}
      {showRoomNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">영역 이름 입력</h3>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveRoomName();
                }
              }}
              placeholder="예: 거실, 침실1, 주방"
              className="input w-full mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRoomNameModal(false);
                  setNewRoomName('');
                  setPendingRoom(null);
                }}
                className="btn btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleSaveRoomName}
                className="btn btn-primary"
                disabled={!newRoomName.trim()}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drawings;
