# Partner Billing App

Frontend (React + Vite) og en lille API-service (Express + SQLite) til at gemme rabatprocenter pr. kunde/produkt.

## Lokal udvikling

Start både frontend og API:

```sh
npm run dev
```

- Frontend kører på Vite (default: `http://localhost:5173`)
- Rabat-API kører på `http://localhost:3001`
- Vite proxy'er `/api/*` til API-serveren

SQLite database-fil oprettes automatisk i `data/discounts.sqlite`.

### Rabat API (SQLite)

- `GET /api/tenant-discounts` - Hent alle rabatter
- `POST /api/tenant-discounts` - Opret ny rabat
- `PATCH /api/tenant-discounts` - Opdater eksisterende rabat
- `PUT /api/tenant-discounts` - Upsert (bruges af UI)
- `DELETE /api/tenant-discounts` - Slet rabat

Eksempel payload:

```json
{
  "tenantId": "tenant-123",
  "vendorName": "Microsoft",
  "productName": "M365 Business Premium",
  "rate": 12.5
}
```

## Docker

Build and run with Docker:

```sh
docker build -t partner-billing-app .
docker run --rm -p 8080:80 \
  -e VITE_ACCESS_TOKEN=your_access_token \
  -e VITE_REFRESH_TOKEN=your_refresh_token \
  partner-billing-app
```

Or use Docker Compose:

```sh
docker compose up --build
```

Compose starter både web og API. SQLite-data persisteres i volumen `discounts-data`.

Docker Compose reads `.env` in the project root. Add:

```sh
VITE_ACCESS_TOKEN=your_access_token
VITE_REFRESH_TOKEN=your_refresh_token
```

Or use non-Vite names (also supported):

```sh
ACCESS_TOKEN=your_access_token
REFRESH_TOKEN=your_refresh_token
```

Legacy names are also supported:

```sh
ACCESSTOKEN=your_access_token
REFRESHTOKEN=your_refresh_token
```

Then run:

```sh
docker compose up --build
```

The container generates `/env-config.js` at startup from env vars, so you can change values and restart the container without rebuilding the image.

To verify values are injected, open `http://localhost:8080/env-config.js`.

If values still look empty, recreate the container (not only restart):

```sh
docker compose up -d --build --force-recreate
```

Then open http://localhost:8080

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
