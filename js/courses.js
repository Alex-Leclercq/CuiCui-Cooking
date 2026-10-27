// CuiCui Cooking – liste de courses. Fonctions pures, sans accès à la page.
// La liste ne garde que les recettes choisies (nombre de personnes, pliée ou non) et les articles cochés :
// les ingrédients sont recalculés à partir des recettes, donc toujours à jour après une synchronisation.
// Elle reste sur le téléphone (magasin « meta »), elle n'est pas envoyée à GitHub.

import { formaterIngredient, ingredientsPour, nombrePersonnes } from "./recette.js";

// { recettes: [{ id, personnes, plie }], coches: [clé d'article] }.
// personnes : null si la recette n'a pas de portions ; plie : ingrédients masqués à l'écran.
export const listeVide = () => ({ recettes: [], coches: [] });

// Liste lue dans le stockage, quelle qu'elle soit (absente, ancienne, abîmée).
export function normaliserListe(valeur) {
  const recettes = Array.isArray(valeur?.recettes)
    ? valeur.recettes.filter((choix) => typeof choix?.id === "string")
      .map(({ id, personnes, plie }) => ({
        id, personnes: Number.isInteger(personnes) && personnes > 0 ? personnes : null, plie: plie === true,
      }))
    : [];
  const coches = Array.isArray(valeur?.coches) ? valeur.coches.filter((cle) => typeof cle === "string") : [];
  return { recettes, coches };
}

// Nombre de personnes d'origine d'une recette, ou null si elle n'en indique pas.
export const portionsOrigine = (recette) =>
  (Number.isInteger(recette?.portions) && recette.portions > 0 ? recette.portions : null);

// Ajoute une recette à la fin, ou change son nombre de personnes si elle est déjà dans la liste.
export function ajouterALaListe(liste, id, personnes) {
  const existante = liste.recettes.find((recette) => recette.id === id);
  const choix = { id, personnes: personnes ?? null, plie: existante?.plie ?? false };
  return {
    ...liste,
    recettes: existante ? liste.recettes.map((recette) => (recette.id === id ? choix : recette)) : [...liste.recettes, choix],
  };
}

export const retirerDeLaListe = (liste, id) =>
  ({ ...liste, recettes: liste.recettes.filter((recette) => recette.id !== id) });

export const plierRecette = (liste, id, plie) =>
  ({ ...liste, recettes: liste.recettes.map((recette) => (recette.id === id ? { ...recette, plie } : recette)) });

export function cocherArticle(liste, cle, coche) {
  const coches = liste.coches.filter((autre) => autre !== cle);
  return { ...liste, coches: coche ? [...coches, cle] : coches };
}

// Liste à afficher, recette par recette, à partir des choix et des recettes du téléphone (Map id → recette).
// - recettes : dans l'ordre d'ajout, chacune avec ses ingrédients pour son nombre de personnes,
//   dans l'ordre de la recette, les cochés à la fin ;
// - introuvables : identifiants de recettes qui ne sont plus sur le téléphone.
// La clé d'un article contient son texte, donc sa quantité : s'il en faut davantage
// (personnes en plus), l'article coché redevient à acheter.
export function construireListe(liste, recettesParId) {
  const coches = new Set(liste.coches);
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
    const articles = ingredientsPour(recette, personnes)
      .filter((ingredient) => String(ingredient.nom ?? "").trim())
      .map((ingredient, index) => {
        const texte = formaterIngredient(ingredient);
        const cle = `${choix.id}|${index}|${texte}`;
        return { cle, texte, coche: coches.has(cle) };
      });
    recettes.push({
      id: choix.id, nom: String(recette.nom ?? choix.id), personnes, origine, plie: choix.plie,
      articles: [...articles.filter((article) => !article.coche), ...articles.filter((article) => article.coche)],
    });
  }
  return { recettes, introuvables };
}

// Coches qui ne correspondent plus à rien (recette retirée, quantité changée) : oubliées.
export function nettoyerCoches(liste, construite) {
  const cles = new Set(construite.recettes.flatMap((recette) => recette.articles.map((article) => article.cle)));
  const coches = liste.coches.filter((cle) => cles.has(cle));
  return coches.length === liste.coches.length ? liste : { ...liste, coches };
}

// Texte envoyé par le bouton Partager : recette par recette, seulement ce qui reste à acheter.
export function listeEnTexte(construite) {
  const lignes = ["🛒 Liste de courses"];
  for (const recette of construite.recettes) {
    const aAcheter = recette.articles.filter((article) => !article.coche);
    if (!aAcheter.length) continue;
    lignes.push("", `${recette.nom}${recette.personnes ? ` (${nombrePersonnes(recette.personnes)})` : ""}`,
      ...aAcheter.map((article) => `• ${article.texte}`));
  }
  if (lignes.length === 1) lignes.push("", "Tout est déjà acheté.");
  lignes.push("", "Partagé depuis CuiCui Cooking 🐦");
  return lignes.join("\n");
}
