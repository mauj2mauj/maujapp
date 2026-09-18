import type { Task } from '../types/database';
import { getHabitStartDate } from './habitStats';
import { getLocalDateString, subtractDays } from './date';

interface CompletedLog {
  task_id: string;
  date: string;
  completed: boolean;
}

function habitsRequiredOn(tasks: Task[], studentJoinedAt: string, date: string): Task[] {
  return tasks.filter((task) => getHabitStartDate(task.created_at, studentJoinedAt) <= date);
}

export function allHabitsDoneOnDay(
  tasks: Task[],
  logs: CompletedLog[],
  studentJoinedAt: string,
  date: string
): boolean {
  const required = habitsRequiredOn(tasks, studentJoinedAt, date);
  if (required.length === 0) return false;
  return required.every((task) =>
    logs.some((log) => log.task_id === task.id && log.date === date && log.completed)
  );
}

export function todayHabitProgress(tasks: Task[], logs: CompletedLog[], studentJoinedAt: string) {
  const today = getLocalDateString();
  const required = habitsRequiredOn(tasks, studentJoinedAt, today);
  const done = required.filter((task) =>
    logs.some((log) => log.task_id === task.id && log.date === today && log.completed)
  ).length;
  return { done, total: required.length };
}

// True if today and the previous 6 calendar days each had every assigned
// habit completed. A habit only counts from the day it started for this student.
export function lastSevenDaysAllComplete(
  tasks: Task[],
  logs: CompletedLog[],
  studentJoinedAt: string
): boolean {
  const today = getLocalDateString();
  for (let offset = 0; offset < 7; offset += 1) {
    if (!allHabitsDoneOnDay(tasks, logs, studentJoinedAt, subtractDays(today, offset))) {
      return false;
    }
  }
  return true;
}
