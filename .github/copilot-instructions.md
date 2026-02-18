<!-- .github/copilot-instructions.md - Guidance for AI coding agents -->

# Copilot instructions for partner-billing-app

Purpose: give an AI coding agent the minimal, actionable context to be productive in this repo.

- Big picture
  - React + TypeScript app bootstrapped with Vite. Entry: `src/main.tsx` → `src/App.tsx`.
  - Data layer: Axios `apiClient` in `src/api/client.ts` communicates with Cloud Factory billing API (baseURL: https://portal.api.cloudfactory.dk/billing).
  - State & caching: `zustand` for auth (`src/store/useAuthStore.ts` and `src/hooks/useAuthStore.ts` — note there are two variants in the tree) and `@tanstack/react-query` for server caching (`useInvoices`, `useInvoiceDetail`).
  - UI patterns: small presentational components under `src/components/` and `src/components/ui/` use Tailwind classes. Pages live under `src/pages/`.

- Key flows to understand
  - Auth & API calls: `apiClient` attaches the access token from `useAuthStore` and has a response interceptor that exchanges the refresh token on 401 (see `src/api/client.ts`). Updating or adding API calls should use `apiClient` to inherit this behavior.
  - Query patterns: hooks under `src/hooks/` use `useQuery` with explicit `queryKey`s (e.g. `['invoices']`, `['invoice', invoiceNo]`) and often `enabled` toggles for conditional fetches.
  - UI navigation: `react-router-dom` routes are defined in `src/App.tsx` — dashboard `"/"` and invoice details `/invoices/:invoiceNo`.

- Project-specific conventions and gotchas
  - Partner GUID constant: many hooks use a hard-coded `PARTNER_GUID` (see `src/hooks/useInvoices.ts`, `src/hooks/useInvoiceDetail.ts`). Be careful when modifying these hooks.
  - Date & currency formatting: code uses `da-DK` locale and ISO date string comparisons (string slicing of ISO date) for status calculations — preserve locale/format assumptions when changing displays or logic.
  - Token store duplication: there are two `useAuthStore` implementations in `src/store` and `src/hooks`. Confirm which one is intended before changing auth behaviour or refactoring stores.
  - Mapping layer: API shapes differ from local types. Mapping functions (e.g. `mapInvoice`, `mapInvoiceDetail`) live inside hooks — prefer updating mappers there rather than spread changes across components.

- Build / dev / lint workflows
  - Start dev server: `npm run dev` (runs `vite`).
  - Build: `npm run build` runs `tsc -b && vite build` — TypeScript project references are expected (`tsconfig.app.json`, `tsconfig.node.json`).
  - Lint: `npm run lint` runs `eslint .`.
  - Preview production build: `npm run preview`.

- Integration & external dependencies
  - Cloud Factory API endpoints are external and required for realistic data. When working offline, mock `apiClient` responses or use React Query `msw` patterns.
  - Key third-party libs: `axios`, `@tanstack/react-query`, `zustand`, `react-router-dom`, `lucide-react`, `tailwindcss`.

- How to add a new API endpoint (quick recipe)
  1. Add call via `apiClient.get/post(...)` in a new hook in `src/hooks/`.
  2. Map API response to types in `src/types/` (add interfaces if needed).
  3. Use `useQuery`/`useMutation` with a descriptive `queryKey`.
  4. Consume hook in components and rely on existing axios interceptors for auth refresh.

- Useful files to inspect (examples)
  - `src/api/client.ts` — axios interceptors and baseURL.
  - `src/hooks/useInvoices.ts` — mapping API -> `Invoice` type and query usage.
  - `src/hooks/useInvoiceDetail.ts` — complex mapping for tenant breakdowns.
  - `src/store/useAuthStore.ts` and `src/hooks/useAuthStore.ts` — auth token handling (watch for duplication).
  - `src/components/InvoiceTable.tsx` and `src/pages/InvoiceDetailPage.tsx` — UI conventions and data consumption examples.

If anything in this summary is ambiguous or you want more examples (e.g., show how to mock the API, where to add new types, or which `useAuthStore` variant is canonical), tell me which section to expand and I'll update this file.
