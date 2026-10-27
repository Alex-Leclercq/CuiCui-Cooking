// Tests de la mise en forme des recettes (js/recette.js).
// Ouvrir tests/test-recette.html avec le serveur local.

import {
  classerRecettes, formaterDuree, formaterIngredient, formaterInfos, formaterModification, formaterSource,
  grouperIngredients, lireStatut, majuscule, modifier, recetteEnTexte, trierParPage,
} from "../js/recette.js";

function egal(obtenu, attendu) {
  if (obtenu !== attendu) throw new Error(`obtenu « ${obtenu} », attendu « ${attendu} »`);
}

const ingredient = (quantite, unite, nom, precision = null, groupe = null) => ({ quantite, unite, nom, precision, groupe });
const entree = (id, champs) => ({ id, recette: { id, nom: id, ...champs } });
const noms = (groupe) => groupe.entrees.map((e) => e.recette.nom).join(",");

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
  "Statut : nouveau champ"() {
    egal(lireStatut({ statut: "favorite" }), "favorite");
    egal(lireStatut({ statut: "cuisinee" }), "cuisinee");
  },

  "Statut : « à ne pas refaire » (retiré) lu comme « déjà cuisinée »"() {
    egal(lireStatut({ statut: "a-eviter" }), "cuisinee");
  },

  "Statut : ancien format favori / aEssayer"() {
    egal(lireStatut({ favori: false, aEssayer: true }), "a-essayer");
    egal(lireStatut({ favori: false, aEssayer: false }), "cuisinee");
    egal(lireStatut({ favori: true, aEssayer: false }), "favorite");
    egal(lireStatut({}), "a-essayer");
    egal(lireStatut({ statut: "inconnu", favori: true }), "favorite");
  },

  "Historique : changer de statut ajoute une ligne et supprime l'ancien format"() {
    const date = new Date("2026-10-27T09:12:00.000Z");
    const nouvelle = modifier({ id: "a", nom: "A", favori: false, aEssayer: true }, "statut", "favorite", date);
    egal(JSON.stringify(nouvelle), JSON.stringify({
      id: "a", nom: "A", statut: "favorite",
      historique: [{ date: "2026-10-27T09:12:00.000Z", champ: "statut", avant: "a-essayer", apres: "favorite" }],
    }));
  },

  "Historique : aucune ligne si la valeur ne change pas"() {
    const recette = { id: "a", statut: "favorite", notes: "Bon" };
    egal(modifier(recette, "statut", "favorite"), recette);
    egal(modifier(recette, "notes", "Bon"), recette);
  },

  "Historique : notes ajoutées, modifiées, puis retour en arrière"() {
    let recette = { id: "a", statut: "a-essayer" };
    recette = modifier(recette, "notes", "Moins de sucre");
    recette = modifier(recette, "notes", "Moins de sucre, plus de beurre");
    const ligne = recette.historique[1];
    egal(ligne.avant, "Moins de sucre");
    recette = modifier(recette, ligne.champ, ligne.avant); // bouton « Revenir »
    egal(recette.notes, "Moins de sucre");
    egal(recette.historique.length, 3);
  },

  "Historique : textes affichés"() {
    egal(formaterModification({ champ: "statut", avant: "favorite", apres: "a-essayer" }), "Statut : Favorite → À essayer");
    egal(formaterModification({ champ: "statut", avant: "a-eviter", apres: "favorite" }), "Statut : Déjà cuisinée → Favorite");
    egal(formaterModification({ champ: "notes", avant: "", apres: "Moins de sucre" }), "Notes ajoutées : « Moins de sucre »");
    egal(formaterModification({ champ: "notes", avant: "Moins de sucre", apres: "" }), "Notes supprimées (c'était : « Moins de sucre »)");
    egal(formaterModification({ champ: "notes", avant: "A", apres: "B" }), "Notes modifiées (avant : « A »)");
  },

  "Majuscule à l'affichage"() {
    egal(majuscule("française"), "Française");
    egal(majuscule("éte"), "Éte");
    egal(majuscule(""), "");
  },

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
      "",
      "Chef Test",
      "Livre test, p. 12",
      "",
      "Pour 6 personnes",
      "Préparation : 20 min",
      "Cuisson : 1 h 20",
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

  "Texte partagé : sans chef ni temps, pas de lignes vides en trop"() {
    const texte = recetteEnTexte({ nom: "Soupe", source: { titre: "Marmiton" }, tempsRepos: 30, ingredients: [], etapes: [] });
    egal(texte.split("\n").slice(0, 5).join("|"), "🍽️ Soupe||Marmiton||Repos : 30 min");
  },

  "Texte partagé : lien de la source web inclus"() {
    const texte = recetteEnTexte({ nom: "Crêpes", source: { type: "site", titre: "Marmiton", url: "https://www.marmiton.org/crepes" }, ingredients: [], etapes: [] });
    if (!texte.includes("https://www.marmiton.org/crepes")) throw new Error("lien absent");
  },

  "Classer par nom : un seul groupe, trié par nom"() {
    const groupes = classerRecettes([entree("b", { nom: "Œufs" }), entree("a", { nom: "Crêpes" }), entree("c", { nom: "abricot" })], "nom");
    egal(groupes.length, 1);
    egal(noms(groupes[0]), "abricot,Crêpes,Œufs");
  },

  "Classer par catégorie : ordre du repas, sans catégorie à la fin"() {
    const groupes = classerRecettes([
      entree("d", { categorie: "dessert" }), entree("p", { categorie: "plat" }),
      entree("x", {}), entree("e", { categorie: "entree" }),
    ], "categorie");
    egal(groupes.map((g) => g.titre).join(","), "Entrée,Plat,Dessert,Sans catégorie");
    egal(groupes.at(-1).cle, null);
  },

  "Classer par cuisine : majuscules et espaces ignorés, titres en majuscule"() {
    const groupes = classerRecettes([
      entree("a", { cuisine: "italienne" }), entree("b", { cuisine: " Italienne " }),
      entree("c", { cuisine: "française" }), entree("d", { cuisine: "" }),
    ], "cuisine");
    egal(groupes.map((g) => `${g.titre}:${g.entrees.length}`).join(","), "Française:1,Italienne:2,Cuisine non précisée:1");
  },

  "Classer par chef : par ordre alphabétique"() {
    const groupes = classerRecettes([entree("a", { chef: "Paul Bocuse" }), entree("b", { chef: "Cyril Lignac" }), entree("c", {})], "chef");
    egal(groupes.map((g) => g.titre).join(","), "Cyril Lignac,Paul Bocuse,Sans chef");
  },

  "Classer par statut : à essayer, déjà cuisinée, favorite (anciens formats compris)"() {
    const groupes = classerRecettes([
      entree("a", { statut: "favorite" }), entree("b", { favori: true }), entree("c", {}), entree("d", { statut: "cuisinee" }),
    ], "statut");
    egal(groupes.map((g) => `${g.cle}:${g.entrees.length}`).join(","), "a-essayer:1,cuisinee:1,favorite:2");
  },

  "Classer par livre : titre de la fiche du livre, sinon celui de la recette"() {
    const groupes = classerRecettes([
      entree("a", { source: { titre: "Titre dans la recette", livre: "mentor" } }),
      entree("b", { source: { titre: "Autre livre", livre: "autre" } }),
      entree("c", { source: { type: "site", titre: "Marmiton" } }),
    ], "livre", [{ id: "mentor", titre: "Méthode Mentor" }]);
    egal(groupes.map((g) => `${g.cle}:${g.titre}`).join(","), "autre:Autre livre,mentor:Méthode Mentor,null:Sans livre");
  },

  "Recettes d'un livre : ordre des pages, sans page à la fin"() {
    const triees = trierParPage([
      entree("c", { source: { page: 268 } }), entree("x", { source: {} }), entree("a", { source: { page: 54 } }),
    ]);
    egal(triees.map((e) => e.id).join(","), "a,c,x");
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
