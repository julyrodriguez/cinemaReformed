import React, { useState } from 'react';

export interface DateData {
  year: number;
  month: number;
  day: number;
  timestamp: number;
  dateString: string;
}

export const LocaleConfig: {
  locales: Record<string, any>;
  defaultLocale: string;
} = {
  locales: {
    es: {
      monthNames: [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ],
      monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      today: 'Hoy',
    },
  },
  defaultLocale: 'es',
};

type CalendarProps = {
  current?: string;
  onDayPress?: (date: DateData) => void;
  onMonthChange?: (date: DateData) => void;
  markedDates?: Record<string, any>;
  dayComponent?: React.ComponentType<{ date?: DateData; state?: string; marking?: any }>;
  theme?: any;
  style?: any;
  hideExtraDays?: boolean;
};

export function Calendar({
  current,
  onDayPress,
  onMonthChange,
  markedDates = {},
  dayComponent: DayComponent,
}: CalendarProps) {
  const initialDate = current ? new Date(`${current}T12:00:00`) : new Date();
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth() + 1);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const locale = LocaleConfig.locales[LocaleConfig.defaultLocale] || LocaleConfig.locales.es;

  const changeMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setYear(nextYear);
    setMonth(nextMonth);
    const dateString = `${nextYear}-${pad2(nextMonth)}-01`;
    onMonthChange?.({
      year: nextYear,
      month: nextMonth,
      day: 1,
      timestamp: new Date(`${dateString}T12:00:00`).getTime(),
      dateString,
    });
  };

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: Array<{ date: DateData; isCurrentMonth: boolean }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateString = `${year}-${pad2(month)}-${pad2(d)}`;
    cells.push({
      date: {
        year,
        month,
        day: d,
        timestamp: new Date(`${dateString}T12:00:00`).getTime(),
        dateString,
      },
      isCurrentMonth: true,
    });
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          {locale.monthNames[month - 1]} {year}
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ›
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
        {locale.dayNamesShort.map((d: string) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }).map((_, idx) => (
          <div key={`empty-${idx}`} />
        ))}
        {cells.map(({ date }) => {
          const marking = markedDates[date.dateString];
          if (DayComponent) {
            return (
              <div key={date.dateString}>
                <DayComponent date={date} state="" marking={marking} />
              </div>
            );
          }
          return (
            <button
              key={date.dateString}
              type="button"
              onClick={() => onDayPress?.(date)}
              className="flex min-h-[44px] flex-col items-center justify-center rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <span>{date.day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default {
  Calendar,
  LocaleConfig,
};
