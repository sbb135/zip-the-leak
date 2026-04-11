import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { dayNum } = req.query;

        if (!process.env.KV_REST_API_URL) {
            console.warn("KV is not configured. Returning mock distribution.");
            return res.status(200).json({
                scores: [
                    { time: 8.2 }, { time: 10.5 }, { time: 12.3 },
                    { time: 15.0 }, { time: 18.2 }, { time: 21.4 },
                    { time: 24.7 }, { time: 28.1 }, { time: 33.5 },
                    { time: 45.0 }, { time: 52.3 }, { time: 61.8 }
                ]
            });
        }

        const key = dayNum ? `leaderboard:daily:${dayNum}` : 'leaderboard:global';

        // Fetch top 200 entries (lowest times first)
        const entries = await kv.zrange(key, 0, 199);

        const scores = entries.map(member => {
            const parsed = typeof member === 'string' ? JSON.parse(member) : member;
            return { time: parsed.time };
        });

        return res.status(200).json({ scores });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}
