# Command Console

Type a plain-English command in **Command Console** (left menu → System). Omni parses it, shows a plan
(what will happen, which integration does it, warnings), and runs it only after you confirm.

* Parser + planner: `shared/commands.ts` (used by the app for the instant preview **and** by the API, which re-parses
  the text itself — the browser never sends the steps to run).
* Server: `api/_handlers/command.ts` (`/api/command/plan`, `/api/command/run`) → `api/_lib/adapters.ts`.
* If the parser doesn't understand, the API asks Claude to rewrite the request into a supported command (when an
  Anthropic key is available), then parses that.

## Safety
* Windows updates go through `patchStage()` (`shared/patchPolicy.ts`) on the server: only updates that have been
  bug-free for the workspace's soak period (15 days by default) are installed; soaking/blocked ones are skipped and listed.
* Destructive actions (delete user) require typing `DELETE`; reboot / shutdown / run / uninstall on **all** devices require `ALL`.
* `user_add`, `user_delete`, `user_reset`, `run` are owner/admin only. Clients can never run commands.
* Every run is written to the audit log (generated passwords are never logged; they're shown once in the UI).

## Supported commands → integrations
| You type | Runs on |
|---|---|
| `update windows 11 on all devices` / `… at <client>` / `… on <host>` | Automox → Tactical RMM → NinjaOne/Atera (first connected) |
| `patch status` | Omni (+ Automox) |
| `install <app>` / `upgrade all software` / `uninstall <app>` (`on …`) | Chocolatey via Tactical RMM |
| `reboot <host>` / `shutdown …` / `run "<cmd>" on …` / `restart service <name> on <host>` / `gpupdate on …` | Tactical RMM (reboot also Automox) |
| `add user Jane Doe jane@client.com` · `disable/enable/delete user …` · `reset password …` · `sign out user …` | Entra ID (Microsoft Graph, tenant = email domain or client's tenant ID) |
| same with `in active directory` · `unlock user jdoe` | Windows Server AD — PowerShell on the client's DC through Tactical RMM |
| same with `in webex` · `list webex users` | Webex |
| `list vms` · `start/stop/restart/snapshot vm <id or name>` | Proxmox VE |
| `backup status` · `nas status` | Proxmox Backup Server, Synology (+ Datto/Veeam note) |
| `what is down` | Omni sites + Uptime Kuma |
| `open ticket for <client>: <subject>` | Omni (+ Zammad, ITFlow if connected) |
| `open fusion ticket for <client>: <subject>` | Emails Fusion Connect support |
| `connect to <host>` | RustDesk (opens `rustdesk://<id>` on the technician's computer) |
| `find <host or IP>` | Omni (+ Lansweeper) |

Add a command: extend `Intent`, `parseCommand`, `routes`, `title` in `shared/commands.ts`, then the matching case in
`runStep` (`api/_lib/adapters.ts`) and the demo `simulate()` in `src/pages/Command.tsx`.

Self-hosted tools must be reachable from Vercel over HTTPS with a trusted certificate (Cloudflare Tunnel recommended).
