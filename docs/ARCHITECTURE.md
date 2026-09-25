# System and booking rules

## Components

- A single Node.js HTTP server serves the website and JSON API.
- SQLite stores one operator listing, room categories, departure dates, date-specific prices, holds, bookings and price offers.
- The public catalog is filtered to the published Nautilus showcase listing. Owner routes are password protected.
- The current Render demo uses an ephemeral filesystem; sample data may reset after restarts, spin-down or redeployment. A real service needs persistent storage or managed Postgres.

This is adapted from HaorBoard's prototype engine, with a Nautilus-only public catalog and independent database path.

## Booking flow

1. The guest chooses one sample date and one private room category.
2. The service creates a short, exclusive hold under a SQLite transaction.
3. The prototype collects guest name and phone number and simulates checkout.
4. A confirmation ID is saved and displayed. It is explicitly marked as a concept reservation and cannot be used to board.
5. A guest may propose a total offer. An accepted offer still must obtain an available room hold before checkout.

A room category in sample data is modeled as one reservable inventory unit per departure. The actual Nautilus cabin layout and inventory must be confirmed. Sample generated dates do not represent real availability.

## Pricing

The demo seed uses the public BD Cruise listing's ৳15,000/person reference. The room's listed total equals its capacity times its per-person rate. Owner tools can override rates for a specific date. A guest offer is a proposed total that needs operator review.

No charge occurs. The future requirement is full advance payment, but payment collection, booking confirmation and operator settlement are not integrated. The owner must determine whether full-capacity pricing or guest-count pricing applies and approve the exact total before launch.

## Existing safeguards

- BEGIN IMMEDIATE transactions and a partial unique index prevent two active holds for one room/date.
- Confirmed bookings also block the room/date.
- Holds expire after ten minutes.
- Checkout checks whether inventory is still available and whether the hold is still active.
- Owner tools can close a departure, set date-specific rates, add dates and block an externally sold room.
- Guest lookup by booking ID returns trip details without exposing the guest phone.

## Known limits

- Simulated payment only; no gateway, webhook verification, payout or refund workflow.
- Shared-password owner access, with no account roles, MFA or audit log.
- Demo room/date seeds; do not treat them as real inventory.
- No automated guest or owner notifications.
- No review verification or moderation interface.
- Terms snapshot is a prototype disclaimer, not approved customer terms.
- Data is stored locally in SQLite; backups and restoration procedures need configuration for a real service.
