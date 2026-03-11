import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../core/config.js';
import { db } from '../core/db.js';
import { log } from '../core/logger.js';

export async function sendApprovalMail(menu) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO approvals (menu_id, token) VALUES (?, ?)').run(menu.id, token);

  const approveUrl = `${config.app.baseUrl}/review/${token}?action=approve`;
  const rejectUrl = `${config.app.baseUrl}/review/${token}?action=reject`;

  const html = `
    <h2>Lekker Menüvorschlag ${menu.day}</h2>
    <p>CO2-Score (Ø): <strong>${menu.co2_score}</strong></p>
    <h3>Vegan</h3>
    <ul><li>Frühstück: ${menu.vegan_breakfast}</li><li>Mittag: ${menu.vegan_lunch}</li><li>Abend: ${menu.vegan_dinner}</li></ul>
    <h3>Nicht-vegan</h3>
    <ul><li>Frühstück: ${menu.omni_breakfast}</li><li>Mittag: ${menu.omni_lunch}</li><li>Abend: ${menu.omni_dinner}</li></ul>
    <p><a href="${approveUrl}">✅ Freigeben</a> | <a href="${rejectUrl}">🔁 Zurückweisen & Alternative</a></p>
  `;

  if (!config.mail.enabled) {
    log.info('SMTP disabled - review links', { approveUrl, rejectUrl });
    return { approveUrl, rejectUrl, skipped: true };
  }

  const transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: false,
    auth: { user: config.mail.user, pass: config.mail.pass }
  });

  await transport.sendMail({
    from: config.mail.from,
    to: config.mail.to,
    subject: `Lekker Freigabe ${menu.day}`,
    html
  });

  return { approveUrl, rejectUrl, skipped: false };
}

export function handleReview(token, action) {
  const row = db.prepare('SELECT * FROM approvals WHERE token = ?').get(token);
  if (!row) return { ok: false, message: 'Ungültiger Token' };

  db.prepare('UPDATE approvals SET action=?, acted_at=? WHERE token=?').run(action, new Date().toISOString(), token);

  if (action === 'approve') {
    db.prepare("UPDATE menus SET status='published' WHERE id=?").run(row.menu_id);
    return { ok: true, message: 'Menü freigegeben und publiziert.' };
  }

  db.prepare("UPDATE menus SET status='rejected' WHERE id=?").run(row.menu_id);
  return { ok: true, message: 'Menü zurückgewiesen. Alternative wird erstellt.' };
}
