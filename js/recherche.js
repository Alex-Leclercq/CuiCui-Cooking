// CuiCui Cooking – recherche et filtres de « Mes recettes ». Fonctions pures, sans accès à la page.
// Les filtres ne sont pas enregistrés : ils repartent à zéro à chaque ouverture de l'application.

import { CATEGORIES, STATUTS, lireStatut, majuscule } from "./recette.js";

// { texte, categories: [clé], statuts: [valeur], cuisines: [clé] }.
export const filtresVides = () => ({ texte: "", categories: [], statuts: [], cuisines: [] });

export const nombreFiltres = (filtres) => filtres.categories.length + filtres.statuts.length + filtres.cuisines.length;

// Texte comparable : sans majuscules ni accents, « œ » et « æ » écrits en deux lettres
// (« boeuf » trouve « Bœuf », « creme » trouve « Crème »).
export const normaliser = (texte) => String(texte ?? "").toLocaleLowerCase("fr")
  .replace(/œ/g, "oe").replace(/æ/g, "ae")
  .normalize("NFD").replace(/\p{M}/gu, "");

// Mots d'un texte, coupés aux espaces, apostrophes et tirets (« l'oignon » → « l », « oignon »).
const motsDe = (texte) => normaliser(texte).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export const rechercheActive = (filtres) => motsDe(filtres.texte).length > 0 || nombreFiltres(filtres) > 0;

const texteNettoye = (valeur) => (typeof valeur === "string" && valeur.trim() ? valeur.trim() : null);
const cleCategorie = (recette) => texteNettoye(recette.categorie);
const cleCuisine = (recette) => texteNettoye(recette.cuisine)?.toLocaleLowerCase("fr") ?? null;

// Tout ce que la barre de recherche fouille : nom, ingrédients, chef, livre et mots-clés.
// titresLivres : Map id → titre, pour les livres de l'étagère.
function motsDeRecherche(recette, titresLivres) {
  const source = recette.source ?? {};
  return motsDe([
    recette.nom, recette.chef, source.titre, titresLivres.get(source.livre),
    ...(Array.isArray(recette.ingredients) ? recette.ingredients.map((ingredient) => ingredient?.nom) : []),
    ...(Array.isArray(recette.motsCles) ? recette.motsCles : []),
  ].filter((valeur) => typeof valeur === "string").join(" "));
}

// Recettes { id, recette } qui correspondent à la recherche et aux filtres.
// Chaque mot tapé doit être le début d'un mot de la recette (« carbo » trouve « carbonara »,
// mais « oeuf » ne trouve pas « boeuf »). Dans un même filtre (catégorie, statut, cuisine), une des valeurs
// cochées suffit ; entre deux filtres, la recette doit remplir les deux.
// livres : [{ id, titre }].
export function filtrerRecettes(entrees, filtres, livres = []) {
  const mots = motsDe(filtres.texte);
  const titresLivres = new Map(livres.map((livre) => [livre.id, livre.titre]));
  const accepte = (choisies, cle) => choisies.length === 0 || choisies.includes(cle);
  return entrees.filter(({ recette }) => {
    if (!accepte(filtres.categories, cleCategorie(recette))) return false;
    if (!accepte(filtres.statuts, lireStatut(recette))) return false;
    if (!accepte(filtres.cuisines, cleCuisine(recette))) return false;
    if (!mots.length) return true;
    const motsRecette = motsDeRecherche(recette, titresLivres);
    return mots.every((mot) => motsRecette.some((motRecette) => motRecette.startsWith(mot)));
  });
}

// Valeurs proposées dans le panneau Filtres : seulement celles présentes dans les recettes,
// avec leur nombre de recettes. Catégories dans l'ordre d'un repas, statuts dans l'ordre habituel,
// cuisines par ordre alphabétique.
export function choixDeFiltres(entrees) {
  const compter = (cleDe) => {
    const nombres = new Map();
    for (const { recette } of entrees) {
      const cle = cleDe(recette);
      if (cle) nombres.set(cle, (nombres.get(cle) ?? 0) + 1);
    }
    return nombres;
  };
  const categories = compter(cleCategorie);
  const statuts = compter(lireStatut);
  const cuisines = compter(cleCuisine);
  const ordreCategories = Object.keys(CATEGORIES);
  const rang = (cle) => (ordreCategories.includes(cle) ? ordreCategories.indexOf(cle) : ordreCategories.length);
  return {
    categories: [...categories].sort(([a], [b]) => rang(a) - rang(b) || a.localeCompare(b, "fr"))
      .map(([cle, nombre]) => ({ cle, titre: CATEGORIES[cle] ?? majuscule(cle), nombre })),
    statuts: STATUTS.filter((statut) => statuts.has(statut.valeur))
      .map((statut) => ({ cle: statut.valeur, titre: `${statut.icone} ${statut.libelle}`, nombre: statuts.get(statut.valeur) })),
    cuisines: [...cuisines].sort(([a], [b]) => a.localeCompare(b, "fr"))
      .map(([cle, nombre]) => ({ cle, titre: majuscule(cle), nombre })),
  };
}
