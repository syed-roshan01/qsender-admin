import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'Qsd$7mKp9xLv2WnBd5tYs6hJfQe1cR8uAoVz3TGw';

// Key format: QSD-{expiryHex8}-{hmac6+deviceHex2}-{hmac8}-{hmac8}
export function generateKey({ machineId, expiryTs, deviceLimit }) {
    const expiryHex = expiryTs.toString(16).toUpperCase().padStart(8, '0');
    const dl = Math.min(255, Math.max(1, Math.floor(deviceLimit)));
    const deviceHex = dl.toString(16).toUpperCase().padStart(2, '0');
    const payload = `QSD|${machineId.toUpperCase()}|${expiryHex}|${deviceHex}`;
    const hmac = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(payload)
        .digest('hex')
        .toUpperCase();
    const p2 = hmac.slice(0, 6) + deviceHex;  // hmac-first, device-last
    const p3 = hmac.slice(6, 14);
    const p4 = hmac.slice(14, 22);
    return `QSD-${expiryHex}-${p2}-${p3}-${p4}`;
}

export function validateKey(key, machineId) {
    if (!key || typeof key !== 'string') return null;
    const clean = key.trim().toUpperCase().replace(/\s/g, '');
    const parts = clean.split('-');
    if (parts.length !== 5 || parts[0] !== 'QSD') return null;
    const [, p1, p2, p3, p4] = parts;
    if (p1.length !== 8 || p2.length !== 8 || p3.length !== 8 || p4.length !== 8) return null;
    const expiryHex = p1;
    const deviceHex = p2.slice(6, 8);  // device-last in p2
    const hmacGiven = (p2.slice(0, 6) + p3 + p4).toUpperCase();
    const payload = `QSD|${machineId.toUpperCase()}|${expiryHex}|${deviceHex}`;
    const expected = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(payload)
        .digest('hex')
        .toUpperCase();
    if (expected.slice(0, 22) !== hmacGiven) return null;
    const expiryTs = parseInt(expiryHex, 16);
    const deviceLimit = parseInt(deviceHex, 16);
    const isLifetime = expiryTs === 0xFFFFFFFF;
    const valid = isLifetime || expiryTs > Math.floor(Date.now() / 1000);
    return { expiryTs, deviceLimit, valid, isLifetime };
}

export function planToExpiry(plan, customDays = 0) {
    if (plan === 'lifetime') return 0xFFFFFFFF;
    const days = {
        trial1day: 1,
        trial:     3,
        weekly:    7,
        monthly:   30,
        '3months': 90,
        '6months': 180,
        yearly:    365,
        custom:    Math.max(1, parseInt(customDays) || 1),
    }[plan] ?? 30;
    return Math.floor(Date.now() / 1000) + days * 86400;
}

export const PLAN_OPTIONS = [
    { value: 'trial1day', label: 'Trial (1 day)'        },
    { value: 'trial',     label: 'Trial (3 days)'       },
    { value: 'weekly',    label: 'Weekly (7 days)'      },
    { value: 'monthly',   label: 'Monthly (30 days)'    },
    { value: '3months',   label: '3 Months (90 days)'   },
    { value: '6months',   label: '6 Months (180 days)'  },
    { value: 'yearly',    label: 'Yearly (365 days)'    },
    { value: 'lifetime',  label: 'Lifetime'             },
    { value: 'custom',    label: 'Custom (specify days)'},
];

export const PLAN_COLORS = {
    trial1day: '#f59e0b',
    trial:     '#f59e0b',
    weekly:    '#3b82f6',
    monthly:   '#4a9eff',
    '3months': '#06b6d4',
    '6months': '#8b5cf6',
    yearly:    '#25D366',
    lifetime:  '#7c3aed',
    custom:    '#94a3b8',
};
