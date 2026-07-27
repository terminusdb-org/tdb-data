# TerminusDB Data Explorer

A data product explorer for TerminusDB. Browse schemas, documents, and branches. Run GraphQL queries, inspect vector search results, and manage embeddings — all through a web UI connected to a running TerminusDB instance.

## What it does

- **Data product picker** — select an organisation, team, and data product to explore
- **Schema viewer** — inspect doctypes, properties, keys, and cardinality constraints
- **Document browser** — search, filter, edit, and preview documents with a Monaco-powered editor
- **GraphQL playground** — run ad-hoc GraphQL queries against any branch or commit
- **Context editor** — view and edit the JSON-LD context for a data product
- **Vector search** — query embeddings, inspect similarity results, and visualise with 2D/3D scatter plots
- **Embeddings management** — configure embedding models, indexing status, and re-index triggers
- **Entity resolution** — run duplicate detection and review candidate matches side by side
- **Branch history** — browse commit history and inspect documents at any commit point
- **Projections** — define and run projection queries with working sets and filter panels

## Tech stack

- **React 18** with TypeScript
- **Vite** for dev server and production builds
- **Redux Toolkit + RTK Query** for state and API calls
- **Tailwind CSS** for styling
- **Monaco Editor** for document and schema editing
- **deck.gl** for geospatial and scatter visualisations
- **GraphiQL** for the GraphQL playground
- **i18next** for internationalisation

## Getting started

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` by default.

### Configuration

The app reads its TerminusDB connection details from environment variables, either at build time (`.env`) or at runtime via a `window.__ENV__` object injected into `index.html`:

| Variable | Description | Default |
|---|---|---|
| `VITE_TDB_URL` | TerminusDB server URL (e.g. `http://localhost:6363`) | — |
| `VITE_TDB_USER` | Default username for authentication | `admin` |
| `VITE_BASE_PATH` | Base path for serving behind a reverse proxy | `/` |

Example `.env`:

```
VITE_TDB_URL=http://localhost:6363
VITE_TDB_USER=admin
```

For Docker deployments, set these as build args or inject them via an `env-config.js` script loaded before the app bundle.

## Relationship to TerminusDB

This is the data-facing companion to the [TerminusDB Admin Console](https://github.com/terminusdb-org/tdb-admin). Where the admin console handles users, teams, grants, and data product lifecycle, the Data Explorer focuses on the content inside those data products — schemas, documents, queries, and search.

The app talks directly to the TerminusDB HTTP API (`/api/`) using Basic auth. It works with both community and enterprise TerminusDB deployments. No backend of its own is required; the app is a static SPA that can be served from any web server or CDN.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check without emitting |

## License

Apache 2.0, see [LICENSE](./LICENSE).
