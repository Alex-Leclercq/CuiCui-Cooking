// CuiCui Cooking – liste de courses. Fonctions pures, sans accès à la page.
// La liste ne garde que les recettes choisies (et leur nombre de personnes) et les articles cochés :
// les ingrédients sont recalculés à partir des recettes, donc toujours à jour après une synchronisation.
// Elle reste sur le téléphone (magasin « meta »), elle n'est pas envoyée à GitHub.

import { formaterIngredient, ingredientsPour, nombrePersonnes } from "./recette.js";

// { recettes: [{ id, personnes }], coches: [clé d'article] }. personnes : null si la recette n'a pas de portions.
export const listeVide = () => ({ recettes: [], coches: [] });

// Liste lue dans le stockage, quelle qu'elle soit (absente, ancienne, abîmée).
export function normaliserListe(valeur) {
  const recettes = Array.isArray(valeur?.recettes)
    ? valeur.recettes.filter((choix) => typeof choix?.id === "string")
      .map(({ id, personnes }) => ({ id, personnes: Number.isInteger(personnes) && personnes > 0 ? personnes : null }))
    : [];
  const coches = Array.isArray(valeur?.coches) ? valeur.coches.filter((cle) => typeof cle === "string") : [];
  return { recettes, coches };
}

// Nombre de personnes d'origine d'une recette, ou null si elle n'en indique pas.
export const portionsOrigine = (recette) =>
  (Number.isInteger(recette?.portions) && recette.portions > 0 ? recette.portions : null);

// Ajoute une recette, ou change son nombre de personnes si elle est déjà dans la liste.
export function ajouterALaListe(liste, id, personnes) {
  const choix = { id, personnes: personnes ?? null };
  const dejaLa = liste.recettes.some((recette) => recette.id === id);
  return {
    ...liste,
    recettes: dejaLa ? liste.recettes.map((recette) => (recette.id === id ? choix : recette)) : [...liste.recettes, choix],
  };
}

export const retirerDeLaListe = (liste, id) =>
  ({ ...liste, recettes: liste.recettes.filter((recette) => recette.id !== id) });

export function cocherArticle(liste, cle, coche) {
  const coches = liste.coches.filter((autre) => autre !== cle);
  return { ...liste, coches: coche ? [...coches, cle] : coches };
}

// ---- Addition des ingrédients ----
// Même nom et même famille d'unité : les quantités s'additionnent (200 g + 0,5 kg de farine = 700 g).
// Des unités différentes (2 oignons et 100 g d'oignon) restent sur deux lignes, l'une sous l'autre.

