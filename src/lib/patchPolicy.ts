// Patch "soak" policy: an update may only be pushed after it has been bug-free for N days (default 15).
// The soak clock starts at the release date and RESTARTS whenever a new issue is reported.
// Any open known issue blocks deployment regardless of age.
import type { Patch } from './types'
import { DAY } from './format'

export type PatchStage = 'soaking' | 'blocked' | 'approved' | 'deployed'

export function patchStage(p: Patch, soakDays = 15): { stage: PatchStage; daysClean: number; daysLeft: number; eligibleOn: Date } {
  const clockStart = new Date(Math.max(new Date(p.releaseDate).getTime(), p.lastIssueReported ? new Date(p.lastIssueReported).getTime() : 0))
  const daysClean = Math.floor((Date.now() - clockStart.getTime()) / DAY)
  const eligibleOn = new Date(clockStart.getTime() + soakDays * DAY)
  const daysLeft = Math.max(0, soakDays - daysClean)
  if (p.deployedAt) return { stage: 'deployed', daysClean, daysLeft: 0, eligibleOn }
  if (p.blocked || p.openIssues > 0) return { stage: 'blocked', daysClean, daysLeft, eligibleOn }
  if (daysClean >= soakDays) return { stage: 'approved', daysClean, daysLeft: 0, eligibleOn }
  return { stage: 'soaking', daysClean, daysLeft, eligibleOn }
}

export const nextWeekly = (day: number, hour: number) => {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  let add = (day - d.getDay() + 7) % 7
  if (add === 0 && d.getTime() < Date.now()) add = 7
  d.setDate(d.getDate() + add)
  return d
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
