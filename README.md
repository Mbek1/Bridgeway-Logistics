# Bridgeway Logistics website

A responsive starter website for Bridgeway Logistics, positioned as a Lusaka Province-based logistics company in Zambia. It includes a React frontend, a Node.js/Express API, and MongoDB storage for quote requests.

> **Important:** Contact details, company address, social links, WhatsApp number, and some company-specific facts are placeholders. Replace them before publishing. Do not publish the sample WhatsApp number or placeholder contact details.

## Project structure

```text
bridgeway-logistics/
├── frontend/   # React + Vite + CSS website
└── backend/    # Express API + MongoDB quote storage
```

## 1. Requirements

- Node.js 20.19+ or 22.12+
- npm
- A MongoDB database (MongoDB Atlas is suitable)

## 2. Run the backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and set your MongoDB connection string and a strong admin API key:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
CLIENT_URL=http://localhost:5173
ADMIN_API_KEY=replace-with-a-long-random-secret
```

Start the API:

```bash
npm run dev
```

The health endpoint is `http://localhost:5000/api/health`.

## 3. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env` and update the values when the company's real details are available. The development API URL can remain as shown:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_WHATSAPP_NUMBER=260000000000
VITE_BUSINESS_PHONE=+260 XXX XXX XXX
VITE_BUSINESS_EMAIL=info@bridgewaylogistics.example
VITE_BUSINESS_ADDRESS=Lusaka, Zambia
```

Then start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## 4. Quote enquiries

The quote form sends a `POST /api/quotes` request. A successful submission is validated and saved to MongoDB. The API currently does not send email or SMS notifications; the company can review submitted quotes through the protected endpoint below or a future admin dashboard.

To list quote requests, send:

```bash
curl http://localhost:5000/api/quotes \
  -H "x-admin-key: YOUR_ADMIN_API_KEY"
```

Keep `ADMIN_API_KEY` private. Never put it in a `VITE_` frontend environment variable or commit a real `.env` file.

## 5. Deployment outline

### Backend (Render)

- Create a **Web Service** from the `backend` directory.
- Build command: `npm install`
- Start command: `npm start`
- Add `MONGODB_URI`, `CLIENT_URL` (your deployed frontend URL), and `ADMIN_API_KEY` as Render environment variables.
- `PORT` is supplied automatically by Render; the app reads it.

### Frontend (Netlify or Render Static Site)

- Set the base directory to `frontend`.
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_BASE_URL` to the deployed backend URL plus `/api`, for example `https://YOUR-BACKEND.onrender.com/api`.
- Set the real WhatsApp number in international format without `+` or spaces, for example Zambia numbers start with `260`.
- Update `CLIENT_URL` on the backend to the deployed frontend origin.

The included `frontend/public/_redirects` supports single-page-app routing on Netlify.

## 6. Before launch checklist

- Replace every placeholder phone, WhatsApp, email, address, and social link.
- Confirm which services Bridgeway Logistics currently provides and adjust the service wording if necessary.
- Add the approved company logo and real fleet/warehouse photographs.
- Add the correct business registration, privacy notice, and terms where applicable.
- Configure backups and restrict access to the admin quote endpoint.
- Test a quote submission on the deployed site and confirm it appears in MongoDB.

## Notes

- The site describes coverage as **Lusaka Province, Zambia** and does not claim nationwide coverage.
- The website does not invent fleet size, years in business, client names, testimonials, registration details, or performance statistics.
- The WhatsApp button uses an obvious sample number until a real number is configured.
