import admin from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  const { method } = req;

  // First, verify the user's token
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or invalid.' });
  }

  const token = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }

  const { uid } = decodedToken;
  const db = admin.firestore();
  const userDocRef = db.collection('users').doc(uid);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists || userDoc.data().userType !== 'empresa') {
    return res.status(403).json({ message: 'Acesso permitido apenas para empresas.' });
  }

  const companyDocRef = userDocRef;

  switch (method) {
    case 'GET':
      try {
        const doc = await companyDocRef.get();
        if (!doc.exists) {
          return res.status(404).json({ message: 'Company not found.' });
        }
        res.status(200).json({ profile: doc.data() });
      } catch (error) {
        res.status(500).json({ message: 'Error fetching company data.' });
      }
      break;

    case 'PUT':
      try {
        // Ensure email is not updated from the request body for security
        const { email, ...updateData } = req.body;
        await companyDocRef.update(updateData);
        res.status(200).json({ message: 'Profile updated successfully.' });
      } catch (error) {
        res.status(500).json({ message: 'Error updating company data.' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
