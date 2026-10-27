// CuiCui Cooking – mise en forme d'une recette en texte lisible
// (affichage et partage). Fonctions pures, sans accès à la page.

// Statuts possibles d'une recette, dans l'ordre d'affichage.
export const STATUTS = [
  { valeur: "a-essayer", icone: "📝", libelle: "À essayer" },
  { valeur: "cuisinee", icone: "✅", libelle: "Déjà cuisinée" },
  { valeur: "favorite", icone: "⭐", libelle: "Favorite" },
];

// Statut d'une recette. Comprend aussi les anciens formats :
// favori / aEssayer, et « a-eviter » (statut retiré, lu comme « déjà cuisinée »).
export function lireStatut(recette) {
  if (STATUTS.some((statut) => statut.valeur === recette.statut)) return recette.statut;
  if (recette.statut === "a-eviter") return "cuisinee";
  if (recette.favori === true) return "favorite";
  if (recette.aEssayer === false) return "cuisinee";
  return "a-essayer";
}

export const infosStatut = (valeur) => STATUTS.find((statut) => statut.valeur === valeur);

// Catégories, dans l'ordre d'un repas.
export const CATEGORIES = {
  aperitif: "Apéritif", entree: "Entrée", plat: "Plat", accompagnement: "Accompagnement",
  dessert: "Dessert", boisson: "Boisson", sauce: "Sauce", autre: "Autre",
};

// Critères proposés pour classer la liste des recettes.
export const CLASSEMENTS = [
  { valeur: "nom", libelle: "Nom" },
  { valeur: "livre", libelle: "Livre" },
  { valeur: "categorie", libelle: "Catégorie" },
  { valeur: "cuisine", libelle: "Cuisine" },
  { valeur: "chef", libelle: "Chef" },
  { valeur: "statut", libelle: "Statut" },
];

const nomRecette = (entree) => String(entree.recette.nom ?? entree.id);
const parNom = (a, b) => nomRecette(a).localeCompare(nomRecette(b), "fr");
const texteNettoye = (valeur) => (typeof valeur === "string" && valeur.trim() ? valeur.trim() : null);

// Pour chaque critère : la clé et le titre du groupe d'une recette (ou null), le rang d'un groupe
// (les groupes de même rang sont triés par titre) et le titre du groupe des recettes non classées.
function criteres(livres) {
  const titresLivres = new Map(livres.map((livre) => [livre.id, livre.titre]));
  const ordreCategories = Object.keys(CATEGORIES);
  const ordreStatuts = STATUTS.map((statut) => statut.valeur);
  const rangDans = (ordre) => (cle) => (ordre.includes(cle) ? ordre.indexOf(cle) : ordre.length);
  const texteLibre = (champ) => (recette) => {
    const valeur = texteNettoye(recette[champ]);
    return valeur && { cle: valeur.toLocaleLowerCase("fr"), titre: majuscule(valeur) };
  };
  return {
    livre: {
      groupe: (recette) => {
        const id = texteNettoye(recette.source?.livre);
        return id && { cle: id, titre: titresLivres.get(id) ?? texteNettoye(recette.source?.titre) ?? id };
      },
      sansGroupe: "Sans livre",
    },
    categorie: {
      groupe: (recette) => {
        const cle = texteNettoye(recette.categorie);
        return cle && { cle, titre: CATEGORIES[cle] ?? majuscule(cle) };
      },
      rang: rangDans(ordreCategories),
      sansGroupe: "Sans catégorie",
    },
    cuisine: { groupe: texteLibre("cuisine"), sansGroupe: "Cuisine non précisée" },
    chef: { groupe: texteLibre("chef"), sansGroupe: "Sans chef" },
    statut: {
      groupe: (recette) => {
        const statut = infosStatut(lireStatut(recette));
        return { cle: statut.valeur, titre: `${statut.icone} ${statut.libelle}` };
      },
      rang: rangDans(ordreStatuts),
    },
  };
}

