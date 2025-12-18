'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * 1. Définition de l'objet qu'on pousse dans le tableau.
 * Record<string, unknown> remplace 'any' pour un objet générique.
 */
type AdSenseItem = Record<string, unknown>;

/**
 * 2. CORRECTION : On utilise 'type' au lieu d'une interface vide qui étend Array.
 * Cela résout l'erreur "An interface declaring no members is equivalent to its supertype".
 */
type AdSenseArray = AdSenseItem[];

/**
 * 3. Extension de l'objet Window pour inclure AdSense.
 */
interface AdSenseWindow extends Window {
    adsbygoogle?: AdSenseArray;
}

/**
 * 4. Extension locale du type User pour inclure isPremium.
 * Cela permet de typer le cast proprement.
 */
interface UserWithPremium {
    isPremium?: boolean;
}

interface AdContainerProps {
    slot: string;
    format?: 'auto' | 'fluid' | 'rectangle';
    style?: React.CSSProperties;
    isLoading?: boolean;
}

export default function AdContainer({ slot, format = 'auto', style, isLoading }: AdContainerProps) {
    const { user } = useAuth();

    // On utilise un cast sécurisé (via unknown) vers notre type étendu localement
    const isPremium = (user as unknown as UserWithPremium)?.isPremium ?? false;

    useEffect(() => {
        if (!isPremium) {
            try {
                // On caste window proprement
                const adsWindow = window as unknown as AdSenseWindow;
                
                // Si le tableau n'existe pas, on le crée
                if (!adsWindow.adsbygoogle) {
                    adsWindow.adsbygoogle = [];
                }

                // On pousse l'objet vide {}.
                adsWindow.adsbygoogle.push({});
            } catch (err) {
                if (err instanceof Error) {
                    console.error('AdSense error:', err.message);
                }
            }
        }
    }, [isPremium, slot]);

    if (isPremium) {
        return null;
    }

    return (
        <div 
            className={`my-4 flex flex-col items-center w-full overflow-hidden ${
                isLoading 
                ? 'p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm' 
                : ''
            }`}
        >
            {isLoading && (
                <p className="text-xs text-muted-foreground mb-3 italic">
                    Traitement en cours... Merci de patienter durant cette courte publicité.
                </p>
            )}
            <ins
                className="adsbygoogle"
                style={style || { display: 'block' }}
                data-ad-client="ca-pub-5492732016245735"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive="true"
            />
        </div>
    );
}