// CuiCui Cooking – stockage local dans le navigateur (IndexedDB).
// Trois « magasins » :
// - recettes : copie locale des recettes { id, recette, sha } (sha = empreinte du fichier sur GitHub) ;
// - attente  : modifications pas encore envoyées à GitHub, une par recette ;
// - meta     : réglages (dépôt, jeton) et état de la synchronisation ;
// - photos   : photos téléchargées, rangées par empreinte (sha) pour rester disponibles hors ligne.

const VERSION_BASE = 2;

export function ouvrirStockage(nom = "cuicui") {
  return new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(nom, VERSION_BASE);
    demande.onupgradeneeded = () => {
      const base = demande.result;
      const existe = (magasin) => base.objectStoreNames.contains(magasin);
      if (!existe("recettes")) base.createObjectStore("recettes", { keyPath: "id" });
      if (!existe("attente")) base.createObjectStore("attente", { keyPath: "id" });
      if (!existe("meta")) base.createObjectStore("meta");
      if (!existe("photos")) base.createObjectStore("photos");
    };
    demande.onsuccess = () => resoudre(creerStockage(demande.result));
    demande.onerror = () => rejeter(demande.error);
  });
}

function creerStockage(base) {
  // Exécute une action sur un magasin et attend la fin de la transaction.
  function executer(magasin, mode, action) {
    return new Promise((resoudre, rejeter) => {
      const transaction = base.transaction(magasin, mode);
      const demande = action(transaction.objectStore(magasin));
      transaction.oncomplete = () => resoudre(demande?.result);
      transaction.onerror = () => rejeter(transaction.error);
      transaction.onabort = () => rejeter(transaction.error);
    });
  }

  const lire = (magasin, cle) => executer(magasin, "readonly", (m) => m.get(cle));
  const lireTout = (magasin) => executer(magasin, "readonly", (m) => m.getAll());
  const ecrire = (magasin, valeur, cle) => executer(magasin, "readwrite", (m) => m.put(valeur, cle));
  const supprimer = (magasin, cle) => executer(magasin, "readwrite", (m) => m.delete(cle));
  const vider = (magasin) => executer(magasin, "readwrite", (m) => m.clear());

  return {
    lireRecettes: () => lireTout("recettes"),
    lireRecette: (id) => lire("recettes", id),
    ecrireRecette: (entree) => ecrire("recettes", entree),
    supprimerRecette: (id) => supprimer("recettes", id),
    viderRecettes: () => vider("recettes"),

    lireToutesAttentes: () => lireTout("attente"),
    lireAttente: (id) => lire("attente", id),
    ecrireAttente: (operation) => ecrire("attente", operation),
    supprimerAttente: (id) => supprimer("attente", id),

    lireMeta: (cle) => lire("meta", cle),
    ecrireMeta: (cle, valeur) => ecrire("meta", valeur, cle),
    supprimerMeta: (cle) => supprimer("meta", cle),

    lirePhoto: (sha) => lire("photos", sha),
    ecrirePhoto: (sha, photo) => ecrire("photos", photo, sha),

    fermer: () => base.close(),
  };
}
