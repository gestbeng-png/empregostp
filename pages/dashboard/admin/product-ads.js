import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useAuth } from '../../../context/AuthContext';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { safeProductAdUrl } from '../../../lib/productAds';
import styles from '../../../styles/AdminProductAds.module.css';

const emptyForm = () => ({
  companyName: '',
  title: '',
  description: '',
  imageUrl: '',
  href: '',
  companyLogoUrl: '',
  badges: ['', ''],
  features: ['', '', ''],
  priceLabel: '',
  price: '',
  priceSuffix: '',
  status: 'draft',
  order: 0,
});

const padList = (value, size) =>
  Array.from({ length: size }, (_, index) =>
    Array.isArray(value) ? value[index] || '' : '',
  );

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function AdminProductAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [feedback, setFeedback] = useState(null);
  const previewUrl = safeProductAdUrl(form.imageUrl, { allowInternal: true });

  const loadAds = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/product-ads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Erro ao carregar anúncios.');
      setAds(data.ads || []);
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleListChange = (name, index) => (event) => {
    const { value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: current[name].map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleImageUpload = (field) => async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || !user) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFeedback({ type: 'error', text: 'Use uma imagem JPG, PNG ou WebP.' });
      input.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'A imagem deve ter até 3 MB.' });
      input.value = '';
      return;
    }

    setUploading(field);
    setFeedback(null);
    try {
      const [token, image] = await Promise.all([
        user.getIdToken(),
        readImage(file),
      ]);
      const response = await fetch('/api/admin/product-ads/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Erro ao carregar imagem.');
      setForm((current) => ({ ...current, [field]: data.imageUrl }));
      setFeedback({
        type: 'success',
        text: 'Imagem carregada. Guarde o anúncio para concluir.',
      });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setUploading('');
      input.value = '';
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!user || saving || uploading) return;
    setSaving(true);
    setFeedback(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        editingId
          ? `/api/admin/product-ads/${editingId}`
          : '/api/admin/product-ads',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Erro ao guardar anúncio.');
      setForm(emptyForm());
      setEditingId(null);
      setFeedback({ type: 'success', text: 'Anúncio guardado.' });
      await loadAds();
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ad) => {
    setEditingId(ad.id);
    setForm({
      companyName: ad.companyName || '',
      title: ad.title || '',
      description: ad.description || '',
      imageUrl: ad.imageUrl || '',
      href: ad.href || '',
      companyLogoUrl: ad.companyLogoUrl || '',
      badges: padList(ad.badges, 2),
      features: padList(ad.features, 3),
      priceLabel: ad.priceLabel || '',
      price: ad.price || '',
      priceSuffix: ad.priceSuffix || '',
      status: ad.status || 'draft',
      order: ad.order ?? 0,
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (ad) => {
    if (!user || !window.confirm(`Eliminar o anúncio “${ad.title}”?`)) return;
    setFeedback(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/product-ads/${ad.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Erro ao eliminar anúncio.');
      if (editingId === ad.id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      setFeedback({ type: 'success', text: 'Anúncio eliminado.' });
      await loadAds();
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    }
  };

  return (
    <>
      <Head>
        <title>Anúncios de produtos - Administração</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Conteúdo da home</span>
          <h1>Anúncios de produtos</h1>
          <p>
            Publique apenas produtos reais de empresas. Só anúncios publicados
            aparecem no carrossel.
          </p>
        </header>

        {feedback ? (
          <p
            className={`${styles.feedback} ${feedback.type === 'error' ? styles.error : styles.success}`}
            role="status"
          >
            {feedback.text}
          </p>
        ) : null}

        <div className={styles.grid}>
          <section
            className={styles.panel}
            aria-labelledby="product-ad-form-title"
          >
            <h2 id="product-ad-form-title">
              {editingId ? 'Editar anúncio' : 'Novo anúncio'}
            </h2>
            <form onSubmit={handleSave} className={styles.form}>
              <label>
                Empresa
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Produto
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Descrição <small>opcional</small>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  maxLength={260}
                />
              </label>
              <label>
                URL da imagem do produto
                <input
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  type="text"
                  required
                  placeholder="https://… ou /assets/…"
                />
              </label>
              <label>
                Ou carregar uma imagem <small>JPG, PNG ou WebP até 3 MB</small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload('imageUrl')}
                  disabled={Boolean(uploading)}
                />
              </label>
              {uploading === 'imageUrl' ? (
                <p className={styles.muted}>A carregar imagem…</p>
              ) : null}
              {previewUrl ? (
                <div className={styles.preview}>
                  <Image
                    src={previewUrl}
                    alt="Pré-visualização do produto"
                    fill
                    sizes="400px"
                    className={styles.thumbImage}
                    unoptimized={/^https?:\/\//i.test(previewUrl)}
                  />
                </div>
              ) : null}
              <fieldset className={styles.fieldset}>
                <legend>
                  Selos sobre a imagem <small>opcional</small>
                </legend>
                {form.badges.map((badge, index) => (
                  <input
                    key={`badge-${index}`}
                    value={badge}
                    onChange={handleListChange('badges', index)}
                    maxLength={28}
                    aria-label={`Selo ${index + 1}`}
                    placeholder={
                      index === 0 ? 'Ex.: 5G Ready STP' : 'Ex.: Stock limitado'
                    }
                  />
                ))}
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend>
                  Destaques do produto <small>opcional, até 3</small>
                </legend>
                {form.features.map((feature, index) => (
                  <input
                    key={`feature-${index}`}
                    value={feature}
                    onChange={handleListChange('features', index)}
                    maxLength={32}
                    aria-label={`Destaque ${index + 1}`}
                    placeholder={
                      [
                        'Ex.: 2 anos de garantia',
                        'Ex.: Entrega grátis',
                        'Ex.: Retoma aceite',
                      ][index]
                    }
                  />
                ))}
              </fieldset>
              <label>
                URL do logótipo da empresa <small>opcional</small>
                <input
                  name="companyLogoUrl"
                  value={form.companyLogoUrl}
                  onChange={handleChange}
                  type="text"
                  placeholder="Sem logótipo, mostram-se as iniciais"
                />
              </label>
              <label>
                Ou carregar o logótipo <small>JPG, PNG ou WebP até 3 MB</small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload('companyLogoUrl')}
                  disabled={Boolean(uploading)}
                />
              </label>
              {uploading === 'companyLogoUrl' ? (
                <p className={styles.muted}>A carregar logótipo…</p>
              ) : null}
              <div className={styles.formRow}>
                <label>
                  Legenda do preço <small>opcional</small>
                  <input
                    name="priceLabel"
                    value={form.priceLabel}
                    onChange={handleChange}
                    maxLength={30}
                    placeholder="Ex.: Condição mensal"
                  />
                </label>
                <label>
                  Preço <small>opcional</small>
                  <input
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    maxLength={24}
                    placeholder="Ex.: 1.850 STN"
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  Sufixo do preço <small>opcional</small>
                  <input
                    name="priceSuffix"
                    value={form.priceSuffix}
                    onChange={handleChange}
                    maxLength={12}
                    placeholder="Ex.: /mês"
                  />
                </label>
              </div>
              <label>
                Site da empresa <small>botão «Saiba mais»</small>
                <input
                  name="href"
                  value={form.href}
                  onChange={handleChange}
                  type="text"
                  placeholder="https://site-da-empresa.st"
                />
              </label>
              <div className={styles.formRow}>
                <label>
                  Ordem
                  <input
                    name="order"
                    value={form.order}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    max="999"
                  />
                </label>
                <label>
                  Estado
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicado</option>
                  </select>
                </label>
              </div>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={saving || Boolean(uploading)}
                >
                  {saving
                    ? 'A guardar…'
                    : editingId
                      ? 'Guardar alterações'
                      : 'Criar anúncio'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm());
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section
            className={styles.panel}
            aria-labelledby="product-ad-list-title"
          >
            <h2 id="product-ad-list-title">Anúncios guardados</h2>
            {loading ? (
              <p className={styles.muted}>A carregar anúncios…</p>
            ) : null}
            {!loading && !ads.length ? (
              <p className={styles.muted}>
                Ainda não há anúncios. Crie o primeiro no formulário.
              </p>
            ) : null}
            <div className={styles.list}>
              {ads.map((ad) => (
                <article className={styles.ad} key={ad.id}>
                  <div className={styles.thumb}>
                    {ad.imageUrl ? (
                      <Image
                        src={ad.imageUrl}
                        alt=""
                        fill
                        sizes="96px"
                        className={styles.thumbImage}
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className={styles.adCopy}>
                    <span
                      className={
                        ad.status === 'published'
                          ? styles.published
                          : styles.draft
                      }
                    >
                      {ad.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                    <h3>{ad.title}</h3>
                    <p>{ad.companyName}</p>
                    <div className={styles.adActions}>
                      <button type="button" onClick={() => handleEdit(ad)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDelete(ad)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const result = await requireAdminPageAuth(context);
  if (!result.ok) return { redirect: result.redirect };
  return { props: {} };
}
