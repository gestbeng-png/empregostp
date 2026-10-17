import type { NextApiRequest, NextApiResponse } from 'next';

import {
  authenticateApiUser,
  getBulkActionService,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

const read = workspaceRoute<unknown>('GET', authenticateApiUser, (uid, id) =>
  getBulkActionService().templates(uid, id),
);
const write = workspaceRoute<unknown>(
  'PATCH',
  authenticateApiUser,
  (uid, id, body) => getBulkActionService().saveTemplates(uid, id, body),
);

/** GET/PATCH — modelos de mensagens da organização (F3.6). */
function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  return req.method === 'PATCH' ? write(req, res) : read(req, res);
}

export default recruitmentApi(handler);
