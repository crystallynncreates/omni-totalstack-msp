// PDF generators: formal proposal, Request for Service (RFS), invoice, and Notice of Non-Payment.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Client, Company, Invoice, Proposal } from './types'
import { optionTotals } from './proposalEngine'
import { fmtDate, money } from './format'
import { invoiceTotal } from './store'

const ACCENT: [number, number, number] = [37, 99, 235]
const INK: [number, number, number] = [20, 22, 30]
const MUTED: [number, number, number] = [110, 116, 130]

type Doc = jsPDF & { lastAutoTable?: { finalY: number } }
const endY = (doc: Doc) => doc.lastAutoTable?.finalY ?? 100

function header(doc: Doc, company: Company, title: string, sub?: string) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(12, 14, 20)
  doc.rect(0, 0, w, 86, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, 86, w, 3, 'F')
  if (company.logoDataUrl) {
    try { doc.addImage(company.logoDataUrl, 'PNG', 40, 20, 46, 46) } catch { /* ignore bad logo */ }
  }
  const x = company.logoDataUrl ? 96 : 40
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text(company.name, x, 40)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.setTextColor(190, 196, 210)
  doc.text(`${company.address}, ${company.city}, ${company.state} ${company.zip}  ·  ${company.phone}  ·  ${company.email}`, x, 58)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(title, w - 40, 40, { align: 'right' })
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(190, 196, 210); doc.text(sub, w - 40, 58, { align: 'right' }) }
  doc.setTextColor(...INK)
}

function footer(doc: Doc, company: Company) {
  const pages = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text(`${company.legalName}  ·  ${company.website}`, 40, h - 24)
    doc.text(`Page ${i} of ${pages}`, w - 40, h - 24, { align: 'right' })
  }
}

function para(doc: Doc, text: string, y: number, size = 10, color: [number, number, number] = INK) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
  const lines = doc.splitTextToSize(text, w - 80)
  if (y + lines.length * (size + 3) > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 60 }
  doc.text(lines, 40, y)
  return y + lines.length * (size + 3) + 6
}

function h2(doc: Doc, text: string, y: number) {
  if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 60 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ACCENT)
  doc.text(text, 40, y)
  doc.setTextColor(...INK)
  return y + 18
}

function addressBlock(doc: Doc, label: string, lines: string[], x: number, y: number) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text(label.toUpperCase(), x, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
  lines.filter(Boolean).forEach((l, i) => doc.text(l, x, y + 14 + i * 13))
}

const lineRows = (p: Proposal['options'][number]) =>
  p.lineItems.map((l) => [l.mandatory ? `${l.description}  [REQUIRED]` : l.description, l.category, String(l.qty), money(l.unitPrice, true), l.recurring ? 'Monthly' : 'One-time', money(l.qty * l.unitPrice, true)])

export function proposalPdf(p: Proposal, client: Client, company: Company) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as Doc
  header(doc, company, 'Technology Services Proposal', `${p.number} · ${fmtDate(p.createdAt)}`)
  addressBlock(doc, 'Prepared for', [client.name, client.primaryContact.name, client.address, client.primaryContact.email], 40, 118)
  addressBlock(doc, 'Prepared by', [company.name, company.email, company.phone], 330, 118)
  let y = h2(doc, 'Executive Summary', 200)
  y = para(doc, p.executiveSummary, y)
  y = h2(doc, 'Assessment Findings', y + 6)
  autoTable(doc, { startY: y, head: [['Area', 'Severity', 'Finding']], body: p.findings.map((f) => [f.area, f.severity.toUpperCase(), f.text]), styles: { fontSize: 9 }, headStyles: { fillColor: ACCENT }, columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60 } }, margin: { left: 40, right: 40 } })
  y = endY(doc) + 24
  y = h2(doc, 'Solution Comparison', y)
  autoTable(doc, {
    startY: y,
    head: [['', ...p.options.map((o) => `${o.tier}: ${o.title}`)]],
    body: [
      ['Monthly investment', ...p.options.map((o) => money(optionTotals(o).monthly, true))],
      ['One-time investment', ...p.options.map((o) => money(optionTotals(o).oneTime, true))],
      ['Huntress 24/7 security', ...p.options.map(() => 'Included (required)')],
      ['Addresses', ...p.options.map((o) => o.addresses.join('\n'))],
    ],
    styles: { fontSize: 9, valign: 'top' }, headStyles: { fillColor: ACCENT }, margin: { left: 40, right: 40 },
  })
  p.options.forEach((o, i) => {
    doc.addPage()
    let yy = h2(doc, `Option ${i + 1} — ${o.tier}: ${o.title}${p.selected === i ? '  (Selected)' : ''}`, 60)
    yy = para(doc, o.summary, yy)
    autoTable(doc, { startY: yy, head: [['Item', 'Category', 'Qty', 'Unit', 'Billing', 'Total']], body: lineRows(o), styles: { fontSize: 8.5 }, headStyles: { fillColor: ACCENT }, columnStyles: { 0: { cellWidth: 220 } }, margin: { left: 40, right: 40 } })
    const t = optionTotals(o)
    yy = endY(doc) + 18
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`Monthly: ${money(t.monthly, true)}     One-time: ${money(t.oneTime, true)}`, 40, yy)
  })
  doc.addPage()
  let yy = h2(doc, 'Terms & Acceptance', 60)
  yy = para(doc, `Pricing valid for 30 days. Monthly services billed in advance; one-time items billed on completion. Payment terms: Net ${company.paymentTermsDays}. A Huntress managed security subscription is a mandatory component of every ${company.name} service plan and is provisioned and managed under ${company.name}'s Huntress partner account. Software and firmware updates are deployed only after a ${company.patchSoakDays}-day stability period with no reported defects.`, yy)
  signatureBlock(doc, client, company, yy + 20)
  footer(doc, company)
  doc.save(`${p.number}-${client.name.replace(/\W+/g, '_')}-Proposal.pdf`)
}

