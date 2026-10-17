import {
  authenticateApiUser,
  getApplicationWorkspace,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** PATCH — avaliação 1–5 por recrutador e etiquetas internas (F3.5). */
const route = workspaceRoute('PATCH', authenticateApiUser, (uid, id, body) =>
  getApplicationWorkspace().review(uid, id, {
    rating: body.rating,
    tags: body.tags,
  }),
);

export default recruitmentApi(route);
