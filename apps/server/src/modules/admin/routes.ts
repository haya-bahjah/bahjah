import { Router, type Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { signAdminPortalToken } from '../auth/jwt';
import { adminPortalRateLimit } from '../../middleware/rateLimit';
import { loadQuestionBank } from '../games/trivia/questionBank';
import { requireAdmin } from './middleware';
import { buildAnalytics } from './analytics';

export const adminRouter = Router();

// The portal: exchange the shared passphrase for a short-lived admin session.
// Registered BEFORE the gate below, because it is how you get past it.
//
// Answers 404 rather than 401 when the passphrase is wrong or the portal is
// switched off, matching every other admin route: somebody guessing should
// not learn that this endpoint exists, nor whether a passphrase is configured
// at all. Rate limited hard -- one shared secret with no email round trip
// behind it is the most guessable thing on the server.
adminRouter.post('/portal-login', adminPortalRateLimit, (req, res) => {
  const notFound = () => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });

  const configured = env.adminPassword;
  const supplied = (req.body as { password?: unknown } | undefined)?.password;
  if (!configured || typeof supplied !== 'string' || !supplied) {
    notFound();
    return;
  }

  // Constant time, so the response cannot be timed to learn the passphrase a
  // character at a time.
  //
  // Both sides go through sha256 first, which is not for secrecy -- it is so
  // both buffers are 32 bytes whatever was typed. timingSafeEqual throws on a
  // length mismatch, and guarding that with `a.length === b.length` would
  // short-circuit: a wrong-length guess would return measurably sooner than a
  // right-length one, handing over the length of the secret.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(configured))) {
    notFound();
    return;
  }

  res.json({ token: signAdminPortalToken() });
});

adminRouter.use(requireAdmin);

// Confirms to the page that the caller is an admin, without it having to
// fetch the whole bank first just to find out.
adminRouter.get('/me', (_req, res) => {
  res.json({ admin: true });
});

// The internal numbers. One request, one snapshot -- the page re-asks on a
// timer rather than holding a socket open, because nothing here needs to be
// live to the second and a dashboard should not be a second thing that can
// fall over.
adminRouter.get('/analytics', async (_req, res, next) => {
  try {
    res.json(await buildAnalytics());
  } catch (err) {
    next(err);
  }
});

// The whole shared question bank for both games, for pre-launch review.
// Read-only on purpose: this is for reading the questions over before going
// live, not for editing them, so there is no write path here to get wrong.
//
// Both banks are small enough (a few hundred rows) to send in one response
// and filter in the browser, which keeps the page responsive while typing
// in the search box.
//
// Room-scoped host-authored questions (TriviaCustomQuestion,
// KnowsYouBestCustomPrompt) are deliberately excluded: they belong to whoever
// wrote them for one room, are never part of what ships, and reading other
// people's private game content is not what this page is for.
adminRouter.get('/questions', async (_req, res, next) => {
  try {
    const [trivia, knowsYouBest] = await Promise.all([
      prisma.triviaQuestion.findMany({
        orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          category: true,
          difficulty: true,
          prompt: true,
          promptAr: true,
          choices: true,
          choicesAr: true,
          correctIndex: true,
        },
      }),
      prisma.knowsYouBestPrompt.findMany({
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, category: true, text: true, textAr: true },
      }),
    ]);

    res.json({
      trivia: trivia.map((q) => ({
        ...q,
        // Flags the page shows as warnings, computed here so both the counts
        // and the rows agree on what "needs a look" means.
        issues: triviaIssues(q),
      })),
      knowsYouBest: knowsYouBest.map((p) => ({
        ...p,
        issues: p.textAr ? [] : ['no-arabic'],
      })),
    });
  } catch (err) {
    next(err);
  }
});

