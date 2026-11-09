# Story ideas: parked designs

**Status: PARKED.** Don't build any of these until steps 1–5 of `STORY_AUDIT.md` work for one burg and one thread (see `AGENT_RULES.md`, "Current focus"). Each idea lists what it depends on, so it's clear when it can be started.

All of them build on **threads** (`sim_threads`, from `STORY_AUDIT.md` step 1).

---

## 1. Rumor drift: the truth bends as it travels

**Why:** in canon, knowledge hoarded makes monsters and knowledge given away keeps the world running. Rumors that bend as they spread make the truth something players dig for, and that fits the setting's theme.

**How it works**
- Every MAJOR event or thread keeps one **true record**: who, what, where and when, all as real IDs.
- A **rumor** is a copy of it, with:
  - a `hops` count;
  - a `fidelity` from 0 to 1;
  - a `source_id` (who told it).
- When a rumor passes from one carrier to the next (a barkeep, a trader, a bard, travelling between burgs), it can drift. Each hop can:
  - **swap the blame** to a rival faction, using real factions only;
  - **inflate the numbers** (10 dead becomes "dozens");
  - **lose a detail** (the place becomes "somewhere north");
  - **add a superstition** from the Lexicon (Canon 16), for example blaming a Power or a moon.
- A drift happens more often with more hops, with an unreliable carrier (tags like `#Gossip` or `#Drunkard`), or when the carrier is biased. A carrier loyal to faction X blames X's enemies.
- **The code drifts the facts; the LLM only voices them** (rule 6). Every swapped ID must still exist (rule 7).
- Players can **trace a rumor back** along `source_id` to its origin. Each step back raises its fidelity. That's an investigation hook for free.

**Data:** a `sim_rumors` table holding `id`, `event_or_thread_id`, `carrier_id`, `source_id`, `cell_id`, `hops`, `fidelity`, `claims` (JSON with the drifted fields) and `created_tick`.

**Tests**
- Every ID in `claims` exists.
- Fidelity never rises without a trace-back.
- A rumor with zero hops matches the true record exactly.

**Depends on:** threads (STORY_AUDIT step 1); the existing `/teller/rumors`; carrier tags.

---

## 2. Pacing director: when trouble comes knocking

**Why:** a living world is either too quiet or too busy around the party. A director that reads the tension decides when a thread turns into a hook. (The model is the AI Director in *Left 4 Dead*.)

**How it works**
- **Tension near the party** is a number made up of:
  - open threads within N cells, weighted by how close each clock is to the end;
  - the party's recent injuries and spent pools (from B.R.U.T.A.L.);
  - days since the last hook.
- **When tension is low and it's been quiet a while:** the director picks the best open thread nearby and **presents it as a hook**, through a real NPC, a rumor or something seen.
- **When tension is high:** it holds new hooks back, and far-off threads stay rumors.
- **Distance sets the role:**
  - far away, a thread stays a rumor;
  - in the region, it's an approach (someone comes looking for help);
  - in the sector, it's an encounter.
- The director **chooses which thread to present and when**; it never invents one. Threads come only from the simulation.

**Tunables:** the quiet-days threshold, the tension ceiling and the hook cooldown. Keep them all in one config file.

**Tests**
- No new hook appears while tension is above the ceiling.
- Every hook points to an existing open thread.

**Depends on:** threads (steps 1–3); merged hook presentation (step 4).

---

## 3. Paragons with wants: people drive the story, not places

**Why:** today, stories come from places, seeded by map coordinates. Stories feel alive when people want things. The novel's character bibles work this way, so the world should too.

**How it works**
- Each of the 714 paragons gets:
  - **a want**: one concrete goal (control the grain exchange, free a brother from the Sallow mines, be named reeve);
  - **a flaw**: what trips them up (pride, debt, a secret, a grudge);
  - **a line**: one thing they won't do (betray kin, deal with cultists, use a Power).
- Wants are generated once from each paragon's role, faction and tags, then **fixed and saved**. The LLM may suggest them; a check keeps every want tied to real IDs and places.
- **Reaction rules check wants.** When a collision touches a paragon's want, the result is a **choice**, not a fixed reaction, and that choice opens a thread. ("The reeve can seize the grain and break his line, or let the riot come.")
- A paragon chases their want in the background (one small action per N ticks). That gives threads their pressure and keeps the world moving when the players aren't there.

**Data:** add `want`, `want_target_id`, `flaw` and `line` columns to `sim_paragons`, plus `want_progress`.

**Tests**
- Every `want_target_id` exists.
- No paragon acts against their own line unless a thread records why.

**Depends on:** threads (steps 1–3). This is step 6 of the STORY_AUDIT plan, written out in full here.

---

## 4. Measure story quality with the agent players

**Why:** knowing the code runs isn't enough. The question is whether it makes stories people care about. The Ollama player agents can tell us that.

**How it works**
- Run sessions of 4 Ollama players and the GM, set up as in our B.R.U.T.A.L. agent playtests:
  - each player sees only the Rules Digest, their own sheet and the Party file;
  - each runs in a separate conversation;
  - players answer in structured JSON.
- **Log per session:**
  - threads offered vs threads taken up;
  - threads that closed with a result the players caused;
  - consequences that came back later (a rumor, an NPC who remembered);
  - dead ends;
  - each player's 1–5 rating per scene.
- **Debrief questions** for each player: "What was the story?" and "Whose choices mattered?" If four players tell four unrelated stories, the threads aren't landing.
- Compare runs before and after each story change, the way Sims 25 and 26 compared rule versions.

**Depends on:** the vertical slice (steps 1–5); the Ollama player wiring; `BrutalGM` resolving actions.

---

## Order, once the slice works

1. **Paragon wants**: they feed everything else.
2. **Pacing director**: it makes threads reach the party well.
3. **Rumor drift**: it adds depth once threads and hooks are flowing.
4. **Agent-player measurement**: start as soon as the slice works, and keep it running alongside the rest.
