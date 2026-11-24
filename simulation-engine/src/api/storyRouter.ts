import { Router, Request, Response } from "express";
import pool from "../db/pool.js";
import {
  autoAcceptTopProposal,
  decideProposal,
  listDeskProposals,
} from "../engine/story/storylines.js";
import { previewStoryOptions } from "../engine/story/preview.js";

const storyRouter = Router();

/**
 * GET /api/story/desk?cell=&cellId=&rx=&ry=&z=
 * Returns grounded storyline proposals and active storylines touching the focus tile.
 */
storyRouter.get("/desk", async (req: Request, res: Response): Promise<void> => {
  try {
    const cellId = Number(req.query.cellId ?? req.query.cell ?? 30627) || 30627;
    const rx = req.query.rx !== undefined ? Number(req.query.rx) : 50;
    const ry = req.query.ry !== undefined ? Number(req.query.ry) : 50;
    const z = req.query.z !== undefined ? Number(req.query.z) : 0;

    const result = await listDeskProposals(pool, { cellId, rx, ry, z });
    res.json({
      success: true,
      cellId,
      rx,
      ry,
      z,
      tick: result.tick,
      proposals: result.proposals,
      openStorylines: result.openStorylines,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

/**
 * POST /api/story/desk/auto_accept
 * Auto-accepts the highest-ranked grounded proposal for the given focus area (used by AI party / headless runs).
 */
storyRouter.post("/desk/auto_accept", async (req: Request, res: Response): Promise<void> => {
  try {
    const cellId = Number(req.body?.cellId ?? req.body?.cell ?? 30627) || 30627;
    const rx = req.body?.rx !== undefined ? Number(req.body.rx) : 50;
    const ry = req.body?.ry !== undefined ? Number(req.body.ry) : 50;
    const z = req.body?.z !== undefined ? Number(req.body.z) : 0;

    const result = await autoAcceptTopProposal(pool, { cellId, rx, ry, z });
    if (!result) {
      res.status(404).json({ success: false, error: "No eligible proposals available to auto-accept." });
      return;
    }
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

/**
 * POST /api/story/desk/:id
 * Accepts, edits, or rejects a Story Desk proposal.
 */
storyRouter.post("/desk/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ success: false, error: "Invalid storyline proposal id." });
      return;
    }

    const rawDecision = String(req.body?.decision ?? req.body?.action ?? "accept").toLowerCase();
    if (rawDecision !== "accept" && rawDecision !== "edit" && rawDecision !== "reject") {
      res.status(400).json({ success: false, error: `Unsupported decision "${rawDecision}". Expected accept, edit, or reject.` });
      return;
    }

    const result = await decideProposal(pool, id, {
      decision: rawDecision,
      question: req.body?.question,
      stakes: req.body?.stakes,
      clock_max: req.body?.clock_max !== undefined ? Number(req.body.clock_max) : undefined,
      hook: req.body?.hook,
      acceptAfterEdit: req.body?.acceptAfterEdit,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

/**
 * POST /api/story/preview
 * Simulates up to MAX_PREVIEW_OPTIONS over up to MAX_PREVIEW_DAYS inside rolled-back transactions.
 */
storyRouter.post("/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await previewStoryOptions({
      proposalId: req.body?.proposalId !== undefined ? Number(req.body.proposalId) : undefined,
      resolutionOptions: Array.isArray(req.body?.resolutionOptions) ? req.body.resolutionOptions : undefined,
      days: req.body?.days !== undefined ? Number(req.body.days) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

export default storyRouter;
