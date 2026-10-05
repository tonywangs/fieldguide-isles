# Verification evidence

The recorded checks were run on 2026-10-05 in a shared Linux environment. These are actual observations, not projected timings or human playtest results. The current evidence files are committed as reproducible snapshots; rerunning the browser suite updates its measurements and screenshots.

## Environment and startup

| Item | Observed value |
| --- | --- |
| Node.js | v24.20.0 |
| npm | 11.19.0 |
| Playwright (pinned development dependency) | 1.58.2 |
| Chromium | 145.0.7632.6 |
| Server process spawn to loopback listening | 307.12 ms |
| Browser navigation to available starter control | 499.35 ms |
| Complete browser verification run | 44901 ms |
| Bundled runtime | 14 files, 60141 bytes uncompressed |
| Elements in starter screen | 108 |
| Elements in sampled battle screen | 160 |
| Elements in sampled ending screen | 165 |

Startup values are one observed local run, not a median, cold-device benchmark, or performance guarantee. Browser launch time is excluded from the navigation measurement. The entire browser verification duration includes browser launch and campaigns. Element counts are representative document snapshots, including hidden tutorial/reset dialogs, not a bound on every possible screen. The runtime includes HTML, CSS, four JavaScript modules, and eight SVG files. It has zero npm runtime dependencies. Node serves it directly, without a compilation step. Playwright is used only for testing.

## Checks that passed

- **15 Node test cases**, with no skipped or failing cases. Independently calculated elemental damage, guard rounding, a known xorshift32 sequence, action immutability, invalid/repeated actions, energy exhaustion, friendship threshold, full-party reserve behavior, swapping, switching, defeat recovery, terminal ending, and map gates.
- **300 complete legal campaigns**: each starter at seeds 1–100, reloading a serialized save after every action. All ended in victory with zero defeats. Each took 47–48 legal interface-equivalent actions and 19–20 battle turns. SHA-256 final-state hashes match the frozen fixture and a replay from the initial state.
- **6 additional campaigns**: each starter at the default seed 2026 and maximum seed 4294967295. A separate scenario deliberately loses the final encounter, checks full recovery with all three beacons preserved, then wins on retry.
- **14,000 seeded state-machine steps**: 40 seeds × 350 candidate actions, mixing legal and invalid actions and checking save/replay equality and bounded state after every step. This is bounded exploration, not exhaustive model checking.
- **Strict save rejection tests**: malformed/oversized JSON, unsupported versions, missing/extra keys, duplicate/unknown identifiers, out-of-range values, disconnected discovery history, invalid party membership, impossible battle stats, and phase/counter inconsistencies. Storage failures and corrupt local saves are also tested.
- **3 Chromium campaigns through actual controls**: Spriglet seed 1 (47 actions), Cindermoth seed 42 (48), and Pebblefin seed 100 (48). Their entire final state equals the engine's state. The first two used 1280×900 and the third 360×800. Horizontal overflow was checked after every campaign action.
- **Browser integration checks**: keyboard navigation, visible focus, native modal behavior, SVG map activation, active-battle reload, downloaded JSON transfer into a clean browser context, hostile imported text rendered inert, invalid imports leaving the current save unchanged, defeat and recruitment retry, full-party recruitment, reserve exchange, battle switching, retreat, and changing the leader.
- **Unavailable storage**: simulated before startup; the interface explains the limitation, gameplay continues, and export works. Corrupt stored data remains untouched until explicit reset/import.
- **Offline operation**: browser contexts abort all requests outside the test server's loopback origin. The final run attempted zero external requests and produced zero page or console errors. HTML controls were checked for labels. The server rejected non-runtime paths and unsupported methods.

## Reproduce and inspect

Run commands from the repository root. Dependency/browser setup is in the README.

```sh
npm test
PLAYWRIGHT_BROWSERS_PATH=/tmp/fieldguide-browsers npm run test:browser
npm run audit:tree
git diff --check
```

- [Plain test output](../results/tests.log) records the actual Node and browser checks.
- [Campaign hashes](../results/campaigns.json) and [one full replay](../results/example-replay.json) preserve deterministic evidence. Normal tests never regenerate these fixtures.
- [Browser measurements](../results/browser.json) contain exact versions, timings, completed campaigns, and observed checks.
- [Artifact inventory](../results/artifacts.json) records each deliverable's size and SHA-256 plus total runtime size. The audit checks the 10 MiB per-file, 32 MiB total-tree and 1,000-file limits. It excludes its own hash to avoid recursion, while including its own size in the limits.
- Screenshots cover [starter selection](../results/starter-desktop.png), [exploration](../results/exploration-desktop.png), [desktop battle](../results/battle-spriglet.png), [mobile battle](../results/battle-mobile.png), and [mobile ending](../results/ending-mobile.png). Selected screenshots were visually inspected; this is not human playtesting.

## Limitations and negative observations

The first browser test run failed because its Tab assertion did not allow native-dialog focus to move to browser chrome. A later run caught a test setup script accessing storage on the initial blank page. Both test fixtures were corrected, and the final complete run passed. Screenshot inspection also found an offscreen skip-link artifact in full-page captures; clipped hidden-link styling fixed it. These were observed failures, not successful runs.

No human playtesting, screen-reader evaluation, physical-device testing, Safari/Firefox testing, broad usability study, statistical balance study, or proof over all 32-bit seeds has been performed. Browser checks are automated and do not certify accessibility. The validator enforces bounded invariants, not save authenticity. Browser storage can be cleared or denied; exported backups remain the portable recovery mechanism. There is no service worker, so the local server must stay running. There is no deployed website or online service.
