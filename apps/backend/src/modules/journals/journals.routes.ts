import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { createJournalSchema, journalQuerySchema } from './journals.validator';
import * as controller from './journals.controller';

const router = Router();

router.use(requireAuth);

// GET /api/v1/journals — list journal entries (filter by date/reference)
router.get('/', validate(journalQuerySchema, 'query'), controller.listJournals);

// POST /api/v1/journals — manual journal entry (admin, must balance)
router.post('/', requireRole(['admin']), validate(createJournalSchema), controller.createJournal);

export default router;
