# API reference

Every **mounted** route. Global prefix: `/api/v1`.

**Auth header:** `Authorization: Bearer <accessToken>` unless the route is public.

**Response envelope** (see [architecture.md](architecture.md)):

```json
{
  "statusCode": 200,
  "success": true,
  "message": "…",
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 },
  "data": {}
}
```

**QueryBuilder list params** (where noted): `page` (default 1), `limit` (default 10), `searchTerm`, `sort` (prefix `-` for desc; default `-createdAt`), `fields`, plus extra keys used as exact Mongo filters.

**Password (register):** 8–25 chars, upper, lower, number, special `@$!%*?&#`.  
**Password (reset / change):** 6–20 chars, same character classes.

---

## Auth — `/api/v1/auth`

Related models: User, Session, OtpToken.

### POST `/api/v1/auth/login`

- **Auth:** Public
- **Purpose:** Email/password login. Unverified accounts get a new OTP and `{ status: "UNVERIFIED" }` (HTTP 400). Disabled users are re-activated.
- **Body:**
  - `email` (string, required)
  - `password` (string, required)
  - `fcmToken` (string, optional)
  - `isRemembered` (boolean, optional)
- **Related models:** User, Session

### POST `/api/v1/auth/admin/login`

- **Auth:** Public
- **Purpose:** Same as login, but `role` must be `admin` or `super-admin`.
- **Body:** Same as login
- **Related models:** User, Session

### POST `/api/v1/auth/social-login`

- **Auth:** Public
- **Purpose:** Google ID-token login (Apple is in the enum, not implemented).
- **Body:**
  - `provider`: `google` | `apple`
  - `token` (string, min 10)
  - `fcmToken` (string, required by Zod)
- **Related models:** User, Session

### POST `/api/v1/auth/verify-email`

- **Auth:** Public
- **Purpose:** Confirm signup OTP; returns tokens + `userId`.
- **Body:** `email`, `otp` (exactly 6 digits), optional `fcmToken`
- **Related models:** User, OtpToken, Session

### POST `/api/v1/auth/resend-otp`

- **Auth:** Public + OTP rate limit (5 / 3 min per IP+email)
- **Purpose:** Resend email-verification OTP. Fails if a non-expired OTP still exists.
- **Body:** `email`
- **Related models:** User, OtpToken

### POST `/api/v1/auth/forgot-password`

- **Auth:** Public + OTP rate limit
- **Purpose:** Start password reset; emails OTP (`OtpToken.type = password_reset`).
- **Body:** `email`
- **Related models:** User, OtpToken

### POST `/api/v1/auth/reset-password-otp`

- **Auth:** Public + OTP rate limit
- **Purpose:** Resend password-reset OTP.
- **Body:** `email`
- **Related models:** User, OtpToken

### POST `/api/v1/auth/verify/reset-password`

- **Auth:** Public
- **Purpose:** Verify reset OTP; returns `{ resetToken }` (short-lived JWT, `purpose: password_reset`).
- **Body:** `email`, `otp` (6 digits)
- **Related models:** User, OtpToken

### POST `/api/v1/auth/reset-password`

- **Auth:** Public, but requires `Authorization: Bearer <resetToken>` from the previous step (not an access token)
- **Purpose:** Set a new password.
- **Body:** `newPassword`
- **Related models:** User

### PATCH `/api/v1/auth/change-password`

- **Auth:** `user`, `admin`, `super-admin`
- **Purpose:** Change password while logged in; invalidates older JWTs via `passwordChangedAt`.
- **Body:** `oldPassword`, `newPassword`
- **Related models:** User

### POST `/api/v1/auth/refresh-token`

- **Auth:** Public (no Zod)
- **Purpose:** Issue a new access token from a refresh token.
- **Body:** `{ "refreshToken": "<string>" }`
- **Related models:** Session, User

---

## User — `/api/v1/user`

Related models: User, OtpToken, Session (guest create).

