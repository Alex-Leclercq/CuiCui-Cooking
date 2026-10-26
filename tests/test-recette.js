// Tests de la mise en forme des recettes (js/recette.js).
// Ouvrir tests/test-recette.html avec le serveur local.

import {
  formaterDuree, formaterIngredient, formaterInfos, formaterSource, grouperIngredients, recetteEnTexte,
} from "../js/recette.js";

function egal(obtenu, attendu) {
  if (obtenu !== attendu) throw new Error(`obtenu « ${obtenu} », attendu « ${attendu} »`);
}

const ingredient = (quantite, unite, nom, precision = null, groupe = null) => ({ quantite, unite, nom, precision, groupe });

const exemple = {
  id: "recette-test-chef-test",
  nom: "Recette test",
  chef: "Chef Test",
  source: { type: "livre", titre: "Livre test", url: null, page: 12 },
  portions: 6,
  tempsPreparation: 20,
  tempsCuisson: 80,
  tempsRepos: null,
  ingredients: [
    ingredient(10, "g", "beurre"),
    ingredient(5, "gousse", "ail"),
    ingredient(null, null, "gros sel"),
  ],
  etapes: ["Première étape.", "Deuxième étape."],
  notes: "Note privée à ne pas partager",
};

const tests = {
  "Durées"() {
    egal(formaterDuree(20), "20 min");
    egal(formaterDuree(80), "1 h 20");
    egal(formaterDuree(65), "1 h 05");
    egal(formaterDuree(120), "2 h");
    egal(formaterDuree(null), null);
    egal(formaterDuree(0), null);
  },

  "Ingrédient avec unité (de / d')"() {
    egal(formaterIngredient(ingredient(10, "g", "beurre")), "10 g de beurre");
    egal(formaterIngredient(ingredient(40, "cl", "crème liquide")), "40 cl de crème liquide");
    egal(formaterIngredient(ingredient(1, "pincée", "huile")), "1 pincée d'huile");
  },

  "Nombres décimaux à la française"() {
    egal(formaterIngredient(ingredient(1.2, "kg", "pomme de terre")), "1,2 kg de pomme de terre");
    egal(formaterIngredient(ingredient(0.5, "l", "lait")), "0,5 l de lait");
  },

  "Unités et noms accordés au pluriel"() {
    egal(formaterIngredient(ingredient(5, "gousse", "ail")), "5 gousses d'ail");
    egal(formaterIngredient(ingredient(1, "gousse", "ail")), "1 gousse d'ail");
    egal(formaterIngredient(ingredient(2, null, "œuf")), "2 œufs");
    egal(formaterIngredient(ingredient(4, null, "jaune d'œuf")), "4 jaunes d'œuf");
    egal(formaterIngredient(ingredient(3, null, "noix")), "3 noix");
    egal(formaterIngredient(ingredient(2, "c. à soupe", "huile")), "2 c. à soupe d'huile");
  },

  "Ingrédient sans quantité et précision"() {
    egal(formaterIngredient(ingredient(null, null, "gros sel")), "Gros sel");
    egal(formaterIngredient(ingredient(2, "brin", "thym", "frais")), "2 brins de thym (frais)");
  },

  "Source et informations"() {
    egal(formaterSource(exemple), "Chef Test · Livre test, p. 12");
    egal(formaterSource({ chef: null, source: { titre: "Marmiton" } }), "Marmiton");
    egal(formaterInfos(exemple), "Pour 6 personnes · Préparation 20 min · Cuisson 1 h 20");
  },

  "Ingrédients regroupés par sous-partie, dans l'ordre"() {
    const groupes = grouperIngredients([
      ingredient(200, "g", "farine", null, "Pâte"),
      ingredient(3, null, "pomme", null, "Garniture"),
      ingredient(100, "g", "beurre", null, "Pâte"),
    ]);
    egal(groupes.map((g) => `${g.nom}:${g.ingredients.length}`).join(" "), "Pâte:2 Garniture:1");
  },

  "Texte partagé complet, sans les notes personnelles"() {
    const texte = recetteEnTexte(exemple);
    const attendu = [
      "🍽️ Recette test",
      "Chef Test · Livre test, p. 12",
      "",
      "Pour 6 personnes · Préparation 20 min · Cuisson 1 h 20",
      "",
      "INGRÉDIENTS",
      "• 10 g de beurre",
      "• 5 gousses d'ail",
      "• Gros sel",
      "",
      "PRÉPARATION",
      "1. Première étape.",
      "2. Deuxième étape.",
      "",
      "Partagé depuis CuiCui Cooking 🐦",
    ].join("\n");
    egal(texte, attendu);
  },

  "Texte partagé : lien de la source web inclus"() {
    const texte = recetteEnTexte({ nom: "Crêpes", source: { type: "site", titre: "Marmiton", url: "https://www.marmiton.org/crepes" }, ingredients: [], etapes: [] });
    if (!texte.includes("https://www.marmiton.org/crepes")) throw new Error("lien absent");
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
