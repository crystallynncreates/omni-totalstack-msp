#!/usr/bin/env node
// Import an Omni workspace export into a STANDALONE Enterprise installation.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/import-workspace.mjs omni-acme-export.json owner@acme.com 'TempPassw0rd!' https://it.acme.com
//
// Creates the owner's login, a complimentary (never-billed) Enterprise workspace with the same web slug,
// loads every record, and prints invitation links for each technician and client-portal user.
// API keys are NOT in the export — re-enter them under Integrations in the new copy.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const [file, ownerEmail, ownerPassword, siteUrl = ''] = process.argv.slice(2)
if (!file || !ownerEmail || !ownerPassword) {
  console.error('Usage: node scripts/import-workspace.mjs <export.json> <owner-email> <owner-password> [https://your-domain]')
  process.exit(1)
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the NEW database.'); process.exit(1) }

const data = JSON.parse(readFileSync(file, 'utf8'))
if (data.format !== 'omni-workspace/1') { console.error('This is not an Omni workspace export.'); process.exit(1) }
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 1. Owner login
let ownerId
const created = await sb.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true, user_metadata: { name: data.org.settings?.ownerName || 'Owner' } })
if (created.error) {
  const list = await sb.auth.admin.listUsers({ perPage: 1000 })
  ownerId = list.data.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase())?.id
  if (!ownerId) throw created.error
} else ownerId = created.data.user.id

// 2. Workspace (complimentary Enterprise — this copy is yours; nothing is billed)
const { data: org, error: oe } = await sb.from('orgs').insert({
  name: data.org.name, slug: data.org.slug, plan: 'enterprise', status: 'active', comped: true, license: 'lifetime',
  settings: { ...data.org.settings, setupDone: true }, integrations: {}, owner_user_id: ownerId,
}).select('*').single()
if (oe) throw oe
await sb.from('org_members').insert({ org_id: org.id, user_id: ownerId, role: 'owner', name: data.org.settings?.ownerName || 'Owner', email: ownerEmail })

// 3. Records in batches
const rows = data.records.map((r) => ({ org_id: org.id, collection: r.collection, id: r.id, data: r.data }))
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('records').insert(rows.slice(i, i + 500))
  if (error) throw error
  process.stdout.write(`\rImported ${Math.min(i + 500, rows.length)} / ${rows.length} records`)
}
console.log('')

// 4. Invitations for everyone else
for (const m of data.members.filter((x) => x.role !== 'owner' && x.email)) {
  const { data: inv } = await sb.from('invites').insert({ org_id: org.id, email: m.email, role: m.role, client_id: m.client_id }).select('token').single()
  console.log(`Invite ${m.role.padEnd(10)} ${m.email.padEnd(32)} ${siteUrl}/accept-invite?token=${inv.token}`)
}
console.log(`\nDone. Sign in at ${siteUrl || 'your site'}/login as ${ownerEmail}, then re-enter your integration keys.`)
