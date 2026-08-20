import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import adminStyles from '../../../../styles/AdminPanel.module.css';
import { deleteDocument } from '../../../../lib/db';
import { safeText, safeTimestampToISOString, safeTimestampToMillis } from '../../../../lib/firestoreNormalize';
import { CONTENT_STATUS, normalizeContentStatus } from '../../../../lib/contentPublication';
import { redirectToLogin } from '../../../../lib/loginRedirect';

export default function AdminBlogList({ posts: initialPosts }) {
    const [posts, setPosts] = useState(initialPosts);
    const [loading, setLoading] = useState(false);

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este artigo?')) return;

        setLoading(true);
        try {
            await deleteDocument('posts', id);
            setPosts(posts.filter(p => p.id !== id));
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir artigo.');
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
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '2rem'
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem'
        },
        title: {
            fontSize: '2rem',
            fontWeight: 800
        },
        addButton: {
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        },
        card: {
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            overflow: 'hidden'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse'
        },
        th: {
            padding: '1rem',
            textAlign: 'left',
            color: 'rgba(255, 255, 255, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            fontWeight: 600
        },
        td: {
            padding: '1rem',
            color: 'white',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        },
        actions: {
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end'
        },
        actionBtn: {
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none'
        },
        editBtn: {
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa'
        },
        deleteBtn: {
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171'
        }
    };

    return (
        <>
            <Head>
                <title>Gerir blog | Admin EmpregoSTP</title>
            </Head>
            <div className={adminStyles.legacyPage} style={styles.page}>
                <div style={styles.container}>
                    <div style={styles.header}>
                        <div>
                            <Link href="/dashboard/admin" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                                ← Voltar ao Dashboard
                            </Link>
                            <h1 style={styles.title}>Gerir blog</h1>
                        </div>
                        <Link href="/dashboard/admin/blog/novo" style={styles.addButton}>
                            <span>+</span> Novo Artigo
                        </Link>
                    </div>

                    <div style={styles.card}>
                        {posts.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Nenhum artigo encontrado. Crie o primeiro!
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Título</th>
                                            <th style={styles.th}>Categoria</th>
                                            <th style={styles.th}>Autor</th>
                                            <th style={styles.th}>Estado</th>
                                            <th style={styles.th}>Data</th>
                                            <th style={styles.th} align="right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {posts.map(post => (
                                            <tr key={post.id}>
                                                <td style={styles.td}>{post.title}</td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        padding: '0.25rem 0.6rem',
                                                        background: 'rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        {post.category}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>{post.author}</td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        padding: '0.25rem 0.6rem',
                                                        background: normalizeContentStatus(post.status) === CONTENT_STATUS.PUBLISHED ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                                        border: `1px solid ${normalizeContentStatus(post.status) === CONTENT_STATUS.PUBLISHED ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.35)'}`,
                                                        borderRadius: '999px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        color: normalizeContentStatus(post.status) === CONTENT_STATUS.PUBLISHED ? '#116e4b' : '#cbd5e1'
                                                    }}>
                                                        {normalizeContentStatus(post.status) === CONTENT_STATUS.PUBLISHED ? 'Publicado' : 'Rascunho'}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.actions}>
                                                        <Link
                                                            href={`/dashboard/admin/blog/${post.id}`}
                                                            style={{ ...styles.actionBtn, ...styles.editBtn, textDecoration: 'none', display: 'inline-block' }}
                                                        >
                                                            Editar
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(post.id)}
                                                            style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                                                        >
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export async function getServerSideProps(context) {
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

        const postsCollectionRef = admin.firestore().collection('posts');
        let snapshot;

        try {
            snapshot = await postsCollectionRef.orderBy('createdAt', 'desc').get();
        } catch (error) {
            console.warn('[admin/blog] fallback sem orderBy(createdAt):', error?.message || error);
            snapshot = await postsCollectionRef.get();
        }

        const posts = snapshot.docs
            .map((doc) => {
                const data = doc.data() || {};
                const createdAt = safeTimestampToISOString(data.createdAt);
                const updatedAt = safeTimestampToISOString(data.updatedAt);
                return {
                    id: doc.id,
                    title: safeText(data.title, 'Sem título'),
                    category: safeText(data.category, 'Geral'),
                    author: safeText(data.author, 'EmpregoSTP'),
                    status: normalizeContentStatus(data.status),
                    createdAt,
                    updatedAt,
                    createdAtMs: safeTimestampToMillis(data.createdAt),
                    updatedAtMs: safeTimestampToMillis(data.updatedAt)
                };
            })
            .sort((a, b) => {
                const aScore = a.createdAtMs || a.updatedAtMs || 0;
                const bScore = b.createdAtMs || b.updatedAtMs || 0;
                return bScore - aScore;
            })
            .map(({ createdAtMs, updatedAtMs, ...post }) => post);

        return {
            props: { posts }
        };
    } catch (error) {
        console.error('Error fetching admin posts:', error);
        return { props: { posts: [] } };
    }
}
