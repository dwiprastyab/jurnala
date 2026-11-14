export type User = { name: string; email: string; created_at?: string }
export type Habit = { id: number; name: string; sort: number }
export type DayHabit = { id: number; name: string; done: boolean; streak: number }
export type Entry = { day: string; mood: number | null; went_well: string | null; was_hard: string | null; tomorrow: string | null; updated_at: string }
export type DayData = { day: string; habits: DayHabit[]; entry: Entry | null; yesterday_tomorrow: string | null }
export type HistoryDay = { day: string; mood: number | null; done: number; total: number }
export type InsightsData = { entries: number; days: HistoryDay[]; habits: { id: number; name: string; last30: number; best_streak: number; streak: number }[] }
export type EntryInput = { mood: number | null; went_well: string; was_hard: string; tomorrow: string }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') onUnauthorized()
    throw new ApiError(data?.error ?? 'Something went wrong. Try again.', res.status)
  }
  return data as T
}

export const api = {
  me: () => call<{ user: User }>('GET', '/me'),
  login: (email: string, password: string) => call<{ user: User }>('POST', '/login', { email, password }),
  logout: () => call<void>('POST', '/logout', {}),
  habits: (archived = false) => call<{ habits: Habit[] }>('GET', `/habits${archived ? '?archived=1' : ''}`),
  addHabit: (name: string) => call<{ habit: Habit }>('POST', '/habits', { name }),
  patchHabit: (id: number, patch: { name?: string; sort?: number; archived?: boolean }) => call<{ habit: Habit }>('PATCH', `/habits/${id}`, patch),
  deleteHabit: (id: number) => call<void>('DELETE', `/habits/${id}`),
  checkin: (id: number, day: string, done: boolean) => call<{ habit_id: number; day: string; done: boolean; streak: number }>('PUT', `/checkins/${id}/${day}`, { done }),
  day: (day: string) => call<DayData>('GET', `/day/${day}`),
  saveEntry: (day: string, e: EntryInput) => call<{ entry: Entry }>('PUT', `/entries/${day}`, e),
  history: (from: string, to: string) => call<{ days: HistoryDay[] }>('GET', `/history?from=${from}&to=${to}`),
  insights: (today: string) => call<InsightsData>('GET', `/insights?today=${today}`),
  exportCsv: async () => {
    let res: Response
    try { res = await fetch('/api/export', { credentials: 'same-origin' }) }
    catch { throw new ApiError("Can't reach the server. Check your connection and try again.", 0) }
    if (!res.ok) {
      if (res.status === 401) onUnauthorized()
      throw new ApiError((await res.json().catch(() => null))?.error ?? 'Something went wrong. Try again.', res.status)
    }
    return res.blob()
  },
}
