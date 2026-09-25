# Nautilus Houseboat

A standalone, Nautilus-only website and booking concept for the houseboat journey on Tanguar Haor. HaorBoard remains the marketplace for discovering multiple boats; this project gives one operator a dedicated digital home for its story, trip details, guest trust and direct booking.

> **Concept / demo status:** Nautilus has not approved or supplied this prototype. Sample dates and room availability are generated for demonstration. The shown ৳15,000 per-person price comes from the public BD Cruise listing checked in September 2026 and is not a live quote. Checkout does not collect money, send an order to Nautilus, or create a valid boarding reservation.

## Why a Nautilus-only site

The multi-boat marketplace helps travelers discover and compare operators. A dedicated Nautilus site solves a different need: presenting one boat in depth, answering questions about the experience, and giving interested travelers one direct path into a booking flow.

That is a product hypothesis, not evidence of demand. The strongest first test is to let Nautilus review the page and data, then measure whether direct visitors understand the offer and complete verified booking requests with less back-and-forth.

## What the page contains

- A Nautilus-first landing page, trip narrative and sample route.
- Room and date selection, whole-room price calculation, a short inventory hold, and a simulated booking confirmation.
- A guest offer flow and password-protected operator tools for dates, room prices, trip closure and external room blocks.
- Dedicated sections for the boat's story, crew and work, credentials, safety records, ratings and guest reviews.
- Clear content gaps where owner-confirmed history, credentials and reviews need to be added.
- Source notes and a production-readiness checklist.

The credential and review sections intentionally do not claim certificates, a rating or an endorsement. The current public listing does not substantiate those claims.

## Run locally

Requires Node.js 22 or newer (the included .node-version pins 24.19.0).

    ADMIN_PASSWORD='choose-a-long-password' SESSION_SECRET='choose-a-random-secret' npm start

Open http://localhost:3000. The operator dashboard is available from the footer or /owner.

SQLite is stored at data/nautilus.sqlite; set DATA_DIR to choose another directory. On first start, the prototype creates one Nautilus showcase listing, sample cabin categories and upcoming sample dates. Set SEED_DEMO_DATA=false to leave a new database empty. This switch does not erase existing data.

    npm test

The integration test checks the single-boat catalog, room holds and conflicts, checkout confirmation, owner login and date-specific pricing.

## Deploy on Render

The included render.yaml creates a free Node web service for previewing the demo. Its SQLite data is ephemeral and can be lost when Render restarts, spins down or redeploys the service. Do not use this setup for real reservations. If configuring a Web Service manually, set:

- Build command: npm install
- Start command: npm start
- ADMIN_PASSWORD: a long private password
- SESSION_SECRET: a randomly generated secret, different from the password
- DATA_DIR: data (ephemeral on the free plan)

Never commit secrets. The Blueprint generates the owner password and session secret. The free service may sleep after idle time and take about a minute to wake. For real inventory, use a paid service with persistent storage or managed Postgres, after approving the cost and completing launch readiness.

## Market fit and limits

A single-operator site can improve product education, credibility and the booking path for people already interested in Nautilus. It cannot by itself create demand, verify safety, keep room inventory accurate, or solve seasonal route changes. See Product and pilot plan.

## Docs

- Product, market fit and pilot: docs/PRODUCT.md
- Content sources and verification: docs/CONTENT_SOURCES.md
- System and booking rules: docs/ARCHITECTURE.md
- Launch readiness: docs/LAUNCH_READINESS.md

## Before real bookings

This build is a working software prototype, not a live transaction system. Before taking money, Nautilus must approve the public content, inventory, trip terms, cancellation/refund policy and responsibilities; a payment provider and payout/reconciliation flow must be integrated; customer receipts and operator notifications must work; and live deployment must be verified with test payments and real trip operations.
