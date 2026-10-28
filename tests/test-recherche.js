// Tests de la recherche et des filtres (js/recherche.js).
// Ouvrir tests/test-recherche.html avec le serveur local.

import { choixDeFiltres, filtrerRecettes, filtresVides, normaliser, rechercheActive } from "../js/recherche.js";

function egal(obtenu, attendu) {
  if (obtenu !== attendu) throw new Error(`obtenu « ${obtenu} », attendu « ${attendu} »`);
}

const ingredient = (nom) => ({ quantite: null, unite: null, nom, precision: null, groupe: null });
const entrees = [
  { id: "bourguignon", recette: {
    nom: "Bœuf bourguignon", chef: "Paul Bocuse", categorie: "plat", cuisine: "française", statut: "favorite",
    source: { type: "livre", titre: "La cuisine du marché", livre: "cuisine-du-marche" },
    ingredients: [ingredient("bœuf"), ingredient("vin rouge"), ingredient("carotte")], motsCles: ["mijoté"],
  } },
  { id: "creme-brulee", recette: {
    nom: "Crème brûlée", categorie: "dessert", cuisine: "Française", statut: "a-essayer",
    ingredients: [ingredient("crème"), ingredient("œuf"), ingredient("vanille")],
  } },
  { id: "pates", recette: {
    nom: "Pâtes carbonara", categorie: "plat", cuisine: "italienne", favori: false, aEssayer: false,
    ingredients: [ingredient("spaghetti"), ingredient("œuf"), ingredient("guanciale")],
  } },
  { id: "salade", recette: { nom: "Salade verte", categorie: "entree", ingredients: [ingredient("laitue")] } },
];
const livres = [{ id: "cuisine-du-marche", titre: "La Cuisine du marché" }];
const ids = (filtres) => filtrerRecettes(entrees, { ...filtresVides(), ...filtres }, livres).map((entree) => entree.id).join();

const tests = {
  "Texte comparable : sans majuscules, accents ni ligatures"() {
    egal(normaliser("Bœuf BRÛLÉ Æsop"), "boeuf brule aesop");
  },

  "Sans recherche ni filtre : toutes les recettes"() {
    egal(ids({}), "bourguignon,creme-brulee,pates,salade");
    egal(rechercheActive(filtresVides()), false);
    egal(rechercheActive({ ...filtresVides(), texte: "   " }), false);
  },

  "Recherche dans le nom, sans tenir compte des accents ni des majuscules"() {
    egal(ids({ texte: "BOEUF" }), "bourguignon");
    egal(ids({ texte: "creme" }), "creme-brulee");
  },

  "Début de mot : « carbo » trouve carbonara, « oeuf » ne trouve pas bœuf"() {
    egal(ids({ texte: "carbo" }), "pates");
    egal(ids({ texte: "rouge" }), "bourguignon");
    egal(ids({ texte: "uf" }), "");
  },

  "Recherche dans les ingrédients, le chef, le livre et les mots-clés"() {
    egal(ids({ texte: "oeuf" }), "creme-brulee,pates");
    egal(ids({ texte: "bocuse" }), "bourguignon");
    egal(ids({ texte: "marché" }), "bourguignon");
    egal(ids({ texte: "mijote" }), "bourguignon");
  },

  "Plusieurs mots : chacun doit être trouvé"() {
    egal(ids({ texte: "œuf vanille" }), "creme-brulee");
    egal(ids({ texte: "œuf chocolat" }), "");
  },

  "Filtre catégorie : une des valeurs cochées suffit"() {
    egal(ids({ categories: ["plat"] }), "bourguignon,pates");
    egal(ids({ categories: ["plat", "entree"] }), "bourguignon,pates,salade");
  },

  "Filtre statut, y compris les anciens formats"() {
    egal(ids({ statuts: ["cuisinee"] }), "pates");
    egal(ids({ statuts: ["a-essayer"] }), "creme-brulee,salade");
  },

  "Filtre cuisine, sans tenir compte des majuscules ; sans cuisine : exclue"() {
    egal(ids({ cuisines: ["française"] }), "bourguignon,creme-brulee");
  },

  "Filtres et recherche combinés : la recette doit tout remplir"() {
    egal(ids({ categories: ["plat"], cuisines: ["française"] }), "bourguignon");
    egal(ids({ texte: "oeuf", categories: ["plat"] }), "pates");
  },

  "Choix proposés : valeurs présentes, avec leur nombre, dans l'ordre"() {
    const choix = choixDeFiltres(entrees);
    egal(choix.categories.map((c) => `${c.titre} ${c.nombre}`).join(), "Entrée 1,Plat 2,Dessert 1");
    egal(choix.statuts.map((c) => `${c.titre} ${c.nombre}`).join(), "📝 À essayer 2,✅ Déjà cuisinée 1,⭐ Favorite 1");
    egal(choix.cuisines.map((c) => `${c.cle} ${c.nombre}`).join(), "française 2,italienne 1");
    egal(choix.cuisines[0].titre, "Française");
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
