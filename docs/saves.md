# Save compatibility and failure behavior

The save/rules version is **1**. Version 1 is the only supported format; no silent migration is attempted. Local storage uses the `fieldguide-isles:v1` key on the current origin. Changing hostname or port creates a different browser storage origin: use export/import when moving between them. Clearing site data removes the local copy.

Each complete save contains:

- Original seed and current nonzero xorshift32 state.
- Phase, location, visited nodes, discovered species, and ordered beacon unlocks.
- Roster health and energy, party order, and active companion.
- An entire ongoing battle: encounter node/type, enemy HP/stats, round, and next intent.
- Victory, defeat, and battle-turn counters and the last 12 journal notes.

The game attempts synchronous local saving after every valid action, except when an existing local save failed validation. In that case the existing bytes are preserved until the player explicitly starts a new journey or imports a valid save. The on-screen storage message explains this condition. If storage is unavailable or full, play continues in memory and the screen asks the player to export a JSON backup. Closing or reloading then loses any unexported changes. There is no claim of persistent storage when browser APIs throw.

Export uses a normal browser download; import uses a file picker. The maximum input is 32,768 UTF-8 bytes (32 KiB), checked against file size before reading and again in the decoder. Malformed JSON, unsupported versions, unknown keys, duplicate IDs, unknown species/nodes, fractional or out-of-range numbers, non-prefix beacon unlocks, inaccessible visited areas, impossible party membership, mismatched enemy stats and location, and inconsistent phase/battle combinations are rejected. The current state and its local save are replaced only after every validation step passes. A rejected file can be selected again after correction.

Journal entries are limited to 512 UTF-16 code units each and rendered through `textContent`, never HTML. Hostile markup can be imported as literal text; it cannot insert elements or execute scripts. No arbitrary imported URL or species name is used for image paths.

The validator checks structural and game invariants; it is not an authenticity or anti-cheat system. It does not reconstruct an entire action history to prove a save was reached by legal play. An intentionally edited save satisfying those invariants can be accepted. JSON is portable and intentionally readable. No credentials or personal data are needed. Do not edit imported files that you want to preserve as an exact replay.

For compatibility, avoid changing engine rules, stat constants, or action ordering under version 1. A future change to these semantics should introduce a new version with explicit migration or a clear rejection message. Per-counter maximum is 1,000,000,000; practical campaigns are far smaller. Journal text and object serialization order form part of the committed replay hashes.