### POST `/api/v1/user/create`

- **Auth:** Public
- **Purpose:** Register. Sends verification OTP. Duplicate unverified/soft-deleted email resends OTP.
- **Body:**
  - `fullName` (3–30 letters/spaces)
  - `email`
  - `password` (register rules)
  - `timezone` (IANA string, required)
- **Related models:** User, OtpToken

### POST `/api/v1/user/create-guest`

- **Auth:** Public
- **Purpose:** Create guest user with generated email; returns tokens immediately (already “verified”).
- **Body:** none
- **Related models:** User, Session

### PATCH `/api/v1/user/update-profile`

- **Auth:** `user`, `guest`
- **Purpose:** Update profile fields.
- **Body (all optional):** `fullName`, `phone` (digits only), `hasNotification` (boolean), `notificationType` (`vibrate` | `sound`)
- **Related models:** User

### POST `/api/v1/user/switch-guest-to-real`

- **Auth:** `guest`
- **Purpose:** Convert guest to real user; sends verification OTP.
- **Body:** Same as `POST /user/create`
- **Related models:** User, OtpToken

### PATCH `/api/v1/user/update-profile-image`

- **Auth:** `user`, `guest`
- **Purpose:** Upload avatar to Cloudinary.
- **Body:** multipart; field `profile_image` (1 file, max 1 MB)
- **Related models:** User

### GET `/api/v1/user/get-profile`

- **Auth:** `user`, `guest`
- **Purpose:** Current user profile.
- **Related models:** User

---

## Content — `/api/v1/content`

Related model: Content.

Types: `about-us` | `privacy-policy` | `terms-and-condition` | `refund-policy`.

### POST `/api/v1/content/create-or-update`

- **Auth:** Public (admin middleware is commented out)
- **Purpose:** Upsert a legal/about page by `type`.
- **Body:** `type`, `title` (min 3), `content` (min 10)
- **Related models:** Content

### GET `/api/v1/content/retrieve`

- **Auth:** Public
- **Purpose:** List all content pages.
- **Related models:** Content

### GET `/api/v1/content/retrieve/:type`

- **Auth:** Public
- **Purpose:** One page by type.
- **Params:** `type` (see enum above)
- **Related models:** Content

---

## User habits — `/api/v1/user-habit`

Related models: UserHabit, HabitTemplate, HabitLog, AdhkarSet, QuranContent.

`habitId` in params is a Mongo ObjectId. For **add**, it is usually a **HabitTemplate** id. For complete/skip/update/details/content/delete/search, it is a **UserHabit** id (except add/toggle, which also accepts a custom UserHabit id when deactivating).

### POST `/api/v1/user-habit/add/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Activate or deactivate a template (or custom habit). Group / obligatory-connected templates expand to multiple UserHabits.
- **Params:** `habitId` (ObjectId)
- **Body:** `{ "isActive": true | false }` (not Zod-validated)
- **Related models:** UserHabit, HabitTemplate, HabitLog

### GET `/api/v1/user-habit/today`

- **Auth:** `user`, `guest`
- **Purpose:** Today’s active habits for the user’s timezone, with log status.
- **Query:** `category` (optional; e.g. `Prayer`, `Quran`, `Dhikr`, `Deeds`)
- **Related models:** UserHabit, HabitLog, HabitTemplate

### POST `/api/v1/user-habit/custom/add`

- **Auth:** `user` only
- **Purpose:** Create a custom UserHabit (`template: null`).
- **Body:**
  - `name` (1–100)
  - `category`: `Prayer` | `Quran` | `Dhikr` | `Deeds`
  - `frequency`: `{ "type": "Daily"|"Weekly"|"Every_N_Days", "selectedDays"?: ["mon",…], "everyNDays"?: number }`  
    Weekly requires `selectedDays`. Every_N_Days requires `everyNDays` (2–365).
  - `connectedPrayer` (optional): Fajr, Dhuhr, Asr, Maghrib, Isha And Witr, Five Prayers, Nafl, Duha, Night Prayer
  - `location` (optional): `Home` | `Masjid` (default Home)
  - `reminder` (optional): `{ "enabled": boolean, "time": "hh:mm AM/PM" }` — time required if enabled
  - `targetType` (optional): `Page` | `Juzz` | `Min`
  - `targetDescription` (optional, max 50)
  - `startDate` (optional ISO string; default now)
  - `showOnTodayScreen` (optional boolean, default false)
  - `customDetails` (optional, 5–50 chars)
