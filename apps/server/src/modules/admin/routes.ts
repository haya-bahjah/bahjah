import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../auth/middleware';
import { requireAdmin } from './middleware';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// Confirms to the page that the caller is an admin, without it having to
// fetch the whole bank first just to find out.
adminRouter.get('/me', (_req, res) => {
  res.json({ admin: true });
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
