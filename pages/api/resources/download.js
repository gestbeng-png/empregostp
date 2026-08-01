import {
  GUIDE_CONTENTS,
  TEMPLATE_CONTENTS,
  slugifyFilename
} from '../../../lib/resourcesCatalog';

const RESOURCE_KIND = {
  template: 'template',
  guide: 'guide'
};

const getQueryValue = (value) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return String(value || '');
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const kind = getQueryValue(req.query.kind).trim().toLowerCase();
  const id = getQueryValue(req.query.id).trim();
  const title = getQueryValue(req.query.title).trim();

  if (!kind || !id) {
    return res.status(400).json({ error: 'Parametros obrigatorios: kind e id.' });
  }

  const source = kind === RESOURCE_KIND.guide ? GUIDE_CONTENTS : TEMPLATE_CONTENTS;
  const content = source[id];

  if (!content) {
    return res.status(404).json({ error: 'Recurso nao encontrado.' });
  }

  const baseName = slugifyFilename(title || id || 'recurso');
  const fileName = `${baseName}.txt`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.status(200).send(content);
}
