export type Role = 'admin' | 'student';
export type TaskType = 'boolean' | 'duration';
export type InvitationStatus = 'pending' | 'registered';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  referral_source: string | null;
  role: Role;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string;
  status: InvitationStatus;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// The palette the admin picks from. A fixed set rather than free-form hex
// keeps every habit legible against the white card backgrounds.
export const HABIT_COLORS = [
  { label: 'Crucial', value: '#dc2626' },
  { label: 'Important', value: '#ea580c' },
  { label: 'Secondary', value: '#2563eb' },
  { label: 'Health', value: '#16a34a' },
  { label: 'Focus', value: '#7c3aed' },
  { label: 'Routine', value: '#64748b' },
];

export const DEFAULT_HABIT_COLOR = '#4f46e5';

export interface DailyLog {
  id: string;
  student_id: string;
  task_id: string;
  date: string;
  completed: boolean;
  duration_minutes: number | null;
  created_at: string;
}