const MASSES = { g: 1, kg: 1000 };
const VOLUMES = { ml: 1, cl: 10, l: 1000 };
const famille = (unite) => (unite in MASSES ? "masse" : unite in VOLUMES ? "volume" : unite ?? "piece");
const nomNormalise = (nom) => String(nom ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
const arrondi = (valeur) => Math.round(valeur * 100) / 100;

// Total en grammes ou millilitres → quantité et unité lisibles.
function enUnite(total, familleUnite, unites) {
  if (familleUnite === "masse") return total >= 1000 ? { quantite: arrondi(total / 1000), unite: "kg" } : { quantite: arrondi(total), unite: "g" };
  if (familleUnite === "volume") {
    if (total >= 1000) return { quantite: arrondi(total / 1000), unite: "l" };
    return unites.has("ml") && !unites.has("cl") && !unites.has("l")
      ? { quantite: arrondi(total), unite: "ml" }
      : { quantite: arrondi(total / 10), unite: "cl" };
  }
  return { quantite: arrondi(total), unite: [...unites][0] ?? null };
}

const parNom = (a, b) => a.nom.localeCompare(b.nom, "fr") || a.cle.localeCompare(b.cle, "fr");

// Liste à afficher, à partir des choix et des recettes du téléphone (Map id → recette).
// - articles : ingrédients additionnés, à acheter ; les cochés à la fin ;
// - placards : ingrédients sans quantité (sel, poivre…), une seule fois chacun, à vérifier ;
// - recettes : les recettes de la liste, avec leur nombre de personnes ;
// - introuvables : identifiants de recettes qui ne sont plus sur le téléphone.
// La clé d'un article contient sa quantité : s'il en faut davantage (recette ajoutée,
// personnes en plus), l'article coché redevient à acheter.
export function construireListe(liste, recettesParId) {
  const totaux = new Map();
  const sansQuantite = new Map();
  const recettes = [];
  const introuvables = [];

  for (const choix of liste.recettes) {
    const recette = recettesParId.get(choix.id);
    if (!recette) {
      introuvables.push(choix.id);
      continue;
    }
    const origine = portionsOrigine(recette);
    const personnes = origine ? choix.personnes ?? origine : null;
    recettes.push({ id: choix.id, nom: String(recette.nom ?? choix.id), personnes, origine });

    for (const ingredient of ingredientsPour(recette, personnes)) {
      const nom = nomNormalise(ingredient.nom);
      if (!nom) continue;
      if (!Number.isFinite(ingredient.quantite) || ingredient.quantite <= 0) {
        sansQuantite.set(nom, ingredient.nom.trim());
        continue;
      }
      const unite = ingredient.unite || null;
      const cle = `${nom}|${famille(unite)}`;
      if (!totaux.has(cle)) totaux.set(cle, { nom, total: 0, unites: new Set(), approximatif: false });
      const total = totaux.get(cle);
      total.total += ingredient.quantite * (MASSES[unite] ?? VOLUMES[unite] ?? 1);
      total.unites.add(unite);
      total.approximatif ||= ingredient.approximatif === true;
    }
  }

  const coches = new Set(liste.coches);
  const articles = [...totaux].map(([cleNom, { nom, total, unites, approximatif }]) => {
    const { quantite, unite } = enUnite(total, cleNom.split("|")[1], unites);
    const cle = `${cleNom}|${quantite}|${unite ?? ""}`;
    return { cle, nom, texte: formaterIngredient({ quantite, unite, nom, approximatif }), coche: coches.has(cle) };
  });
  const dejaAchetes = new Set(articles.map((article) => article.nom));
  const placards = [...sansQuantite]
    .filter(([nom]) => !dejaAchetes.has(nom)) // déjà dans la liste avec une quantité
    .map(([nom, nomAffiche]) => {
      const cle = `placard|${nom}`;
      return { cle, nom, texte: formaterIngredient({ quantite: null, nom: nomAffiche }), coche: coches.has(cle) };
    });

  const ranger = (elements) => [...elements.filter((e) => !e.coche).sort(parNom), ...elements.filter((e) => e.coche).sort(parNom)];
  return { articles: ranger(articles), placards: ranger(placards), recettes, introuvables };
}

// Coches qui ne correspondent plus à rien (recette retirée, quantité changée) : oubliées.
export function nettoyerCoches(liste, construite) {
  const cles = new Set([...construite.articles, ...construite.placards].map((element) => element.cle));
  const coches = liste.coches.filter((cle) => cles.has(cle));
  return coches.length === liste.coches.length ? liste : { ...liste, coches };
}

// Texte envoyé par le bouton Partager : seulement ce qui reste à acheter.
export function listeEnTexte(construite) {
  const lignes = ["🛒 Liste de courses"];
  const aAcheter = construite.articles.filter((article) => !article.coche);
  if (aAcheter.length) lignes.push("", ...aAcheter.map((article) => `• ${article.texte}`));
  const aVerifier = construite.placards.filter((article) => !article.coche);
  if (aVerifier.length) lignes.push("", "À VÉRIFIER DANS LES PLACARDS", ...aVerifier.map((article) => `• ${article.texte}`));
  if (construite.recettes.length) {
    lignes.push("", "POUR", ...construite.recettes.map((recette) =>
      `• ${recette.nom}${recette.personnes ? ` (${nombrePersonnes(recette.personnes)})` : ""}`));
  }
  lignes.push("", "Partagé depuis CuiCui Cooking 🐦");
  return lignes.join("\n");
}
