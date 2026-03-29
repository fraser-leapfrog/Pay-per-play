# Leapfrog Advertising — Pay Per Play Form

Node.js / Express server that serves the Pay Per Play advertiser application form and submits responses to HubSpot CRM.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and add your HubSpot Private App token:

```
HUBSPOT_API_KEY=pat-eu1-xxxxxxxxxxxxxxxxxxxx
```

> **Where to find it:** HubSpot → Settings → Integrations → Private Apps → your app → Auth → Access token.

Optionally add your marketing email subscription ID:

```
HUBSPOT_SUBSCRIPTION_ID=12345
```

> **Where to find it:** HubSpot → Settings → Marketing → Email → Subscription Types.

### 3. Create HubSpot custom properties (first time only)

```bash
node create-hubspot-properties.js
```

This creates the custom contact properties that the form writes to:
`leapfrog_campaign_timeframe`, `leapfrog_ad_creative_status`, `leapfrog_selected_screens`, `leapfrog_budget`, `leapfrog_estimated_plays`, `leapfrog_notes`

### 4. Start the server

```bash
npm start
```

The form is available at `http://localhost:3000`.

---

## Embedding in Squarespace

Add a **Code Block** to your Squarespace page and paste:

```html
<iframe
  src="https://your-server-url.com"
  width="100%"
  height="1100"
  frameborder="0"
  scrolling="no"
  style="border:none; width:100%; display:block;"
  title="Pay Per Play Application">
</iframe>
```

Replace `https://your-server-url.com` with your deployed server URL (e.g. Railway, Render, Fly.io).

To make the iframe auto-resize to its content height, also add this script to the same Code Block:

```html
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'leapfrog-resize') {
      document.querySelector('iframe').style.height = e.data.height + 'px';
    }
  });
</script>
```

---

## Deploying to Railway (recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables from `.env` in the Railway dashboard
4. Railway auto-detects Node and runs `npm start`

---

## HubSpot field reference

| Form field | HubSpot property |
|---|---|
| First name | `firstname` |
| Last name | `lastname` |
| Email | `email` |
| Phone | `phone` |
| Business name | `company` |
| Website | `website` |
| Campaign dates | `leapfrog_campaign_timeframe` |
| Ad creative status | `leapfrog_ad_creative_status` |
| Selected screens | `leapfrog_selected_screens` |
| Budget | `leapfrog_budget` |
| Estimated plays | `leapfrog_estimated_plays` |
| Additional info | `leapfrog_notes` |
| Marketing opt-in | `email_optout` (false = opted in) |
