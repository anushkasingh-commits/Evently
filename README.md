# ✦ Evently — Event & Venue Booking Management System

Evently is a full-stack campus/community event and venue booking application built with **EJS, Node.js, Express.js, MongoDB Atlas, JWT authentication, and an MVC-style project structure**.

## Live Demo

**Production URL:** https://evently-bice.vercel.app

## Problem Statement

Evently is designed to simplify the process of discovering, checking the availability of, and booking venues for campus and community events. It provides a centralized system for organisers and venue managers to handle venue availability, booking requests, approvals, conflicts, notifications, and event check-ins.

## What is included

### Organiser

- Register/login with role-based access
- Search venues by capacity, facilities, rate and location
- Natural-language smart search (example: `300 people, projector and AC, under ₹2000`)
- Live venue availability calendar
- Booking requests with date/time, attendees, facilities and notes
- Weekly/daily recurring bookings (up to 12 occurrences)
- Server-side overlap prevention
- Maintenance-window awareness
- Smart alternative venue suggestions when a slot is unavailable
- Alternative time-slot suggestions
- Booking conflict explanations
- Booking history and status tracking
- 24-hour cancellation rule for approved bookings
- Favourite venues
- In-app notifications
- QR event pass
- PDF booking confirmation

### Admin / Venue Manager

- Venue CRUD
- Venue gallery and facilities
- Opening/closing hours and hourly rate
- Maintenance blocking
- Booking approval/rejection with reasons
- Complete/cancel events
- Revenue tracking
- Venue utilisation analytics
- Audit trail
- Booking reports
- CSV export
- QR/camera check-in + manual booking-code check-in
- Optional email notifications through SMTP

## Setup

### 1. Requirements

- Node.js 18+
- MongoDB Atlas account/database
- Git

### 2. Install

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and set:

```env
PORT=3000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=a-long-random-secret
NODE_ENV=development
```

SMTP values are optional. If configured, approval/rejection updates can also be emailed.

### 4. Seed demo data

```bash
npm run seed
```

Demo users:

- **Admin:** `admin@evently.demo` / `Admin@123`
- **Organiser:** `organiser@evently.demo` / `Organiser@123`

The seed creates venues, an approved event, a pending request and a maintenance block so the dashboard is populated immediately.

### 5. Run

```bash
npm run dev
```

or

```bash
npm start
```

Open `http://localhost:3000`.

## Architecture

```text
config/       MongoDB connection
models/       Mongoose schemas
controllers/  Business logic
routers/      HTTP routes
middleware/   JWT authentication, roles, errors
utils/        Availability, recommendations, mailer, seed
views/        EJS server-rendered UI
public/       CSS + browser JavaScript
```

## Important Booking Rule

A slot conflicts when:

```text
requestedStart < existingEnd
AND
requestedEnd > existingStart
```

The check happens on the **server**, so frontend manipulation cannot create an overlapping booking.

## Smart Recommendation Logic

The Plan B engine scores available venues using:

- Capacity fit
- Requested facility matches
- Price similarity

It also proposes available time windows for the original venue.

No external AI API is required for the smart-search/recommendation features, keeping the core booking system deterministic and reliable.

## Author

**Anushka Singh**  
B.Tech CSE (AI/ML)  
GitHub: [anushkasingh-commits](https://github.com/anushkasingh-commits)