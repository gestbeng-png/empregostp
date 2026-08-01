import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import adminStyles from '../../../../styles/AdminPanel.module.css';
import { addDocument, setDocument } from '../../../../lib/db';
import { getFirebaseStorageErrorMessage } from '../../../../lib/firebaseStorageError';
import { redirectToLogin } from '../../../../lib/loginRedirect';

const RESOURCE_TYPES = [
  { id: 'resources_templates', label: 'Modelos & Templates' },
  { id: 'resources_guides', label: 'Guias e Manuais' },
  { id: 'resources_foreigners', label: 'Estrangeiros & Repatriação' },
  { id: 'resources_premium', label: 'Serviços Premium' },
  { id: 'resources_tools', label: 'Ferramentas' },
  { id: 'resources_links', label: 'Links Úteis' },
  { id: 'resources_faqs', label: 'FAQs' },
];

const SCHEMAS = {
  resources_templates: [
    { name: 'id', label: 'ID interno (opcional)', type: 'text' },
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
    { name: 'category', label: 'Categoria', type: 'text' },
    {
      name: 'audience',
      label: 'Público (all/candidato/empresa)',
      type: 'text',
    },
    { name: 'fileUrl', label: 'URL do Arquivo', type: 'text' },
    { name: 'format', label: 'Formato (ex: PDF, DOCX)', type: 'text' },
    { name: 'price', label: 'Preço (0 para Grátis)', type: 'number' },
  ],
  resources_guides: [
    { name: 'id', label: 'ID interno (opcional)', type: 'text' },
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
    { name: 'content', label: 'Conteúdo do Guia (texto)', type: 'textarea' },
    {
      name: 'audience',
      label: 'Público (all/candidato/empresa)',
      type: 'text',
    },
    { name: 'fileUrl', label: 'URL do Anexo (opcional)', type: 'text' },
    { name: 'readTime', label: 'Tempo de Leitura', type: 'text' },
    { name: 'image', label: 'Imagem de Capa', type: 'text' },
  ],
  resources_tools: [
    {
      name: 'title',
      label: 'Nome da Ferramenta',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
    { name: 'url', label: 'URL da Ferramenta', type: 'text', required: true },
    {
      name: 'audience',
      label: 'Público (all/candidato/empresa)',
      type: 'text',
    },
    {
      name: 'requiresProfessional',
      label: 'Recurso pago (true/false)',
      type: 'text',
    },
    { name: 'icon', label: 'Ícone (URL ou nome)', type: 'text' },
    { name: 'pricing', label: 'Modelo de Preço (Grátis, Pago)', type: 'text' },
  ],
  resources_foreigners: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
    { name: 'content', label: 'Conteúdo', type: 'textarea' },
    { name: 'country', label: 'País / Origem', type: 'text' },
    {
      name: 'audience',
      label: 'Público (all/candidato/empresa)',
      type: 'text',
    },
    { name: 'fileUrl', label: 'URL de Documento (opcional)', type: 'text' },
    { name: 'url', label: 'URL Externa (opcional)', type: 'text' },
  ],
  resources_premium: [
    { name: 'title', label: 'Título do Serviço', type: 'text', required: true },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
    { name: 'content', label: 'Detalhes', type: 'textarea' },
    {
      name: 'audience',
      label: 'Público (all/candidato/empresa)',
      type: 'text',
    },
    { name: 'priceLabel', label: 'Preço', type: 'text' },
    {
      name: 'requiresProfessional',
      label: 'Requer Profissional (true/false)',
      type: 'text',
    },
    { name: 'url', label: 'URL de Acesso', type: 'text' },
  ],
  resources_faqs: [
    { name: 'question', label: 'Pergunta', type: 'text', required: true },
    { name: 'answer', label: 'Resposta', type: 'textarea', required: true },
    { name: 'category', label: 'Categoria', type: 'text' },
  ],
  resources_links: [
    { name: 'label', label: 'Rótulo do Link', type: 'text', required: true },
    { name: 'url', label: 'URL de Destino', type: 'text', required: true },
    { name: 'description', label: 'Breve Descrição', type: 'text' },
    { name: 'category', label: 'Categoria', type: 'text' },
  ],
  default: [
    { name: 'title', label: 'Título/Nome', type: 'text', required: true },
    { name: 'description', label: 'Descrição', type: 'textarea' },
    { name: 'image', label: 'Imagem', type: 'text' },
    { name: 'url', label: 'URL / Link', type: 'text' },
  ],
};

