# CampaignBuddy Frontend

CampaignBuddy is an AI-powered Outbound Sales Platform front-end application designed to automate outreach and boost reply rates. 

## 🚀 Key Features

*   **Campaign Builder (Wizards):** A seamless, multi-step form wrapper to launch new outbound campaigns containing rich details like Goal, Product Name, Value Proposition, Target Industries, Target Job Titles, Competitor Displacement, Social Proof, and CTA Links.
*   **Instant Campaign Launch:** "Fire-and-forget" webhook integration that instantly triggers background processes via n8n (`Outreach_Campaign` webhook) without blocking the user interface, alongside a beautiful success animation modal.
*   **Campaign History & Real-Time Polling:** Live table displaying launched campaigns with a real-time polling indicator (updates every 8 seconds) hooked up to Supabase via serverless Vercel functions (`/api/campaigns`).
*   **Detailed Email Previews:** Click into a campaign to view every generated email. Includes an interactive "Preview" modal that displays the email in a native email-client aesthetic (rendering From, To, Date, Subject, and Body).
*   **Live SendGrid Analytics Dashboard:** A dedicated analytics tab that natively fetches global metrics (Sent, Opened, Clicked, Delivered) from a live SendGrid API via n8n webhooks and visualizes them using Chart.js.
*   **Fast Form Autofill:** A developer/demo "Autofill" button that instantly populates all campaign configuration fields with highly targeted test data.
*   **Temporary Admin Authentication:** A secure login gate required to access the application dashboard.
    *   **Username:** `anurag`
    *   **Password:** A fast-rolling 2-digit number (e.g., `42`, `88`) that randomly regenerates every 30 seconds. (Accessible strictly via the browser Developer Console).
    *   **Auto-Logout:** Enforces a rigid 30-minute session expiry before safely kicking users back to the login screen.

## 🛠 Tech Stack

*   **Core:** HTML5, Vanilla JavaScript, CSS3 (Native Custom Properties)
*   **Icons:** Lucide Icons
*   **Data Visualization:** Chart.js
*   **Background Automation:** n8n Webhooks
*   **Data Retrieval:** Supabase & Vercel Serverless Functions

## 📝 Setup & Usage

To test the admin gate locally, simply serve the directory using any static file server:

```bash
npx serve .
```

Navigate to the local URL, open your browser's Developer Console to retrieve the rotating 2-digit password, and login as `anurag`.
