// CuiCui Cooking – mise en forme d'une recette en texte lisible
// (affichage et partage). Fonctions pures, sans accès à la page.

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

// « Philippe Etchebest · Mon livre, p. 120 »
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
// Les notes personnelles ne sont pas partagées.
export function recetteEnTexte(recette) {
  const lignes = [`🍽️ ${recette.nom ?? recette.id}`];
  const source = formaterSource(recette);
  if (source) lignes.push(source);
  const infos = formaterInfos(recette);
  if (infos) lignes.push("", infos);

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
