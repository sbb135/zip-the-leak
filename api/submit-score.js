import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { time, dayNum } = req.body;

        if (typeof time !== 'number' || time <= 0 || time > 9999) {
            return res.status(400).json({ error: 'Invalid time' });
        }

        const scoreEntry = { time, timestamp: Date.now() };

        if (!process.env.KV_REST_API_URL) {
            console.warn("KV is not configured. Mocking success.");
            return res.status(200).json({ success: true, message: 'Mock saved', entry: scoreEntry });
        }

        // Add to Daily Leaderboard
        if (typeof dayNum === 'number') {
            const dailyKey = `leaderboard:daily:${dayNum}`;
            await kv.zadd(dailyKey, { score: time, member: JSON.stringify(scoreEntry) });
            // Set TTL of 7 days so old daily boards clean themselves up
            await kv.expire(dailyKey, 60 * 60 * 24 * 7);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error submitting score:', error);
        return res.status(500).json({ error: 'Failed to submit score' });
    }
}
