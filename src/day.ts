// The only place a day string is built, from local date parts (the UTC-based ISO helpers give the wrong day).
const p2 = (n: number) => String(n).padStart(2, '0')

export const localDay = (d: Date = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

const parse = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fmt = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}

export const addDays = (day: string, n: number) => fmt(parse(day) + n * 86_400_000)
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  const i = y * 12 + (m - 1) + n
  return `${Math.floor(i / 12)}-${p2((i % 12) + 1)}`
}
export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
/** 0 = Monday ... 6 = Sunday */
export const weekdayMon = (day: string) => (new Date(parse(day)).getUTCDay() + 6) % 7
export const mondayOf = (day: string) => addDays(day, -weekdayMon(day))
export const monthOf = (day: string) => day.slice(0, 7)
export const diffDays = (a: string, b: string) => Math.round((parse(a) - parse(b)) / 86_400_000)

const dt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(parse(day)))
export const longDate = (day: string) => dt(day, { weekday: 'long', day: 'numeric', month: 'long' })
export const weekdayName = (day: string) => dt(day, { weekday: 'long' })
export const monthTitle = (month: string) => dt(`${month}-01`, { month: 'long', year: 'numeric' })
