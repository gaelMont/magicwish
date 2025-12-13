// app/politique-confidentialite/page.tsx
'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {

    return (
        <main className="container mx-auto p-4 max-w-4xl min-h-[80vh]">
            <h1 className="text-3xl font-bold text-foreground mb-8 border-b border-border pb-4">
                Politique de Confidentialité (RGPD)
            </h1>

            <div className="space-y-8 text-muted">

                <div>
                    <h2 className="text-xl font-bold text-primary mb-3">1. Identité et Contact du Responsable de Traitement</h2>
                    <p>Le responsable du traitement des données à caractère personnel est :</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li className="text-foreground font-semibold">Contact : [à completer]</li>
                    </ul>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-primary mb-3">2. Données Collectées, Finalités et Bases Légales</h2>
                    <p>Nous collectons les données suivantes, nécessaires au bon fonctionnement de l&apos;application :</p>
                    <div className="space-y-4 mt-3">
                        
                        <h3 className="text-lg font-semibold text-foreground">2.1. Données d&apos;Identification et de Profil</h3>
                        <ul className="list-disc list-inside ml-6 space-y-2">
                            <li>
                                <strong>Données :</strong> Adresse email, UID (identifiant unique Firebase), Nom d&apos;affichage, Nom d&apos;utilisateur unique (@pseudo), Photo d&apos;avatar.
                                <br />
                                <strong>Finalité :</strong> Identification, authentification, personnalisation du profil utilisateur et du scanner d&apos;échanges.
                                <br />
                                <strong>Base Légale :</strong> Exécution du contrat (fourniture du service).
                            </li>
                        </ul>

                        <h3 className="text-lg font-semibold text-foreground">2.2. Données de Contenu et d&apos;Activité</h3>
                        <ul className="list-disc list-inside ml-6 space-y-2">
                            <li>
                                <strong>Données :</strong> Collections de cartes, Wishlists multiples, statut des cartes (Foil, à l&apos;échange, customPrice), historique des propositions et des échanges acceptés/refusés.
                                <br />
                                <strong>Finalité :</strong> Permettre la gestion de la collection et l&apos;exécution du service d&apos;échange et de matching.
                                <br />
                                <strong>Base Légale :</strong> Exécution du contrat (service principal de l&apos;Application).
                            </li>
                        </ul>

                        <h3 className="text-lg font-semibold text-foreground">2.3. Données de Paiement (Abonnement Premium)</h3>
                        <ul className="list-disc list-inside ml-6 space-y-2">
                            <li>
                                <strong>Données :</strong> ID client Stripe (stripeCustomerId), ID d&apos;abonnement Stripe (stripeSubscriptionId), statut Premium (isPremium).
                                <br />
                                <strong>Finalité :</strong> Gestion des abonnements Premium, facturation et accès aux fonctionnalités sans publicité.
                                <br />
                                <strong>Base Légale :</strong> Exécution du contrat (abonnement).
                            </li>
                        </ul>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-primary mb-3">3. Destinataires et Transfert de Données</h2>
                    <p>Vos données sont transmises aux tiers suivants, uniquement dans la mesure où cela est strictement nécessaire :</p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        <li>
                            <strong>Firebase/Google (Authentification et Base de données) :</strong> Pour le stockage sécurisé de votre profil et de vos données de collection.
                        </li>
                        <li>
                            <strong>Stripe, Inc. :</strong> Pour le traitement sécurisé de vos paiements d&apos;abonnement Premium. Nous ne stockons jamais vos informations de carte bancaire.
                        </li>
                        <li>
                            <strong>Google AdSense :</strong> Pour l&apos;affichage de publicités. AdSense utilise des cookies publicitaires et des identifiants (sous réserve de votre consentement via le CMP).
                        </li>
                        <li>
                            <strong>Utilisateurs (Profil Public) :</strong> Votre nom d&apos;affichage, pseudo, avatar, collection, et wishlist sont visibles par vos amis et par la fonction de recherche.
                        </li>
                    </ul>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-primary mb-3">4. Conservation des Données</h2>
                    <p>Vos données de profil et de collection sont conservées tant que vous maintenez un compte actif sur MagicWish. En cas de suppression de votre compte, vos données personnelles et de collection seront effacées de nos serveurs, sous réserve des obligations légales de conservation (ex: facturation Stripe).</p>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-primary mb-3">5. Vos Droits RGPD</h2>
                    <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants concernant vos données :</p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        <li>Droit d&apos;accès (savoir quelles données nous détenons)</li>
                        <li>Droit de rectification (corriger les données erronées)</li>
                        <li>Droit à l&apos;effacement (demander la suppression de vos données)</li>
                        <li>Droit à la limitation du traitement</li>
                        <li>Droit d&apos;opposition</li>
                        <li>Droit à la portabilité (récupérer vos données)</li>
                    </ul>
                    <p className="mt-4 text-sm">Pour exercer ces droits, veuillez nous contacter par email à : [Votre adresse email de contact].</p>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-primary mb-3">6. Cookies et Gestion du Consentement</h2>
                    <p>L&apos;Application utilise des cookies fonctionnels. L&apos;utilisation de cookies tiers à des fins publicitaires (Google AdSense) est soumise à votre consentement préalable, recueilli via un outil de gestion du consentement (CMP).</p>
                </div>
                
                {/* Lien vers les Mentions Légales */}
                <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted">
                        Dernière mise à jour : 13 Décembre 2025. Consultez également nos <Link href="/mentions-legales" className="text-primary hover:underline">Mentions Légales</Link>.
                    </p>
                </div>
            </div>
        </main>
    );
}