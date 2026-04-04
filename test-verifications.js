// Test script to check if verifications collection has data
// This can be run in the browser console while logged in as admin

async function testVerifications() {
    try {
        console.log('Testing verifications API...');

        // Get current user token
        const auth = window.firebase?.auth?.() || (await import('/lib/firebase').then(m => m.auth));
        const user = auth.currentUser;

        if (!user) {
            console.error('Not logged in');
            return;
        }

        const token = await user.getIdToken();
        console.log('Got user token');

        // Call the API
        const response = await fetch('/api/admin/verifications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (data.verifications) {
            console.log(`Found ${data.verifications.length} verifications`);
            data.verifications.forEach((v, i) => {
                console.log(`Verification ${i + 1}:`, {
                    id: v.id,
                    candidateName: v.candidateName,
                    candidateEmail: v.candidateEmail,
                    status: v.status,
                    submittedAt: v.submittedAt
                });
            });
        }
    } catch (error) {
        console.error('Error testing verifications:', error);
    }
}

testVerifications();
