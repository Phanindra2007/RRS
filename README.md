# Railway Reservation System

Full-stack DBMS mini project using **React + Node/Express + MySQL** with CNF/WL-only ticketing.

## 1) Project Structure

```text
Railway-Reservation-System/
├── backend/
│   ├── app.js
│   ├── server.js
│   ├── .env.example
│   ├── config/db.js
│   ├── controllers/
│   ├── routes/
│   ├── services/bookingService.js
│   ├── middleware/auth.js
│   ├── utils/pnr.js
│   └── database/
│       ├── schema.sql
│       └── seed.sql
├── frontend/
│   ├── .env.example
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── styles.css
│       ├── pages/
│       ├── components/
│       ├── context/
│       └── services/api.js
├── report.pdf
└── README.md
```

## 2) Database (MySQL)

Run in order:

```sql
SOURCE /absolute/path/backend/database/schema.sql;
SOURCE /absolute/path/backend/database/seed.sql;
```

### Implemented tables

- `USER`, `ADMIN`, `TRAIN`, `STATION`, `ROUTE`
- `CLASS`, `SCHEDULE`, `BOOKING`, `PASSENGER`
- `SEAT`, `PAYMENT`, `CANCELLATION`, `WAITING_LIST`

### Key rules enforced

- `PASSENGER.ticket_status` only: `CNF`, `WL`
- `PASSENGER.seat_id` required for `CNF`, must be `NULL` for `WL` (`CHECK` constraint)
- `SEAT` stores `coach_number`, `seat_number`, `berth_type (LB/MB/UB/SL/SU)`
- Trigger `trg_promote_waiting_list_after_cancel` auto-promotes WL -> CNF when a confirmed seat is cancelled.

## 3) Backend Setup (Express)

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Server: `http://localhost:5000`

### Required APIs

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`

Trains:
- `GET /api/trains/search?source=NDLS&destination=BCT&date=2026-04-20`
- `GET /api/trains/:id`

Booking:
- `POST /api/bookings`
- `GET /api/bookings/:pnr`
- `GET /api/bookings/user/:userId`

Seat:
- `GET /api/seats/availability?scheduleId=1&classId=1&date=2026-04-20`

Cancellation:
- `POST /api/bookings/:id/cancel`

### Concurrency and seat allocation

- Booking is done in a transaction (`BEGIN/COMMIT/ROLLBACK`).
- Seat rows are selected with `FOR UPDATE` to prevent double assignment.
- Allocation order: preferred berth first, then any available seat.
- If no seat is available: passenger becomes `WL` and gets WL position.

## 4) Frontend Setup (React)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

### Implemented pages

- Login / Register
- Search trains
- Train results table
- Booking page (class + berth preference)
- Booking confirmation page
- PNR status page
- Booking history page

### Seat display behavior

Confirmed ticket display example:

`Coach S1 - Seat 23 (Lower Berth)`

WL display:

`WL Position: <number>`

## 5) Sample Booking Payload

```json
{
  "userId": 1,
  "scheduleId": 1,
  "classId": 1,
  "sourceStationId": 1,
  "destinationStationId": 2,
  "journeyDate": "2026-04-20",
  "berthPreference": "LB",
  "passengerName": "Aman",
  "age": 28,
  "gender": "M"
}
```

## 6) Notes

- This implementation supports only CNF and WL statuses across schema, business logic, and UI.
- CNF passengers always store an explicit `seat_id`.