- **Related models:** UserHabit

### DELETE `/api/v1/user-habit/custom/delete/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Delete a custom habit.
- **Params:** `habitId`
- **Related models:** UserHabit

### PATCH `/api/v1/user-habit/update/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Partial update. At least one field required.
- **Body (all optional):** `name`, `connectedPrayer`, `frequency`, `reminder`, `startDate`, `location`, `targetType`, `targetDescription`, `customDetails`, `connectedHabits` (array of UserHabit ObjectId strings, unique)
- **Related models:** UserHabit

### PATCH `/api/v1/user-habit/complete/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Toggle today’s HabitLog to Completed (or back to Pending).
- **Params:** `habitId` (UserHabit)
- **Related models:** UserHabit, HabitLog

### PATCH `/api/v1/user-habit/skip/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Toggle today’s HabitLog to Skipped (or back to Pending).
- **Params:** `habitId`
- **Related models:** UserHabit, HabitLog

### GET `/api/v1/user-habit/search/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Search other user habits to connect.
- **Params:** `habitId`
- **Query:** `searchTerm`
- **Related models:** UserHabit

### GET `/api/v1/user-habit/details/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Single habit detail (merged with template display fields when pre-built).
- **Params:** `habitId`
- **Related models:** UserHabit, HabitTemplate

### GET `/api/v1/user-habit/content/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Dynamic Adhkar or Quran content for the linked template.
- **Params:** `habitId`
- **Related models:** UserHabit, HabitTemplate, AdhkarSet, QuranContent

---

## Progress — `/api/v1/progress`

Related models: UserHabit, HabitLog, User (timezone).

### GET `/api/v1/progress/overview`

- **Auth:** `user` (not guest)
- **Purpose:** Combined progress calendar and analytics.
- **Query (no Zod):** `year`, `month`, `category` (default `all`), `analyticsView` (default `week`)
- **Related models:** UserHabit, HabitLog

### GET `/api/v1/progress/specific/:habitId`

- **Auth:** `user`
- **Purpose:** Analytics for one UserHabit.
- **Params:** `habitId`
- **Query:** `year?`, `month?`
- **Related models:** UserHabit, HabitLog

### PATCH `/api/v1/progress/restart/:habitId`

- **Auth:** `user`, `guest`
- **Purpose:** Set `progressRestartedAt` on the UserHabit.
- **Params:** `habitId`
- **Related models:** UserHabit

---

## Bugs (app) — `/api/v1/bug`

Related model: Bug (User refs).

`featureKey` values include: `app crash`, `performance issue`, `data loss`, `notification issue`, `sync problem`, `signup is not working`, `login is not working`, `guest login is not working`, `update profile image`, `update profile`, `change password`, `social login`, `bug upload`, `create habit`, `custom habit`, `habit list`, `update habit`, `delete habit`, `active habit`, `deactivate habit`, `habit completed`, `habit skipped`, `show completed`, `connected habit`, `frequency problem`, `connected prayer`, `progress tab`, `settings`, `other`.

### POST `/api/v1/bug/create`

- **Auth:** `user`, `guest`
- **Purpose:** Report a bug; optional images.
- **Body:** multipart form-data: `featureKey`, `title`, `description`; files field `bug_images` (up to 10, 1 MB each)
- **Related models:** Bug, User

### GET `/api/v1/bug/check-existing`

