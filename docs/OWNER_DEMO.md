# Nautilus owner presentation

## Five-minute walkthrough

1. Open the home page on a phone. Show the boat photos, cabin presentation, journey outline and gallery. Open a gallery image.
2. Go to **Find your date**, choose an upcoming date and two guests, then **Choose a cabin**. Explain that the sample whole-cabin total is capacity × the dated per-person rate.
3. Choose **Book at listed price**. Show the ten-minute hold and sample payment notice. Enter a demo name and phone, acknowledge the preview terms, and confirm. Save the reference. Print the summary if useful.
4. Close the confirmation and use **My booking** with that reference and phone. This returns the booking status.
5. Open **Operator access** in the footer (or `/owner`) and sign in using the owner password configured on the hosting service. Show booking counts and sample value, then cancel the sample booking. Verify that the cabin is available again.
6. Show adding a departure, changing a dated cabin rate, closing sales and blocking a room sold by phone. An external block can be reopened.
7. Demonstrate an offer on another cabin. In the owner dashboard, accept or counter it. Use **My booking** to retrieve the offer, accept the counteroffer with the matching phone, and complete sample checkout at the agreed amount.
8. Open **Website content**. Demonstrate editing the story, contact details, gallery, crew, real sourced reviews and document links. Saving updates the public page without a source-code edit.
9. Export the booking CSV. Explain that no payment or notification was sent during the demonstration.

## Before the meeting

- Open the hosted website before presenting; a free Render service may need time to wake.
- Verify `/api/health` returns `ok: true` and `/api/content` is reachable after deployment.
- Have the owner password from Render’s environment settings available privately. It is not in this repository.
- Use invented guest data throughout the demonstration.
- Have at least one upcoming sample departure. Existing databases do not regenerate future dates automatically; add a date in the owner dashboard if needed.

## Questions for the owner

- What are the exact cabin identities, capacities, current prices and available trip dates?
- Which photos, footage, business story, crew information, reviews and safety documents may be published?
- Which direct phone/WhatsApp number should receive inquiries?
- What are the boarding time, child policy, cancellation rules and weather/refund arrangements?
- Who updates inventory when a room is sold through phone, Facebook or an agent?
- Which verified merchant account should collect payments, and what makes a reservation final?

## Preview boundaries

This is an independent working prototype. Prices and dates are sample data. No payment processing, guest email/SMS, operator notification or valid boarding reservation is created. The free Render configuration has ephemeral SQLite storage. Use persistent storage and complete the launch-readiness checklist before live transactions.
