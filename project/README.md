# Pulse — React Emergency Patient Management

Educational React + Vite frontend; no backend required. Do not use for real patient data or clinical decisions.

## Run
```sh
npm install
npm run dev
```
Production build: `npm run build`. Preview a build: `npm run preview`.

## Source map
- `src/App.jsx`: reusable React components, forms, hooks, exact-ID search, persistence integration.
- `src/structures.js`: real max heap, linked FIFO queues, patient-ID BST, singly linked treatment history; detailed `//` comments explain pointer operations and algorithms.
- `src/styles.css`: responsive dashboard styling.
- `src/main.jsx`: React root.

## Behavior
Level 5 is highest priority. Equal-level patients are treated FIFO. Only waiting patients are indexed by the BST. Cancelled registrations do not enter history. IDs are case-insensitive and cannot be reused. Browser localStorage preserves records across reloads; six fictional records seed a fresh browser. Live diagrams are under How it works.

The domain model is held in a stable React ref. A revision state triggers rendering after a mutation. Rendered arrays are snapshots, not substitutes for the actual node-based data structures. Persistence serializes snapshots and reconstructs classes and node links on reload.
