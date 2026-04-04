import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import LandingHeader from '../../../../components/LandingHeader';

const EMPLOYMENT_TYPES = [
    'Tempo Integral',
    'Meio Período',
    'Contrato',
    'Estágio',
    'Freelance',
    'Voluntariado'
];

const EXPERIENCE_LEVELS = [
    'Júnior (0-2 anos)',
    'Pleno (2-5 anos)',
    'Sénior (5+ anos)',
    'Especialista',
    'Gestão'
];

const EDUCATION_LEVELS = [
    'Ensino Básico',
    'Ensino Secundário',
    'Licenciatura',
    'Mestrado',
    'Doutoramento',
    'Não exigido'
];

const JOB_CATEGORIES = [
    'Marketing Digital',
    'Programação',
    'Design',
    'Gestão e Administração',
    'Vendas',
    'Educação',
    'Saúde',
    'Engenharia',
    'Finanças',
    'Recursos Humanos',
    'Jurídico',
    'Atendimento'
];

export default function AdminJobCreate({ companies }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [currentStep, setCurrentStep] = useState(1);

    const [jobData, setJobData] = useState({
        companyId: '',
        titulo: '',
        descricao: '',
        requisitos: '',
        responsabilidades: '',
        localizacao: '',
        tipoContrato: '',
        nivelExperiencia: '',
        escolaridade: '',
        salarioDe: '',
        salarioAte: '',
        beneficios: '',
        dataAbertura: new Date().toISOString().split('T')[0],
        dataFecho: '',
        remoto: false,
        destaque: false,
        vagasDisponiveis: 1,
        palavrasChave: '',
        categoria: '',
        tdrUrl: '',
        tdrFileName: ''
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setJobData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const nextStep = () => {
        if (currentStep === 1 && (!jobData.companyId || !jobData.titulo || !jobData.descricao || !jobData.categoria)) {
            setError('Selecione a empresa, categoria, preencha o título e a descrição para continuar');
            return;
        }
        setError('');
        setCurrentStep(prev => Math.min(prev + 1, 4));
    };

    const prevStep = () => {
        setError('');
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            if (!jobData.companyId) throw new Error("Empresa é obrigatória");

            const response = await fetch('/api/admin/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...jobData,
                    palavrasChave: jobData.palavrasChave.split(',').map(k => k.trim()).filter(Boolean),
                    vagasDisponiveis: parseInt(jobData.vagasDisponiveis, 10) || 1
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Erro ao criar vaga');
            }

            setSuccess('Vaga criada com sucesso!');
            setTimeout(() => {
                router.push('/dashboard/admin/jobs');
            }, 2000);

        } catch (error) {
            console.error('Erro ao criar vaga:', error);
            setError(`Erro ao criar vaga: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const styles = {
        page: {
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
            color: '#fff'
        },
        container: {
            maxWidth: '900px',
            margin: '0 auto',
            padding: '2rem'
        }
    };

    const selectedCompanyName = companies.find(c => c.id === jobData.companyId)?.name || 'Nenhuma selecionada';

    return (
        <>
            <Head>
                <title>Criar Vaga (Admin) | EmpregoSTP</title>
            </Head>
            <div style={styles.page}>
                <LandingHeader />

                <div style={styles.container}>
                    <div style={{ marginBottom: '2rem' }}>
                        <Link href="/dashboard/admin/jobs" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                            ← Voltar a Gestão de Vagas
                        </Link>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Nova Vaga (Admin)</h1>
                    </div>

                    {/* Steps Indicator (Simplified) */}
                    <div style={{
                        marginBottom: '2rem',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '1rem'
                    }}>
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} style={{
                                flex: 1,
                                height: '4px',
                                background: currentStep >= s ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                borderRadius: '2px'
                            }} />
                        ))}
                    </div>

                    {error && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
                    {success && <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', borderRadius: '8px', marginBottom: '1rem' }}>{success}</div>}

                    <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>

                        {currentStep === 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontWeight: 600 }}>Empresa Responsável *</label>
                                    <select
                                        name="companyId"
                                        value={jobData.companyId}
                                        onChange={handleChange}
                                        style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }}
                                    >
                                        <option value="">Selecione a empresa...</option>
                                        {companies.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontWeight: 600 }}>Título da Vaga *</label>
                                        <input
                                            type="text"
                                            name="titulo"
                                            value={jobData.titulo}
                                            onChange={handleChange}
                                            style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontWeight: 600 }}>Categoria *</label>
                                        <select
                                            name="categoria"
                                            value={jobData.categoria}
                                            onChange={handleChange}
                                            style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }}
                                        >
                                            <option value="">Selecione categoria...</option>
                                            {JOB_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontWeight: 600 }}>Descrição *</label>
                                    <textarea
                                        name="descricao"
                                        value={jobData.descricao}
                                        onChange={handleChange}
                                        rows={5}
                                        style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }}
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Localização</label>
                                        <input type="text" name="localizacao" value={jobData.localizacao} onChange={handleChange} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Tipo Contrato</label>
                                        <select name="tipoContrato" value={jobData.tipoContrato} onChange={handleChange} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }}>
                                            <option value="">Selecione...</option>
                                            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Salário Min</label>
                                        <input type="number" name="salarioDe" value={jobData.salarioDe} onChange={handleChange} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Salário Max</label>
                                        <input type="number" name="salarioAte" value={jobData.salarioAte} onChange={handleChange} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input type="checkbox" name="remoto" checked={jobData.remoto} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
                                        Remoto
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input type="checkbox" name="destaque" checked={jobData.destaque} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
                                        Destaque
                                    </label>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Data Abertura</label>
                                        <input type="date" name="dataAbertura" value={jobData.dataAbertura} onChange={handleChange} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Data Fecho</label>
                                        <input type="date" name="dataFecho" value={jobData.dataFecho} onChange={handleChange} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div style={{ color: 'rgba(255,255,255,0.8)' }}>
                                <h3>Revisão</h3>
                                <p><strong>Empresa:</strong> {selectedCompanyName}</p>
                                <p><strong>Título:</strong> {jobData.titulo}</p>
                                <p><strong>Local:</strong> {jobData.localizacao} {jobData.remoto ? '(Remoto)' : ''}</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                            {currentStep > 1 ? (
                                <button type="button" onClick={prevStep} style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>Anterior</button>
                            ) : <div />}

                            {currentStep < 4 ? (
                                <button type="button" onClick={nextStep} style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>Próximo</button>
                            ) : (
                                <button type="submit" disabled={isLoading} style={{ padding: '0.75rem 1.5rem', background: '#10b981', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
                                    {isLoading ? 'Criando...' : 'Confirmar e Criar Vaga'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
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

        // Fetch All Companies
        const companiesSnapshot = await admin.firestore().collection('users')
            .where('userType', '==', 'empresa')
            .get();

        const companies = companiesSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || doc.data().empresaNome || 'Empresa sem nome',
            logo: doc.data().logo || ''
        }));

        return {
            props: { companies }
        };
    } catch (error) {
        console.error('Error in admin job create props:', error);
        return { redirect: { destination: '/login', permanent: false } };
    }
}
