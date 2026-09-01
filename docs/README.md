# Developer docs

Onboarding guides for this backend. Read them in this order:

1. **[Architecture](architecture.md)** — how the process starts, request lifecycle, folders, auth, response shape, how to add a module.
2. **[Models](models.md)** — the 14 Mongoose collections and how they relate (especially User → UserHabit → HabitLog, and HabitTemplate → AdhkarSet / QuranContent).
3. **[Flows](flows.md)** — end-to-end journeys: register/OTP, guest, login, habits, progress, admin CMS, bugs.
4. **[API reference](api-reference.md)** — every mounted route under `/api/v1`.

Setup, env, and scripts live in the root [README](../README.md).
