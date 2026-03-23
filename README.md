# Work Force Workspace

This repository is intentionally split into separate projects. There is no npm workspace or shared runtime package.

## Top-level folders

- `backend` - Minimal Express + Prisma API for PostgreSQL
- `client-web` - Public-facing React app built with Vite and TypeScript
- `admin-web` - Admin React app built with Vite and TypeScript
- `kiosk-app` - Expo React Native app for kiosk flows
- `user-app` - Expo React Native app for end users
- `shared` - Non-runtime reference material only, such as design docs and tokens

Each project manages its own dependencies with its own `package.json`, `package-lock.json`, and `node_modules`.
