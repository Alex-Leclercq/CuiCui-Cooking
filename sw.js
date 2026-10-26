// CuiCui Cooking – service worker : rend l'application utilisable hors ligne.
// Changer CACHE à chaque version pour que les téléphones récupèrent
// les nouveaux fichiers.

const CACHE = "cuicui-v0.5.0";

const FICHIERS_APPLICATION = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/stockage.js",
  "js/github.js",
  "js/synchro.js",
  "js/recette.js",
  "manifest.webmanifest",
  "icones/icone.svg",
  "icones/icone-192.png",
  "icones/icone-512.png",
];

self.addEventListener("install", (evenement) => {
  // cache: "reload" : toujours télécharger les fichiers depuis le serveur. Sinon le navigateur
  // peut resservir d'anciens fichiers depuis son propre cache (10 min sur GitHub Pages) et la
  // nouvelle version contiendrait l'ancien code.
  const requetes = FICHIERS_APPLICATION.map((fichier) => new Request(fichier, { cache: "reload" }));
  evenement.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requetes)));
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom)))
    )
  );
  self.clients.claim();
});

// Fichiers de l'application : d'abord le cache, sinon le réseau.
// Les autres requêtes (API GitHub plus tard) passent directement par le réseau.
self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET" || new URL(requete.url).origin !== self.location.origin) {
    return;
  }
  evenement.respondWith(
    caches.match(requete, { ignoreSearch: true }).then((reponse) => reponse || fetch(requete))
  );
});
