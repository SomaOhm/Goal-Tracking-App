import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { user, goals } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const myGoals = goals.filter(g => g.userId === user?.id);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getCompletionsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    let count = 0;
    myGoals.forEach(goal => {
      if (goal.completions.some(c => c.date === dateStr)) {
        count++;
      }
    });
    return count;
  };

  const getGoalsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return myGoals.map(goal => ({
      ...goal,
      completed: goal.completions.some(c => c.date === dateStr),
      reflection: goal.completions.find(c => c.date === dateStr)?.reflection
    }));
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const selectedDateGoals = getGoalsForDate(selectedDate);

  return (
    <div className="pb-28 pt-6 w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl mb-2 text-[#4A4A4A]">Calendar</h1>
        <p className="text-[#8A8A8A]">Track your progress over time</p>
      </div>

      {/* Calendar Card */}
      <Card className="p-5 rounded-3xl shadow-lg border-none bg-white mb-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={previousMonth} className="p-2 hover:bg-[#F5F0FF] rounded-xl transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#C8B3E0]" />
          </button>
          <h2 className="text-xl text-[#4A4A4A]">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-[#F5F0FF] rounded-xl transition-colors">
            <ChevronRight className="w-6 h-6 text-[#C8B3E0]" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-sm text-[#8A8A8A] py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            const completions = getCompletionsForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            
            return (
              <button
                key={index}
                onClick={() => setSelectedDate(day)}
                className={`
                  aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all
                  ${isSelected ? 'shadow-lg' : 'hover:shadow-md'}
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                `}
                style={{
                  backgroundColor: isSelected 
                    ? '#C8B3E0' 
                    : isToday 
                    ? '#FFD4C8' 
                    : completions > 0 
                    ? '#E0D5F0' 
                    : '#FFFBF7'
                }}
              >
                <span className={`text-sm ${isSelected ? 'text-white' : 'text-[#4A4A4A]'}`}>
                  {format(day, 'd')}
                </span>
                {completions > 0 && !isSelected && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {Array.from({ length: Math.min(completions, 3) }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: '#C8B3E0' }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Date Details */}
      <Card className="p-6 rounded-3xl shadow-lg border-none bg-white">
        <h3 className="text-lg mb-4 text-[#4A4A4A]">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h3>
        
        {selectedDateGoals.length === 0 ? (
          <p className="text-[#8A8A8A] text-center py-8">No goals for this day</p>
        ) : (
          <div className="space-y-3">
            {selectedDateGoals.map((goal) => (
              <div 
                key={goal.id} 
                className="p-4 rounded-2xl"
                style={{ 
                  backgroundColor: goal.completed ? '#E0D5F0' : '#FFFBF7',
                  border: '1px solid',
                  borderColor: goal.completed ? '#C8B3E0' : '#E0E0E0'
                }}
              >
                <div className="flex items-start gap-3">
                  {goal.completed && (
                    <CheckCircle2 className="w-5 h-5 text-[#C8B3E0] flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className={`mb-1 ${goal.completed ? 'text-[#4A4A4A]' : 'text-[#8A8A8A]'}`}>
                      {goal.title}
                    </h4>
                    {goal.completed && goal.reflection && (
                      <p className="text-sm text-[#8A8A8A] italic mt-2">
                        "{goal.reflection}"
                      </p>
                    )}
                    {!goal.completed && (
                      <p className="text-xs text-[#8A8A8A]">Not completed</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
