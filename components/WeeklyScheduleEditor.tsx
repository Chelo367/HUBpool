"use client";

import type { ChangeEvent } from "react";
import type { Weekday, WeeklySchedule } from "@/lib/types";
import { WEEKDAYS } from "@/lib/schedule";

export default function WeeklyScheduleEditor({
  value,
  onChange,
}: {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
}) {
  function updateDay(day: Weekday, patch: Partial<WeeklySchedule[Weekday]>) {
    onChange({
      ...value,
      [day]: { ...value[day], ...patch },
    });
  }

  return (
    <div className="scheduleEditor">
      <div className="scheduleHeaderRow" aria-hidden="true">
        <span>Day</span>
        <span>Working?</span>
        <span>At HUB by</span>
        <span>Leave HUB</span>
      </div>
      {WEEKDAYS.map(({ key, label, short }) => {
        const day = value[key];
        return (
          <div className={`scheduleRow ${day.enabled ? "" : "scheduleRowOff"}`} key={key}>
            <div className="scheduleDay">
              <strong>{short}</strong>
              <span>{label}</span>
            </div>
            <label className="toggleField">
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(key, { enabled: event.target.checked })}
              />
              <span>{day.enabled ? "Working" : "Off"}</span>
            </label>
            <input
              aria-label={`${label} arrival time`}
              type="time"
              value={day.arriveBy}
              disabled={!day.enabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(key, { arriveBy: event.target.value })}
            />
            <input
              aria-label={`${label} departure time`}
              type="time"
              value={day.leaveAt}
              disabled={!day.enabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(key, { leaveAt: event.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}
