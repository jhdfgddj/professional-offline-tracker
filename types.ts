
export type CircleKey = 'F' | 'Z' | 'A' | 'M' | 'E' | 'T1' | 'T2';

export type RectKey = 'QURAN' | 'HADITH' | 'SADKA' | 'DUROOD' | 'ISTIGFAAR' | 'DUA';

export interface DayData {
  circles: Partial<Record<CircleKey, boolean>>;
  rects: Partial<Record<RectKey, string>>;
  notes: Partial<Record<RectKey, string>>;
}

export interface AppState {
  theme: 'dark' | 'white';
  appTitle: string;
  userName: string;
  userImage: string;
  selectedDay: number;
  removedT2: boolean;
  data: Record<number, DayData>;
}

export const INITIAL_DAY_DATA: DayData = {
  circles: {},
  rects: {},
  notes: {}
};