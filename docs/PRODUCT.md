# Product and pilot plan

## Product intent

Nautilus Houseboat is a direct, single-operator website for tourists who already want to learn about or book Nautilus. It gives the boat a narrative home and makes the journey easier to understand before a traveler chooses a date and cabin.

HaorBoard is the broader Sunamganj discovery marketplace. The two products serve different points in the journey:

| HaorBoard | Nautilus Houseboat |
| --- | --- |
| Browse and compare multiple operators | Explore one boat in depth |
| Helps travelers decide which boat | Helps travelers decide whether/how to travel on Nautilus |
| Marketplace inventory and platform policy | Operator-approved story, schedule, booking terms and support |

## Problem hypothesis

The public listing shows trip logistics and package details, but the decision still depends on scattered information: what the boat feels like, who operates it, what credentials can be checked, which reviews are genuine, what is available on a specific date, and what happens after payment. Travelers commonly ask for details through social channels or phone, while operators repeat the same answers.

Ismail traveled aboard Nautilus on a sponsored stay and did not personally make a booking or pay. His report that the boat and service made a strong impression is useful qualitative input about the experience, but does not validate the booking journey, current price, availability, or overall guest satisfaction.

## Why test a dedicated site

- The boat is an established named experience with a public trip listing and journey media to build from.
- The operator can control its own story and detail, instead of being one card among many.
- A focused path can answer the key questions before contact: journey, cabin, date, included items, total price, terms and next step.
- One operator is a contained pilot: content approval and booking operations can be tested without onboarding hundreds of boats.

These are reasons to run an operator-led pilot, not proof of product-market fit. A direct site may complement BD Cruise, Facebook and WhatsApp rather than replace them.

## First pilot

### Stage 1 — Operator validation

Review the page with the owner/manager and resolve every marked content gap. Collect current room names/capacities, date calendars, rate rules, route variants, crew-approved photos, operating registration, safety documents, refund/cancellation policy, review links, booking contact and payment details. Confirm who handles guest support and weather decisions.

### Stage 2 — Booking request test

Run a low-volume test with a handful of dates that the operator controls. Until payment integration and procedures are approved, use the site to capture intent or simulate the flow; do not present prototype confirmations as valid bookings. Compare the questions travelers still ask by phone or WhatsApp.

### Stage 3 — Payments and operations

Integrate a Bangladesh-supported payment provider only after the operator agreement and merchant onboarding. Test payment success, failure, timeout, duplicate callback, refund and reconciliation. Ensure a room becomes unavailable atomically when payment succeeds, and expires safely when payment does not complete.

### Stage 4 — Public launch

Launch when live inventory owner, booking support, payment and refund responsibility, customer notifications, terms, privacy and fallback contact are all named and tested. Keep manual booking channels during the first operational season.

## Success measures

Track from the first pilot rather than setting invented baselines:

- Visitor-to-booking-intent rate and paid booking conversion.
- Number of messages/calls needed per booking; repeated-question categories.
- Booking completion and payment failure rate.
- Inventory mismatches, accidental double sales and owner response time.
- Cancellation/refund handling time and customer complaints.
- Post-trip review response rate, source and permission status.
- Operator willingness to keep dates, cabins, rates and route notes current.

Interview travelers who completed and abandoned booking attempts. Ask owners whether the site reduced repetitive replies and whether direct acquisition justified the update work and transaction costs.

## Product boundaries

The website is only for Nautilus. It does not include a public multi-boat directory, social feed, open reviews, or general boat onboarding. It should not claim certifications, inspection status, ratings or affiliation that cannot be verified. Guest review publication requires a real source, consent and moderation.