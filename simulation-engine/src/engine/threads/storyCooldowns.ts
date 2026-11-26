/**
 * After a storyline about a town ends, the same kind of story (same rule, same cell) waits this many
 * ticks before it can open again. Without it a 300-tick run reopened "Will The Sacred Spire get grain?"
 * 50 times, every 6 ticks, and each expiry hit the town again. A crisis that outlasts its thread is
 * carried on by escalation (thread -> arc), not by reopening the same thread.
 */
export const STORY_REOPEN_COOLDOWN_TICKS = 30;
