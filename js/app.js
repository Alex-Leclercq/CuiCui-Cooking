// CuiCui Cooking – point d'entrée de l'application.
// Navigation par « hash » (#/favoris…) : fonctionne sans serveur
// particulier, aussi bien en local que sur GitHub Pages.

import { ouvrirStockage } from "./stockage.js";
import { creerClientGitHub } from "./github.js";
import { creerSynchro } from "./synchro.js";
import {
  CATEGORIES, CLASSEMENTS, STATUTS, classerRecettes, formaterIngredient, formaterInfos, formaterModification,
  formaterSource, grouperIngredients, infosStatut, lireStatut, majuscule, modifier, recetteEnTexte, trierParPage,
  valeurActuelle,
} from "./recette.js";

const VERSION = "0.8.0";
const DEPOT_PAR_DEFAUT = { proprietaire: "Alex-Leclercq", depot: "CuiCui-Recettes" };

const stockage = await ouvrirStockage("cuicui", {
  // Une ancienne version, ouverte ailleurs (onglet Chrome, appli installée), bloque la base.
  // (el() est utilisable ici car c'est une déclaration de fonction ; pageVide ne l'est pas encore.)
  siBloque: () => document.getElementById("vue").replaceChildren(
    el("div", { class: "vide" },
      el("span", { class: "vide__icone", "aria-hidden": "true" }, "⏳"),
      el("p", {}, el("strong", {}, "Mise à jour en attente.")),
      el("p", { class: "discret" },
        "CuiCui Cooking est encore ouverte ailleurs dans une ancienne version (onglet Chrome ou appli installée). Fermez-la : l'application reprendra toute seule."))),
  // Une version plus récente a besoin de la base : on la libère et on propose de recharger.
  siNouvelleVersion: () => proposerMiseAJour(),
});
const synchro = creerSynchro({ stockage, creerClient: creerClientGitHub });

// ---- Outils d'affichage ----

// Crée un élément HTML. Les chaînes passées en enfants deviennent des nœuds texte :
// elles ne sont jamais interprétées comme du HTML (règle de sécurité, voir CLAUDE.md).
function el(balise, attributs = {}, ...enfants) {
  const element = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (nom.startsWith("on")) element.addEventListener(nom.slice(2), valeur);
    else if (valeur === true) element.setAttribute(nom, "");
    else if (valeur !== false && valeur != null) element.setAttribute(nom, valeur);
  }
  element.append(...enfants.flat().filter((enfant) => enfant != null && enfant !== false));
  return element;
}

const page = (titre, ...contenu) => el("div", {}, el("h2", {}, titre), ...contenu);

const pageVide = (icone, titre, explication, ...actions) =>
  el("div", { class: "vide" },
    el("span", { class: "vide__icone", "aria-hidden": "true" }, icone),
    el("p", {}, el("strong", {}, titre)),
    el("p", { class: "discret" }, explication),
    ...actions);

const formaterDate = (horodatage) =>
  new Date(horodatage).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

function texteEtat(etat) {
  if (!etat.configure) return "Non connecté à GitHub.";
  if (etat.enCours) return "Synchronisation en cours…";
  const morceaux = [];
  if (etat.derniereErreur) morceaux.push(`Échec de la synchronisation : ${etat.derniereErreur.message}`);
  else morceaux.push(etat.derniereSynchro ? `Synchronisé le ${formaterDate(etat.derniereSynchro)}.` : "Jamais synchronisé.");
  if (etat.enAttente) morceaux.push(`${etat.enAttente} modification(s) en attente d'envoi.`);
  if (etat.conflits.length) morceaux.push(`${etat.conflits.length} conflit(s) à résoudre dans les Réglages.`);
  return morceaux.join(" ");
}

function boutonSynchroniser() {
  const bouton = el("button", { type: "button", class: "bouton bouton--secondaire" }, "🔄 Synchroniser");
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    try {
      await synchro.synchroniser();
    } catch {
      // L'erreur est affichée dans l'état de la synchronisation.
    } finally {
      bouton.disabled = false;
    }
  });
  return bouton;
}

