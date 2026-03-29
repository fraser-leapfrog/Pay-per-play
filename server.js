require('dotenv').config();
console.log('ENV KEYS WITH RESEND:', Object.keys(process.env).filter(k => k.includes('RESEND')));
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── CORS + iframe headers ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://leapfrogadvertising.com',
  'https://www.leapfrogadvertising.com',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://leapfrogadvertising.com https://www.leapfrogadvertising.com");
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Send email via Resend API (HTTPS — works on all cloud hosts) ──────────────
async function sendEmail({ to, replyTo, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     'Leapfrog Form <form@leapfrogadvertising.com>',
      to:       [to],
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Resend error: ${res.status}`);
  return data;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'form.html'));
});

app.post('/submit', async (req, res) => {
  try {
    const {
      firstname, lastname, email, phone, website, company,
      start_date, end_date, campaign_days,
      ad_creative_status, selected_screens,
      budget, plays_summary, notes,
      marketing_optin,
    } = req.body;

    console.log(`[submit] New application from ${email} (${company})`);

    const displayDate = (d) => d
      ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';

    const creativeLabels = {
      ready:  'I have a ready-made ad',
      help:   'I need help creating one',
      unsure: 'Not sure yet',
    };

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f3; margin: 0; padding: 32px 16px; color: #070212; }
    .card { background: #ffffff; border-radius: 12px; max-width: 580px; margin: 0 auto; overflow: hidden; }
    .header { background: #070212; padding: 28px 32px; }
    .header img { max-width: 160px; height: auto; }
    .tag { display: inline-block; background: linear-gradient(125deg,#7209b7,#e43f84); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 4px; padding: 4px 10px; margin-top: 14px; }
    .body { padding: 28px 32px; }
    .body h2 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .body .sub { font-size: 13px; color: #888; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #aaa; margin-bottom: 12px; border-bottom: 1px solid #f0f0f0; padding-bottom: 6px; }
    .row { display: flex; gap: 16px; margin-bottom: 10px; }
    .field { flex: 1; }
    .label { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
    .value { font-size: 14px; color: #070212; font-weight: 500; }
    .value.empty { color: #ccc; font-style: italic; font-weight: 400; }
    .plays-box { background: #070212; border-radius: 8px; padding: 18px 20px; margin-bottom: 10px; }
    .plays-box .plays-text { font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.6; }
    .optin-pill { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 99px; }
    .optin-yes { background: #e8f5ee; color: #1b7a3e; }
    .optin-no  { background: #f5f5f5; color: #999; }
    .footer { background: #fafafa; border-top: 1px solid #f0f0f0; padding: 16px 32px; font-size: 12px; color: #bbb; text-align: center; }
    .footer a { color: #7209b7; text-decoration: none; }
    @media (max-width: 500px) { .row { flex-direction: column; gap: 10px; } }
  </style>
</head>
<body>
<div class="card">
  <div class="header">
    <img src="https://images.squarespace-cdn.com/content/v1/67e435a9add09975846d9818/e2f423be-5ba7-45c5-b5f7-c992d4324256/Leapfrog-Advertising-Full-Colour-01.png" alt="Leapfrog Advertising">
    <div class="tag">New Pay Per Play Application</div>
  </div>
  <div class="body">
    <h2>${firstname} ${lastname}</h2>
    <div class="sub">${company}${email ? ` · ${email}` : ''}</div>

    <div class="section">
      <div class="section-title">Contact Details</div>
      <div class="row">
        <div class="field">
          <div class="label">Email</div>
          <div class="value">${email || '<span class="empty">Not provided</span>'}</div>
        </div>
        <div class="field">
          <div class="label">Phone</div>
          <div class="value ${!phone ? 'empty' : ''}">${phone || 'Not provided'}</div>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <div class="label">Website</div>
          <div class="value ${!website ? 'empty' : ''}">${website || 'Not provided'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Campaign Details</div>
      <div class="row">
        <div class="field">
          <div class="label">Screens</div>
          <div class="value ${!selected_screens ? 'empty' : ''}">${selected_screens || 'None selected'}</div>
        </div>
        <div class="field">
          <div class="label">Budget</div>
          <div class="value ${!budget ? 'empty' : ''}">£${budget ? Number(budget).toLocaleString('en-GB') : '—'}</div>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <div class="label">Start Date</div>
          <div class="value ${!start_date ? 'empty' : ''}">${displayDate(start_date)}</div>
        </div>
        <div class="field">
          <div class="label">End Date</div>
          <div class="value ${!end_date ? 'empty' : ''}">${displayDate(end_date)}</div>
        </div>
      </div>
      ${campaign_days ? `
      <div class="row">
        <div class="field">
          <div class="label">Campaign Duration</div>
          <div class="value">${campaign_days} days</div>
        </div>
        <div class="field">
          <div class="label">Ad Creative</div>
          <div class="value ${!ad_creative_status ? 'empty' : ''}">${creativeLabels[ad_creative_status] || 'Not specified'}</div>
        </div>
      </div>` : ''}
    </div>

    ${plays_summary ? `
    <div class="section">
      <div class="section-title">Estimated Plays</div>
      <div class="plays-box">
        <div class="plays-text">${plays_summary}</div>
      </div>
    </div>` : ''}

    ${notes ? `
    <div class="section">
      <div class="section-title">Additional Information</div>
      <div class="value">${notes.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Marketing Opt-in</div>
      <span class="optin-pill ${marketing_optin ? 'optin-yes' : 'optin-no'}">
        ${marketing_optin ? '✓ Opted in to email marketing' : 'Did not opt in'}
      </span>
    </div>

  </div>
  <div class="footer">
    Submitted via <a href="https://payperplay.leapfrogadvertising.com">payperplay.leapfrogadvertising.com</a>
    &nbsp;·&nbsp; Reply directly to ${email} to respond
  </div>
</div>
</body>
</html>`;

    await sendEmail({
      to:      'hello@leapfrogadvertising.com',
      replyTo: email,
      subject: `New Pay Per Play Application — ${firstname} ${lastname} (${company})`,
      html:    htmlBody,
    });

    console.log(`[submit] Email sent for ${email}`);
    res.json({ success: true });

  } catch (err) {
    console.error('[submit] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Leapfrog form server running at http://localhost:${PORT}`);
  if (process.env.RESEND_API_KEY) {
    console.log('Resend API key loaded ✓');
  } else {
    console.warn('WARNING: RESEND_API_KEY is not set — emails will not send');
  }
});
