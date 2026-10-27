// Tests de la liste de courses (js/courses.js).
// Ouvrir tests/test-courses.html avec le serveur local.

import {
  ajouterALaListe, cocherArticle, construireListe, listeEnTexte, listeVide, nettoyerCoches, normaliserListe,
  retirerDeLaListe,
} from "../js/courses.js";

function egal(obtenu, attendu) {
  if (obtenu !== attendu) throw new Error(`obtenu « ${obtenu} », attendu « ${attendu} »`);
}

const ingredient = (quantite, unite, nom, precision = null) => ({ quantite, unite, nom, precision, groupe: null });
const recettes = new Map([
  ["crepes", { nom: "Crêpes", portions: 4, ingredients: [
    ingredient(250, "g", "farine"), ingredient(4, null, "œuf"), ingredient(50, "cl", "lait"),
    ingredient(null, null, "sel"), ingredient(1, "pincée", "sucre"),
  ] }],
  ["gateau", { nom: "Gâteau", portions: 6, ingredients: [
    ingredient(0.8, "kg", "farine"), ingredient(3, null, "œuf"), ingredient(200, "ml", "lait"),
    ingredient(null, null, "sel"), ingredient(100, "g", "sucre"), ingredient(null, null, "beurre", "pour le moule"),
  ] }],
  ["salade", { nom: "Salade", portions: null, ingredients: [ingredient(1, null, "laitue"), ingredient(null, null, "sucre")] }],
]);
const textes = (elements) => elements.map((element) => element.texte).join(" | ");
const liste = (...choix) => choix.reduce((suite, [id, personnes]) => ajouterALaListe(suite, id, personnes), listeVide());

const tests = {
  "Addition : masses, volumes et pièces de plusieurs recettes"() {
    const { articles } = construireListe(liste(["crepes", 4], ["gateau", 6]), recettes);
    egal(textes(articles), "1,05 kg de farine | 70 cl de lait | 7 œufs | 100 g de sucre | 1 pincée de sucre");
  },

  "Addition : quantités ajustées au nombre de personnes choisi"() {
    const { articles, recettes: choisies } = construireListe(liste(["crepes", 2]), recettes);
    egal(textes(articles), "125 g de farine | 25 cl de lait | 2 œufs | 0,5 pincée de sucre");
    egal(choisies[0].personnes, 2);
  },

  "Placards : sans quantité, une seule fois, sauf si déjà à acheter"() {
    const { placards } = construireListe(liste(["crepes", 4], ["gateau", 6], ["salade", null]), recettes);
    egal(textes(placards), "Beurre | Sel");
  },

  "Recette sans portions : quantités d'origine, sans nombre de personnes"() {
    const { articles, recettes: choisies } = construireListe(liste(["salade", 3]), recettes);
    egal(textes(articles), "1 laitue");
    egal(choisies[0].personnes, null);
  },

  "Ajouter deux fois : le nombre de personnes est remplacé"() {
    const choix = ajouterALaListe(liste(["crepes", 4]), "crepes", 8);
    egal(choix.recettes.length, 1);
    egal(choix.recettes[0].personnes, 8);
  },

  "Coché : en bas de la liste, et décoché s'il en faut davantage"() {
    let choix = liste(["crepes", 4]);
    const farine = construireListe(choix, recettes).articles.find((article) => article.nom === "farine");
    choix = cocherArticle(choix, farine.cle, true);
    egal(construireListe(choix, recettes).articles.at(-1).nom, "farine");
    choix = ajouterALaListe(choix, "gateau", 6);
    const construite = construireListe(choix, recettes);
    egal(construite.articles.find((article) => article.nom === "farine").coche, false);
    egal(nettoyerCoches(choix, construite).coches.length, 0);
  },

  "Retirer une recette et recette disparue du dépôt"() {
    const choix = retirerDeLaListe(liste(["crepes", 4], ["inconnue", 2]), "crepes");
    const construite = construireListe(choix, recettes);
    egal(construite.recettes.length, 0);
    egal(construite.introuvables.join(), "inconnue");
  },

  "Liste abîmée ou absente"() {
    egal(normaliserListe(undefined).recettes.length, 0);
    const lue = normaliserListe({ recettes: [{ id: "a", personnes: -2 }, { personnes: 3 }, null], coches: [1, "x"] });
    egal(JSON.stringify(lue), '{"recettes":[{"id":"a","personnes":null}],"coches":["x"]}');
  },

  "Texte partagé : seulement ce qui reste à acheter"() {
    let choix = liste(["crepes", 4]);
    const sucre = construireListe(choix, recettes).articles.find((article) => article.nom === "sucre");
    choix = cocherArticle(choix, sucre.cle, true);
    const texte = listeEnTexte(construireListe(choix, recettes));
    if (texte.includes("sucre")) throw new Error(texte);
    if (!texte.includes("• 250 g de farine") || !texte.includes("À VÉRIFIER DANS LES PLACARDS\n• Sel")) throw new Error(texte);
    if (!texte.includes("POUR\n• Crêpes (4 personnes)")) throw new Error(texte);
  },
};

const lignes = [];
let echecs = 0;
for (const [nom, test] of Object.entries(tests)) {
  try {
    await test();
    lignes.push(`✅ ${nom}`);
  } catch (erreur) {
    echecs++;
    lignes.push(`❌ ${nom}\n   → ${erreur.message}`);
  }
}
lignes.push("", echecs ? `${echecs} test(s) en échec sur ${Object.keys(tests).length}.` : `Tous les tests passent (${Object.keys(tests).length}).`);
document.getElementById("resultats").textContent = lignes.join("\n");
window.resultatsTests = { echecs, total: Object.keys(tests).length, lignes };
