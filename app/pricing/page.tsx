// app/pricing/page.tsx
import Link from 'next/link';
import { Check, Zap, Infinity } from 'lucide-react';
import StripeButton from '@/components/StripeButton'; // Import du composant partagé

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Passez au niveau supérieur
          </h1>
          <p className="mt-4 text-xl text-slate-600">
            Libérez tout le potentiel de votre collection pour le prix d&apos;un café.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plan Gratuit */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col relative overflow-hidden">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Découverte</h3>
              <p className="text-slate-500 mt-2">Pour gérer l&apos;essentiel.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-slate-900">Gratuit</span>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                <span className="text-slate-600">1 Collection Principale</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                <span className="text-slate-600">1 Wishlist Générale</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                <span className="text-slate-600">5 Crédits / jour</span>
              </li>
              <li className="flex items-start">
                <Zap className="w-5 h-5 text-amber-500 mr-3 shrink-0" />
                <span className="text-slate-600">Scanner de match (coût: 1 crédit)</span>
              </li>
              <li className="flex items-start">
                <Zap className="w-5 h-5 text-amber-500 mr-3 shrink-0" />
                <span className="text-slate-600">Import / Export (coût: 1 crédit)</span>
              </li>
            </ul>

            <Link 
              href="/"
              className="block w-full py-3 px-4 bg-slate-100 text-slate-700 font-medium text-center rounded-lg hover:bg-slate-200 transition-colors"
            >
              Retour à l&apos;accueil
            </Link>
          </div>

          {/* Plan Premium */}
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 flex flex-col relative overflow-hidden">
            
     

            <div className="mb-4">
              <h3 className="text-xl font-semibold text-white">Premium</h3>
              <p className="text-slate-400 mt-2">Zéro limite, zéro contrainte.</p>
            </div>
            <div className="mb-6 flex items-baseline">
              <span className="text-4xl font-bold text-white">1€</span>
              <span className="text-slate-400 ml-2">/ mois</span>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-start">
                <Infinity className="w-5 h-5 text-blue-400 mr-3 shrink-0" />
                <span className="text-slate-200 font-bold">Collections Illimitées</span>
              </li>
              <li className="flex items-start">
                <Infinity className="w-5 h-5 text-blue-400 mr-3 shrink-0" />
                <span className="text-slate-200 font-bold">Wishlists Illimitées</span>
              </li>
              <li className="flex items-start">
                <Infinity className="w-5 h-5 text-blue-400 mr-3 shrink-0" />
                <span className="text-slate-200 font-bold">Crédits Illimités</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-blue-400 mr-3 shrink-0" />
                <span className="text-slate-300">Scanner illimité</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-blue-400 mr-3 shrink-0" />
                <span className="text-slate-300">Imports & Exports illimités</span>
              </li>
            </ul>

            {/* UTILISATION DU COMPOSANT PARTAGÉ */}
            <StripeButton 
                className="block w-full py-3 px-4 bg-blue-600 text-white font-medium text-center rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
            >
                Passer Premium (1€)
            </StripeButton>

            <p className="text-center text-xs text-slate-500 mt-4">
              Paiement sécurisé via Stripe. Annulation à tout moment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}