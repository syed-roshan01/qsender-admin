import { NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/kv';
import { validateKey } from '@/lib/license';

// PUBLIC endpoint – called by the QSender desktop app on startup / activation
export async function POST(req) {
    try {
        const { key, machineId } = await req.json();

        if (!key || !machineId)
            return NextResponse.json({ valid: false, error: 'key and machineId required' });

        const cleanKey = key.trim().toUpperCase();
        const cleanMid = machineId.trim().toUpperCase().replace(/[-\s]/g, '');

        const license = await getLicense(cleanKey);
        if (!license)
            return NextResponse.json({ valid: false, error: 'Key not registered' });
        if (license.revoked)
            return NextResponse.json({ valid: false, error: 'Key has been revoked' });

        const primaryCrypto = validateKey(cleanKey, cleanMid);
        let cryptoResult = primaryCrypto;
        let usedExceptionFallback = false;

        if ((!cryptoResult || !cryptoResult.valid) && license.validationException === true) {
            const storedMid = (license.machineId || '').trim().toUpperCase();
            const fallbackCrypto = validateKey(cleanKey, storedMid);
            if (fallbackCrypto?.valid) {
                cryptoResult = fallbackCrypto;
                usedExceptionFallback = true;
            }
        }

        if (!cryptoResult)
            return NextResponse.json({ valid: false, error: 'Invalid key signature' });
        if (!cryptoResult.valid)
            return NextResponse.json({ valid: false, error: 'Key expired' });

        const now = Math.floor(Date.now() / 1000);
        let updatedLicense = license;

        if (!license.activated) {
            updatedLicense = { ...updatedLicense, activated: true, activatedAt: now };
        }
        if (usedExceptionFallback && license.exceptionBoundMachineId !== cleanMid) {
            updatedLicense = { ...updatedLicense, exceptionBoundMachineId: cleanMid };
        }
        if (updatedLicense !== license) {
            await saveLicense(updatedLicense);
        }

        const secondsLeft = cryptoResult.isLifetime ? null : Math.max(0, cryptoResult.expiryTs - now);
        const daysLeft    = cryptoResult.isLifetime ? 9999 : Math.floor((secondsLeft ?? 0) / 86400);

        return NextResponse.json({
            valid:       true,
            plan:        license.plan,
            deviceLimit: cryptoResult.deviceLimit,
            isLifetime:  cryptoResult.isLifetime,
            daysLeft,
            secondsLeft,
            expiry:      cryptoResult.isLifetime ? null : new Date(cryptoResult.expiryTs * 1000).toISOString(),
            features:    license.features || null,
        });
    } catch (err) {
        console.error('Validate error:', err);
        return NextResponse.json({ valid: false, error: 'Server error' });
    }
}
