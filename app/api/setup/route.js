import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { kv } from '@vercel/kv';

export async function GET() {
    try {
        const username = (process.env.SUPER_ADMIN_USER || 'admin').toLowerCase();
        const pass = process.env.SUPER_ADMIN_PASS || 'changeme123';

        const passwordHash = await bcrypt.hash(pass, 12);
        const id = randomUUID();
        const admin = {
            id,
            username,
            passwordHash,
            createdAt: Math.floor(Date.now() / 1000),
            active: true,
        };

        // Clear old admin keys
        const oldIds = await kv.smembers('admins');
        for (const oldId of (oldIds || [])) {
            const oldAdmin = await kv.get(`admin:${oldId}`);
            if (oldAdmin?.username) {
                await kv.del(`admin:u:${oldAdmin.username}`);
            }
            await kv.del(`admin:${oldId}`);
        }
        await kv.del('admins');

        // Save new admin
        await kv.set(`admin:${id}`, admin);
        await kv.set(`admin:u:${username}`, id);
        await kv.sadd('admins', id);

        return NextResponse.json({
            success: true,
            message: `Admin created: username="${username}"`,
            note: 'Delete this route after first login!',
        });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
