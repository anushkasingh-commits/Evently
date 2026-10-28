# Evently: cleanup and professional-quality changes

Tested against a real MongoDB 8 server with 95 end-to-end checks (all pass).
The original code failed 27 of the same checks.

## Bugs fixed

1. **Search crashed on special characters.** Typing `(` or similar into the search box caused a server error, because it was used directly as a regular expression. Search text is now escaped (`controllers/venueController.js`, `utils/validators.js`).
2. **Bad ids and dates caused server errors.** Opening `/venues/notanid`, `/bookings/notanid`, or the availability API with a bad date returned an error page or a 500 response. These now return a clear 400 or 404.
3. **Invalid numbers caused server errors.** Entering text like `abc` for capacity, or a negative rate, failed with a generic error. These now show a specific message.
4. **Sign-up accepted any role.** Sending `role=weird` in the sign-up form caused a server error. Sign-up now always creates an organiser, and it validates name, email and password. A duplicate email now shows a clear message.
5. **Users were not returned to their page after signing in.** The sign-in page now remembers where the user was going. It only redirects to pages on this site, which blocks redirects to other websites.
6. **CSV export allowed spreadsheet formulas.** Event names starting with `=`, `+`, `-` or `@` could run as formulas when the CSV was opened. These are now neutralised.
7. **Error messages could expose internal details.** Server errors now show a friendly message. Full details are only shown in development.
8. **Seed script could delete production data.** It now refuses to run when `NODE_ENV` is `production`.
9. **Admin maintenance blocks could be created with bad input.** The date, times and reason are now checked.
10. **Missing server secret caused confusing failures.** The server now stops at startup with a clear message if `JWT_SECRET` is missing.
11. **Database connection errors could crash the app when the module is imported.** Connection errors are now handled in both run modes.
12. **Venue floor could be saved as empty.** It now defaults to "Ground Floor".

## Error handling
- Every route passes unexpected errors to one error handler. It logs the error on the server and shows the user a friendly page.
- Validation errors from the database are shown as "invalid information" (400), and duplicates as 409, instead of a generic 500.
- Verified: when MongoDB stops, the server stays running, shows an error page, and recovers when the database comes back.

## Code clean-up
- Removed the debug log that printed the database setting, and the "connected" log in the database file. The only remaining logs are the startup message, error logs, and the seed script's output.
- Split the long, dense controller and router files into clearly named, readable blocks. Behaviour is unchanged except where listed above.
- Moved the notification routes from the admin router to the organiser router, where they belong.
- Added `utils/validators.js` (input checks) and `utils/respond.js` (shared error page).
- Pinned the QR scanner library to version 2.3.8 (it was loading the latest version automatically).
- Made the login cookie lifetime a single setting.
- Tidied `utils/mailer.js`, `middleware/auth.js` and `middleware/authorizeRoles.js`. Behaviour is unchanged, and email is still optional.

## Login page
- Removed the "Demo access" box that showed demo passwords on the sign-in page. The demo accounts still exist in the seed data and in the README setup steps.

## Project setup
- Added `.env.example` (the README already asked for it). It lists every setting the code reads.
- `.gitignore`: also ignores `.vercel/`, logs and coverage folders.
- `package.json`: name `evently`, version 1.1.0, author, keywords, Node 18+ requirement, marked private so it cannot be published to npm by accident.
- `README.md`: environment table, reliability and security section, known limitations, and the production seed rule.

## Not changed (recommended next steps)
- Add `helmet` for security headers, and CSRF tokens on forms. Both need testing against the QR scanner and external images before adding.
- Two bookings for the same slot submitted at the exact same moment can, rarely, both succeed. Fixing this fully needs database transactions.
- `public/js/app.js` works, but its code is dense and could be split into smaller functions.

## Voice booking broker (new)
- `GET /broker` (sign-in required): voice booking page, linked from the navbar as "Voice broker".
- `GET /api/venues`: returns up to three active venues that fit the requested capacity and budget and are free at the requested date and time.
- `public/js/broker.js`: asks six questions one at a time, reads the top options with totals, and sends a booking request to the existing `POST /bookings` route only after the organiser says "confirm."
- Booking requests are saved as pending and need admin approval. The broker says "request sent," not "confirmed."
- Files: new `controllers/brokerController.js`, `views/broker.ejs`, `public/js/broker.js`; changed `routers/venueRoutes.js`, `views/partials/navbar.ejs`.

## Fix: booked slots still shown as free (time-zone bug)
- Bookings were saved at local midnight, but availability and conflict checks compared against UTC midnight. On a computer outside UTC (for example, India), a booked venue was still offered by the search, and the booking then failed with "already booked."
- All date lookups in `utils/bookingHelper.js` and the maintenance block in `controllers/adminController.js` now use the same local-midnight rule as the saved bookings. No data migration is needed.
- The voice broker now reports "already booked" (409) separately from other errors.
- Regression checks added to the broker test. All checks pass in India time and in UTC.
