// app/mentions-legales/page.tsx
'use client';

import React from 'react';

export default function MentionsLegales() {
    return (
        <main className="min-h-screen bg-background pb-20 pt-8">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 text-foreground border-b border-border pb-4 mt-8">
                    Mentions Légales & CGV
                </h1>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">1. Édition du site</h2>
                    <p className="text-muted-foreground mb-4">
                        En vertu de l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique, 
                        il est précisé aux utilisateurs du site <strong>www.magicwish.be</strong> (l&apos;application) l&apos;identité des différents intervenants :
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                        <li><strong>URL du site :</strong> https://www.magicwish.be</li>
                        <li><strong>Propriétaire / Éditeur :</strong> Gaël Montpelier</li>
                        <li><strong>Contact :</strong> magicwish.be.contact@gmail.com</li>
                    </ul>
                </section>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">2. Hébergement</h2>
                    <p className="text-muted-foreground">
                        Le site est hébergé par la société <strong>Vercel Inc.</strong>, située au 340 S Lemon Ave #1192, Walnut, CA 91789, USA. 
                        <br />Contact : https://vercel.com.
                    </p>
                </section>

                {/* SECTION OBLIGATOIRE SI TU VENDS DU PREMIUM */}
                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">3. Conditions Générales de Vente (Service Premium)</h2>
                    <div className="text-muted-foreground space-y-4">
                        <p>
                            MagicWish propose un abonnement optionnel &quot;Premium&quot; permettant de lever les limites de création de listes et d&apos;accéder aux outils de manière illimitée.
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Prix :</strong> 1,00 € TTC par mois.</li>
                            <li><strong>Paiement :</strong> Sécurisé via Stripe. Aucune donnée bancaire n&apos;est conservée par MagicWish.</li>
                            <li><strong>Durée et Résiliation :</strong> Abonnement mensuel sans engagement, renouvelable tacitement. L&apos;utilisateur peut résilier à tout moment depuis son espace Stripe (accessible via les paramètres ou le mail de confirmation), l&apos;accès Premium restant actif jusqu&apos;à la fin de la période payée.</li>
                            <li><strong>Remboursement :</strong> Compte tenu de la nature numérique immédiate du service, aucun remboursement n&apos;est effectué pour le mois entamé, sauf obligation légale contraire.</li>
                        </ul>
                    </div>
                </section>

                <section className="mb-8 p-6 bg-surface rounded-xl border border-border shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-primary">4. Propriété intellectuelle</h2>
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
                    <h2 className="text-xl font-bold mb-4 text-primary">5. Limitation de responsabilité</h2>
                    <p className="text-muted-foreground">
                        MagicWish s&apos;efforce de fournir des informations précises (prix Scryfall, base de données). Cependant, 
                        l&apos;éditeur ne pourra être tenu responsable des omissions ou des lacunes dans la mise à jour des prix 
                        ou des données de cartes provenant de sources tierces.
                    </p>
                </section>
                
                <p className="text-xs text-muted-foreground text-center mt-12">
                    Dernière mise à jour : 24 Décembre 2025
                </p>
            </div>
        </main>
    );
}