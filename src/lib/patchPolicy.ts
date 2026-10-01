// Patch "soak" policy: an update may only be pushed after it has been bug-free for N days (default 15).
// The soak clock starts at the release date and RESTARTS whenever a new issue is reported.
// Any open known issue blocks deployment regardless of age.
export { patchStage, type PatchStage } from '../../shared/patchPolicy'

export const nextWeekly = (day: number, hour: number) => {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  let add = (day - d.getDay() + 7) % 7
  if (add === 0 && d.getTime() < Date.now()) add = 7
  d.setDate(d.getDate() + add)
  return d
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
