// app/actions/export.ts
'use server';

import { checkAndConsumeCredits } from '@/lib/limits';

type ActionResponse = {
    success: boolean;
    error?: string;
};

/**
 * Débite un crédit pour l'export.
 * Cette action doit être appelée par le client AVANT de lancer la génération du CSV.
 */
export async function deductExportCreditAction(userId: string): Promise<ActionResponse> {
    const result = await checkAndConsumeCredits(userId, 'EXPORT');
    
    if (!result.allowed) {
        return { success: false, error: result.error };
    }

    return { success: true };
}