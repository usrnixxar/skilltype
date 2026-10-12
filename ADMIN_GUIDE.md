# SkillType Admin

Open https://skilltype.vercel.app/admin or choose **Admin login** on the login screen. Use the existing registered Admin name and PIN. Each new page load requires Admin login. Student/guest accounts cannot manage Admin data.

## Players

Search by name or player ID. Choose **Delete**, review the named player, type `DELETE`, then choose **Permanently delete**. This removes their profile, all leaderboard rows, saved game sessions and login sessions. Student PINs are disabled. The Admin account is protected. Guests can still register again as new guests. Deletion is permanent and may change historical winner results if the deleted player previously won.

## Top Achievement

Choose **Top Achievement** and upload a title and JPG/PNG/WebP image (up to 2 MB). Each upload is saved in this separate library, initially hidden. Check **Show as Top Achievement** on a product and **Save changes**. Selecting a product automatically hides the previously selected product. A database constraint enforces at most one active achievement, including concurrent requests. Uncheck and save to show COMING SOON in the section. Products remain in the library until deleted.

## Showcase

Choose **Showcase** and upload products one at a time. You can keep multiple products; all visible showcase products appear between the achievement/winner row and Admin profile in a compact, randomly shuffled carousel. Each remains visible for five seconds, with previous/next, dots and pause controls. The order stays stable during background refreshes unless products are added or removed. It pauses while hovered/focused and initially for reduced-motion users.

Edit a title or **Show in showcase**, then save. Delete removes the image and entry; hiding retains them. Images have public storage URLs, so hiding is not a privacy control. Website sections refresh every 30 seconds or on page focus; reload for an immediate update. Empty sections remain visible with COMING SOON. Existing gift uploads remain in Showcase.

## Refer & Earn

The compact REFER AND WIN row sits directly below the player profile, outside the Live Stats metrics. Its text takes 70% of the row and the share button 30%. The share button copies the personal invite URL, with a manual-copy fallback. This release provides invite sharing only; referral conversion tracking and reward points are not configured.

Login is an opaque, fixed first screen. Game content is hidden and background scrolling is locked until login. The login form itself can scroll on short screens and when the mobile keyboard is open.

## Implementation

- UI: `src/admin/AdminPage.tsx`, `src/admin/admin.css`
- Client: `src/utils/adminApi.ts`
- Public carousel: `src/components/GiftSlider.tsx`
- Backend: `supabase/functions/admin-manager/index.ts`
- Database setup: `supabase/admin_management.sql`, followed by `supabase/product_sections.sql`

The Edge Function validates the opaque player session against the existing Admin UUID on every operation. The database RPC is callable only by `service_role`; no service-role key is included in the browser. Player deletion is transactional and revokes sessions. Tombstones and score-write triggers prevent an in-flight score request from recreating a deleted account's leaderboard entry. Gift writes go through the authenticated backend; public clients have read access to enabled slide metadata only.

Verification: production API exercised using temporary test sessions/records, including rejected non-admin access, deletion confirmation, Admin protection, revoked-session denial, image validation/upload/update/hide/delete and retry. SQL rollback checks cover student PIN disabling, deletion of linked data and score replay rejection. Browser checks cover login, confirmation/cancel, gift controls, 390px layout and account-switch access removal. Existing Sunday schedule and leaderboard rank tests pass.

## Leaderboard layout and Sunday display

Top Achievement and Last Week Winner occupy equal halves above the showcase. Sunday still blocks competition point increases, but numeric scores and saved points remain visible every day in stats, leaderboard, results, records and personal bests.

## Game balance

Wave 1 begins at 20 WPM; speeds rise by 2–3 WPM each wave to 70 WPM at Wave 20. Later waves retain the 70 WPM cap. The Top Achievement target is 20 completed waves. New runs earn 70% fewer points: 3 per correct character, 15 per completed word (both retain the combo multiplier), and 45 × wave for a wave-clear bonus. Existing saved scores are unchanged. Sunday practice still does not award competition points. The pause panel uses 30% of the typing area, with a 180px minimum (bounded by available space) to keep controls readable.

Start-menu difficulty and action controls use 30% width with a 220px readable minimum bounded by available space. The hero logo/title remain unchanged.

## No remembered login

Student, Guest and Admin login identity/session tokens are kept only in page memory. No PIN is retained in the active profile. Refresh, a new tab or returning to the site requires login; server accounts and leaderboard history are unchanged. Legacy active-profile/name/ID/profile-list keys are removed from localStorage and sessionStorage on startup. Device identifiers and game settings are not login credentials and remain available. Login forms request autocomplete off and password-manager ignore hints, but the website cannot erase entries previously stored in an external browser password manager or force every browser to suppress its save prompt.
