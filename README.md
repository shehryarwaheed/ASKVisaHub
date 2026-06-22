# ✈️ ASKVisaHub — Visa Management System

A full-stack Visa Management System built with **Node.js / Express** on the backend and **React** on the frontend, powered by a **Microsoft SQL Server** database. Designed to streamline the visa application process for applicants, travel agents, and administrators.

**Developed by:**

* 24L3023 Muhammad Shehryar Waheed
* 24L3017 Aqsa Ehtesham
* 24L3058 Adnan Ali Khan

---

## 🌟 Features

### 👤 Applicant Portal
* 📋 **Multi-Step Application Wizard** — Submit visa applications in a guided 3-step flow (destination & visa type → travel info → agent selection)
* 🗂️ **Application Tracking** — View all active applications and their real-time status
* 📜 **History** — Browse past approved/rejected applications
* 💳 **Payments** — Record and view visa fee payments
* 🤝 **Agent Connection** — Browse and select a travel agent for your application

### 🧑‍💼 Agent (Officer) Portal
* 📥 **Work Requests** — View and accept/reject incoming applicant requests
* 📁 **Active Visa Management** — Process assigned applications, update statuses, add remarks
* ✅ **Completion** — Move finalized applications to history
* 👤 **Profile Management** — Update bio, hourly fee, experience, and availability
* 🚩 **Blacklist Requests** — Flag suspicious applicants and escalate to admin

### 🛡️ Admin Panel
* 📊 **Dashboard Statistics** — Live counts of active applications, total applicants, agents, approved/rejected, and blacklisted users
* 🌐 **Global Feed** — Monitor all visa applications across the system
* 👥 **Applicant Management** — View, block/unblock, and manage all registered applicants
* 🧑‍✈️ **Agent Management** — View all agents, block/unblock, approve/reject pending registrations
* ⛔ **Blacklist Management** — Review blacklist requests submitted by agents; approve or reject
* 📑 **Reports** — View system-wide completed application history
* 🔔 **Notifications** — Real-time notification system for all roles

### 🔐 Security & Auth
* JWT-based authentication with real-time DB validation on every request
* Role-based access control (`applicant`, `agent`, `admin`)
* Automatic account suspension enforcement — blocked users are kicked out mid-session via a 15-second heartbeat
* Pending registration approval flow — new accounts require admin approval before login
* Ownership checks on all sensitive mutations (e.g. delete own application only)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express.js |
| Database | Microsoft SQL Server (via `mssql`) |
| Auth | JSON Web Tokens (`jsonwebtoken`), `bcrypt` |
| HTTP Client | Axios (with request/response interceptors) |
| UI Style | Glassmorphism, custom design system |

---

## 📦 Prerequisites

Make sure you have the following installed before running the project:

* [Node.js](https://nodejs.org/) (v18 or later)
* [npm](https://www.npmjs.com/) (comes with Node.js)
* [Microsoft SQL Server](https://www.microsoft.com/en-us/sql-server) (2019 or later) or SQL Server Express
* [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms) — recommended for DB setup

---

## 🚀 How to Run Locally

### Step 1 — Clone the Repository

⚠️ This repo is read-only. You can only fetch/clone the code, not push changes.

```bash
git clone https://github.com/YOUR_USERNAME/ASKVisaHub.git
```

Or download the ZIP directly from the green **Code** button above.

---

### Step 2 — Set Up the Database

1. Open **SSMS** and connect to your SQL Server instance
2. Run the provided SQL script (`database/schema.sql`) to create all tables, stored procedures, and triggers
3. Optionally run `database/seed.sql` to populate initial lookup data (countries, visa types, etc.)

---

### Step 3 — Configure the Backend

1. Navigate to the backend folder:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the `backend/` directory with the following:

```env
DB_USER=your_sql_username
DB_PASSWORD=your_sql_password
DB_SERVER=localhost
DB_NAME=ASKVisaHub
DB_PORT=1433

JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=8h

PORT=5000
```

4. Start the backend server:

```bash
node server.js
```

You should see:

```
✅ Connected to MSSQL Database
🚀 Server running on port 5000
```

---

### Step 4 — Configure the Frontend

1. Navigate to the frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the React development server:

```bash
npm run dev
```

4. Open your browser and visit:

```
http://localhost:5173
```

---

## 📁 Project Structure

```
ASKVisaHub/
├── backend/
│   ├── config/
│   │   └── db.js                  # MSSQL connection pool
│   ├── middleware/
│   │   └── auth.js                # JWT auth + role authorization
│   ├── routes/
│   │   ├── auth.js                # Register, Login, Logout, /me
│   │   ├── applicant.js           # Applicant-specific routes
│   │   ├── agent.js               # Agent-specific routes
│   │   ├── admin.js               # Admin-specific routes
│   │   ├── lookup.js              # Countries, visa types, agents list
│   │   └── notifications.js       # Notification CRUD
│   └── server.js                  # Express app entry point
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js           # Axios instance with interceptors
│   │   ├── components/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── IOSSelect.jsx
│   │   │   ├── NotificationBox.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StatCard.jsx
│   │   │   └── Toast.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Global auth state
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── ApplicantDashboard.jsx
│   │   │   ├── AgentDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── NewApplication.jsx
│   │   ├── assets/
│   │   │   └── images/
│   │   │       └── bg.jpg         # Background image
│   │   ├── App.jsx                # Routes & providers
│   │   ├── index.css              # Global styles & design system
│   │   └── index.js              # React root
│   └── package.json
│
└── README.md
```

---

## 🔒 Contributing & Permissions

This repository is **view/clone only**.

* ✅ You can clone or download the code
* ✅ You can run it locally
* ❌ You cannot push changes to this repository
* ❌ Pull requests are not accepted

If you'd like to suggest something, open an **Issue** — but changes to the codebase are managed solely by the original authors.

---

## 📄 License

This project is for **educational purposes only**. All rights reserved by the original authors.
