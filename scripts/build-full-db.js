// scripts/build-full-db.js
/* eslint-disable */
const fs = require('fs');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');

// --- CONFIGURATION ---
// "unique_artwork" est le meilleur choix : une entrée par dessin unique.
// Cela évite de scanner 10 fois la même carte "Sol Ring" si le dessin est identique.
const BULK_TYPE = 'unique_artwork'; 
const OUTPUT_FILE = 'public/card-hashes.json';

// --- ALGORYTHME DE HACHAGE (dHash) ---
function computeDHash(image) {
    const size = 9; 
    const canvas = createCanvas(size, size - 1);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(image, 0, 0, size, size - 1);
    const imageData = ctx.getImageData(0, 0, size, size - 1);
    const data = imageData.data;

    let hash = '';
    for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
            const i = (y * size + x) * 4;
            const j = (y * size + (x + 1)) * 4;
            const left = (data[i] + data[i+1] + data[i+2]) / 3;
            const right = (data[j] + data[j+1] + data[j+2]) / 3;
            hash += (left > right ? '1' : '0');
        }
    }
    return BigInt('0b' + hash).toString(16);
}

// --- UTILITAIRES RÉSEAU ---
async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'MagicWishBuilder/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        });
    });
}

async function main() {
    console.log("📡 Connexion à l'API Scryfall Bulk Data...");
    
    // 1. Récupérer l'URL du dernier fichier Bulk
    const bulkIndex = await fetchJson('https://api.scryfall.com/bulk-data');
    const targetBulk = bulkIndex.data.find(d => d.type === BULK_TYPE);
    
    if (!targetBulk) throw new Error(`Type ${BULK_TYPE} introuvable.`);
    
    console.log(`⬇️ Téléchargement de la liste : ${targetBulk.download_uri}`);
    
    // 2. Télécharger le gros JSON
    // Note : Pour la prod, on devrait streamer le fichier, mais pour < 500Mo ça passe en mémoire Node.js
    const allCards = await fetchJson(targetBulk.download_uri);
    
    console.log(`📦 ${allCards.length} cartes chargées en mémoire.`);
    
    const database = [];
    let processed = 0;
    
    // 3. Boucle de traitement
    for (const card of allCards) {
        
        // --- FILTRE DE TEST (A retirer pour la version finale) ---
        // On ne traite que les cartes sorties après 2023 pour que le script finisse vite
        const year = new Date(card.released_at).getFullYear();
        if (year < 2023) continue; 
        // --------------------------------------------------------

        // On ignore les cartes sans image (textless, placeholder...)
        if (!card.image_uris || !card.image_uris.small) continue;

        try {
            // Téléchargement de l'image (Petit format pour aller vite)
            const img = await loadImage(card.image_uris.small);
            
            // Calcul de l'empreinte
            const hash = computeDHash(img);
            
            // On stocke le minimum vital pour que le fichier JSON final soit léger
            database.push({
                h: hash,       
                n: card.name, 
                s: card.set,   
                cn: card.collector_number,
                id: card.id    
            });

            processed++;
            if (processed % 50 === 0) process.stdout.write(`\r🔨 Traité : ${processed} cartes...`);
            
        } catch (e) {
            // Parfois une image échoue, on continue
        }
    }

    console.log(`\n✅ Terminé ! Base de données générée avec ${database.length} cartes.`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database));
    console.log(`💾 Fichier sauvegardé : ${OUTPUT_FILE}`);
}

main();