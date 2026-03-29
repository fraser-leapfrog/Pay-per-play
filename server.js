require('dotenv').config();
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

// ── Config ──────────────────────────────────────────────────────────────────
const HUBSPOT_TOKEN       = process.env.HUBSPOT_API_KEY;
const SUBSCRIPTION_ID     = process.env.HUBSPOT_SUBSCRIPTION_ID; // set in .env
const HS_BASE             = 'https://api.hubapi.com';

function hsHeaders() {
  return {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type':  'application/json',
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET / — serve the application form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'form.html'));
});

// POST /submit — receive form data and push to HubSpot
app.post('/submit', async (req, res) => {
  try {
    const {
      firstname, lastname, email, phone, website, company,
      start_date, end_date,
      ad_creative_status, selected_screens,
      budget, plays_summary, notes,
      marketing_optin,
    } = req.body;

    console.log(`[submit] New application from ${email} (${company})`);

    // Build HubSpot properties — skip blank values
    const properties = clean({
      firstname,
      lastname,
      email,
      phone,
      website,
      company,
      hs_lead_status:                   'NEW',
      leapfrog_campaign_timeframe:       formatDateRange(start_date, end_date),
      leapfrog_ad_creative_status:       ad_creative_status,
      leapfrog_selected_screens:         selected_screens,
      leapfrog_budget:                   budget != null ? String(budget) : undefined,
      leapfrog_estimated_plays:          plays_summary,
      leapfrog_notes:                    notes,
      email_optout:                      marketing_optin ? 'false' : 'true',
    });

    const contactId = await upsertContact(properties, email);
    console.log(`[submit] HubSpot contact upserted — id: ${contactId}`);

    if (marketing_optin) {
      await subscribeContact(email);
      console.log(`[submit] Subscribed ${email} to marketing emails`);
    }

    res.json({ success: true });

  } catch (err) {
    console.error('[submit] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── HubSpot helpers ───────────────────────────────────────────────────────────

/**
 * Search for an existing contact by email; create if not found, patch if found.
 * Returns the HubSpot contact ID.
 */
async function upsertContact(properties, email) {
  // 1. Search for existing contact
  const searchRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method:  'POST',
    headers: hsHeaders(),
    body:    JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }],
      }],
      properties: ['id'],
      limit: 1,
    }),
  });

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(`HubSpot search failed: ${err.message || searchRes.status}`);
  }

  const searchData = await searchRes.json();

  if (searchData.total > 0) {
    // 2a. Contact exists — PATCH to update
    const contactId = searchData.results[0].id;
    const patchRes  = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${contactId}`, {
      method:  'PATCH',
      headers: hsHeaders(),
      body:    JSON.stringify({ properties }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}));
      throw new Error(`HubSpot update failed: ${err.message || patchRes.status}`);
    }

    console.log(`[hubspot] Updated existing contact ${contactId}`);
    return contactId;

  } else {
    // 2b. New contact — POST to create
    const createRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
      method:  'POST',
      headers: hsHeaders(),
      body:    JSON.stringify({ properties }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`HubSpot create failed: ${err.message || createRes.status}`);
    }

    const created = await createRes.json();
    console.log(`[hubspot] Created new contact ${created.id}`);
    return created.id;
  }
}

/**
 * Subscribe an email address to the marketing email subscription type.
 * A warning is logged on failure rather than throwing, so the form still succeeds.
 */
async function subscribeContact(email) {
  if (!SUBSCRIPTION_ID) {
    console.warn('[hubspot] HUBSPOT_SUBSCRIPTION_ID not set — skipping subscription');
    return;
  }

  const res = await fetch(`${HS_BASE}/communication-preferences/v3/subscribe`, {
    method:  'POST',
    headers: hsHeaders(),
    body:    JSON.stringify({
      emailAddress:            email,
      subscriptionId:          SUBSCRIPTION_ID,
      legalBasis:              'CONSENT_WITH_NOTICE',
      legalBasisExplanation:   'Contact opted in via Pay Per Play application form on leapfrogadvertising.com',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn(`[hubspot] Subscription warning for ${email}: ${err.message || res.status}`);
    // Non-fatal — contact was created/updated successfully
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Remove null / undefined / empty-string properties. */
function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && v !== '')
  );
}

/** Format a start/end date pair as a readable string, e.g. "1 Apr 2026 – 30 Apr 2026". */
function formatDateRange(start, end) {
  if (!start && !end) return undefined;
  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '?';
  return `${fmt(start)} – ${fmt(end)}`;
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Leapfrog form server running at http://localhost:${PORT}`);
});
