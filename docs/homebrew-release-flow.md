# Homebrew Release Flow

This repository uses a two-branch strategy:

- `develop`: integration branch for active work and prerelease builds.
- `main`: stable branch for public releases.

## Workflows

- `.github/workflows/ci.yml`
  - Runs on push/PR for `develop` and `main`.
  - Installs dependencies, runs lint, runs tests if present, and builds with `npm run pack-p`.
- `.github/workflows/release-develop.yml`
  - Runs on pushes to `develop`.
  - Builds IPK and updates a prerelease under tag `develop`.
  - Generates and uploads:
    - `<app-id>_<version>_all.ipk`
    - `<app-id>.manifest.json`
- `.github/workflows/release-stable.yml`
  - Runs on pushes to `main`.
  - Uses `appinfo.json` version and publishes a normal (non-prerelease) GitHub release tagged `v<version>`.
  - Skips when the matching tag already exists, unless manually forced via `workflow_dispatch`.