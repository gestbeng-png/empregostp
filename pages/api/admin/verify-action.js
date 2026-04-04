import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { verificationId, uid, action, reason } = req.body;

        // Validate input
        if (!verificationId || !uid || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
        }

        // Verify admin authentication
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const adminUid = decodedToken.uid;

        // Check if user is admin
        const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
        if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
            return res.status(403).json({ error: 'Forbidden - Admin access required' });
        }

        // Get verification document
        const verificationRef = admin.firestore().collection('verifications').doc(verificationId);
        const verificationDoc = await verificationRef.get();

        if (!verificationDoc.exists) {
            return res.status(404).json({ error: 'Verification request not found' });
        }

        const verificationData = verificationDoc.data();

        // Check if already reviewed
        if (verificationData.status !== 'pending') {
            return res.status(400).json({ error: 'Verification already reviewed' });
        }

        // Update verification status
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        await verificationRef.update({
            status: newStatus,
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedBy: adminUid,
            reviewReason: reason || null
        });

        // Update user's verificationStatus
        const userRef = admin.firestore().collection('users').doc(uid);
        await userRef.update({
            verificationStatus: action === 'approve' ? 'verified' : 'rejected',
            verificationReviewedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await admin.firestore().collection('activities').add({
            type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
            description: action === 'approve'
                ? `Verificação do utilizador ${uid} foi aprovada por um administrador`
                : `Verificação do utilizador ${uid} foi rejeitada por um administrador`,
            userId: uid,
            verificationId,
            adminId: adminUid,
            createdAt: new Date().toISOString()
        });

        // Keep public profile flags in sync (used by talent pool and public listings).
        try {
            const profileRef = admin.firestore().collection('profiles').doc(uid);
            await profileRef.set({
                verified: action === 'approve',
                verificationStatus: action === 'approve' ? 'verified' : 'rejected',
                verificationReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (profileErr) {
            console.error('Error syncing profile verification:', profileErr);
        }

        // Create notification for candidate
        try {
            await createServerNotification(admin, {
                userId: uid,
                type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
                title: action === 'approve'
                    ? '✅ Verificação Aprovada!'
                    : '❌ Verificação Rejeitada',
                message: action === 'approve'
                    ? 'Sua conta foi verificada com sucesso! Agora você tem acesso a recursos premium.'
                    : `Sua solicitação de verificação foi rejeitada. ${reason || 'Entre em contato com o suporte para mais informações.'}`,
                actionUrl: '/dashboard/candidato?tab=verification'
            });
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
            // Don't fail the whole operation if notification fails
        }

        return res.status(200).json({
            success: true,
            message: `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
            newStatus
        });
    } catch (error) {
        console.error('Error processing verification action:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
