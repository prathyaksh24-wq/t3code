# CI quality gates

- `.github/workflows/ci.yml` runs `vp check` (lint + typecheck), `vpr typecheck`, and `vp run test` on pull requests and pushes to `main`.
- `.github/workflows/beta-artifact.yml` is a manual fork-owned gate. It reruns qualification, checks, tests, the production desktop build, and release smoke before uploading an unsigned Windows x64 installer for 14 days.
- The beta workflow does not publish a release and does not reference upstream production credentials or services.
- See [Small beta operations](../releases/small-beta.md) for setup, upgrade, rollback, and known limitations. Production publication remains disabled as described in [Release operations](./release.md).