function triviaIssues(q: {
  prompt: string;
  promptAr: string | null;
  choices: string[];
  choicesAr: string[];
  correctIndex: number;
}): string[] {
  const issues: string[] = [];
  if (!q.promptAr) issues.push('no-arabic');
  // A question whose Arabic prompt is translated but whose choices are not
  // renders half-English in an Arabic game, which is worth catching before
  // launch rather than in a room.
  if (q.promptAr && q.choicesAr.length !== q.choices.length) issues.push('arabic-choices-mismatch');
  if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) issues.push('bad-correct-index');
  if (q.choices.length < 2) issues.push('too-few-choices');
  // Two identical options mean the "right" answer is ambiguous even when
  // correctIndex is in range.
  if (new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== q.choices.length) {
    issues.push('duplicate-choices');
  }
  return issues;
}

// ---- Trivia bank editing ------------------------------------------------
// The bank is read from an in-memory cache the server fills once at startup
// (games/trivia/questionBank.ts), so every write below has to refresh it --
// otherwise an edit lands in Postgres and the game keeps dealing the old
// question until the next deploy. A game already in progress is unaffected
// either way: its questions are snapshotted into game state when it starts.
const difficultySchema = z.enum(['easy', 'medium', 'hard']);

const questionBodySchema = z
  .object({
    category: z.string().trim().min(1, 'A category is required.').max(60),
    difficulty: difficultySchema,
    prompt: z.string().trim().min(1, 'A question is required.').max(300),
    // Empty string means "no Arabic yet", which is a valid state -- half the
    // bank was written before the Arabic pass. Stored as null, not '', so
    // the no-arabic flag stays a single check.
    promptAr: z.string().trim().max(300).optional().default(''),
    choices: z
      .array(z.string().trim().min(1, 'Choices cannot be blank.').max(160))
      .min(2, 'A question needs at least two choices.')
      .max(6),
    choicesAr: z.array(z.string().trim().max(160)).max(6).optional().default([]),
    correctIndex: z.number().int().min(0),
  })
  .superRefine((v, ctx) => {
    if (v.correctIndex >= v.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctIndex'],
        message: 'The correct answer must be one of the choices.',
      });
    }
    // Arabic is all-or-nothing per question: a partial set renders a board
    // half in each language, which is worse than showing the English.
    const filledAr = v.choicesAr.filter((c) => c.length > 0);
    if (filledAr.length > 0 && filledAr.length !== v.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choicesAr'],
        message: 'Give every choice an Arabic translation, or leave them all blank.',
      });
    }
    const seen = new Set(v.choices.map((c) => c.toLowerCase()));
    if (seen.size !== v.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'Two choices are identical, so the right answer is ambiguous.',
      });
    }
  });

function toRow(body: z.infer<typeof questionBodySchema>) {
  const choicesAr = body.choicesAr.filter((c) => c.length > 0);
  return {
    category: body.category,
    difficulty: body.difficulty,
    prompt: body.prompt,
    promptAr: body.promptAr ? body.promptAr : null,
    choices: body.choices,
    choicesAr: choicesAr.length === body.choices.length ? choicesAr : [],
    correctIndex: body.correctIndex,
  };
}

function badRequest(res: Response, parsed: z.SafeParseError<unknown>) {
  const first = parsed.error.issues[0];
  res.status(400).json({
    error: { code: 'INVALID_INPUT', message: first ? first.message : 'That question is not valid.' },
  });
}

adminRouter.post('/trivia/questions', async (req, res, next) => {
  try {
    const parsed = questionBodySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed);
    const created = await prisma.triviaQuestion.create({ data: toRow(parsed.data) });
    await loadQuestionBank();
    res.status(201).json({ question: { ...created, issues: triviaIssues(created) } });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/trivia/questions/:id', async (req, res, next) => {
  try {
    const parsed = questionBodySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed);
    const existing = await prisma.triviaQuestion.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No question with that id.' } });
      return;
    }
    const updated = await prisma.triviaQuestion.update({
      where: { id: req.params.id },
      data: toRow(parsed.data),
    });
    await loadQuestionBank();
    res.json({ question: { ...updated, issues: triviaIssues(updated) } });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/trivia/questions/:id', async (req, res, next) => {
  try {
    const existing = await prisma.triviaQuestion.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No question with that id.' } });
      return;
    }
    await prisma.triviaQuestion.delete({ where: { id: req.params.id } });
    await loadQuestionBank();
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
