# Legacy: metrics version 1

`analyzer-v1.js` is the original ACQA analyser, kept unchanged so that results published before September 2026 can be reproduced exactly (`node src/cli.js analyze <dir> --legacy`).

**Do not use it for new work.** It contains a parsing defect: files containing JSX failed to parse, so the pure function ratio and decomposability returned 0.5 for most React files, and cognitive complexity fell back to a keyword count. Type explicitness used a regular expression that returned 1.0 when no declarations were found. All of these are fixed from metrics version 2; see [CHANGELOG.md](../CHANGELOG.md).
