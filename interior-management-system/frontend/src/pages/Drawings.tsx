import { useState, useRef, useEffect } from 'react';
import { useDataStore } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { FileImage, Trash2, Square, ZoomIn, ArrowLeft, Edit2 } from 'lucide-react';
import { drawingStorage } from '../utils/drawingStorage';

// 도면 종류
const DRAWING_TYPES = [
  '네이버도면',
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
  const [selectedDrawingType, setSelectedDrawingType] = useState('네이버도면');
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
  const isLoadingRef = useRef(false); // 데이터 로딩 중 플래그
  const hasMigratedRef = useRef(false); // 마이그레이션 완료 플래그

  // localStorage에서 IndexedDB로 데이터 마이그레이션 (최초 1회만)
  useEffect(() => {
    if (user?.id && !hasMigratedRef.current) {
      hasMigratedRef.current = true;
      drawingStorage.migrateFromLocalStorage(user.id).then(count => {
        if (count > 0) {
          console.log(`✅ ${count}개의 도면을 IndexedDB로 마이그레이션했습니다.`);
        }
      }).catch(error => {
        console.error('마이그레이션 실패:', error);
      });
    }
  }, [user?.id]);

  // Load from localStorage when user and projects are ready (only if not selected)
  useEffect(() => {
    if (user?.id && projects.length > 0 && !selectedProject) {
      const savedProjectId = localStorage.getItem(`drawings-selected-project-${user.id}`);

      if (savedProjectId) {
        const projectExists = projects.some(p => p.id === savedProjectId);
        if (projectExists) {
          setSelectedProject(savedProjectId);
        }
      }
    }
  }, [user?.id, projects, selectedProject]);

  // Load drawing type from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const savedDrawingType = localStorage.getItem(`drawings-selected-type-${user.id}`);
      if (savedDrawingType && DRAWING_TYPES.includes(savedDrawingType)) {
        setSelectedDrawingType(savedDrawingType);
      }
    }
  }, [user?.id]);

  // Save selected project to localStorage when it changes
  useEffect(() => {
    if (user?.id && selectedProject) {
      localStorage.setItem(`drawings-selected-project-${user.id}`, selectedProject);
    }
  }, [user?.id, selectedProject]);

  // Save selected drawing type to localStorage when it changes
  useEffect(() => {
    if (user?.id && selectedDrawingType) {
      localStorage.setItem(`drawings-selected-type-${user.id}`, selectedDrawingType);
    }
  }, [user?.id, selectedDrawingType]);

  // Load drawing data when project or drawing type changes
  useEffect(() => {
    if (user?.id && selectedProject && selectedDrawingType) {
      isLoadingRef.current = true; // 로딩 시작
      const key = `drawing-${user.id}-${selectedProject}-${selectedDrawingType}`;

      // IndexedDB에서 데이터 로드 (비동기)
      drawingStorage.getItem(key).then(data => {
        if (data) {
          setUploadedImage(data.imageUrl || '');
          setMarkers(data.markers || []);
          setRooms(data.rooms || []);
        } else {
          // Clear current data if no saved data exists
          setUploadedImage('');
          setMarkers([]);
          setRooms([]);
        }
        // Reset view mode when switching drawings
        setViewMode('full');
        setSelectedRoomId(null);

        // 로딩 완료 - 다음 렌더 사이클에서 저장 가능하도록 설정
        setTimeout(() => {
          isLoadingRef.current = false;
        }, 0);
      }).catch(error => {
        console.error('Failed to load drawing data:', error);
        // 에러 발생 시에도 초기화
        setUploadedImage('');
        setMarkers([]);
        setRooms([]);
        setViewMode('full');
        setSelectedRoomId(null);
        isLoadingRef.current = false;
      });
    }
  }, [user?.id, selectedProject, selectedDrawingType]);

  // Save drawing data when image, markers, or rooms change
  useEffect(() => {
    // 로딩 중이면 저장하지 않음 (무한 루프 방지)
    if (isLoadingRef.current) {
      return;
    }

    if (user?.id && selectedProject && selectedDrawingType && uploadedImage) {
      const key = `drawing-${user.id}-${selectedProject}-${selectedDrawingType}`;
      const data: DrawingData = {
        type: selectedDrawingType,
        projectId: selectedProject,
        imageUrl: uploadedImage,
        markers,
        rooms,
        lastModified: new Date()
      };

      // IndexedDB에 저장 (비동기)
      drawingStorage.setItem(key, data, user.id).catch(error => {
        console.error('Failed to save drawing data:', error);
        alert('도면 저장 중 오류가 발생했습니다.');
      });
    }
  }, [user?.id, selectedProject, selectedDrawingType, uploadedImage, markers, rooms]);

  // 이미지 압축 및 업로드
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 체크 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기가 너무 큽니다. 10MB 이하의 이미지를 선택해주세요.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // 최대 크기 설정 (2048px로 설정 - 화질 개선)
          const MAX_WIDTH = 2048;
          const MAX_HEIGHT = 2048;
          let width = img.width;
          let height = img.height;

          // 비율 유지하며 리사이즈
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height;
              height = MAX_HEIGHT;
            }
          }

          // Canvas로 리사이즈 및 압축
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);

            // JPEG로 압축 (품질 0.88로 설정 - 화질과 용량 균형)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);

            // Base64 크기 체크 (약 3MB 제한)
            const sizeInBytes = (compressedDataUrl.length * 3) / 4;
            const sizeInMB = sizeInBytes / (1024 * 1024);

            if (sizeInMB > 3) {
              alert('압축된 이미지가 여전히 큽니다 (3MB 초과). 더 작은 이미지를 선택해주세요.');
              return;
            }

            setUploadedImage(compressedDataUrl);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }

    // 파일 입력 초기화 (같은 파일 재선택 가능하도록)
    e.target.value = '';
  };

  // 이미지 삭제
  const handleDeleteImage = () => {
    if (confirm('이미지를 삭제하시겠습니까? 마커와 영역 데이터도 함께 삭제됩니다.')) {
      setUploadedImage('');
      setMarkers([]);
      setRooms([]);
      setViewMode('full');
      setSelectedRoomId(null);

      // IndexedDB에서도 삭제
      if (user?.id && selectedProject && selectedDrawingType) {
        const key = `drawing-${user.id}-${selectedProject}-${selectedDrawingType}`;
        drawingStorage.removeItem(key).catch(error => {
          console.error('Failed to delete drawing:', error);
        });
      }
    }
  };

  // 모든 도면 데이터 삭제
  const handleClearAllDrawings = () => {
    if (confirm('⚠️ 경고: 모든 프로젝트의 모든 도면 데이터를 삭제합니다.\n\n계속하시겠습니까?')) {
      if (confirm('정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        // IndexedDB의 모든 도면 데이터 삭제
        drawingStorage.clearAll().then(count => {
          // 현재 상태 초기화
          setUploadedImage('');
          setMarkers([]);
          setRooms([]);
          setViewMode('full');
          setSelectedRoomId(null);

          alert(`✅ ${count}개의 도면 데이터가 삭제되었습니다.`);
        }).catch(error => {
          console.error('Failed to clear drawings:', error);
          alert('데이터 삭제 중 오류가 발생했습니다.');
        });
      }
    }
  };

  // 캔버스 클릭/드래그 처리
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!uploadedImage || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let x, y;

    // 영역 확대 모드일 때 좌표 변환
    if (viewMode === 'room' && selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (!room || !imageRef.current) return;

      // 실제 이미지 크기
      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      if (!naturalWidth || !naturalHeight) return;

      // 실제 이미지의 비율
      const imageAspect = naturalWidth / naturalHeight;
      const containerAspect = rect.width / rect.height;

      // object-contain 방식으로 표시되는 실제 크기 계산
      let displayWidth, displayHeight, offsetX, offsetY;

      if (containerAspect > imageAspect) {
        // 컨테이너가 더 넓음 - 좌우 여백
        displayHeight = rect.height;
        displayWidth = rect.height * imageAspect;
        offsetX = (rect.width - displayWidth) / 2;
        offsetY = 0;
      } else {
        // 컨테이너가 더 높음 - 상하 여백
        displayWidth = rect.width;
        displayHeight = rect.width / imageAspect;
        offsetX = 0;
        offsetY = (rect.height - displayHeight) / 2;
      }

      // 여백을 제외한 클릭 위치
      const adjustedX = clickX - offsetX;
      const adjustedY = clickY - offsetY;

      // 여백 영역 클릭 시 무시
      if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
        return;
      }

      // 클릭 위치를 전체 이미지 기준 백분율로 변환
      x = (adjustedX / displayWidth) * 100;
      y = (adjustedY / displayHeight) * 100;
    } else {
      // 전체 보기 모드 - 동일한 로직 사용
      if (!imageRef.current) return;

      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      if (!naturalWidth || !naturalHeight) return;

      const imageAspect = naturalWidth / naturalHeight;
      const containerAspect = rect.width / rect.height;

      let displayWidth, displayHeight, offsetX, offsetY;

      if (containerAspect > imageAspect) {
        displayHeight = rect.height;
        displayWidth = rect.height * imageAspect;
        offsetX = (rect.width - displayWidth) / 2;
        offsetY = 0;
      } else {
        displayWidth = rect.width;
        displayHeight = rect.width / imageAspect;
        offsetX = 0;
        offsetY = (rect.height - displayHeight) / 2;
      }

      const adjustedX = clickX - offsetX;
      const adjustedY = clickY - offsetY;

      if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
        return;
      }

      x = (adjustedX / displayWidth) * 100;
      y = (adjustedY / displayHeight) * 100;
    }

    if (workMode === 'room') {
      // 영역 그리기 시작
      setIsDrawingRoom(true);
      setRoomDrawStart({ x, y });
      setRoomDrawCurrent({ x, y });
    } else if (selectedDrawingType === '전기도면') {
      // 마커 추가 모드 (전기도면에서만)
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
    if (!uploadedImage || !canvasRef.current || !imageRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const naturalWidth = imageRef.current.naturalWidth;
    const naturalHeight = imageRef.current.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;

    const imageAspect = naturalWidth / naturalHeight;
    const containerAspect = rect.width / rect.height;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (containerAspect > imageAspect) {
      displayHeight = rect.height;
      displayWidth = rect.height * imageAspect;
      offsetX = (rect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = rect.width;
      displayHeight = rect.width / imageAspect;
      offsetX = 0;
      offsetY = (rect.height - displayHeight) / 2;
    }

    const adjustedX = clickX - offsetX;
    const adjustedY = clickY - offsetY;

    if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
      return;
    }

    const x = (adjustedX / displayWidth) * 100;
    const y = (adjustedY / displayHeight) * 100;

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
      // 영역 그리기 모드 유지 (사용자가 직접 토글할 때까지)
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
                    onClick={() => setWorkMode(workMode === 'room' ? 'marker' : 'room')}
                    className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center font-medium ${
                      workMode === 'room'
                        ? 'bg-green-700 text-white'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {workMode === 'room' ? '영역 그리기 중...' : '영역 그리기'}
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
                {uploadedImage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-outline text-sm"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      이미지 변경
                    </button>
                    <button
                      onClick={handleDeleteImage}
                      className="btn btn-outline text-sm text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      이미지 삭제
                    </button>
                  </div>
                )}
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
                                // 비율 유지를 위해 더 큰 scale 값 사용
                                const scaleX = 100 / selectedRoom.width;
                                const scaleY = 100 / selectedRoom.height;
                                const scale = Math.max(scaleX, scaleY);

                                // 영역의 중심점 계산
                                const centerX = selectedRoom.x + selectedRoom.width / 2;
                                const centerY = selectedRoom.y + selectedRoom.height / 2;

                                return {
                                  objectFit: 'none',
                                  transform: `scale(${scale}) translate(${(50 - centerX) / scale}%, ${(50 - centerY) / scale}%)`,
                                  transformOrigin: '0 0'
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
                    <p className="text-base mb-4">도면 이미지를 업로드하세요</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-primary"
                    >
                      <FileImage className="w-4 h-4 mr-2" />
                      파일 선택
                    </button>
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
