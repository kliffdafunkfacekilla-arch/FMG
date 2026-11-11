# Ostraka

A living Shatterlands world that a party can play B.R.U.T.A.L. in. The world runs on its own, one day per tick:

> **tick → trouble (a thread) → hook reaches the party → players act → B.R.U.T.A.L. resolves → consequences written back → tick**

- **Start here:** [`AGENT_RULES.md`](AGENT_RULES.md) (rules for every change) and [`SYSTEM_OVERVIEW.md`](SYSTEM_OVERVIEW.md) (architecture and how to run it).
- **Engine:** [`simulation-engine/`](simulation-engine/README.md), a Node/TypeScript service on PostgreSQL with the Observer dashboard.
- **Canon and rules** live outside this repo in the Shatterlands folder and are read-only.

## Quick start

Needs Node.js, PostgreSQL running locally, and [Git LFS](https://git-lfs.com) (map, audio and images are stored in LFS).

```bash
git lfs install && git lfs pull          # after cloning: fetch the real map/audio/image files
git config core.hooksPath .githooks      # once per clone: run the tests before every commit
cp simulation-engine/.env.example simulation-engine/.env   # then set DATABASE_URL
npm --prefix simulation-engine install
npm --prefix simulation-engine test      # rebuilds and runs every test suite (needs Postgres)
```

On Windows, `START.bat` builds and launches the engine and the Observer dashboard; `STOP.bat` stops them. See [`simulation-engine/README.md`](simulation-engine/README.md) for the scripts, endpoints and data repairs.

Originally forked from Azgaar's [Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) (MIT).
