# Dead State Audit - 2026-07-16

Checked visible disabled controls, placeholder copy, module routes, browser back behavior, and branch cards in the web ERP.

## Fixed

- Unknown `/modules/:moduleSlug` paths no longer fall through to the Dashboard while keeping a bad URL. Module slugs now resolve through the registry, legacy aliases canonicalize, and missing modules redirect out of the dead route.
- Reports categories are now reachable from in-page category cards, not only from the sidebar submenu. Category changes use React Router state, so browser Back returns to the previous report category.
- Communication task cards now update the module route state, so browser Back returns to the previous communication task.
- Fees > Fee Collections now has helper copy on its branch card.
- Fees > Adjustment History now renders an adjustment-only panel instead of showing an empty Recent Collections half.
- Settings > Module Defaults marks reserved toggles as "Coming later" so disabled defaults do not look like broken controls.

## Intentional Guard States

- Settings > Module Defaults keeps `onlinePayments`, `receiptGeneration`, and `communicationModule` disabled. This matches the README note that these excluded features remain disabled by default, so they are intentional until those modules are implemented.
- Fees > Approve Adjustment is disabled when the user lacks `fees.adjust` or there are no payable assignments. This is data/permission gated, not broken.
- Exams branches for Internal Assessment, Generate Results, and Report Cards are permission gated and open their respective CTA panels. No dead exam branch was found in the inspected code path.
- Document owner fields and role/permission buttons disable correctly when prerequisites or role permissions are missing. These are guard states, not dead controls.

## Verification

- `npm test`
- `npm run lint`
- `npm run build`
- Browser smoke on `http://127.0.0.1:5174`: unauthenticated `/dashboard`, `/students`, `/register`, legacy module aliases, and an unknown module slug all landed on `/login` without console errors.

## Remaining Manual Check

- Authenticated browser traversal of protected modules still needs a valid test login supplied by the project owner. The protected shell and route/state changes build and pass unit coverage, but live Back-button traversal inside protected modules was not submitted with local credentials during this audit.
