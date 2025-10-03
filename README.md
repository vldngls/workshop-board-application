## Workshop Board Application (MERN, TypeScript)

A starter MERN application scaffolded with TypeScript. It includes a Next.js frontend (Tailwind CSS, white + Ford blue theme) and an Express API (Helmet, CORS, RBAC stub). The app currently focuses on the Administrator experience with a sidebar layout and blank content pages. A simple client-side login lets you choose a role (Administrator, Job Controller, Technician) and routes you to the appropriate area.

### Tech Stack
- **Frontend**: Next.js (App Router, TypeScript), Tailwind CSS, React 19
- **Backend**: Express, Helmet, CORS, TypeScript
- **Database**: MongoDB (placeholder wiring; not yet enabled)
- **Auth/RBAC**: Stubbed client-side role selection and server RBAC middleware placeholder
- **Deployment**: Vercel-ready frontend (`web/`)

### Current Features
- **Login page** with role selection (mock): Administrator, Job Controller, Technician
- **Administrator area** with left sidebar and right content panel
  - Sidebar links: Workshop, Job Orders, Account Management
  - Blank content pages for each section
- **Theming**: White background and Ford blue (`#003478`) accents

---

## Local Development

### Prerequisites
- Node.js 18+
- npm (comes with Node)

### Install Dependencies
Run these from the project root:

```bash
npm install --prefix server
npm install --prefix web
```

### Environment Variables (Backend)
Create `server/.env` (optional for now):

```bash
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=change_me
```

> Note: MongoDB and real auth are not yet wired. The API includes a simple RBAC stub and health routes.

### Start Dev Servers
Use two terminals (one for frontend, one for backend), from the project root:

```bash
# Terminal 1: Frontend (Next.js)
npm run web:dev

# Terminal 2: Backend (Express)
npm run server:dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

### Try It
1. Open the app and click "Go to Login".
2. Choose a role and sign in (mock).
3. If Administrator, you’ll see the admin layout with sidebar and blank pages.

---

## Project Structure

```text
workshop-board-application/
  server/           # Express API (TypeScript, Helmet, RBAC stub)
    src/
      index.ts
  web/              # Next.js (TypeScript, Tailwind)
    src/app/
      (auth)/login/page.tsx
      admin/
        layout.tsx
        page.tsx
        workshop/page.tsx
        job-orders/page.tsx
        account-management/page.tsx
```

---

## Deployment

The `web/` app is ready for Vercel. You can deploy it directly by importing the `web` directory in Vercel. A `vercel.json` is included to use default Next.js settings.

For a full MERN deployment, you would host the `server/` separately (e.g., Render, Railway, Fly.io, or your own VM) and configure the frontend to call the API URL.

---

## Author

vldngls

---

## GitHub Repository Setup

Run these commands from the project root to initialize and push to GitHub. Replace placeholders as needed.

### Option A: Using GitHub CLI (`gh`)
```bash
# If not initialized yet
git init
git add .
git commit -m "Initial scaffold"

# Create and push to repo under your account
gh repo create vldngls/workshop-board-application --public --source=. --remote=origin --push
```

### Option B: Using plain Git (no `gh`)
```bash
# If not initialized yet
git init
git add .
git commit -m "Initial scaffold"

# Create a new repo on GitHub via the website first, then:
git branch -M main
git remote add origin https://github.com/vldngls/workshop-board-application.git
git push -u origin main
```


