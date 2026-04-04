import Head from 'next/head';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import LandingHeader from '../../../../components/LandingHeader';
import { deleteDocument } from '../../../../lib/db';
import { useRouter } from 'next/router';
import {
    DEFAULT_FAQS,
    DEFAULT_GUIDES,
    DEFAULT_TEMPLATES,
    DEFAULT_TOOLS
} from '../../../../lib/resourcesCatalog';

// Collection mapping
const RESOURCE_TYPES = [
    { id: 'resources_templates', label: 'Modelos & Templates' },
    { id: 'resources_guides', label: 'Guias e Manuais' },
    { id: 'resources_foreigners', label: 'Estrangeiros & Repatriação' },
    { id: 'resources_premium', label: 'Serviços Premium' },
    { id: 'resources_tools', label: 'Ferramentas' },
    { id: 'resources_links', label: 'Links Úteis' },
    { id: 'resources_faqs', label: 'FAQs' }
];

const DEFAULT_RESOURCES_BY_COLLECTION = {
    resources_templates: DEFAULT_TEMPLATES,
    resources_guides: DEFAULT_GUIDES,
    resources_tools: DEFAULT_TOOLS,
    resources_faqs: DEFAULT_FAQS
};

const ALLOWED_RESOURCE_TYPES = new Set(RESOURCE_TYPES.map((item) => item.id));

const normalizeResourceType = (value) => {
    const candidate = String(value || '').trim();
    if (!candidate || !ALLOWED_RESOURCE_TYPES.has(candidate)) {
        return 'resources_templates';
    }
    return candidate;
};

const isTimestampLike = (value) => value && typeof value.toDate === 'function';

const serializeData = (data) => {
    const serialized = { ...data };
    if (isTimestampLike(serialized.createdAt)) {
        serialized.createdAt = serialized.createdAt.toDate().toISOString();
    } else if (serialized.createdAt instanceof Date) {
        serialized.createdAt = serialized.createdAt.toISOString();
    }

    if (isTimestampLike(serialized.updatedAt)) {
        serialized.updatedAt = serialized.updatedAt.toDate().toISOString();
    } else if (serialized.updatedAt instanceof Date) {
        serialized.updatedAt = serialized.updatedAt.toISOString();
    }
    return serialized;
};

const syncCollectionDefaults = async (collectionRef, defaults = []) => {
    if (!Array.isArray(defaults) || defaults.length === 0) {
        return;
    }

    const now = admin.firestore.Timestamp.now();
    await Promise.all(
        defaults.map(async (item) => {
            const defaultId = String(item?.id || '').trim();
            if (!defaultId) return;
            const docRef = collectionRef.doc(defaultId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                return;
            }

            await docRef.set({
                ...item,
                createdAt: now,
                updatedAt: now,
                isSystemDefault: true
            });
        })
    );
};

export default function AdminResourcesList({ initialData, initialType }) {
    const router = useRouter();
    const [currentType, setCurrentType] = useState(initialType || 'resources_templates');
    const [items, setItems] = useState(initialData || []);
    const [loading, setLoading] = useState(false);

    // Function to refresh data when type changes (client-side transition)
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setCurrentType(newType);
        setLoading(true);
        router.push(`/dashboard/admin/resources?type=${newType}`);
    };

    useEffect(() => {
        setItems(initialData);
        setLoading(false);
    }, [initialData]);

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;

        setLoading(true);
        try {
            await deleteDocument(currentType, id);
            setItems(items.filter(item => item.id !== id));
            setLoading(false);
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir item.');
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
        controls: {
            display: 'flex',
            gap: '1rem',
            alignItems: 'center'
        },
        select: {
            padding: '0.75rem',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            fontSize: '0.9rem',
            cursor: 'pointer'
        },
        addButton: {
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600
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
                <title>Gerenciar Recursos | Admin EmpregoSTP</title>
            </Head>
            <div style={styles.page}>
                <LandingHeader />
                <main style={styles.container}>
                    <div style={styles.header}>
                        <div>
                            <Link href="/dashboard/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                                ← Voltar ao Dashboard
                            </Link>
                            <h1 style={styles.title}>Gerenciar Recursos</h1>
                        </div>

                        <div style={styles.controls}>
                            <select value={currentType} onChange={handleTypeChange} style={styles.select}>
                                {RESOURCE_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>{type.label}</option>
                                ))}
                            </select>

                            <Link href={`/dashboard/admin/resources/novo?type=${currentType}`} style={styles.addButton}>
                                + Novo Item
                            </Link>
                        </div>
                    </div>

                    <div style={styles.card}>
                        {loading ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Carregando...</div>
                        ) : items.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Nenhum item encontrado nesta coleção.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Título / Nome</th>
                                            <th style={styles.th}>Descrição / Detalhe</th>
                                            <th style={styles.th} align="right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(item => (
                                            <tr key={item.id}>
                                                <td style={styles.td}>
                                                    <strong>{item.title || item.name || item.question || 'Sem Título'}</strong>
                                                </td>
                                                <td style={styles.td}>
                                                    {item.description || item.answer || item.role || item.content || '...'}
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.actions}>
                                                        <Link
                                                            href={`/dashboard/admin/resources/${item.id}?type=${currentType}`}
                                                            style={{ ...styles.actionBtn, ...styles.editBtn, textDecoration: 'none', display: 'inline-block' }}
                                                        >
                                                            Editar
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
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
                </main>
            </div>
        </>
    );
}

export async function getServerSideProps(context) {
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

        // Determine collection type from query or default
        const type = normalizeResourceType(context.query.type);
        const collectionRef = admin.firestore().collection(type);
        await syncCollectionDefaults(collectionRef, DEFAULT_RESOURCES_BY_COLLECTION[type] || []);
        const snapshot = await collectionRef.get();

        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...serializeData(doc.data())
        }));

        return {
            props: { initialData: data, initialType: type }
        };
    } catch (error) {
        console.error('Error fetching admin resources:', error);
        return { redirect: { destination: '/login', permanent: false } };
    }
}