- **Auth:** `user`, `guest`
- **Purpose:** List existing bugs for a feature (so the client can upvote instead of duplicating).
- **Query:** `featureKey` (required in service)
- **Related models:** Bug

### PATCH `/api/v1/bug/upvote/:bugId`

- **Auth:** `user`, `guest`
- **Purpose:** Upvote an existing bug.
- **Params:** `bugId`
- **Related models:** Bug

### PATCH `/api/v1/bug/status/:bugId`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Update status (`pending` | `in_progress` | `resolved`).
- **Params:** `bugId`
- **Body:** `{ "status": "pending"|"in_progress"|"resolved" }`
- **Related models:** Bug

### DELETE `/api/v1/bug/delete/:bugId`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Delete a bug.
- **Params:** `bugId`
- **Related models:** Bug

### GET `/api/v1/bug/retrieve-all`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Paginated admin list (QueryBuilder; search on title, description, featureKey).
- **Query:** `page`, `limit`, `searchTerm`, `sort`, `status`, …
- **Related models:** Bug

---

## FAQ — `/api/v1/faq`

Related model: Faq.

### POST `/api/v1/faq/create`

- **Auth:** Public (admin middleware is commented out)
- **Purpose:** Create an FAQ.
- **Body:** `question` (min 10), `answer` (min 20), `isPublished` (optional boolean, default false)
- **Related models:** Faq

### GET `/api/v1/faq/`

- **Auth:** `admin`, `super-admin`
- **Purpose:** List FAQs (pagination/search via query; no Zod).
- **Related models:** Faq

### PATCH `/api/v1/faq/update/:id`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Update FAQ.
- **Params:** `id`
- **Body:** Zod schema is nested as `{ "body": { "question?", "answer?", "isPublished?" } }`. The validator is applied to `req.body`, so the JSON should include that extra `body` wrapper unless the schema is fixed later.
- **Related models:** Faq

### DELETE `/api/v1/faq/delete/:id`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Delete FAQ.
- **Params:** `id`
- **Related models:** Faq

---

## Admin dashboard — `/api/v1/admin`

Unless noted, auth is `admin` and `super-admin`.

Three paths are registered with `router.use`, so **any HTTP method** hits the handler: `/get-me`, `/update-profile`, `/habit/analytics`. Prefer GET for get-me/analytics and PATCH/PUT for update-profile.

### Admin profile and analytics

#### ANY `/api/v1/admin/get-me`

- **Purpose:** Admin’s own profile snapshot.
- **Related models:** User

#### ANY `/api/v1/admin/update-profile`

- **Purpose:** Update admin display name.
- **Body:** `{ "fullName": "…" }` (no Zod; required in service)
- **Related models:** User

#### ANY `/api/v1/admin/habit/analytics`

- **Purpose:** Habit analytics table (templates vs user activity).
- **Query:** `category`, `search`, `page`, `limit`
- **Related models:** HabitTemplate, UserHabit, HabitLog

### Overview — `/api/v1/admin/overview`

#### GET `/api/v1/admin/overview/stats`

- **Purpose:** High-level dashboard counts.
- **Related models:** User (and related aggregates)

#### GET `/api/v1/admin/overview/user-growth`

- **Purpose:** User growth chart.
- **Query:** `year` (number; defaults to current year)
- **Related models:** User

#### GET `/api/v1/admin/overview/recent-active-users`

- **Purpose:** Recently active users.
- **Related models:** User

### User management — `/api/v1/admin/users`

#### GET `/api/v1/admin/users/overview`

- **Purpose:** Counts by status (active / blocked / disabled).
- **Related models:** User

#### GET `/api/v1/admin/users/list`

- **Purpose:** Paginated users.
- **Query:** `page`, `limit`, `searchTerm` (name/email), `status`, `plan`
- **Related models:** User

#### GET `/api/v1/admin/users/details/:userId`

- **Purpose:** One user.
- **Params:** `userId`
- **Related models:** User

#### PATCH `/api/v1/admin/users/change-status/:userId`

