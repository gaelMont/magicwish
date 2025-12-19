// app/mentions-legales/page.tsx
'use client';

import React from 'react';
import Header from '@/components/Header';

export default function MentionsLegales() {
    return (
        <main className="min-h-screen bg-background pb-20">
            <Header />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 text-foreground border-b border-border pb-4 mt-8">
                    Mentions Légales
                </h1>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">1. Édition du site</h2>
                    <p className="text-muted-foreground mb-4">
                        En vertu de l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique, 
                        il est précisé aux utilisateurs de l&apos;application MagicWish l&apos;identité des différents intervenants dans 
                        le cadre de sa réalisation et de son suivi :
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                        <li><strong>Propriétaire / Éditeur :</strong> Gaël Montpelier</li>
                        <li><strong>Responsable de la publication :</strong> Gaël Montpelier</li>
                        <li><strong>Contact :</strong> magicwish.be.contact@gmail.com</li>
                        <li><strong>Webmaster :</strong> MagicWish Tech Team</li>
                    </ul>
                </section>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">2. Hébergement</h2>
                    <p className="text-muted-foreground">
                        Le site est hébergé par la société <strong>Vercel Inc.</strong>, située au 340 S Lemon Ave #1192, Walnut, CA 91789, USA. 
                        Contact : https://vercel.com.
                    </p>
                </section>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">3. Propriété intellectuelle</h2>
                    <p className="text-muted-foreground mb-4">
                        MagicWish est une application indépendante. Les visuels des cartes, les noms, les symboles de rareté et 
                        les textes des cartes sont la propriété de <strong>Wizards of the Coast LLC</strong> (filiale de Hasbro, Inc.). 
                        MagicWish n&apos;est pas affilié, approuvé ou parrainé par Wizards of the Coast.
                    </p>
                    <p className="text-muted-foreground">
                        La structure générale, les textes, les logos propres à MagicWish et le code source de l&apos;application 
                        sont la propriété exclusive de l&apos;éditeur. Toute reproduction totale ou partielle est interdite.
                    </p>
                </section>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">4. Limitation de responsabilité</h2>
                    <p className="text-muted-foreground">
                        MagicWish s&apos;efforce de fournir des informations précises (prix Scryfall, base de données). Cependant, 
                        l&apos;éditeur ne pourra être tenu responsable des omissions ou des lacunes dans la mise à jour des prix 
                        ou des données de cartes provenant de sources tierces.
                    </p>
                </section>
                
                <p className="text-xs text-muted-foreground text-center mt-12">
                    Dernière mise à jour : 19 Décembre 2025
                </p>
            </div>
        </main>
    );
}