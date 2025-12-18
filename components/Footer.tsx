import React from 'react';
import Link from 'next/link';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full border-t border-border bg-card/50 mt-auto">
            <div className="container mx-auto px-4 py-12">
                {/* Utilisation de 4 colonnes sur Desktop :
                   - Colonne 1 & 2 (span-2) : Marque + Description (prend la moitié de la largeur)
                   - Colonne 3 : Liens Légaux
                   - Colonne 4 : Disclaimer WotC
                */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12 mb-8">
                    
                    {/* Bloc Marque : Prend 2 colonnes sur 4 */}
                    <div className="md:col-span-2 flex flex-col gap-4">
                        <div>
                            <h3 className="font-bold text-xl text-primary flex items-center gap-2">
                                MagicWish
                            </h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
                                L&apos;outil de référence pour gérer vos collections de cartes Magic: The Gathering. 
                                trouvez facilement les cartes que vous cherchez dans les collections de vos amis !
                            </p>
                        </div>
                    </div>

                    {/* Bloc Liens : Prend 1 colonne */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-foreground">Informations</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/mentions-legales" className="hover:text-primary transition-colors">
                                    Mentions Légales
                                </Link>
                            </li>
                            <li>
                                <Link href="/politique-confidentialite" className="hover:text-primary transition-colors">
                                    Politique de Confidentialité
                                </Link>
                            </li>
                            <li>
                                <Link href="/politique-confidentialite" className="hover:text-primary transition-colors">
                                    Gestion des Cookies
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Bloc Disclaimer : Prend 1 colonne */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-foreground">Droits d&apos;auteur</h3>
                        <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                            <p>
                                Magic: The Gathering est une marque déposée de Wizards of the Coast LLC.
                            </p>
                            <p>
                                MagicWish n&apos;est pas affilié, approuvé ou sponsorisé par Wizards of the Coast.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Barre de copyright en bas */}
                <div className="border-t border-border pt-6 mt-2 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
                    <p>© {currentYear} MagicWish Project. Tous droits réservés.</p>
                    <div className="flex items-center gap-4">
                        <span>Fait avec passion en Belgique 🇧🇪</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}