// ---- Vues ----
// Chaque vue renvoie { contenu, rafraichir? }. « rafraichir » met à jour la vue
// quand la synchronisation change quelque chose, sans tout reconstruire.

const nomRecette = (entree) => String(entree.recette.nom ?? entree.id);
const detailsParDefaut = ({ chef, source }) => [chef, source?.titre].filter(Boolean).join(" · ");
const nombreRecettes = (nombre) => `${nombre} recette${nombre > 1 ? "s" : ""}`;

// Recettes, dans l'ordre reçu, chacune menant à son écran de détail.
// details : texte affiché sous le nom (par défaut « Chef · Livre »).
function cartesRecettes(entrees, details = detailsParDefaut) {
  return el("ul", { class: "liste-recettes" }, entrees.map((entree) => {
    const texte = details(entree.recette);
    const statut = infosStatut(lireStatut(entree.recette));
    return el("li", {},
      el("a", { class: "carte lien-recette", href: `#/recette/${encodeURIComponent(entree.id)}` },
        el("span", { class: "lien-recette__titre" },
          el("strong", {}, nomRecette(entree)),
          el("span", { class: "lien-recette__statut", title: statut.libelle, "aria-label": statut.libelle }, statut.icone)),
        texte && el("span", { class: "discret" }, texte)));
  }));
}

// Liste de recettes triées par nom.
function listeRecettes(entrees) {
  const [groupe] = classerRecettes(entrees, "nom");
  return [el("p", { class: "discret" }, nombreRecettes(entrees.length)), cartesRecettes(groupe?.entrees ?? [])];
}

// Liste rangée en sections (catégorie, cuisine, chef, statut…).
function listeGroupee(groupes) {
  return groupes.map((groupe) => el("section", { class: "groupe" },
    el("h3", { class: "groupe__titre" }, groupe.titre, el("span", { class: "discret" }, ` · ${groupe.entrees.length}`)),
    cartesRecettes(groupe.entrees)));
}

// Couverture d'un livre : l'image dès qu'elle est disponible, sinon le titre sur fond coloré.
function couvertureLivre(idLivre, titre) {
  const cadre = el("div", { class: "couverture" }, el("span", { class: "couverture__titre" }, titre));
  if (idLivre) {
    synchro.couverture(idLivre).then((image) => {
      if (!image) return;
      cadre.replaceChildren(el("img", { src: URL.createObjectURL(image), alt: `Couverture : ${titre}` }));
    });
  }
  return cadre;
}

// Étagère : un livre par couverture, avec son nombre de recettes ; les recettes sans livre à la fin.
function etagere(entrees, livres) {
  const groupes = classerRecettes(entrees, "livre", livres.map((entree) => ({ id: entree.id, titre: entree.livre?.titre })));
  // Un livre du dépôt sans recette reste sur l'étagère.
  for (const { id, livre } of livres) {
    if (!groupes.some((groupe) => groupe.cle === id)) {
      groupes.splice(groupes.length - (groupes.at(-1)?.cle === null ? 1 : 0), 0,
        { cle: id, titre: livre?.titre ?? id, entrees: [] });
    }
  }
  return el("ul", { class: "etagere" }, groupes.map((groupe) => el("li", {},
    el("a", { class: "etagere__livre", href: `#/livre/${encodeURIComponent(groupe.cle ?? "")}` },
      groupe.cle ? couvertureLivre(groupe.cle, groupe.titre)
        : el("div", { class: "couverture couverture--vide" }, el("span", { class: "couverture__titre" }, "📖")),
      el("strong", { class: "etagere__titre" }, groupe.titre),
      el("span", { class: "discret" }, nombreRecettes(groupe.entrees.length))))));
}

// Critère de classement choisi : retenu sur ce téléphone (simple confort, sans importance s'il se perd).
const CLE_CLASSEMENT = "cuicui.classement";

function lireClassement() {
  try {
    const valeur = localStorage.getItem(CLE_CLASSEMENT);
    return CLASSEMENTS.some((classement) => classement.valeur === valeur) ? valeur : "nom";
  } catch {
    return "nom";
  }
}