function signatureBlock(doc: Doc, client: Client, company: Company, y: number) {
  doc.setDrawColor(...MUTED)
  doc.line(40, y + 40, 270, y + 40); doc.line(330, y + 40, 560, y + 40)
  doc.setFontSize(9); doc.setTextColor(...MUTED)
  doc.text(`${client.name} — Authorized signature / date`, 40, y + 54)
  doc.text(`${company.name} — Authorized signature / date`, 330, y + 54)
  doc.text(`Printed name: ${client.primaryContact.name}`, 40, y + 68)
}

export function rfsPdf(p: Proposal, client: Client, company: Company) {
  if (p.selected === undefined) throw new Error('Select an option first')
  const o = p.options[p.selected]
  const t = optionTotals(o)
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as Doc
  header(doc, company, 'Request for Service (RFS)', `${p.rfsNumber} · ${fmtDate(p.rfsDate)}`)
  addressBlock(doc, 'Client', [client.name, client.address, `${client.primaryContact.name} · ${client.primaryContact.phone}`, client.primaryContact.email], 40, 118)
  addressBlock(doc, 'Service provider', [company.legalName, `${company.address}`, `${company.city}, ${company.state} ${company.zip}`, company.phone], 330, 118)
  let y = h2(doc, `Selected solution: ${o.tier} — ${o.title}`, 204)
  y = para(doc, `Reference proposal ${p.number}. ${client.name} requests that ${company.name} provide the following services and materials under the terms of the Master Services Agreement.`, y)
  y = para(doc, `Scope: ${o.summary}`, y)
  autoTable(doc, { startY: y, head: [['Item', 'Qty', 'Unit', 'Billing', 'Total']], body: o.lineItems.map((l) => [l.mandatory ? `${l.description}  [REQUIRED]` : l.description, String(l.qty), money(l.unitPrice, true), l.recurring ? 'Monthly' : 'One-time', money(l.qty * l.unitPrice, true)]), styles: { fontSize: 8.5 }, headStyles: { fillColor: ACCENT }, columnStyles: { 0: { cellWidth: 260 } }, margin: { left: 40, right: 40 } })
  y = endY(doc) + 10
  const tax = t.oneTime * (company.taxRate / 100)
  autoTable(doc, { startY: y, body: [['Monthly recurring', money(t.monthly, true)], ['One-time (before tax)', money(t.oneTime, true)], [`Sales tax on hardware/one-time (${company.taxRate}%)`, money(tax, true)], ['Due at signing (one-time + first month)', money(t.oneTime + tax + t.monthly, true)]], theme: 'plain', styles: { fontSize: 10 }, columnStyles: { 0: { halign: 'right', cellWidth: 380 }, 1: { halign: 'right', fontStyle: 'bold' } }, margin: { left: 40, right: 40 } })
  y = endY(doc) + 16
  y = para(doc, `Service start: upon signature and receipt of deposit. Payment terms Net ${company.paymentTermsDays}. Monthly services renew automatically each month and may be cancelled with 30 days' written notice after the initial term. Huntress managed security is required and cannot be removed from this service order.`, y, 9, MUTED)
  signatureBlock(doc, client, company, y + 10)
  footer(doc, company)
  doc.save(`${p.rfsNumber}-${client.name.replace(/\W+/g, '_')}-RFS.pdf`)
}

