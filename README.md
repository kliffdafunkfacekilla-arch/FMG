# Ostraka

A living Shatterlands world that a party can play B.R.U.T.A.L. in. The world runs on its own, one day per tick:

> **tick → trouble (a thread) → hook reaches the party → players act → B.R.U.T.A.L. resolves → consequences written back → tick**

- **Start here:** [`AGENT_RULES.md`](AGENT_RULES.md) (rules for every change) and [`SYSTEM_OVERVIEW.md`](SYSTEM_OVERVIEW.md) (architecture and how to run it).
- **Engine:** [`simulation-engine/`](simulation-engine/README.md), a Node/TypeScript service on PostgreSQL with the Observer dashboard.
- **Canon and rules** live outside this repo in the Shatterlands folder and are read-only.

Originally forked from Azgaar's [Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) (MIT).