// Range des entrées { id, recette } selon un critère de CLASSEMENTS.
// Renvoie [{ cle, titre, entrees }] : groupes dans l'ordre du critère, recettes non classées
// en dernier (cle null), recettes triées par nom. « nom » donne un seul groupe sans titre.
// livres : [{ id, titre }], pour afficher le titre des livres.
export function classerRecettes(entrees, critere, livres = []) {
  const definition = criteres(livres)[critere];
  if (!definition) return entrees.length ? [{ cle: null, titre: null, entrees: [...entrees].sort(parNom) }] : [];

  const groupes = new Map();
  const sansGroupe = [];
  for (const entree of entrees) {
    const groupe = definition.groupe(entree.recette);
    if (!groupe) {
      sansGroupe.push(entree);
      continue;
    }
    if (!groupes.has(groupe.cle)) groupes.set(groupe.cle, { cle: groupe.cle, titre: groupe.titre, entrees: [] });
    groupes.get(groupe.cle).entrees.push(entree);
  }
  const rang = definition.rang ?? (() => 0);
  const resultat = [...groupes.values()].sort((a, b) =>
    rang(a.cle) - rang(b.cle) || a.titre.localeCompare(b.titre, "fr"));
  if (sansGroupe.length) resultat.push({ cle: null, titre: definition.sansGroupe, entrees: sansGroupe });
  for (const groupe of resultat) groupe.entrees.sort(parNom);
  return resultat;
}

// Recettes d'un livre dans l'ordre du livre (numéro de page), celles sans page à la fin.
export function trierParPage(entrees) {
  const page = (entree) => (Number.isFinite(entree.recette.source?.page) ? entree.recette.source.page : Infinity);
  return [...entrees].sort((a, b) => page(a) - page(b) || parNom(a, b));
}

// Valeur actuelle d'un champ suivi par l'historique.
function valeurSuivie(recette, champ) {
  if (champ === "statut") return lireStatut(recette);
  if (champ === "notes") return recette.notes ?? "";
  return recette[champ];
}

// Nouvelle version de la recette avec un champ modifié (« statut » ou « notes »),
// et une ligne ajoutée à son historique. Renvoie la même recette si rien ne change.
// Les champs de l'ancien format (favori / aEssayer) disparaissent au passage.
export function modifier(recette, champ, valeur, date = new Date()) {
  const avant = valeurSuivie(recette, champ);
  if (avant === valeur) return recette;
  const { favori, aEssayer, ...reste } = recette;
  return {
    ...reste,
    [champ]: valeur,
    historique: [...(Array.isArray(recette.historique) ? recette.historique : []),
      { date: date.toISOString(), champ, avant, apres: valeur }],
  };
}

// Valeur actuelle du champ concerné par une ligne d'historique (pour savoir si « Revenir » a un sens).
export const valeurActuelle = valeurSuivie;

const extrait = (texte, longueur = 60) =>
  (texte.length > longueur ? `${texte.slice(0, longueur).trimEnd()}…` : texte);

// Une ligne d'historique en texte : « Statut : Favorite → À essayer ».
export function formaterModification({ champ, avant, apres }) {
  if (champ === "statut") {
    const libelle = (valeur) => infosStatut(lireStatut({ statut: valeur }))?.libelle ?? valeur;
    return `Statut : ${libelle(avant)} → ${libelle(apres)}`;
  }
  if (champ === "notes") {
    if (!avant) return `Notes ajoutées : « ${extrait(apres)} »`;
    if (!apres) return `Notes supprimées (c'était : « ${extrait(avant)} »)`;
    return `Notes modifiées (avant : « ${extrait(avant)} »)`;
  }
  return `${majuscule(champ)} modifié`;
}

// « française » → « Française » (affichage seulement : les fiches restent en minuscules).
export function majuscule(texte) {
  return texte.charAt(0).toLocaleUpperCase("fr-FR") + texte.slice(1);
}

// Unités qui prennent un « s » au pluriel (« 5 gousses d'ail »).
const UNITES_VARIABLES = new Set(["pincée", "gousse", "tranche", "botte", "brin", "feuille", "boîte", "sachet"]);