export function invoicePdf(inv: Invoice, client: Client, company: Company) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as Doc
  header(doc, company, `Invoice ${inv.number}`, `Issued ${fmtDate(inv.issueDate)} · Due ${fmtDate(inv.dueDate)}`)
  addressBlock(doc, 'Bill to', [client.name, client.address, client.primaryContact.email], 40, 118)
  addressBlock(doc, 'Remit to', [company.legalName, company.address, `${company.city}, ${company.state} ${company.zip}`], 330, 118)
  autoTable(doc, { startY: 196, head: [['Description', 'Qty', 'Rate', 'Amount']], body: inv.lines.map((l) => [l.description, String(l.qty), money(l.rate, true), money(l.qty * l.rate, true)]), headStyles: { fillColor: ACCENT }, styles: { fontSize: 9.5 }, margin: { left: 40, right: 40 } })
  const sub = inv.lines.reduce((a, l) => a + l.qty * l.rate, 0)
  autoTable(doc, { startY: endY(doc) + 8, body: [['Subtotal', money(sub, true)], [`Tax (${inv.taxRate}%)`, money(sub * inv.taxRate / 100, true)], ['Total due', money(invoiceTotal(inv), true)]], theme: 'plain', columnStyles: { 0: { halign: 'right', cellWidth: 400 }, 1: { halign: 'right', fontStyle: 'bold' } }, margin: { left: 40, right: 40 } })
  para(doc, `Pay online through your client portal (ACH, card, Apple Pay / Google Pay) or by check to the remit-to address. Thank you for your business!`, endY(doc) + 20, 9, MUTED)
  footer(doc, company)
  doc.save(`${inv.number}.pdf`)
}

export interface NoticeData {
  invoice: Invoice
  client: Client
  company: Company
  amountOwed: number
  daysPastDue: number
}

export function nonPaymentText({ invoice, client, company, amountOwed, daysPastDue }: NoticeData) {
  return `NOTICE OF NON-PAYMENT

Date of notice: ${fmtDate(new Date().toISOString())}

CONTRACTOR / SERVICE PROVIDER
${company.legalName}
${company.address}, ${company.city}, ${company.state} ${company.zip}

RECIPIENT — PROPERTY OWNER
${client.ownerName}
${client.ownerAddress}
${client.primeContractor ? `\nRECIPIENT — PRIME CONTRACTOR IN CONTRACTUAL RELATION\n${client.primeContractor.name}\n${client.primeContractor.address}\n` : ''}
CUSTOMER / PROJECT
${client.name}, ${client.address}

DESCRIPTION OF WORK OR MATERIALS
${invoice.workDescription}
Items billed: ${invoice.lines.map((l) => l.description).join('; ')}.

AMOUNT OWED
${money(amountOwed, true)} unpaid as of the date of this notice (Invoice ${invoice.number}, issued ${fmtDate(invoice.issueDate)}, due ${fmtDate(invoice.dueDate)}; ${daysPastDue} days past due).

LAST DATE OF SERVICE
${fmtDate(invoice.lastServiceDate)}

${company.name} has not received payment for the labor, services, materials and/or equipment described above. Please remit the amount owed within ten (10) days of this notice to avoid suspension of non-critical services and further collection or lien action as permitted by law.

${company.legalName}
${company.phone} · ${company.email}`
}

export function nonPaymentPdf(data: NoticeData) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as Doc
  header(doc, data.company, 'Notice of Non-Payment', `Invoice ${data.invoice.number}`)
  const body = nonPaymentText(data).split('\n').slice(2).join('\n')
  let y = 120
  body.split('\n').forEach((ln) => {
    const isHead = /^[A-Z][A-Z /—-]+$/.test(ln.trim()) && ln.trim().length > 3
    doc.setFont('helvetica', isHead ? 'bold' : 'normal'); doc.setFontSize(isHead ? 9 : 10.5)
    doc.setTextColor(...(isHead ? ACCENT : INK))
    const lines = doc.splitTextToSize(ln || ' ', 530)
    doc.text(lines, 40, y)
    y += lines.length * 14 + (isHead ? 0 : 2)
  })
  footer(doc, data.company)
  doc.save(`Notice-of-NonPayment-${data.invoice.number}.pdf`)
}

/** HTML email body for the weekly system-wide update notice (also used by api/cron/weekly-updates). */
export function weeklyUpdateEmail(company: Company, clientName: string, deployed: { title: string; kb: string; deployedAt?: string }[], upcoming: { title: string; eligibleOn: string }[]) {
  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:auto;color:#14161e">
  <div style="background:#0c0e14;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><b style="font-size:18px">${company.name}</b><div style="color:#9aa3b5;font-size:13px">Weekly System Update Report</div></div>
  <div style="border:1px solid #e3e6ee;border-top:0;padding:24px;border-radius:0 0 12px 12px">
  <p>Hello ${clientName} team,</p>
  <p>Here is your weekly summary of system-wide updates. We only deploy updates after they have been <b>bug-free for ${company.patchSoakDays} days</b>, so your systems stay secure without surprises.</p>
  <h3 style="color:#2563eb">Installed this week</h3><ul>${deployed.length ? deployed.map((d) => li(`${d.title} (${d.kb})`)).join('') : li('No updates were required this week.')}</ul>
  <h3 style="color:#2563eb">Scheduled next (after stability period)</h3><ul>${upcoming.length ? upcoming.map((u) => li(`${u.title} — eligible ${u.eligibleOn}`)).join('') : li('Nothing pending.')}</ul>
  <p>No action is needed on your part. Devices may restart outside business hours. Questions? Reply to this email or call ${company.phone}.</p>
  <p style="color:#6e7482;font-size:12px">${company.legalName} · ${company.website}</p></div></div>`
}
