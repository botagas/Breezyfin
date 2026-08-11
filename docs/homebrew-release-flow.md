# Homebrew Release Flow

The release process uses two branches:

- `develop`: integration branch for active work and prerelease builds.
- `main`: stable branch for public releases.

## Workflows

- `.github/workflows/ci.yml`
  - Runs for pushes and pull requests to `develop` and `main`.
  - Uses Node 20 and installs locked dependencies.
  - Runs lint, tests, repository audits, and the production dependency audit.
  - Builds content-hashed assets with `npm run pack-p`.
- `.github/workflows/release-develop.yml`
  - Runs on pushes to `develop`.
  - Runs the same validation gates before building with the develop release channel and
    persistent-logging capability.
  - Builds the IPK and updates the prerelease with tag `nightly`.
  - Generates and uploads:
    - `<app-id>_<version>_all.ipk`
    - `<app-id>.manifest.json`
- `.github/workflows/release-stable.yml`
  - Runs on pushes to `main`.
  - Runs the same validation gates before building with the stable release channel and
    persistent-logging capability.
  - Reads the version from `appinfo.json`.
  - Publishes a stable GitHub release with tag `v<version>`.
  - Skips publication when the tag already exists, unless `workflow_dispatch` forces the
    workflow to run.
