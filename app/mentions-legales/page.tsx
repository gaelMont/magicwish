// app/mentions-legales/page.tsx
'use client';

import React from 'react';

export default function MentionsLegales() {
    return (
        <main className="min-h-screen bg-background pb-20 pt-8">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 text-foreground border-b border-border pb-4 mt-8">
                    Mentions Légales
                </h1>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">1. Édition du site</h2>
                    <p className="text-muted-foreground mb-4">
                        En vertu de l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004, l&apos;identité des intervenants est précisée :
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                        <li><strong>Propriétaire / Éditeur :</strong> Gaël Montpelier</li>
                        <li><strong>Contact :</strong> magicwish.be.contact@gmail.com</li>
                    </ul>
                </section>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">2. Hébergement</h2>
                    <p className="text-muted-foreground">Site hébergé par <strong>Vercel Inc.</strong>, USA.</p>
                </section>
                
                <p className="text-xs text-muted-foreground text-center mt-12">Dernière mise à jour : 19 Décembre 2025</p>
            </div>
        </main>
    );
}