- **Purpose:** Set user status.
- **Params:** `userId`
- **Body:** `{ "status": "pending"|"active"|"blocked"|"disabled" }`
- **Related models:** User

### Quran content — `/api/v1/admin/quran-content`

Related model: QuranContent.

**Route order note:** `GET /:id` is registered before `GET /preview/:id`. A request to `/preview/:id` may be captured as `id = "preview"`. Prefer listing/create/update paths that do not collide, or call preview with that caveat.

#### POST `/api/v1/admin/quran-content/create`

- **Purpose:** Create surah/content + page images.
- **Body:** multipart: `name`, optional `nameArabic`, `totalVerses` (number ≥ 1); files field `pages`
- **Related models:** QuranContent

#### GET `/api/v1/admin/quran-content/list`

- **Purpose:** List contents.
- **Related models:** QuranContent

#### PATCH `/api/v1/admin/quran-content/update/:id`

- **Purpose:** Update metadata.
- **Params:** `id`
- **Body:** optional `name`, `nameArabic`, `totalVerses`
- **Related models:** QuranContent

#### DELETE `/api/v1/admin/quran-content/delete/:id`

- **Purpose:** Delete content.
- **Params:** `id`
- **Related models:** QuranContent

#### GET `/api/v1/admin/quran-content/:id`

- **Purpose:** Get one document.
- **Params:** `id`
- **Related models:** QuranContent

#### GET `/api/v1/admin/quran-content/preview/:id`

- **Purpose:** Preview a page image.
- **Params:** `id`
- **Query:** `index` (number)
- **Related models:** QuranContent

#### POST `/api/v1/admin/quran-content/image/:id`

- **Purpose:** Append verse/page images.
- **Params:** `id`
- **Body:** multipart files field `pages`
- **Related models:** QuranContent

#### POST `/api/v1/admin/quran-content/image/reorder/:id`

- **Purpose:** Reorder one image.
- **Params:** `id`
- **Body (no Zod):** `{ "imageUrl": "<url>", "order": <number> }`
- **Related models:** QuranContent

#### DELETE `/api/v1/admin/quran-content/image/delete/:id`

- **Purpose:** Remove one image by URL.
- **Params:** `id`
- **Body:** `{ "imageUrl": "<url>" }`
- **Related models:** QuranContent

#### PUT `/api/v1/admin/quran-content/image/replace/:id`

- **Purpose:** Replace an image.
- **Params:** `id`
- **Body:** multipart: `imageUrl` plus files field `pages`
- **Related models:** QuranContent

#### GET `/api/v1/admin/quran-content/`

- **Purpose:** Name list for dropdowns.
- **Related models:** QuranContent

### Adhkar sets — `/api/v1/admin/adhkar-sets`

Related model: AdhkarSet.

#### POST `/api/v1/admin/adhkar-sets/add`

- **Purpose:** Create a set (name only).
- **Body:** `name`, optional `nameArabic`
- **Related models:** AdhkarSet

#### GET `/api/v1/admin/adhkar-sets/contents`

- **Purpose:** List sets.
- **Related models:** AdhkarSet

#### DELETE `/api/v1/admin/adhkar-sets/delete/:setId`

- **Purpose:** Delete a set.
- **Params:** `setId`
- **Related models:** AdhkarSet

#### PATCH `/api/v1/admin/adhkar-sets/update/:setId`

- **Purpose:** Rename set.
- **Params:** `setId`
- **Body:** optional `name`, `nameArabic`
- **Related models:** AdhkarSet

#### GET `/api/v1/admin/adhkar-sets/preview/:setId`

- **Purpose:** Set plus sorted items.
- **Params:** `setId`
- **Related models:** AdhkarSet

#### POST `/api/v1/admin/adhkar-sets/item/add/:setId`

- **Purpose:** Append an item.
- **Params:** `setId`
- **Body:** `title`, `arabic`, `transliteration`, `translation`; optional `virtue`, `reference`, `count`, `order`
- **Related models:** AdhkarSet

