// app/api/search/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q'); 

  if (!query) {
    return NextResponse.json({ error: 'Recherche vide' }, { status: 400 });
  }

  // CHANGEMENT ICI : 'unique=prints' pour avoir toutes les éditions
  const scryfallUrl = `https://api.scryfall.com/cards/search?q=${query}&unique=prints`;

  try {
    const scryfallResponse = await fetch(scryfallUrl);
    // ... le reste du code ne change pas
    if (!scryfallResponse.ok) {
        // ...
        return NextResponse.json({ error: 'Erreur' }, { status: 400 });
    }
    const data = await scryfallResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}