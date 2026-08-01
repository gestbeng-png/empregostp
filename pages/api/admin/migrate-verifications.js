import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';

/**
 * Migration script to move verification data from users collection to verifications collection
 * This is needed for old verification requests that were submitted before the fix
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Método não permitido' });
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


        // Find all users with verificationStatus = 'pending'
        const usersSnapshot = await admin.firestore()
            .collection('users')
            .where('verificationStatus', '==', 'pending')
            .get();


        let migrated = 0;
        let skipped = 0;
        const errors = [];

        for (const userDoc of usersSnapshot.docs) {
            try {
                const userData = userDoc.data();
                const uid = userDoc.id;

                // Check if verification already exists in verifications collection
                const existingVerification = await admin.firestore()
                    .collection('verifications')
                    .where('uid', '==', uid)
                    .where('status', '==', 'pending')
                    .get();

                if (!existingVerification.empty) {
                    skipped++;
                    continue;
                }

                // Create verification document from user data
                const verificationData = {
                    uid: uid,
                    status: 'pending',
                    submittedAt: userData.verificationDate
                        ? admin.firestore.Timestamp.fromDate(new Date(userData.verificationDate))
                        : admin.firestore.FieldValue.serverTimestamp(),
                    documents: {
                        contact: {
                            email: userData.verificationData?.email || userData.email || '',
                            phone: userData.verificationData?.phone || userData.phone || ''
                        },
                        idDocument: userData.verificationData?.idUrl ? {
                            url: userData.verificationData.idUrl,
                            type: 'ID Document'
                        } : null,
                        selfieDocument: userData.verificationData?.selfieUrl ? {
                            url: userData.verificationData.selfieUrl
                        } : null,
                        cvDocument: userData.verificationData?.cvUrl ? {
                            url: userData.verificationData.cvUrl
                        } : null
                    }
                };

                // Add to verifications collection
                await admin.firestore().collection('verifications').add(verificationData);

                migrated++;

            } catch (err) {
                logServerError('admin_migrate_verifications.migrating_user_failed', err);
                errors.push({ uid: userDoc.id, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            migrated,
            skipped,
            errors,
            message: `Migrated ${migrated} verifications, skipped ${skipped}, ${errors.length} errors`
        });

    } catch (error) {
        logServerError('admin_migrate_verifications.in_migration_failed', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