#### PATCH `/api/v1/admin/adhkar-sets/item/update/:setId/:itemIndex`

- **Purpose:** Update item by array index.
- **Params:** `setId`, `itemIndex`
- **Body (all optional):** `title`, `arabic`, `transliteration`, `translation`, `virtue`, `reference`, `count`
- **Related models:** AdhkarSet

#### DELETE `/api/v1/admin/adhkar-sets/item/delete/:setId/:itemIndex`

- **Purpose:** Delete item by index.
- **Params:** `setId`, `itemIndex`
- **Related models:** AdhkarSet

#### PATCH `/api/v1/admin/adhkar-sets/item/reorder/:setId`

- **Purpose:** Move item to a new order.
- **Params:** `setId`
- **Body:** `{ "itemIndex": number, "newOrder": number }` (non-negative integers)
- **Related models:** AdhkarSet

#### GET `/api/v1/admin/adhkar-sets/`

- **Purpose:** Name list for dropdowns.
- **Related models:** AdhkarSet

### Habit templates — `/api/v1/admin/habit-template`

Related models: HabitTemplate, AdhkarSet, QuranContent, UserHabit (for “already added” flags).

Create/list-for-users/details/groups/parents allow **guest, user, super-admin** (not `admin`). Admin-only: get-all, update, delete, publish.

#### POST `/api/v1/admin/habit-template/create`

- **Auth:** `guest`, `user`, `super-admin`
- **Purpose:** Create a template (usually `draft`). Optional PDF upload.
- **Body:** multipart form-data:
  - required: `name`, `category` (Prayer|Quran|Dhikr|Deeds), `habitType`, `level` (Beginner|Intermediate|Advanced|Custom), `allowedFrequencies` (array of Daily|Weekly|Every_N_Days), `defaultFrequency`
  - optional: `connectedPrayer`, `allowConnectedPrayers[]`, `isPrayerLocked`, `supportsLocation`, `parent`, `isParent`, `group`, `isGroup`, `isNew`, `isConnectedObligatory`, `isLocked`, `isGuestLocked`, `infoContent`, `adhkarSet`, `quranContent`
  - file field `pdf` (max 5 MB)
- **Related models:** HabitTemplate

`habitType`: `obligatory_prayer`, `sunnah_prayer`, `witr`, `duha`, `night_prayer`, `nafl`, `quran`, `adhkar`, `dhikr`, `deed`.

#### GET `/api/v1/admin/habit-template/get-habits`

- **Auth:** `guest`, `user`, `super-admin`
- **Purpose:** Published habits for the app, including whether the current user has them active.
- **Query:** `category?`
- **Related models:** HabitTemplate, UserHabit

#### GET `/api/v1/admin/habit-template/get-all-habits`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Admin list (including drafts).
- **Query:** `page`, `limit`, `searchTerm`, `status` (`draft`|`published`), `category`, `level`
- **Related models:** HabitTemplate

#### PATCH `/api/v1/admin/habit-template/update/:id`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Partial update; optional new PDF.
- **Params:** `id`
- **Body:** multipart; same fields as create, all optional except constraints on provided fields
- **Related models:** HabitTemplate

#### DELETE `/api/v1/admin/habit-template/delete/:id`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Delete template.
- **Params:** `id`
- **Related models:** HabitTemplate

#### PATCH `/api/v1/admin/habit-template/publish/:id`

- **Auth:** `admin`, `super-admin`
- **Purpose:** Flip `status` from `draft` to `published`.
- **Params:** `id`
- **Related models:** HabitTemplate

#### GET `/api/v1/admin/habit-template/get-habit-details/:id`

- **Auth:** `guest`, `user`, `super-admin`
- **Purpose:** Template detail.
- **Params:** `id`
- **Related models:** HabitTemplate

#### GET `/api/v1/admin/habit-template/get-group-habits`

