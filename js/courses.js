// CuiCui Cooking – liste de courses. Fonctions pures, sans accès à la page.
// La liste ne garde que les recettes choisies (nombre de personnes, pliée ou non) et les articles cochés :
// les ingrédients sont recalculés à partir des recettes, donc toujours à jour après une synchronisation.
// Elle reste sur le téléphone (magasin « meta »), elle n'est pas envoyée à GitHub.

import { formaterIngredient, ingredientsPour, nombrePersonnes, partiesIngredient } from "./recette.js";

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

// Coche ou décoche d'un coup plusieurs articles (une ligne de la vue « Tout ensemble »).
export const cocherArticles = (liste, cles, coche) => cles.reduce((suite, cle) => cocherArticle(suite, cle, coche), liste);

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
        return { cle, texte, coche: coches.has(cle), ingredient };
      });
    recettes.push({
      id: choix.id, nom: String(recette.nom ?? choix.id), personnes, origine, plie: choix.plie,
      articles: [...articles.filter((article) => !article.coche), ...articles.filter((article) => article.coche)],
    });
  }
  return { recettes, introuvables };
}

// ---- Vue « Tout ensemble » : les ingrédients de toutes les recettes, additionnés ----

const MASSES = { g: 1, kg: 1000 }; // en grammes
const VOLUMES = { ml: 1, cl: 10, l: 1000 }; // en millilitres
const arrondi = (valeur) => Math.round(valeur * 100) / 100;

// Total d'une ligne, dans l'unité qui se lit le mieux : kg dès 1 000 g, l dès 1 000 ml,
// ml seulement si toutes les recettes parlent en ml, sinon cl.
function totalLisible(famille, total, unites) {
  if (famille === "masse") return total >= 1000 ? { quantite: arrondi(total / 1000), unite: "kg" } : { quantite: arrondi(total), unite: "g" };
  if (famille === "volume") {
    if (total >= 1000) return { quantite: arrondi(total / 1000), unite: "l" };
    if ([...unites].every((unite) => unite === "ml")) return { quantite: arrondi(total), unite: "ml" };
    return { quantite: arrondi(total / 10), unite: "cl" };
  }
  return { quantite: arrondi(total), unite: [...unites][0] ?? null };
}

// Clé d'un nom d'ingrédient pour le regroupement : sans majuscules ni accents, et sans la marque
// du pluriel (s ou x final de chaque mot de plus de 3 lettres), appliquée pareil à toutes les recettes :
// « haricots blancs » et « haricot blanc », « Vinaigre de Xérès » et « vinaigre de xérès » se retrouvent.
export function cleNom(nom) {
  return String(nom).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim()
    .split(/\s+/).map((mot) => (mot.length > 3 ? mot.replace(/[sx]$/, "") : mot)).join(" ");
}

// Nom affiché pour un regroupement : la forme la plus au singulier parmi celles des recettes
// (l'affichage remet le pluriel selon la quantité).
const marquesDePluriel = (nom) => nom.split(/\s+/).filter((mot) => mot.length > 3 && /[sx]$/i.test(mot)).length;
const nomAuSingulier = (noms) => [...noms].sort((a, b) => marquesDePluriel(a) - marquesDePluriel(b))[0];

// Une ligne à afficher pour un groupe d'articles du même ingrédient (tous à acheter, ou tous achetés).
function ligneAgregee(groupe, articles, partie) {
  const recettes = [...new Set(articles.map((article) => article.recette))];
  const precisions = new Set(articles.map((article) => article.precision));
  const total = articles.reduce((somme, article) => somme + article.base, 0);
  const unites = new Set(articles.map((article) => article.unite).filter(Boolean));
  const quantites = groupe.famille === "sans" ? { quantite: null, unite: null } : totalLisible(groupe.famille, total, unites);
  const nom = nomAuSingulier(new Set(articles.map((article) => article.nom)));
  const ingredient = { ...quantites, nom, precision: precisions.size === 1 ? [...precisions][0] : null };
  return {
    cle: `ensemble|${groupe.cle}|${partie}`, nom, cles: articles.map((article) => article.cle), recettes,
    coche: articles.every((article) => article.coche),
    texte: formaterIngredient(ingredient), parties: partiesIngredient(ingredient),
  };
}

// Vue « Tout ensemble » : un ingrédient = même nom (voir cleNom : pluriel, majuscules et accents
// ne comptent pas) et unités compatibles (g et kg, ml, cl et l ; sinon la même unité). Les quantités
// s'additionnent ; sans quantité (sel, poivre), une seule ligne. Une précision n'est reprise que si
// tous les articles de la ligne ont la même (« 0,5 vin blanc (bouteille) »).
// Ingrédient acheté en partie : deux lignes. Ce qui reste à acheter, avec ses seules recettes, à sa
// place alphabétique ; ce qui est acheté, coché, en bas avec ses seules recettes. Dès que tout est
// coché (ou tout décoché), elles se rejoignent en une seule ligne, avec toutes les recettes.
// Chaque ligne garde les clés des articles qu'elle regroupe, pour les cocher ou décocher d'un coup.
export function agregerListe(construite) {
  const groupes = new Map();
  for (const recette of construite.recettes) {
    for (const article of recette.articles) {
      const { quantite, unite = null, nom = "", precision = null } = article.ingredient ?? {};
      const chiffree = Number.isFinite(quantite) && quantite > 0;
      const famille = !chiffree ? "sans" : unite in MASSES ? "masse" : unite in VOLUMES ? "volume" : `unite:${unite ?? ""}`;
      const cle = `${cleNom(nom)}|${famille}`;
      if (!groupes.has(cle)) groupes.set(cle, { cle, famille, articles: [] });
      groupes.get(cle).articles.push({
        cle: article.cle, coche: article.coche, recette: recette.nom, nom: String(nom).trim(), unite,
        base: chiffree ? quantite * (MASSES[unite] ?? VOLUMES[unite] ?? 1) : 0,
        precision: typeof precision === "string" && precision.trim() ? precision.trim() : null,
      });
    }
  }
  const articles = [];
  for (const groupe of groupes.values()) {
    const aAcheter = groupe.articles.filter((article) => !article.coche);
    const achetes = groupe.articles.filter((article) => article.coche);
    if (aAcheter.length && achetes.length) {
      articles.push(ligneAgregee(groupe, aAcheter, "a-acheter"), ligneAgregee(groupe, achetes, "achete"));
    } else {
      articles.push(ligneAgregee(groupe, groupe.articles, "tout"));
    }
  }
  articles.sort((a, b) => Number(a.coche) - Number(b.coche) || a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })
    || a.texte.localeCompare(b.texte, "fr"));
  return { articles };
}

// Texte partagé depuis la vue « Tout ensemble » : seulement ce qui reste à acheter.
export function listeAgregeeEnTexte(agregee) {
  const aAcheter = agregee.articles.filter((article) => !article.coche);
  return ["🛒 Liste de courses", "",
    ...(aAcheter.length ? aAcheter.map((article) => `• ${article.texte}`) : ["Tout est déjà acheté."]),
    "", "Partagé depuis CuiCui Cooking 🐦"].join("\n");
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
