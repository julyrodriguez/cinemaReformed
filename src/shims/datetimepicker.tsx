import React from 'react';

type DateTimePickerProps = {
  value: Date;
  mode?: 'date' | 'time' | 'datetime';
  display?: string;
  onChange?: (event: any, date?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

export default function DateTimePicker({
  value,
  mode = 'date',
  onChange,
}: DateTimePickerProps) {
  const d = value instanceof Date && !isNaN(value.getTime()) ? value : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const dateVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeVal = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <div className="my-2 inline-flex items-center">
      {mode === 'time' ? (
        <input
          type="time"
          value={timeVal}
          onChange={(e) => {
            const [hh, mm] = e.target.value.split(':').map(Number);
            const next = new Date(d);
            if (!isNaN(hh) && !isNaN(mm)) {
              next.setHours(hh, mm, 0, 0);
              onChange?.({ type: 'set', nativeEvent: {} }, next);
            }
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      ) : (
        <input
          type="date"
          value={dateVal}
          onChange={(e) => {
            const [y, m, day] = e.target.value.split('-').map(Number);
            const next = new Date(d);
            if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
              next.setFullYear(y, m - 1, day);
              onChange?.({ type: 'set', nativeEvent: {} }, next);
            }
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}
    </div>
  );
}