function retenirClassement(valeur) {
  try {
    localStorage.setItem(CLE_CLASSEMENT, valeur);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour cette visite.
  }
}

// La synchronisation est automatique : son état et son bouton sont dans les Réglages,
// et le badge en haut de l'écran signale ce qui demande attention.
async function vueRecettes() {
  const liste = el("div");
  const choix = el("select", { class: "classement__choix", id: "classement" },
    CLASSEMENTS.map((classement) => el("option", { value: classement.valeur }, classement.libelle)));
  choix.value = lireClassement();
  choix.addEventListener("change", () => {
    retenirClassement(choix.value);
    rafraichir();
  });
  const barreClassement = el("div", { class: "classement" },
    el("label", { for: "classement" }, "Classer par"), choix);

  async function rafraichir() {
    const [entrees, livres, statut] = await Promise.all([stockage.lireRecettes(), stockage.lireLivres(), synchro.lireEtat()]);

    barreClassement.hidden = entrees.length === 0;
    if (entrees.length === 0) {
      liste.replaceChildren(statut.configure
        ? pageVide("📖", "Aucune recette dans le dépôt.",
          "Ajoutez-en depuis le téléphone ou en envoyant des captures à Claude.")
        : pageVide("📖", "Aucune recette pour l'instant.",
          "Connectez l'application à votre dépôt de recettes dans les Réglages.",
          el("a", { href: "#/reglages", class: "bouton" }, "Aller aux Réglages")));
      return;
    }
    const critere = choix.value;
    if (critere === "nom") liste.replaceChildren(...listeRecettes(entrees));
    else if (critere === "livre") liste.replaceChildren(etagere(entrees, livres));
    else liste.replaceChildren(el("p", { class: "discret" }, nombreRecettes(entrees.length)),
      ...listeGroupee(classerRecettes(entrees, critere)));
  }

  await rafraichir();
  return {
    contenu: page("Mes recettes", barreClassement, liste),
    rafraichir,
  };
}

// Un livre : sa couverture, ses informations et ses recettes dans l'ordre des pages.
// idLivre vide : les recettes qui ne viennent d'aucun livre connu.
async function vueLivre(idLivre) {
  const contenu = el("div");

  async function rafraichir() {
    const [entrees, entreeLivre] = await Promise.all([stockage.lireRecettes(), idLivre ? stockage.lireLivre(idLivre) : null]);
    const recettes = entrees.filter((entree) => (entree.recette.source?.livre || "") === idLivre);
    const livre = entreeLivre?.livre ?? {};
    const titre = idLivre ? livre.titre ?? recettes[0]?.recette.source?.titre ?? idLivre : "Sans livre";

    if (idLivre && !entreeLivre && recettes.length === 0) {
      contenu.replaceChildren(
        el("a", { href: "#/", class: "retour" }, "← Mes recettes"),
        pageVide("🤔", "Ce livre n'existe pas ou plus.", "Il a peut-être été supprimé du dépôt."));
      return;
    }
    const publication = [livre.editeur, livre.annee].filter(Boolean).join(", ");
    contenu.replaceChildren(
      el("a", { href: "#/", class: "retour" }, "← Mes recettes"),
      el("div", { class: "livre" },
        idLivre ? couvertureLivre(idLivre, titre) : null,
        el("div", { class: "livre__infos" },
          el("h2", {}, titre),
          livre.sousTitre && el("p", {}, livre.sousTitre),
          livre.auteur && el("p", {}, el("strong", {}, livre.auteur)),
          publication && el("p", { class: "discret" }, publication),
          el("p", { class: "discret" }, nombreRecettes(recettes.length)))),
      idLivre
        ? cartesRecettes(trierParPage(recettes), ({ source }) => (source?.page ? `p. ${source.page}` : ""))
        : cartesRecettes(classerRecettes(recettes, "nom")[0]?.entrees ?? []));
  }

  await rafraichir();
  return { contenu, rafraichir };
}

