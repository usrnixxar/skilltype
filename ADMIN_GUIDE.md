# SkillType Admin

Open https://skilltype.vercel.app/admin or choose **Admin login** on the login screen. Use the existing registered Admin name and PIN. An existing Admin session opens the console directly. Student/guest sessions cannot manage data; log out before switching accounts.

## Players

Search by name or player ID. Choose **Delete**, review the named player, type `DELETE`, then choose **Permanently delete**. This removes their profile, all leaderboard rows, saved game sessions and login sessions. Student PINs are disabled. The Admin account is protected. Guests can still register again as new guests. Deletion is permanent and may change historical winner results if the deleted player previously won.

## Gifts

Choose **Gifts**, enter a title and upload a JPG/PNG/WebP image up to 2 MB. Published images appear below the game leaderboard. The carousel refreshes every 30 seconds or on page focus; reload to see changes immediately. With no visible gifts, the carousel is hidden.

Edit the title, display order or **Show in slider**, then save. Lower order numbers show first; equal order numbers use upload time. Delete removes the image and its entry; Hide only removes it from the public carousel. Images use public storage URLs, so hiding is not a privacy control.

## Implementation

- UI: `src/admin/AdminPage.tsx`, `src/admin/admin.css`
- Client: `src/utils/adminApi.ts`
- Public carousel: `src/components/GiftSlider.tsx`
- Backend: `supabase/functions/admin-manager/index.ts`
- Database setup: `supabase/admin_management.sql`

The Edge Function validates the opaque player session against the existing Admin UUID on every operation. The database RPC is callable only by `service_role`; no service-role key is included in the browser. Player deletion is transactional and revokes sessions. Tombstones and score-write triggers prevent an in-flight score request from recreating a deleted account's leaderboard entry. Gift writes go through the authenticated backend; public clients have read access to enabled slide metadata only.

Verification: production API exercised using temporary test sessions/records, including rejected non-admin access, deletion confirmation, Admin protection, revoked-session denial, image validation/upload/update/hide/delete and retry. SQL rollback checks cover student PIN disabling, deletion of linked data and score replay rejection. Browser checks cover login, confirmation/cancel, gift controls, 390px layout and account-switch access removal. Existing Sunday schedule and leaderboard rank tests pass.
