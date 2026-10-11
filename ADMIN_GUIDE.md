# SkillType Admin

Open https://skilltype.vercel.app/admin or choose **Admin login** on the login screen. Use the existing registered Admin name and PIN. An existing Admin session opens the console directly. Student/guest sessions cannot manage data; log out before switching accounts.

## Players

Search by name or player ID. Choose **Delete**, review the named player, type `DELETE`, then choose **Permanently delete**. This removes their profile, all leaderboard rows, saved game sessions and login sessions. Student PINs are disabled. The Admin account is protected. Guests can still register again as new guests. Deletion is permanent and may change historical winner results if the deleted player previously won.

## Top Achievement

Choose **Top Achievement** and upload a title and JPG/PNG/WebP image (up to 2 MB). Each upload is saved in this separate library, initially hidden. Check **Show as Top Achievement** on a product and **Save changes**. Selecting a product automatically hides the previously selected product. A database constraint enforces at most one active achievement, including concurrent requests. Uncheck and save to hide the section entirely. Products remain in the library until deleted.

## Showcase

Choose **Showcase** and upload products one at a time. You can keep multiple products; all visible showcase products appear below the leaderboard in a randomly shuffled carousel. Each remains visible for five seconds, with previous/next, dots and pause controls. The order stays stable during background refreshes unless products are added or removed. It pauses while hovered/focused and initially for reduced-motion users.

Edit a title or **Show in showcase**, then save. Delete removes the image and entry; hiding retains them. Images have public storage URLs, so hiding is not a privacy control. Website sections refresh every 30 seconds or on page focus; reload for an immediate update. Empty sections stay hidden. Existing gift uploads remain in Showcase.

## Refer & Earn

The card below Last Week Winner provides a personal invite URL and copyable player-ID referral code. A copy failure exposes the link for manual copying. This release provides invite sharing only: referral conversion tracking and reward points are not configured. The card says “Rewards to be announced”; no reward amount or qualification rule is assumed.

## Implementation

- UI: `src/admin/AdminPage.tsx`, `src/admin/admin.css`
- Client: `src/utils/adminApi.ts`
- Public carousel: `src/components/GiftSlider.tsx`
- Backend: `supabase/functions/admin-manager/index.ts`
- Database setup: `supabase/admin_management.sql`, followed by `supabase/product_sections.sql`

The Edge Function validates the opaque player session against the existing Admin UUID on every operation. The database RPC is callable only by `service_role`; no service-role key is included in the browser. Player deletion is transactional and revokes sessions. Tombstones and score-write triggers prevent an in-flight score request from recreating a deleted account's leaderboard entry. Gift writes go through the authenticated backend; public clients have read access to enabled slide metadata only.

Verification: production API exercised using temporary test sessions/records, including rejected non-admin access, deletion confirmation, Admin protection, revoked-session denial, image validation/upload/update/hide/delete and retry. SQL rollback checks cover student PIN disabling, deletion of linked data and score replay rejection. Browser checks cover login, confirmation/cancel, gift controls, 390px layout and account-switch access removal. Existing Sunday schedule and leaderboard rank tests pass.
