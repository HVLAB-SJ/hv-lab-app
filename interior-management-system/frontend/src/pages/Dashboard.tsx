import { format, isToday, isFuture, isTomorrow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useDataStore } from '../store/dataStore';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock } from 'lucide-react';

const ALL_TEAM_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현'];

const Dashboard = () => {
  const { schedules } = useDataStore();
  const { user } = useAuth();

  // 사용자 이름에서 성 제거 (마지막 2글자만 사용)
  // 예: "김상준" → "상준", "상준" → "상준"
  const userNameWithoutSurname = user?.name ? user.name.slice(-2) : null;

  // 로그인한 사용자를 맨 앞으로 정렬
  const TEAM_MEMBERS = userNameWithoutSurname
    ? [userNameWithoutSurname, ...ALL_TEAM_MEMBERS.filter(member => member !== userNameWithoutSurname)]
    : ALL_TEAM_MEMBERS;

  // 각 사람별 일정 계산
  const getMemberSchedules = (member: string) => {
    const memberSchedules = schedules.filter(schedule =>
      schedule.attendees && schedule.attendees.includes(member)
    );

    const todaySchedules = memberSchedules.filter(s => isToday(new Date(s.start)));
    const upcomingSchedules = memberSchedules
      .filter(s => isFuture(new Date(s.start)) && !isToday(new Date(s.start)))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3);

    return { todaySchedules, upcomingSchedules, member };
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">담당업무</h1>
      </div>

      {/* 사람별 할일 섹션 */}
      <div>
        <h2 className="hidden md:block text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">담당자별 할일</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {TEAM_MEMBERS.map((member) => {
            const { todaySchedules, upcomingSchedules } = getMemberSchedules(member);
            const totalTasks = todaySchedules.length + upcomingSchedules.length;

            const isCurrentUser = member === userNameWithoutSurname;

            return (
              <div key={member} className={`card p-4 md:p-4 ${isCurrentUser ? 'ring-1 ring-gray-400' : ''}`}>
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg md:text-lg text-gray-900">{member}</h3>
                    {isCurrentUser && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100/50 text-gray-900 rounded font-medium">나</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 ${isCurrentUser && todaySchedules.length > 0 ? 'bg-yellow-100 text-gray-900' : 'bg-gray-100 text-gray-900'} rounded-full font-semibold whitespace-nowrap`}>
                      {todaySchedules.length} 오늘
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full font-semibold whitespace-nowrap">
                      {upcomingSchedules.length} 예정
                    </span>
                  </div>
                </div>

                {/* 오늘의 일정 */}
                {todaySchedules.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar className="h-4 w-4 text-gray-900" />
                      <p className="text-xs font-semibold text-gray-900 uppercase">오늘</p>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        // 프로젝트별로 그룹화
                        const grouped = todaySchedules.reduce((acc, schedule) => {
                          const projectName = schedule.project || '-';
                          if (!acc[projectName]) acc[projectName] = [];
                          acc[projectName].push(schedule);
                          return acc;
                        }, {} as Record<string, typeof todaySchedules>);

                        return Object.entries(grouped).map(([projectName, schedules]) => {
                          // 로그인한 사용자의 카드인지 확인
                          const isCurrentUser = member === userNameWithoutSurname;

                          return (
                            <div
                              key={projectName}
                              className={`border-l-3 ${isCurrentUser ? 'border-gray-400' : 'border-gray-900'} ${isCurrentUser ? 'bg-yellow-50' : 'bg-gray-50'} rounded-r overflow-hidden`}
                            >
                              <div className={`px-3 py-1.5 ${isCurrentUser ? 'bg-yellow-100' : 'bg-gray-100'} border-b ${isCurrentUser ? 'border-yellow-200' : 'border-gray-200'}`}>
                                <span className="text-xs font-semibold text-gray-900">{projectName}</span>
                              </div>
                              <div className="px-3 py-2 space-y-1">
                                {schedules.map((schedule) => (
                                  <p key={schedule.id} className="font-medium text-gray-900 text-sm leading-relaxed">
                                    • {schedule.title}
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* 다가오는 일정 */}
                {upcomingSchedules.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase">예정</p>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        // 날짜 + 프로젝트별로 그룹화
                        const grouped = upcomingSchedules.reduce((acc, schedule) => {
                          const dateKey = format(new Date(schedule.start), 'MM.dd', { locale: ko });
                          const projectName = schedule.project || '-';
                          const key = `${dateKey}|${projectName}`;
                          if (!acc[key]) acc[key] = { date: dateKey, project: projectName, schedules: [] };
                          acc[key].schedules.push(schedule);
                          return acc;
                        }, {} as Record<string, { date: string; project: string; schedules: typeof upcomingSchedules }>);

                        return Object.values(grouped).map(({ date, project, schedules }) => {
                          // 내일인지 확인 (첫 번째 일정으로 체크)
                          const isTomorrowSchedule = schedules.length > 0 && isTomorrow(new Date(schedules[0].start));
                          const dateDisplay = isTomorrowSchedule ? `${date} (내일)` : date;

                          return (
                            <div key={`${date}-${project}`} className="border-l-3 border-gray-400 bg-gray-50 rounded-r overflow-hidden">
                              <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700">{project}</span>
                                <span className="text-xs text-gray-500 font-medium">{dateDisplay}</span>
                              </div>
                              <div className="px-3 py-2 space-y-1">
                                {schedules.map((schedule) => (
                                  <p key={schedule.id} className="font-medium text-gray-900 text-sm leading-relaxed">
                                    • {schedule.title}
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* 일정이 없을 때 */}
                {totalTasks === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    예정된 일정이 없습니다
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
