# Prompt-driven views

Two live TypeSafe/Jev examples using published `@arcrider/arcwidgets-react@0.1.0-alpha.5`:

- **Board ↔ Table** (`/`, `/minimal-table-live`): A fictional issue workspace starts as a Kanban board. Ask for a table, essential columns, recent history, highlights, filters or board grouping. Jev chooses from a defined schema; the server validates the choices and React builds the widget `data` prop. The **Schema** drawer shows the exact handoff. The eight issues are fictional and are not sent to Jev.
- **Smart Kanban** (`/smart-kanban-live`): Enter a customer request. Jev returns one Choice for team and two Nouls for urgency and clarification. The app validates the answers, applies explicit demonstration thresholds and places a card into Act now, Schedule or Review. The card uses the user's text; Jev does not generate a title or UI. The decision panel exposes the raw values and question schema. No prerecorded answer is substituted for a live call.

Use fictional requests in Smart Kanban: entered text is transmitted to TypeSafe for evaluation.

From the repository root:

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` **in this demo directory**, set `TYPESAFE_API_KEY`, and restart the server. The local server alone reads the key. Never use a `VITE_` variable for it or commit `.env.local`. Without a key, both demos show an offline state. The development server binds to localhost; do not deploy its unauthenticated API publicly. A public deployment needs a protected backend and rate limits.

Run `npm test`, `npm run build` and `npm run test:ui` to validate the examples. The TypeSafe calls use [`POST /v1/systemone`](https://docs.typesafe.ai/api) with [Choice](https://docs.typesafe.ai/primitives/choice) and [Noul](https://docs.typesafe.ai/primitives/noul). The Smart Kanban thresholds are demonstration policy, not measured production criteria.
