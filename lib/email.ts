import nodemailer from "nodemailer";

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const FROM = () => process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@techscribe";
const BASE_URL = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function html(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:'DM Sans',sans-serif;background:#f3f4f6;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #d7dee7;">
<div style="font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0FA882;margin-bottom:8px;">TechScribe Studio</div>
${body}
<hr style="border:none;border-top:1px solid #d7dee7;margin:24px 0;">
<p style="font-size:12px;color:#94a3b8;margin:0;">You're receiving this because you're an admin of TechScribe Studio.</p>
</div></body></html>`;
}

export async function sendNewUserNotification(user: {
  name: string | null;
  email: string;
}) {
  const transporter = getTransporter();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!transporter || !adminEmail) return;

  const displayName = user.name ?? user.email;
  const approveUrl = `${BASE_URL()}/admin/users`;

  await transporter.sendMail({
    from: FROM(),
    to: adminEmail,
    subject: `New access request — ${displayName}`,
    html: html(`
      <h2 style="font-size:20px;color:#0D1F40;margin:0 0 12px;">New user requesting access</h2>
      <p style="color:#475569;margin:0 0 16px;"><strong style="color:#0D1F40;">${displayName}</strong> (${user.email}) has signed in and is awaiting approval.</p>
      <a href="${approveUrl}" style="display:inline-block;background:#0FA882;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;font-size:14px;">Review in Admin Panel →</a>
    `),
  });
}

export async function sendApprovalNotification(user: {
  name: string | null;
  email: string;
}) {
  const transporter = getTransporter();
  if (!transporter) return;

  const displayName = user.name ?? "there";
  const appUrl = BASE_URL();

  await transporter.sendMail({
    from: FROM(),
    to: user.email,
    subject: "Your TechScribe Studio access has been approved",
    html: html(`
      <h2 style="font-size:20px;color:#0D1F40;margin:0 0 12px;">You're approved!</h2>
      <p style="color:#475569;margin:0 0 16px;">Hi ${displayName}, your access to TechScribe Studio has been approved. You can sign in now.</p>
      <a href="${appUrl}/login" style="display:inline-block;background:#0FA882;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;font-size:14px;">Sign in to Studio →</a>
    `),
  });
}