export function formaterNombre(nombre) {
  return Number(nombre).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// 80 → « 1 h 20 », 20 → « 20 min », 120 → « 2 h ».
export function formaterDuree(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const heures = Math.floor(minutes / 60);
  const reste = Math.round(minutes % 60);
  if (!heures) return `${reste} min`;
  return reste ? `${heures} h ${String(reste).padStart(2, "0")}` : `${heures} h`;
}

const pluriel = (mot) => (/[sxz]$/.test(mot) ? mot : `${mot}s`);

// Met au pluriel le premier mot : « jaune d'œuf » → « jaunes d'œuf ».
const pluralizerNom = (nom) => nom.replace(/^[^\s']+/, pluriel);

// « de beurre », « d'ail », « d'œuf ».
const de = (nom) => (/^[aeiouyhàâéèêëîïôœûù]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

// { quantite: 5, unite: "gousse", nom: "ail" } → « 5 gousses d'ail ».
export function formaterIngredient({ quantite, unite, nom = "", precision }) {
  let texte;
  if (quantite == null) {
    texte = nom.charAt(0).toUpperCase() + nom.slice(1);
  } else if (!unite) {
    texte = `${formaterNombre(quantite)} ${quantite > 1 ? pluralizerNom(nom) : nom}`;
  } else {
    const uniteAccordee = quantite > 1 && UNITES_VARIABLES.has(unite) ? pluriel(unite) : unite;
    texte = `${formaterNombre(quantite)} ${uniteAccordee} ${de(nom)}`;
  }
  return precision ? `${texte} (${precision})` : texte;
}

// « Chef · Titre du livre, p. 120 »
export function formaterSource(recette) {
  const source = recette.source ?? {};
  const origine = [source.titre, source.page ? `p. ${source.page}` : null].filter(Boolean).join(", ");
  return [recette.chef, origine].filter(Boolean).join(" · ");
}

// « Pour 6 personnes · Préparation 20 min · Cuisson 1 h 20 »
export function formaterInfos(recette) {
  return [
    recette.portions ? `Pour ${recette.portions} personne${recette.portions > 1 ? "s" : ""}` : null,
    formaterDuree(recette.tempsPreparation) && `Préparation ${formaterDuree(recette.tempsPreparation)}`,
    formaterDuree(recette.tempsCuisson) && `Cuisson ${formaterDuree(recette.tempsCuisson)}`,
    formaterDuree(recette.tempsRepos) && `Repos ${formaterDuree(recette.tempsRepos)}`,
  ].filter(Boolean).join(" · ");
}

// Regroupe les ingrédients par sous-partie (« Pâte », « Garniture »…), dans l'ordre d'apparition.
export function grouperIngredients(ingredients = []) {
  const groupes = new Map();
  for (const ingredient of ingredients) {
    const groupe = ingredient.groupe ?? "";
    if (!groupes.has(groupe)) groupes.set(groupe, []);
    groupes.get(groupe).push(ingredient);
  }
  return [...groupes].map(([nom, liste]) => ({ nom, ingredients: liste }));
}

// Texte complet envoyé par le bouton Partager (WhatsApp, SMS, e-mail…).
// Une information par ligne : chef, puis livre ; portions, puis chaque temps.
// Les notes personnelles ne sont pas partagées.
export function recetteEnTexte(recette) {
  const lignes = [`🍽️ ${recette.nom ?? recette.id}`];

  const source = recette.source ?? {};
  const origine = [source.titre, source.page ? `p. ${source.page}` : null].filter(Boolean).join(", ");
  const lignesSource = [recette.chef, origine].filter(Boolean);
  if (lignesSource.length) lignes.push("", ...lignesSource);

  const lignesInfos = [
    recette.portions ? `Pour ${recette.portions} personne${recette.portions > 1 ? "s" : ""}` : null,
    formaterDuree(recette.tempsPreparation) && `Préparation : ${formaterDuree(recette.tempsPreparation)}`,
    formaterDuree(recette.tempsCuisson) && `Cuisson : ${formaterDuree(recette.tempsCuisson)}`,
    formaterDuree(recette.tempsRepos) && `Repos : ${formaterDuree(recette.tempsRepos)}`,
  ].filter(Boolean);
  if (lignesInfos.length) lignes.push("", ...lignesInfos);

  lignes.push("", "INGRÉDIENTS");
  for (const groupe of grouperIngredients(recette.ingredients)) {
    if (groupe.nom) lignes.push(`${groupe.nom} :`);
    for (const ingredient of groupe.ingredients) lignes.push(`• ${formaterIngredient(ingredient)}`);
  }

  lignes.push("", "PRÉPARATION");
  (recette.etapes ?? []).forEach((etape, index) => lignes.push(`${index + 1}. ${etape}`));

  if (recette.source?.url) lignes.push("", recette.source.url);
  lignes.push("", "Partagé depuis CuiCui Cooking 🐦");
  return lignes.join("\n");
}
