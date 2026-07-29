# Homebrew Release Flow

This repository uses a two-branch strategy:

- `develop`: integration branch for active work and prerelease builds.
- `main`: stable branch for public releases.

## Workflows

- `.github/workflows/ci.yml`
  - Runs on push/PR for `develop` and `main`.
  - Uses Node 20, installs locked dependencies, runs lint, tests, repository audits, and
    the production dependency audit, then builds with `npm run pack-p` (content-hashed
    assets).
- `.github/workflows/release-develop.yml`
  - Runs on pushes to `develop`.
  - Runs the same validation gates before building with the develop release channel and
    persistent-logging capability.
  - Builds IPK and updates a prerelease under tag `nightly`.
  - Generates and uploads:
    - `<app-id>_<version>_all.ipk`
    - `<app-id>.manifest.json`
- `.github/workflows/release-stable.yml`
  - Runs on pushes to `main`.
  - Runs the same validation gates before building with the stable release channel and
    persistent-logging capability.
  - Uses `appinfo.json` version and publishes a normal (non-prerelease) GitHub release tagged `v<version>`.
  - Skips when the matching tag already exists, unless manually forced via `workflow_dispatch`.
