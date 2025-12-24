// app/politique-confidentialite/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-background pb-20 pt-8">
            <div className="container mx-auto p-4 max-w-4xl">
                <h1 className="text-3xl font-bold text-foreground mb-8 border-b border-border pb-4 mt-8">
                    Politique de Confidentialité et Gestion des Cookies (RGPD)
                </h1>

                <div className="space-y-8 text-muted-foreground">
                    <section>
                        <h2 className="text-xl font-bold text-primary mb-3">1. Identité et Contact</h2>
                        <p>Le responsable du traitement des données pour l&apos;application MagicWish est :</p>
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                            <li className="text-foreground font-bold">Responsable : Gaël Montpelier</li>
                            <li className="text-foreground font-bold">Email : magicwish.be.contact@gmail.com</li>
                        </ul>
                    </section>

                    {/* --- NOUVELLE SECTION STRIPE --- */}
                    <section className="bg-primary/5 p-6 rounded-lg border border-primary/20">
                        <h2 className="text-xl font-bold text-primary mb-3">2. Paiements et Données Bancaires (Stripe)</h2>
                        <p className="mb-4 text-foreground">
                            Pour la gestion des abonnements Premium, nous utilisons les services de paiement sécurisés de <strong>Stripe</strong>.
                        </p>
                        <ul className="list-disc list-inside ml-4 space-y-3 text-sm">
                            <li>
                                <strong>Sécurité des données :</strong> MagicWish ne collecte, ne stocke et ne traite <strong>aucune</strong> donnée bancaire complète (numéro de carte, cryptogramme). Ces données sont saisies directement dans le module sécurisé de Stripe.
                            </li>
                            <li>
                                <strong>Partage de données :</strong> Seules les informations strictement nécessaires à la facturation et à la gestion de l&apos;abonnement (adresse email, identifiant utilisateur, statut du paiement) sont partagées avec Stripe.
                            </li>
                            <li>
                                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-primary font-bold">Consulter la politique de confidentialité de Stripe</a>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-primary mb-3">3. Publicité et Cookies Google AdSense</h2>
                        <p className="mb-4 text-foreground">
                            Pour les utilisateurs de la version gratuite, nous utilisons des fournisseurs tiers, y compris Google, pour diffuser des annonces.
                        </p>
                        <ul className="list-disc list-inside ml-4 space-y-3 text-sm">
                            <li>
                                <strong>Cookies publicitaires :</strong> Google utilise des cookies pour diffuser des annonces basées sur vos visites précédentes sur MagicWish ou sur d&apos;autres sites.
                            </li>
                            <li>
                                <strong>Désactivation :</strong> Vous pouvez désactiver la publicité personnalisée dans les <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="underline text-primary font-bold">Paramètres des annonces Google</a>.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-primary mb-3">4. Données Collectées</h2>
                        <p>Nous collectons l&apos;email, le pseudonyme et les listes de cartes pour assurer le service de matching, de gestion de collection et d&apos;échanges.</p>
                    </section>

                    <div className="pt-8 border-t border-border mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs">Dernière mise à jour : 24 Décembre 2025</p>
                        <Link href="/mentions-legales" className="text-xs text-primary hover:underline font-bold">Mentions Légales & CGV</Link>
                    </div>
                </div>
            </div>
        </main>
    );
}