import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import LandingHeader from '../../../../components/LandingHeader';
import { addDocument, setDocument } from '../../../../lib/db';
import { CONTENT_STATUS, normalizeContentStatus, resolvePublishedAt } from '../../../../lib/contentPublication';

export default function AdminBlogEdit({ postData, isNew }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        excerpt: '',
        content: '',
        category: 'Carreira',
        author: 'EmpregoSTP',
        image: '',
        readTime: '5 min',
        color: '#6366f1',
        featured: false,
        status: CONTENT_STATUS.PUBLISHED
    });

    useEffect(() => {
        if (postData) {
            setFormData(postData);
        }
    }, [postData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const normalizedStatus = normalizeContentStatus(formData.status);
            const publishedAt = resolvePublishedAt({
                status: normalizedStatus,
                publishedAt: formData.publishedAt || null,
                fallbackDate: new Date().toISOString()
            });
            const payload = {
                ...formData,
                status: normalizedStatus,
                publishedAt
            };

            if (isNew) {
                await addDocument('posts', {
                    ...payload,
                    views: 0,
                    createdAt: new Date().toISOString()
                });
            } else {
                await setDocument('posts', postData.id, {
                    ...payload,
                    updatedAt: new Date().toISOString()
                });
            }
            router.push('/dashboard/admin/blog');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar o artigo. Verifique o console.');
        } finally {
            setLoading(false);
        }
    };

    const styles = {
        page: {
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
            color: '#fff'
        },
        container: {
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem'
        },
        header: {
            marginBottom: '2rem'
        },
        title: {
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '0.5rem'
        },
        card: {
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
        },
        formGroup: {
            marginBottom: '1.5rem'
        },
        label: {
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '0.9rem'
        },
        input: {
            width: '100%',
            padding: '0.8rem',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem'
        },
        textarea: {
            width: '100%',
            padding: '0.8rem',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            minHeight: '200px',
            fontFamily: 'monospace'
        },
        select: {
            width: '100%',
            padding: '0.8rem',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem'
        },
        row: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem'
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
            opacity: loading ? 0.7 : 1
        }
    };

    return (
        <>
            <Head>
                <title>{isNew ? 'Novo Artigo' : 'Editar Artigo'} | Admin EmpregoSTP</title>
            </Head>
            <div style={styles.page}>
                <LandingHeader />
                <main style={styles.container}>
                    <div style={styles.header}>
                        <Link href="/dashboard/admin/blog" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                            ← Voltar a Lista
                        </Link>
                        <h1 style={styles.title}>{isNew ? 'Novo Artigo' : 'Editar Artigo'}</h1>
                    </div>

                    <form onSubmit={handleSubmit} style={styles.card}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Título</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                style={styles.input}
                                required
                            />
                        </div>

                        <div style={styles.row}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Categoria</label>
                                <select name="category" value={formData.category} onChange={handleChange} style={styles.select}>
                                    <option value="Carreira">Carreira</option>
                                    <option value="Mercado">Mercado</option>
                                    <option value="Dicas">Dicas</option>
                                    <option value="Tecnologia">Tecnologia</option>
                                    <option value="Entrevistas">Entrevistas</option>
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Status de Publicação</label>
                                <select name="status" value={normalizeContentStatus(formData.status)} onChange={handleChange} style={styles.select}>
                                    <option value={CONTENT_STATUS.PUBLISHED}>Publicado</option>
                                    <option value={CONTENT_STATUS.DRAFT}>Rascunho</option>
                                </select>
                            </div>
                        </div>

                        <div style={styles.row}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Autor</label>
                                <input
                                    type="text"
                                    name="author"
                                    value={formData.author}
                                    onChange={handleChange}
                                    style={styles.input}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Data de Publicação (opcional)</label>
                                <input
                                    type="datetime-local"
                                    name="publishedAt"
                                    value={formData.publishedAt ? new Date(formData.publishedAt).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData((prev) => ({
                                            ...prev,
                                            publishedAt: value ? new Date(value).toISOString() : ''
                                        }));
                                    }}
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>Resumo (Excerpt)</label>
                            <textarea
                                name="excerpt"
                                value={formData.excerpt}
                                onChange={handleChange}
                                style={{ ...styles.textarea, minHeight: '100px' }}
                                required
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>Conteúdo (HTML Permitido)</label>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Use tags HTML para formatar (&lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, etc.)</p>
                            <textarea
                                name="content"
                                value={formData.content}
                                onChange={handleChange}
                                style={styles.textarea}
                                required
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>URL da Imagem de Capa</label>
                            <input
                                type="text"
                                name="image"
                                value={formData.image}
                                onChange={handleChange}
                                style={styles.input}
                                placeholder="https://exemplo.com/imagem.jpg"
                            />
                        </div>

                        <div style={styles.row}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Tempo de Leitura</label>
                                <input
                                    type="text"
                                    name="readTime"
                                    value={formData.readTime}
                                    onChange={handleChange}
                                    style={styles.input}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Cor do Tema (Hex)</label>
                                <input
                                    type="color"
                                    name="color"
                                    value={formData.color}
                                    onChange={handleChange}
                                    style={{ ...styles.input, padding: '0.5rem', height: '50px' }}
                                />
                            </div>
                        </div>

                        <button type="submit" style={styles.submitBtn} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Publicação'}
                        </button>
                    </form>
                </main>
            </div>
        </>
    );
}

export async function getServerSideProps(context) {
    const { id } = context.params;
    const isNew = id === 'novo';

    try {
        const cookies = nookies.get(context);
        if (!cookies.token) {
            return { redirect: { destination: '/login', permanent: false } };
        }

        const token = await admin.auth().verifyIdToken(cookies.token);
        const { uid } = token;

        // Check if admin
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!userDoc.exists || userDoc.data().userType !== 'admin') {
            return { redirect: { destination: '/dashboard', permanent: false } };
        }

        let postData = null;

        if (!isNew) {
            const docSnap = await admin.firestore().collection('posts').doc(id).get();
            if (docSnap.exists) {
                postData = { id: docSnap.id, ...docSnap.data() };
                // Serialize dates for props
                if (postData.createdAt?.toDate) postData.createdAt = postData.createdAt.toDate().toISOString();
                if (postData.updatedAt?.toDate) postData.updatedAt = postData.updatedAt.toDate().toISOString();
                if (postData.publishedAt?.toDate) postData.publishedAt = postData.publishedAt.toDate().toISOString();
                postData.status = normalizeContentStatus(postData.status);
            } else {
                return { notFound: true };
            }
        }

        return {
            props: {
                postData,
                isNew
            }
        };
    } catch (error) {
        console.error('Error in admin blog edit props:', error);
        return { redirect: { destination: '/login', permanent: false } };
    }
}
