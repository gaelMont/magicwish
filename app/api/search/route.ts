// app/api/search/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q'); 

  if (!query) {
    return NextResponse.json(
      { error: 'Aucun terme de recherche fourni.' }, 
      { status: 400 } 
    );
  }

  // --- MODIFICATION ICI : Ajout des guillemets "${query}" ---
  // Cela force la recherche exacte de l'expression
  const scryfallUrl = `https://api.scryfall.com/cards/search?q="${query}"&unique=prints`;

  try {
    const scryfallResponse = await fetch(scryfallUrl);

    if (!scryfallResponse.ok) {
      const errorData = await scryfallResponse.json();
      console.error('Erreur Scryfall:', errorData);
      return NextResponse.json(
        { error: errorData.details || 'Carte non trouvée' }, 
        { status: scryfallResponse.status }
      );
    }

    const data = await scryfallResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Erreur interne du serveur:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue sur le serveur.' }, 
      { status: 500 }
    );
  }
}