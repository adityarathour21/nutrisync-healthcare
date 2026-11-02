import nodemailer from 'nodemailer';

export async function sendClinicalEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ delivered: boolean; mode: 'smtp' | 'unconfigured_preview' }> {
  const host = process.env.EMAIL_HOST?.trim();
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASSWORD?.trim();

  if (!host || !user || !pass) {
    return { delivered: false, mode: 'unconfigured_preview' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'NutriSync Care <noreply@nutrisync.health>',
    to: params.to,
    subject: params.subject,
    text: params.text,
  });

  return { delivered: true, mode: 'smtp' };
}
