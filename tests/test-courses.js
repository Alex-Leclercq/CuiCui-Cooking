// Tests de la liste de courses (js/courses.js).
// Ouvrir tests/test-courses.html avec le serveur local.

import {
  ajouterALaListe, cocherArticle, construireListe, listeEnTexte, listeVide, nettoyerCoches, normaliserListe,
  plierRecette, retirerDeLaListe,
} from "../js/courses.js";

function egal(obtenu, attendu) {
  if (obtenu !== attendu) throw new Error(`obtenu « ${obtenu} », attendu « ${attendu} »`);
}

const ingredient = (quantite, unite, nom, precision = null) => ({ quantite, unite, nom, precision, groupe: null });
const recettes = new Map([
  ["crepes", { nom: "Crêpes", portions: 4, ingredients: [
    ingredient(250, "g", "farine"), ingredient(4, null, "œuf"), ingredient(50, "cl", "lait"),
    ingredient(null, null, "sel"), ingredient(50, "g", "beurre", "fondu"),
  ] }],
  ["gateau", { nom: "Gâteau", portions: 6, ingredients: [ingredient(0.8, "kg", "farine"), ingredient(3, null, "œuf")] }],
  ["salade", { nom: "Salade", portions: null, ingredients: [ingredient(1, null, "laitue"), ingredient(null, null, "poivre")] }],
]);
const textes = (recette) => recette.articles.map((article) => article.texte).join(" | ");
const liste = (...choix) => choix.reduce((suite, [id, personnes]) => ajouterALaListe(suite, id, personnes), listeVide());

const tests = {
  "Recette par recette, dans l'ordre d'ajout, ingrédients dans l'ordre de la recette"() {
    const { recettes: affichees } = construireListe(liste(["gateau", 6], ["crepes", 4]), recettes);
    egal(affichees.map((recette) => recette.nom).join(), "Gâteau,Crêpes");
    egal(textes(affichees[0]), "0,8 kg de farine | 3 œufs");
    egal(textes(affichees[1]), "250 g de farine | 4 œufs | 50 cl de lait | Sel | 50 g de beurre (fondu)");
  },

  "Quantités ajustées au nombre de personnes de chaque recette"() {
    const { recettes: affichees } = construireListe(liste(["crepes", 2]), recettes);
    egal(textes(affichees[0]), "125 g de farine | 2 œufs | 25 cl de lait | Sel | 25 g de beurre (fondu)");
    egal(affichees[0].personnes, 2);
  },

  "Recette sans portions : quantités d'origine, sans nombre de personnes"() {
    const { recettes: affichees } = construireListe(liste(["salade", 3]), recettes);
    egal(textes(affichees[0]), "1 laitue | Poivre");
    egal(affichees[0].personnes, null);
  },

  "Ajouter deux fois : le nombre de personnes est remplacé, le pliage gardé"() {
    let choix = plierRecette(liste(["crepes", 4]), "crepes", true);
    choix = ajouterALaListe(choix, "crepes", 8);
    egal(choix.recettes.length, 1);
    egal(choix.recettes[0].personnes, 8);
    egal(construireListe(choix, recettes).recettes[0].plie, true);
  },

  "Coché : en bas de sa recette seulement, et décoché s'il en faut davantage"() {
    let choix = liste(["crepes", 4], ["gateau", 6]);
    const farine = construireListe(choix, recettes).recettes[0].articles[0];
    choix = cocherArticle(choix, farine.cle, true);
    const [crepes, gateau] = construireListe(choix, recettes).recettes;
    egal(crepes.articles.at(-1).texte, "250 g de farine");
    egal(crepes.articles.at(-1).coche, true);
    egal(gateau.articles[0].coche, false); // même ingrédient, autre recette : pas coché
    choix = ajouterALaListe(choix, "crepes", 5);
    const construite = construireListe(choix, recettes);
    egal(construite.recettes[0].articles.some((article) => article.coche), false);
    egal(nettoyerCoches(choix, construite).coches.length, 0);
  },

  "Retirer une recette et recette disparue du dépôt"() {
    const choix = retirerDeLaListe(liste(["crepes", 4], ["inconnue", 2]), "crepes");
    const construite = construireListe(choix, recettes);
    egal(construite.recettes.length, 0);
    egal(construite.introuvables.join(), "inconnue");
  },

  "Liste abîmée, absente ou d'une version précédente"() {
    egal(normaliserListe(undefined).recettes.length, 0);
    const lue = normaliserListe({ recettes: [{ id: "a", personnes: -2 }, { personnes: 3 }, null], coches: [1, "x"] });
    egal(JSON.stringify(lue), '{"recettes":[{"id":"a","personnes":null,"plie":false}],"coches":["x"]}');
  },

  "Texte partagé : recette par recette, seulement ce qui reste à acheter"() {
    let choix = liste(["crepes", 4], ["gateau", 6]);
    for (const article of construireListe(choix, recettes).recettes[1].articles) choix = cocherArticle(choix, article.cle, true);
    const sel = construireListe(choix, recettes).recettes[0].articles.find((article) => article.texte === "Sel");
    choix = cocherArticle(choix, sel.cle, true);
    const texte = listeEnTexte(construireListe(choix, recettes));
    if (texte.includes("Gâteau") || texte.includes("Sel")) throw new Error(texte);
    if (!texte.includes("Crêpes (4 personnes)\n• 250 g de farine\n• 4 œufs")) throw new Error(texte);
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