- **Auth:** `guest`, `user`, `super-admin`
- **Purpose:** Templates flagged as groups.
- **Related models:** HabitTemplate

#### GET `/api/v1/admin/habit-template/get-parent-habits`

- **Auth:** `guest`, `user`, `super-admin`
- **Purpose:** Templates flagged as parents (for attaching children).
- **Related models:** HabitTemplate

### Admin bugs — `/api/v1/admin/bugs`

Related model: Bug.

#### GET `/api/v1/admin/bugs/`

- **Purpose:** Paginated bug list.
- **Query:** `page`, `limit`, `searchTerm`, `status`, `plan`
- **Related models:** Bug

#### GET `/api/v1/admin/bugs/details/:bugId`

- **Purpose:** One bug with reporter.
- **Params:** `bugId`
- **Related models:** Bug, User

#### PATCH `/api/v1/admin/bugs/change-status/:bugId`

- **Purpose:** Set status.
- **Params:** `bugId`
- **Body:** `{ "status": "pending"|"in_progress"|"resolved" }`
- **Related models:** Bug

### Announcements — `/api/v1/admin/announcement`

Related model: Announcement.

#### POST `/api/v1/admin/announcement/add`

- **Purpose:** Create (status defaults to Scheduled).
- **Body:** `title`, `description`, `startedAt`, `endedAt` (dates; startedAt ≤ endedAt)
- **Related models:** Announcement

#### PATCH `/api/v1/admin/announcement/update/:id`

- **Purpose:** Partial update.
- **Params:** `id`
- **Body:** optional `title`, `description`, `startedAt`, `endedAt`
- **Related models:** Announcement

#### DELETE `/api/v1/admin/announcement/delete/:id`

- **Purpose:** Delete.
- **Params:** `id`
- **Related models:** Announcement

#### GET `/api/v1/admin/announcement/retrieve`

- **Purpose:** Admin list.
- **Query:** `page`, `limit`, `searchTerm`, `status` (`Active`|`Expired`|`Scheduled`)
- **Related models:** Announcement

### Discounts — `/api/v1/admin/discount`

Related model: Discount.

`appliesTo`: `Yearly Plan` | `Monthly Plan` | `Quarterly Plan` | `Biannual Plan`.

#### POST `/api/v1/admin/discount/add`

- **Purpose:** Create a code. Service also sets `discountString`.
- **Body:** `code`, `discount` (positive number), `appliesTo`, `usageLimit` (positive int), `validFrom`, `validUntil` (validFrom ≤ validUntil)
- **Related models:** Discount

#### PATCH `/api/v1/admin/discount/update/:id`

- **Purpose:** Partial update (at least one field).
- **Params:** `id`
- **Body:** same fields as create, all optional
- **Related models:** Discount

#### DELETE `/api/v1/admin/discount/delete/:id`

- **Purpose:** Delete.
- **Params:** `id`
- **Related models:** Discount

#### GET `/api/v1/admin/discount/retrieve`

- **Purpose:** Admin list.
- **Query:** `page`, `limit`, `searchTerm`, `status` (`Active`|`Expired`), `plan`
- **Related models:** Discount

---

## Non-module HTTP

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Static `src/public/index.html` |
| GET | `/root` | Server info HTML |
| GET | `/health_check` | Health HTML |
| GET | `/plan` | Static plan view |
| GET | `/error` | Throws a test `BadRequestError` |
| static | `/v1/uploads/*` | Local upload files |

---

## Not mounted / inactive

Do not call these as live APIs:

| Item | Status |
|------|--------|
| Subscription routes (`src/app/modules/subscription/`) | Not registered in `version1.ts` |
| Stripe `POST /webhook` | Commented out in `src/app.ts` |
| `habitTemplateRouter` import in `version1.ts` | Unused; templates are only under `/admin/habit-template` |
| Firebase / Socket.IO | Dependencies only |

The Subscription **model** still exists and can be seeded; there is no public payment API yet.