// Onglets « Favoris » et « À essayer » : les recettes d'un statut donné.
function vueStatut(statut, titre, vide) {
  return async () => {
    const liste = el("div");
    async function rafraichir() {
      const entrees = (await stockage.lireRecettes()).filter((entree) => lireStatut(entree.recette) === statut);
      liste.replaceChildren(...(entrees.length ? listeRecettes(entrees) : [vide()]));
    }
    await rafraichir();
    return { contenu: page(titre, liste), rafraichir };
  };
}

// N'accepte que les liens web : une adresse « javascript: » venue d'une recette serait dangereuse.
function lienWeb(adresse) {
  try {
    const url = new URL(adresse);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// Ouvre le menu de partage du téléphone, ou copie la recette si le navigateur ne sait pas partager.
async function partager(recette, message) {
  const texte = recetteEnTexte(recette);
  const afficherMessage = (contenu, type) => {
    message.textContent = contenu;
    message.className = `message message--${type}`;
  };
  if (navigator.share) {
    try {
      await navigator.share({ title: String(recette.nom ?? recette.id), text: texte });
    } catch (erreur) {
      if (erreur.name !== "AbortError") afficherMessage("Le partage a échoué.", "erreur");
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(texte);
    afficherMessage("Recette copiée : collez-la dans un message.", "succes");
  } catch {
    afficherMessage("Le partage n'est pas disponible sur cet appareil.", "erreur");
  }
}

async function vueRecette(id) {
  const entree = await stockage.lireRecette(id);
  if (!entree) {
    return {
      contenu: page("Recette introuvable",
        pageVide("🤔", "Cette recette n'existe pas ou plus.", "Elle a peut-être été supprimée du dépôt.",
          el("a", { href: "#/", class: "bouton" }, "Retour aux recettes"))),
    };
  }

  let { recette } = entree;
  const source = formaterSource(recette);
  const lienSource = lienWeb(recette.source?.url);
  const infos = formaterInfos(recette);
  const categorie = recette.categorie && (CATEGORIES[recette.categorie] ?? majuscule(String(recette.categorie)));
  const etiquettes = [
    recette.cuisine,
    recette.difficulte,
    ...(Array.isArray(recette.motsCles) ? recette.motsCles : []),
  ].filter(Boolean).map((etiquette) => majuscule(String(etiquette)));

  // Toute modification (statut, notes) passe par ici : ligne d'historique,
  // enregistrement sur le téléphone, envoi à GitHub, mise à jour de l'écran.
  function appliquer(champ, valeur) {
    const nouvelle = modifier(recette, champ, valeur);
    if (nouvelle === recette) return false;
    recette = nouvelle;
    synchro.enregistrer(recette);
    afficherStatut();
    return true;
  }

  // Photo du plat (pas la page du livre) : chargée sans bloquer l'affichage de la recette.
  const photoPlat = el("figure", { class: "photo-plat", hidden: true });
  synchro.photo(id, recette.photos?.plat).then((image) => {
    if (!image) return;
    const adresse = URL.createObjectURL(image);
    photoPlat.replaceChildren(el("img", { src: adresse, alt: `Photo : ${recette.nom ?? id}` }));
    photoPlat.hidden = false;
  });

  // Choix du statut : un appui suffit.
  const choixStatut = el("div", { class: "statuts", role: "radiogroup", "aria-label": "Statut de la recette" },
    STATUTS.map((statut) => el("button", {
      type: "button", class: "statut", role: "radio", "data-valeur": statut.valeur,
    }, `${statut.icone} ${statut.libelle}`)));
  function afficherStatut() {
    for (const bouton of choixStatut.querySelectorAll(".statut")) {
      bouton.setAttribute("aria-checked", String(bouton.dataset.valeur === lireStatut(recette)));
    }
  }
  choixStatut.addEventListener("click", (evenement) => {
    const bouton = evenement.target.closest(".statut");
    if (bouton) appliquer("statut", bouton.dataset.valeur);
  });
  afficherStatut();

  // Notes personnelles : enregistrées sur demande (une modification = une ligne d'historique).
  const champNotes = el("textarea", {
    class: "notes-saisie", rows: "4", "aria-label": "Mes notes",
    placeholder: "Moins de sucre, 5 minutes de cuisson en plus…",
  });
  champNotes.value = recette.notes ?? "";
  const messageNotes = el("p", { class: "message", role: "status" });
  const boutonNotes = el("button", { type: "button", class: "bouton bouton--secondaire" }, "Enregistrer les notes");
  boutonNotes.addEventListener("click", () => {
    const enregistre = appliquer("notes", champNotes.value.trim());
    messageNotes.textContent = enregistre ? "Notes enregistrées." : "Aucun changement.";
    messageNotes.className = `message message--${enregistre ? "succes" : "info"}`;
  });

  const message = el("p", { class: "message", role: "status" });
  const boutonPartager = el("button", { type: "button", class: "bouton bouton--secondaire" }, "📤 Partager");
  boutonPartager.addEventListener("click", () => partager(recette, message));

  return {
    contenu: el("article", { class: "recette" },
      el("a", { href: "#/", class: "retour" }, "← Mes recettes"),
      el("h2", {}, String(recette.nom ?? id)),
      photoPlat,
      source && el("p", { class: "discret" }, source),
      recette.source?.livre && el("p", {},
        el("a", { href: `#/livre/${encodeURIComponent(recette.source.livre)}` }, "📚 Toutes les recettes du livre")),
      lienSource && el("p", {}, el("a", { href: lienSource, target: "_blank", rel: "noopener noreferrer" }, "Voir la recette en ligne")),
      infos && el("p", { class: "recette__infos" }, infos),
      (categorie || etiquettes.length > 0) && el("ul", { class: "etiquettes" },
        categorie && el("li", { class: "etiquette--categorie" }, categorie),
        etiquettes.map((etiquette) => el("li", {}, etiquette))),
      choixStatut,
      el("div", { class: "barre-actions" }, boutonPartager),
      message,
      el("h3", {}, "Ingrédients"),
      grouperIngredients(recette.ingredients).map((groupe) => el("section", {},
        groupe.nom && el("h4", {}, String(groupe.nom)),
        el("ul", { class: "ingredients" }, groupe.ingredients.map((ingredient) => el("li", {}, formaterIngredient(ingredient)))))),
      el("h3", {}, "Préparation"),
      el("ol", { class: "etapes" }, (recette.etapes ?? []).map((etape) => el("li", {}, String(etape)))),
      el("h3", {}, "Mes notes"),
      champNotes,
      el("div", { class: "barre-actions" }, boutonNotes),
      messageNotes),
  };
}

async function vueReglages() {
  const config = await synchro.lireConfig();
  const message = el("p", { class: "message", role: "status" });
  const champ = (libelle, attributs) => el("label", { class: "champ" }, el("span", {}, libelle), el("input", attributs));

  const champJeton = el("input", { name: "jeton", type: "password", autocomplete: "off", spellcheck: "false" });
  const boutonOublier = el("button", { type: "button", class: "bouton bouton--secondaire" }, "Oublier le jeton");
  const afficherJetonEnregistre = (present) => {
    champJeton.placeholder = present ? "Enregistré – laisser vide pour le garder" : "github_pat_…";
    boutonOublier.hidden = !present;
  };
  afficherJetonEnregistre(config?.aUnJeton);

  const afficherMessage = (texte, type) => {
    message.textContent = texte;
    message.className = `message message--${type}`;
  };

  const formulaire = el("form", { class: "carte formulaire" },
    el("p", {}, el("strong", {}, "Connexion à GitHub")),
    champ("Propriétaire du dépôt", { name: "proprietaire", required: true, autocomplete: "off", autocapitalize: "off", spellcheck: "false", value: config?.proprietaire ?? DEPOT_PAR_DEFAUT.proprietaire }),
    champ("Dépôt des recettes", { name: "depot", required: true, autocomplete: "off", autocapitalize: "off", spellcheck: "false", value: config?.depot ?? DEPOT_PAR_DEFAUT.depot }),
    el("label", { class: "champ" }, el("span", {}, "Jeton d'accès"), champJeton),
    el("p", { class: "discret" },
      "Jeton « fine-grained » limité à ce seul dépôt, permission Contents en lecture et écriture. Il reste sur ce téléphone."),
    el("div", { class: "barre-actions" }, el("button", { type: "submit", class: "bouton" }, "Enregistrer et tester"), boutonOublier),
    message);

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const bouton = formulaire.querySelector("button[type=submit]");
    const donnees = new FormData(formulaire);
    bouton.disabled = true;
    afficherMessage("Vérification de la connexion…", "info");
    try {
      const infos = await synchro.configurer({
        proprietaire: donnees.get("proprietaire"),
        depot: donnees.get("depot"),
        jeton: donnees.get("jeton"),
      });
      champJeton.value = "";
      afficherJetonEnregistre(true);
      if (infos.prive) afficherMessage(`Connecté à ${infos.nomComplet}.`, "succes");
      else afficherMessage(`Connecté à ${infos.nomComplet}, mais ce dépôt est PUBLIC : vos recettes sont visibles de tous.`, "erreur");
      synchro.synchroniser().catch(() => {});
    } catch (erreur) {
      afficherMessage(erreur.message, "erreur");
    } finally {
      bouton.disabled = false;
    }
  });

  boutonOublier.addEventListener("click", async () => {
    await synchro.oublierJeton();
    afficherJetonEnregistre(false);
    afficherMessage("Jeton supprimé de ce téléphone. Révoquez-le aussi sur GitHub si vous ne l'utilisez plus.", "info");
  });

  const etat = el("p", { class: "discret" });
  const conflits = el("div");

  const historique = el("div");
  let toutAfficher = false;

  async function rafraichir() {
    const statut = await synchro.lireEtat();
    etat.textContent = texteEtat(statut);
    conflits.replaceChildren(...statut.conflits.map((operation) =>
      el("div", { class: "conflit" },
        el("p", {}, el("strong", {}, String(operation.recette.nom ?? operation.id)),
          " a été modifiée à la fois sur ce téléphone et sur GitHub."),
        el("div", { class: "barre-actions" },
          el("button", { type: "button", class: "bouton", onclick: () => synchro.choisirVersion(operation.id, "locale") },
            "Garder ma version"),
          el("button", { type: "button", class: "bouton bouton--secondaire", onclick: () => synchro.choisirVersion(operation.id, "distante") },
            "Garder la version GitHub")))));
    await afficherHistoriqueGlobal();
  }

  // Historique de toutes les recettes, le plus récent en premier, avec retour en arrière.
  async function afficherHistoriqueGlobal() {
    const lignes = (await stockage.lireRecettes())
      .flatMap((entree) => (Array.isArray(entree.recette.historique) ? entree.recette.historique : [])
        .map((ligne) => ({ entree, ligne })))
      .sort((a, b) => String(b.ligne.date).localeCompare(String(a.ligne.date)));
    if (!lignes.length) {
      historique.replaceChildren(el("p", { class: "discret" }, "Aucune modification pour l'instant."));
      return;
    }
    const visibles = toutAfficher ? lignes : lignes.slice(0, LIGNES_HISTORIQUE);
    historique.replaceChildren(
      el("ul", { class: "historique" }, visibles.map(({ entree, ligne }) => {
        const nom = String(entree.recette.nom ?? entree.id);
        const dejaRevenu = valeurActuelle(entree.recette, ligne.champ) === ligne.avant;
        const libelleRetour = ligne.champ === "statut"
          ? `↩ Revenir à « ${infosStatut(lireStatut({ statut: ligne.avant }))?.libelle ?? ligne.avant} »`
          : "↩ Revenir aux notes précédentes";
        return el("li", {},
          el("span", { class: "discret" }, formaterDate(Date.parse(ligne.date))),
          el("a", { href: `#/recette/${encodeURIComponent(entree.id)}`, class: "historique__recette" }, nom),
          el("span", {}, formaterModification(ligne)),
          !dejaRevenu && el("button", {
            type: "button", class: "bouton bouton--secondaire bouton--petit",
            onclick: () => revenir(entree.id, ligne),
          }, libelleRetour));
      })),
      lignes.length > LIGNES_HISTORIQUE && el("button", {
        type: "button", class: "bouton bouton--secondaire bouton--petit",
        onclick: () => { toutAfficher = !toutAfficher; afficherHistoriqueGlobal(); },
      }, toutAfficher ? "Afficher moins" : `Tout afficher (${lignes.length})`));
  }

  async function revenir(id, ligne) {
    const entree = await stockage.lireRecette(id);
    if (!entree) return;
    const nouvelle = modifier(entree.recette, ligne.champ, ligne.avant);
    if (nouvelle !== entree.recette) synchro.enregistrer(nouvelle); // la synchro rafraîchit l'écran
  }

  await rafraichir();

  const horsLigne = el("p", { class: "discret" }, "Vérification du mode hors ligne…");
  afficherEtatHorsLigne(horsLigne);
  const stockageProtege = el("p", { class: "discret" }, "Vérification de la protection des données…");
  afficherEtatStockage(stockageProtege);

  return {
    contenu: page("Réglages",
      formulaire,
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "Synchronisation")), etat, conflits,
        el("div", { class: "barre-actions" }, boutonSynchroniser())),
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "À propos")),
        el("p", { class: "discret" }, `CuiCui Cooking, version ${VERSION}.`),
        horsLigne,
        stockageProtege),
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "Historique des modifications")),
        el("p", { class: "discret" }, "Changements de statut et de notes sur toutes les recettes."),
        historique)),
    rafraichir,
  };
}

