import { admin } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
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

        // Fetch all verifications (without complex ordering that requires index)
        console.log('Fetching verifications from Firestore...');
        const verificationsSnapshot = await admin.firestore()
            .collection('verifications')
            .get();

        console.log(`Found ${verificationsSnapshot.docs.length} verifications`);
        
        // Sort in memory to avoid index requirement
        const allDocs = verificationsSnapshot.docs.sort((a, b) => {
            const timeA = a.data().submittedAt?.toDate?.() || new Date(0);
            const timeB = b.data().submittedAt?.toDate?.() || new Date(0);
            return timeB - timeA;
        }).slice(0, 100);

        const verifications = [];
        for (const doc of allDocs) {
            const verificationData = doc.data();

            // Get candidate info
            let candidateInfo = {
                name: 'Desconhecido',
                email: verificationData.documents?.contact?.email || 'Não informado'
            };

            try {
                const userDoc = await admin.firestore().collection('users').doc(verificationData.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    candidateInfo.name = userData.name || userData.displayName || 'Desconhecido';
                    if (!candidateInfo.email || candidateInfo.email === 'Não informado') {
                        candidateInfo.email = userData.email || 'Não informado';
                    }
                }
            } catch (err) {
                console.error('Error fetching user info:', err);
            }

            verifications.push({
                id: doc.id,
                uid: verificationData.uid,
                candidateName: candidateInfo.name,
                candidateEmail: candidateInfo.email,
                status: verificationData.status,
                submittedAt: verificationData.submittedAt?.toDate?.()?.toISOString() || null,
                documents: verificationData.documents || {}
            });
        }

        return res.status(200).json({ verifications });
    } catch (error) {
        console.error('Error fetching verifications:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
