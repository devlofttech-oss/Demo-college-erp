# Dead State Audit - 2026-07-16

Checked visible disabled controls, placeholder copy, module routes, and branch cards in the web ERP.

## Findings

- Settings > Module Defaults keeps `onlinePayments`, `receiptGeneration`, and `communicationModule` disabled. This matches the README note that these excluded features remain disabled by default, so they are intentional dead states until those modules are implemented.
- Fees > Fee Collections has an empty branch description, but the card and header button still open the record-payment page when the role has `fees.collect`. This is only missing helper copy, not a dead button.
- Fees > Approve Adjustment is disabled when the user lacks `fees.adjust` or there are no payable assignments. This is data/permission gated, not broken.
- Fees > Adjustment History uses the shared reports panel, so the Recent Collections half can show "No collections posted yet" even when the user only came to see adjustments. It works, but the shared panel can feel like a dead sub-section in that context.
- Exams branches for Internal Assessment, Generate Results, and Report Cards are permission gated and open their respective CTA panels. No dead exam branch was found in the inspected code path.
- Document owner fields and role/permission buttons disable correctly when prerequisites or role permissions are missing. These are guard states, not dead controls.

## Follow-up Candidates

- Add a short description for the Fee Collections branch card.
- Split Fees > Adjustment History into an adjustment-only panel so the collections empty state is not shown there.
- Keep the excluded Settings toggles hidden or marked as coming later if they should not invite clicks.
