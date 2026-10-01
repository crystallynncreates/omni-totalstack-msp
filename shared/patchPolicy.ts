// Patch "soak" policy shared by the app and the API (the Command Console enforces it on the server too).
// An update may only be pushed after it has been bug-free for N days (default 15). The clock starts at the
// release date and RESTARTS whenever a new issue is reported. Any open known issue blocks deployment.
export type PatchStage = 'soaking' | 'blocked' | 'approved' | 'deployed'
export interface SoakPatch { releaseDate: string; lastIssueReported?: string; openIssues: number; deployedAt?: string; blocked?: boolean }

const DAY = 864e5

export function patchStage(p: SoakPatch, soakDays = 15): { stage: PatchStage; daysClean: number; daysLeft: number; eligibleOn: Date } {
  const clockStart = new Date(Math.max(new Date(p.releaseDate).getTime(), p.lastIssueReported ? new Date(p.lastIssueReported).getTime() : 0))
  const daysClean = Math.floor((Date.now() - clockStart.getTime()) / DAY)
  const eligibleOn = new Date(clockStart.getTime() + soakDays * DAY)
  const daysLeft = Math.max(0, soakDays - daysClean)
  if (p.deployedAt) return { stage: 'deployed', daysClean, daysLeft: 0, eligibleOn }
  if (p.blocked || p.openIssues > 0) return { stage: 'blocked', daysClean, daysLeft, eligibleOn }
  if (daysClean >= soakDays) return { stage: 'approved', daysClean, daysLeft: 0, eligibleOn }
  return { stage: 'soaking', daysClean, daysLeft, eligibleOn }
}
