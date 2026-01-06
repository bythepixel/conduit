const crypto = require('crypto');
const secret = process.env.FIREFLIES_WEBHOOK_SECRET || '';

const payload = JSON.stringify({
    eventType: 'Transcription completed',
    meetingId: 'BOGUS_MEETING_ID_12345'
});

const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

console.log('Payload:', payload);
console.log('Signature:', signature);

fetch('http://localhost:3006/api/firespot', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': `sha256=${signature}`
    },
    body: payload
})
    .then(res => res.json())
    .then(data => console.log('Response:', data))
    .catch(err => console.error('Error:', err));
