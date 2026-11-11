// CuiCui Cooking – ajout d'une recette en photo.
// Les photos sont déposées dans la boîte « a-traiter/<identifiant>/ » du dépôt des recettes,
// avec un petit fichier demande.json qui les décrit. Claude les transforme ensuite en fiches.

export const DOSSIER_A_TRAITER = "a-traiter";
export const TAILLE_MAX = 1600;  // plus grand côté, en pixels
export const QUALITE_JPEG = 0.85;

// Rôle de chaque photo. La couverture et la page de copyright ne servent que pour un nouveau livre.
export const ROLES = {
  recette: "Page de la recette",
  plat: "Photo du plat",
  copyright: "Page de copyright (ISBN)",
  couverture: "Couverture du livre",
};
export const ROLES_NOUVEAU_LIVRE = ["copyright", "couverture"];

// Dimensions réduites pour que le plus grand côté ne dépasse pas « max » (jamais agrandies).
export function dimensionsReduites(largeur, hauteur, max = TAILLE_MAX) {
  const echelle = Math.min(1, max / Math.max(largeur, hauteur));
  return { largeur: Math.round(largeur * echelle), hauteur: Math.round(hauteur * echelle) };
}

// Identifiant d'un envoi : date et heure locales, puis quelques caractères au hasard
// (deux envois dans la même seconde ne se mélangent pas). Ex. : 2026-11-11-153012-a3f9.
export function identifiantEnvoi(date = new Date(), aleatoire = Math.random) {
  const deux = (nombre) => String(nombre).padStart(2, "0");
  const jour = `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
  const heure = `${deux(date.getHours())}${deux(date.getMinutes())}${deux(date.getSeconds())}`;
  const hasard = Math.floor(aleatoire() * 0x10000).toString(16).padStart(4, "0");
  return `${jour}-${heure}-${hasard}`;
}

// Noms des fichiers selon le rôle : recette-1.jpg, recette-2.jpg, plat.jpg, copyright.jpg…
// Un rôle présent plusieurs fois est numéroté (couverture-1.jpg, couverture-2.jpg).
export function nommerPhotos(roles) {
  const totaux = {};
  for (const role of roles) totaux[role] = (totaux[role] ?? 0) + 1;
  const vus = {};
  return roles.map((role) => {
    vus[role] = (vus[role] ?? 0) + 1;
    return role === "recette" || totaux[role] > 1 ? `${role}-${vus[role]}.jpg` : `${role}.jpg`;
  });
}

// Problème qui empêche l'envoi, ou null si tout est prêt.
// livre : { type: "existant", id, titre } | { type: "nouveau" } | { type: "aucun" }.
export function verifierEnvoi({ roles, livre }) {
  if (!roles.length) return "Ajoutez au moins une photo.";
  if (!roles.includes("recette")) return "Indiquez au moins une page de la recette.";
  if (roles.filter((role) => role === "plat").length > 1) return "Une seule photo du plat, s'il vous plaît.";
  if (livre.type !== "nouveau" && roles.some((role) => ROLES_NOUVEAU_LIVRE.includes(role))) {
    return "La couverture et la page de copyright ne servent que pour un nouveau livre.";
  }
  return null;
}

// Contenu de demande.json : ce que Claude doit savoir pour créer la fiche.
export function creerDemande({ date, livre, page, roles }) {
  const fichiers = nommerPhotos(roles);
  const pageValide = livre.type !== "aucun" && Number.isInteger(page) && page > 0;
  return {
    date: date.toISOString(),
    livre: livre.type === "existant" ? livre.id : null,
    titreLivre: livre.type === "existant" ? livre.titre ?? null : null,
    nouveauLivre: livre.type === "nouveau",
    page: pageValide ? page : null,
    photos: roles.map((role, index) => ({ fichier: fichiers[index], role })),
  };
}

// Description courte d'un envoi, pour la liste des envois (« Simple, p. 42 · 2 photos »).
export function decrireDemande(demande) {
  if (!demande) return "Photos envoyées depuis un autre appareil";
  const livre = demande.nouveauLivre ? "Nouveau livre" : demande.titreLivre ?? (demande.livre ? demande.livre : "Hors livre");
  const page = demande.page ? `, p. ${demande.page}` : "";
  const nombre = demande.photos?.length ?? 0;
  return `${livre}${page} · ${nombre} photo${nombre > 1 ? "s" : ""}`;
}

// Message du commit qui dépose les photos.
export function messageEnvoi(demande) {
  return `Photos à traiter : ${decrireDemande(demande)}`;
}