const ALLOWED_RESOURCE_TYPES = new Set(RESOURCE_TYPES.map((item) => item.id));

const normalizeResourceType = (value) => {
  const parsed = Array.isArray(value) ? value[0] : value;
  const candidate = String(parsed || '').trim();
  if (!candidate || !ALLOWED_RESOURCE_TYPES.has(candidate)) {
    return 'resources_templates';
  }
  return candidate;
};

const serializeValue = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const output = {};
    Object.keys(value).forEach((key) => {
      output[key] = serializeValue(value[key]);
    });
    return output;
  }
  return value;
};

export default function AdminResourceEdit({ itemData, isNew, type }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [formData, setFormData] = useState({});

  const fields = SCHEMAS[type] || SCHEMAS['default'];
  const typeLabel = RESOURCE_TYPES.find((t) => t.id === type)?.label || type;
  const supportsManagedFile =
    type === 'resources_templates' || type === 'resources_guides';

  useEffect(() => {
    if (itemData) {
      setFormData(itemData);
    } else {
      // Init empty fields
      const initial = {};
      fields.forEach((f) => (initial[f.name] = ''));
      setFormData(initial);
    }
  }, [itemData, fields]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (
        type === 'resources_templates' &&
        !String(formData.fileUrl || '').trim()
      ) {
        alert('Carregue um documento do template antes de salvar.');
        setLoading(false);
        return;
      }

      if (isNew) {
        await addDocument(type, {
          ...formData,
          createdAt: new Date().toISOString(),
        });
      } else {
        await setDocument(type, itemData.id, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
      }
      router.push(`/dashboard/admin/resources?type=${type}`);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar item.');
    } finally {
      setLoading(false);
    }
  };

  const inferFileFormat = (fileName = '') => {
    const extension = String(fileName).split('.').pop()?.trim().toUpperCase();
    if (!extension || extension === fileName.toUpperCase()) return '';
    return extension;
  };

  const sanitizeFileName = (value = '') => {
    return String(value)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setUploadStatus('Ficheiro demasiado grande. Limite: 15MB.');
      return;
    }

    const acceptedFileTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    const isAccepted =
      acceptedFileTypes.includes(file.type) ||
      /\.(pdf|doc|docx|txt)$/i.test(file.name);

    if (!isAccepted) {
      setUploadStatus('Formato não suportado. Use PDF, DOC, DOCX ou TXT.');
      return;
    }

    setUploadingFile(true);
    setUploadStatus('A carregar ficheiro...');

    try {
      const [{ ref, uploadBytesResumable, getDownloadURL }, { storage, auth }] =
        await Promise.all([
          import('firebase/storage'),
          import('../../../../lib/firebase'),
        ]);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sessão expirada. Faça login novamente como admin.');
      }

      const safeName = sanitizeFileName(file.name || 'documento');
      // storage.rules permite escrita em /users/{userId}/** para o dono autenticado.
      const path = `users/${currentUser.uid}/resources/${type}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);

      await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const inferredFormat = inferFileFormat(file.name);

      setFormData((prev) => ({
        ...prev,
        fileUrl: url,
        ...(inferredFormat && !String(prev.format || '').trim()
          ? { format: inferredFormat }
          : {}),
      }));
      setUploadStatus('Documento carregado com sucesso.');
    } catch (error) {
      console.error('Erro no upload de recurso:', error);
      setUploadStatus(
        getFirebaseStorageErrorMessage(error, 'Erro ao carregar documento.'),
      );
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
      color: '#fff',
    },
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem',
    },
    header: {
      marginBottom: '2rem',
    },
    title: {
      fontSize: '2rem',
      fontWeight: 800,
      marginBottom: '0.5rem',
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: '1rem',
    },
    card: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
    },
    formGroup: {
      marginBottom: '1.5rem',
    },
    label: {
      display: 'block',
      marginBottom: '0.5rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.9rem',
    },
    input: {
      width: '100%',
      padding: '0.8rem',
      background: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '1rem',
    },
    textarea: {
      width: '100%',
      padding: '0.8rem',
      background: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '1rem',
      minHeight: '120px',
      fontFamily: 'sans-serif',
    },
    submitBtn: {
      width: '100%',
      padding: '1rem',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: '1rem',
      opacity: loading ? 0.7 : 1,
    },
    uploadCard: {
      marginBottom: '1.5rem',
      padding: '1rem',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(15, 23, 42, 0.5)',
    },
    uploadHint: {
      margin: '0 0 0.75rem',
      color: 'rgba(255, 255, 255, 0.75)',
      fontSize: '0.85rem',
      lineHeight: 1.5,
    },
    uploadActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flexWrap: 'wrap',
    },
    uploadButton: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.55rem 1rem',
      background: 'rgba(16, 185, 129, 0.2)',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      borderRadius: '8px',
      color: '#6ee7b7',
      fontWeight: 600,
      cursor: uploadingFile ? 'not-allowed' : 'pointer',
      opacity: uploadingFile ? 0.75 : 1,
    },
    hiddenFileInput: {
      display: 'none',
    },
    uploadStatus: {
      margin: 0,
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '0.82rem',
    },
  };

  return (
    <>
      <Head>
        <title>{isNew ? 'Novo Item' : 'Editar Item'} | Admin Recursos</title>
      </Head>
      <div className={adminStyles.legacyPage} style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <Link
              href={`/dashboard/admin/resources?type=${type}`}
              style={{
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              ← Voltar a Lista
            </Link>
            <h1 style={styles.title}>{isNew ? 'Novo Item' : 'Editar Item'}</h1>
            <p style={styles.subtitle}>Coleção: {typeLabel}</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.card}>
            {supportsManagedFile && (
              <div style={styles.uploadCard}>
                <p style={styles.uploadHint}>
                  O documento desta secção deve ser carregado e atualizado pelo
                  Admin. O link será preenchido automaticamente no campo URL do
                  Arquivo.
                </p>
                <div style={styles.uploadActions}>
                  <label style={styles.uploadButton}>
                    {uploadingFile ? 'Carregando...' : 'Carregar documento'}
                    <input
                      aria-label="Carregar documento do recurso"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      style={styles.hiddenFileInput}
                    />
                  </label>
                  {uploadStatus ? (
                    <p style={styles.uploadStatus}>{uploadStatus}</p>
                  ) : null}
                </div>
              </div>
            )}

            {fields.map((field) => (
              <div key={field.name} style={styles.formGroup}>
                <label htmlFor={`resource-${field.name}`} style={styles.label}>
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={`resource-${field.name}`}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    style={styles.textarea}
                    required={field.required}
                  />
                ) : (
                  <input
                    id={`resource-${field.name}`}
                    type={field.type}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    style={styles.input}
                    required={field.required}
                  />
                )}
              </div>
            ))}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Item'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.params;
  const isNew = id === 'novo';
  const type = normalizeResourceType(context.query.type);

  try {
    const cookies = nookies.get(context);
    if (!cookies.token) {
      return redirectToLogin(context);
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    // Check if admin
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    let itemData = null;

    if (!isNew) {
      const docSnap = await admin.firestore().collection(type).doc(id).get();
      if (docSnap.exists) {
        itemData = serializeValue({ id: docSnap.id, ...docSnap.data() });
      } else {
        return { notFound: true };
      }
    }

    return {
      props: {
        itemData,
        isNew,
        type,
      },
    };
  } catch (error) {
    console.error('Error in admin resources edit props:', error);
    return redirectToLogin(context);
  }
}
