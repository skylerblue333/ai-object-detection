# Contributing

Use Node.js 22 or newer.

```bash
npm install --ignore-scripts
npm run build
npm test
npm audit --omit=dev --audit-level=high
```

Keep the library network-independent and deterministic. New behavior must include tests and must not imply image inference or model accuracy unless that capability is actually implemented and verified.