const LIGNES_HISTORIQUE = 20;

const vues = {
  "/": vueRecettes,
  "/favoris": vueStatut("favorite", "Mes meilleures recettes", () =>
    pageVide("⭐", "Aucune favorite pour l'instant.",
      "Sur l'écran d'une recette, choisissez « ⭐ Favorite » pour la retrouver ici.")),
  "/a-essayer": vueStatut("a-essayer", "À essayer", () =>
    pageVide("📝", "Aucune recette à essayer.",
      "Les recettes jamais cuisinées apparaissent ici, comme une liste de choses à faire.")),
  "/courses": () => ({
    contenu: page("Liste de courses",
      pageVide("🛒", "Votre liste de courses est vide.",
        "Sélectionnez plusieurs recettes pour obtenir la liste de tous les ingrédients à acheter.")),
  }),
  "/reglages": vueReglages,
};

// ---- Navigation ----

let rafraichirVue = null;
let numeroAffichage = 0;

const PREFIXE_RECETTE = "/recette/";
const PREFIXE_LIVRE = "/livre/";
const estDetail = (route) => route.startsWith(PREFIXE_RECETTE) || route.startsWith(PREFIXE_LIVRE);

function routeCourante() {
  const route = location.hash.replace(/^#/, "") || "/";
  if (estDetail(route)) return route;
  return route in vues ? route : "/";
}

function identifiant(route, prefixe) {
  try {
    return decodeURIComponent(route.slice(prefixe.length));
  } catch {
    return "";
  }
}

function chargerVue(route) {
  if (route.startsWith(PREFIXE_RECETTE)) return vueRecette(identifiant(route, PREFIXE_RECETTE));
  if (route.startsWith(PREFIXE_LIVRE)) return vueLivre(identifiant(route, PREFIXE_LIVRE));
  return vues[route]();
}

async function afficher() {
  const numero = ++numeroAffichage;
  const route = routeCourante();
  const { contenu, rafraichir } = await chargerVue(route);
  if (numero !== numeroAffichage) return; // une autre page a été demandée entre-temps

  rafraichirVue = rafraichir ?? null;
  const conteneur = document.getElementById("vue");
  conteneur.replaceChildren(contenu);
  conteneur.scrollTop = 0;

  // Le détail d'une recette ou d'un livre reste rattaché à l'onglet « Recettes ».
  const onglet = estDetail(route) ? "/" : route;
  for (const lien of document.querySelectorAll(".navigation a")) {
    if (lien.dataset.route === onglet) lien.setAttribute("aria-current", "page");
    else lien.removeAttribute("aria-current");
  }
}

// ---- État global ----

async function afficherEtatHorsLigne(element) {
  if (!("serviceWorker" in navigator)) {
    element.textContent = "Mode hors ligne non pris en charge par ce navigateur.";
    return;
  }
  const enregistrement = await navigator.serviceWorker.getRegistration();
  element.textContent = enregistrement?.active
    ? "Mode hors ligne prêt : l'application fonctionne sans connexion."
    : "Mode hors ligne en cours d'installation…";
}

// Demande au navigateur de ne pas effacer les recettes et les photos quand le téléphone
// manque de place. Chrome l'accorde sans rien demander, notamment à une application installée.
// Renvoie true (protégé), false (refusé) ou null (non pris en charge).
async function protegerStockage() {
  try {
    if (!navigator.storage?.persist) return null;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return null;
  }
}

async function afficherEtatStockage(element) {
  const protege = await protegerStockage();
  element.textContent = protege === null
    ? "Protection des données non prise en charge par ce navigateur."
    : protege
      ? "Recettes et photos protégées : le téléphone ne les effacera pas pour faire de la place."
      : "Recettes et photos non protégées : le téléphone pourrait les effacer s'il manque de place. "
        + "Installer l'application sur l'écran d'accueil permet de les protéger.";
}

async function mettreAJourBadge() {
  const badge = document.getElementById("etat-synchro");
  const etat = await synchro.lireEtat();
  if (etat.conflits.length) badge.textContent = "⚠️ Conflit";
  else if (etat.derniereErreur && !etat.derniereErreur.estHorsLigne) badge.textContent = "⚠️ Synchro";
  else if (etat.enCours) badge.textContent = "🔄";
  else if (etat.enAttente) badge.textContent = `${etat.enAttente} en attente`;
  else badge.textContent = "";
  badge.hidden = !badge.textContent;
}

function suivreConnexion() {
  const badge = document.getElementById("etat-connexion");
  const mettreAJour = () => { badge.hidden = navigator.onLine; };
  window.addEventListener("online", () => {
    mettreAJour();
    synchro.synchroniser().catch(() => {});
  });
  window.addEventListener("offline", mettreAJour);
  mettreAJour();
}

// ---- Mises à jour de l'application ----
// Une nouvelle version est cherchée à l'ouverture et à chaque retour sur l'application.
// Quand elle prend la main, la page est rechargée : tout de suite si l'application vient
// de s'ouvrir, sinon via un bandeau, pour ne jamais perdre une saisie en cours.

const OUVERTURE = Date.now();

function verifierMiseAJour() {
  navigator.serviceWorker?.getRegistration()
    .then((enregistrement) => enregistrement?.update())
    .catch(() => {}); // hors ligne : on réessaiera au prochain retour
}

function proposerMiseAJour() {
  if (document.querySelector(".bandeau-maj")) return;
  const bandeau = el("div", { class: "bandeau-maj", role: "status" },
    el("span", {}, "Nouvelle version disponible."),
    el("button", { type: "button", class: "bouton", onclick: () => location.reload() }, "Mettre à jour"));
  document.querySelector(".entete").after(bandeau);
}

function enregistrerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const avaitUneVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!avaitUneVersion) return; // première installation : rien à recharger
    if (Date.now() - OUVERTURE < 10_000) location.reload();
    else proposerMiseAJour();
  });
  navigator.serviceWorker.register("sw.js").catch((erreur) => {
    console.error("Échec de l'installation du mode hors ligne :", erreur);
  });
}

synchro.ecouter(() => {
  rafraichirVue?.();
  mettreAJourBadge();
});

// Synchronisation et recherche de mise à jour à l'ouverture et à chaque retour sur l'application.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  synchro.synchroniser().catch(() => {});
  verifierMiseAJour();
});

window.addEventListener("hashchange", afficher);
afficher();
suivreConnexion();
mettreAJourBadge();
enregistrerServiceWorker();
protegerStockage();
synchro.synchroniser().catch(() => {});
