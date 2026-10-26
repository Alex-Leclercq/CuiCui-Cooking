// CuiCui Cooking – service worker : rend l'application utilisable hors ligne.
// Changer CACHE à chaque version pour que les téléphones récupèrent
// les nouveaux fichiers.

const CACHE = "cuicui-v0.2.0";

const FICHIERS_APPLICATION = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/stockage.js",
  "js/github.js",
  "js/synchro.js",
  "manifest.webmanifest",
  "icones/icone.svg",
  "icones/icone-192.png",
  "icones/icone-512.png",
];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS_APPLICATION))
  );
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
