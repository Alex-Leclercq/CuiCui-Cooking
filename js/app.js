// CuiCui Cooking – point d'entrée de l'application.
// Navigation par « hash » (#/favoris…) : fonctionne sans serveur
// particulier, aussi bien en local que sur GitHub Pages.

import { ouvrirStockage } from "./stockage.js";
import { creerClientGitHub } from "./github.js";
import { creerSynchro } from "./synchro.js";
import {
  CATEGORIES, CLASSEMENTS, STATUTS, classerRecettes, formaterIngredient, formaterInfos, formaterModification,
  formaterSource, grouperIngredients, infosStatut, ingredientsPour, lireStatut, majuscule, modifier, nombrePersonnes,
  recetteEnTexte, trierParPage, valeurActuelle,
} from "./recette.js";
import {
  ajouterALaListe, cocherArticle, construireListe, listeEnTexte, listeVide, nettoyerCoches, normaliserListe,
  plierRecette, portionsOrigine, retirerDeLaListe,
} from "./courses.js";

const VERSION = "0.13.1";
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

// En-tête figé en haut de l'écran pendant le défilement : la liste passe dessous.
const enteteFige = (...contenu) => el("div", { class: "entete-vue" }, ...contenu);

// Ligne de titre d'un en-tête figé, avec à droite un compteur discret (« 100 recettes »).
const ligneTitre = (titre, compteur) =>
  el("div", { class: "entete-vue__titre" }, el("h2", {}, titre), compteur);

// Court message en bas de l'écran, visible même au milieu d'une page qu'on fait défiler.
let minuterieNotification = null;
function notifier(texte, type = "info") {
  let bulle = document.querySelector(".notification");
  if (!bulle) {
    bulle = el("div", { class: "notification", role: "status" });
    document.body.append(bulle);
  }
  bulle.textContent = texte;
  bulle.className = `notification notification--${type} notification--visible`;
  clearTimeout(minuterieNotification);
  minuterieNotification = setTimeout(() => bulle.classList.remove("notification--visible"), 3000);
}

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
// selection : en mode sélection (liste de courses), chaque recette devient une case à cocher.
function cartesRecettes(entrees, details = detailsParDefaut, selection = null) {
  return el("ul", { class: "liste-recettes" }, entrees.map((entree) => {
    const statut = infosStatut(lireStatut(entree.recette));
    const titre = el("span", { class: "lien-recette__titre" },
      el("strong", {}, nomRecette(entree)),
      el("span", { class: "lien-recette__statut", title: statut.libelle, "aria-label": statut.libelle }, statut.icone));
    if (selection?.active()) {
      const dejaLa = selection.dansLaListe(entree.id);
      return el("li", {},
        el("label", { class: "carte lien-recette lien-recette--choix" },
          el("input", {
            type: "checkbox", checked: dejaLa || selection.choisie(entree.id), disabled: dejaLa,
            onchange: (evenement) => selection.basculer(entree.id, evenement.target.checked),
          }),
          el("span", { class: "lien-recette__corps" },
            titre,
            el("span", { class: "discret" }, dejaLa ? "Déjà dans la liste de courses" : details(entree.recette)))));
    }
    const texte = details(entree.recette);
    return el("li", {},
      el("a", { class: "carte lien-recette", href: `#/recette/${encodeURIComponent(entree.id)}` },
        titre,
        texte && el("span", { class: "discret" }, texte)));
  }));
}

// Liste de recettes triées par nom (le nombre de recettes est affiché dans l'en-tête figé).
function listeRecettes(entrees, selection = null) {
  const [groupe] = classerRecettes(entrees, "nom");
  return [cartesRecettes(groupe?.entrees ?? [], undefined, selection)];
}

// Liste rangée en sections (catégorie, cuisine, chef, statut…).
function listeGroupee(groupes, selection = null) {
  return groupes.map((groupe) => el("section", { class: "groupe" },
    el("h3", { class: "groupe__titre" }, groupe.titre, el("span", { class: "discret" }, ` · ${groupe.entrees.length}`)),
    cartesRecettes(groupe.entrees, undefined, selection)));
}

// Mode sélection : cocher plusieurs recettes, puis les ajouter d'un coup à la liste de courses,
// chacune pour son nombre de personnes d'origine. reafficher : redessine la liste des recettes.
// Pendant la sélection, la barre « Annuler / Ajouter » prend la place de la barre de navigation.
function creerSelection(reafficher) {
  let active = false;
  const choisies = new Set();
  let dejaDansLaListe = new Set();
  const message = el("p", { class: "message", role: "status" });
  const boutonSelectionner = el("button", { type: "button", class: "bouton bouton--secondaire bouton--petit" }, "🛒 Sélectionner");
  const boutonAjouter = el("button", { type: "button", class: "bouton barre-selection__ajouter" });
  const boutonAnnuler = el("button", { type: "button", class: "bouton bouton--secondaire" }, "Annuler");
  const barre = el("div", { class: "barre-selection", hidden: true }, boutonAnnuler, boutonAjouter);

  function afficherBarre() {
    boutonSelectionner.hidden = active;
    barre.hidden = !active;
    document.body.classList.toggle("selection-en-cours", active);
    boutonAjouter.disabled = choisies.size === 0;
    boutonAjouter.textContent = choisies.size ? `🛒 Ajouter ${nombreRecettes(choisies.size)}` : "Cochez des recettes";
  }

  function changerMode(nouveau) {
    active = nouveau;
    choisies.clear();
    afficherBarre();
    reafficher();
  }

  boutonSelectionner.addEventListener("click", async () => {
    dejaDansLaListe = new Set((await lireListeCourses()).recettes.map((choix) => choix.id));
    message.textContent = "";
    changerMode(true);
  });
  boutonAnnuler.addEventListener("click", () => changerMode(false));
  boutonAjouter.addEventListener("click", async () => {
    const recettes = await Promise.all([...choisies].map((id) => stockage.lireRecette(id)));
    const nombre = recettes.filter(Boolean).length;
    await modifierListeCourses((liste) => recettes.filter(Boolean)
      .reduce((suite, entree) => ajouterALaListe(suite, entree.id, portionsOrigine(entree.recette)), liste));
    changerMode(false);
    annoncerAjout(message, `${nombreRecettes(nombre)} ajoutée${nombre > 1 ? "s" : ""} à la liste de courses.`);
  });
  afficherBarre();

  return {
    boutonSelectionner, barre, message,
    active: () => active,
    // En quittant l'écran : la barre de navigation revient.
    quitter: () => document.body.classList.remove("selection-en-cours"),
    choisie: (id) => choisies.has(id),
    dansLaListe: (id) => dejaDansLaListe.has(id),
    basculer(id, coche) {
      if (coche) choisies.add(id);
      else choisies.delete(id);
      afficherBarre();
    },
  };
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
  const selection = creerSelection(() => rafraichir());
  const barreClassement = el("div", { class: "classement" },
    el("label", { for: "classement" }, "Classer par"), choix, selection.boutonSelectionner);
  const compteur = el("span", { class: "discret" });

  async function rafraichir() {
    const [entrees, livres, statut] = await Promise.all([stockage.lireRecettes(), stockage.lireLivres(), synchro.lireEtat()]);

    barreClassement.hidden = entrees.length === 0;
    compteur.textContent = entrees.length ? nombreRecettes(entrees.length) : "";
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
    const titresLivres = livres.map((entree) => ({ id: entree.id, titre: entree.livre?.titre }));
    if (critere === "nom") liste.replaceChildren(...listeRecettes(entrees, selection));
    // En mode sélection, l'étagère laisse place aux recettes rangées par livre.
    else if (critere === "livre" && !selection.active()) liste.replaceChildren(etagere(entrees, livres));
    else liste.replaceChildren(...listeGroupee(classerRecettes(entrees, critere, titresLivres), selection));
  }

  await rafraichir();
  return {
    contenu: el("div", {},
      enteteFige(ligneTitre("Mes recettes", compteur), barreClassement),
      selection.message, liste, selection.barre),
    rafraichir,
    quitter: selection.quitter,
  };
}

// Un livre : sa couverture, ses informations et ses recettes dans l'ordre des pages.
// idLivre vide : les recettes qui ne viennent d'aucun livre connu.
async function vueLivre(idLivre) {
  const contenu = el("div");
  // En-tête figé compact : retour et titre du livre ; la couverture défile avec la liste.
  const nomFige = el("strong", { class: "entete-vue__nom" });
  const entete = enteteFige(el("div", { class: "entete-vue__barre" },
    boutonRetour(), nomFige));

  async function rafraichir() {
    const [entrees, entreeLivre] = await Promise.all([stockage.lireRecettes(), idLivre ? stockage.lireLivre(idLivre) : null]);
    const recettes = entrees.filter((entree) => (entree.recette.source?.livre || "") === idLivre);
    const livre = entreeLivre?.livre ?? {};
    const titre = idLivre ? livre.titre ?? recettes[0]?.recette.source?.titre ?? idLivre : "Sans livre";

    if (idLivre && !entreeLivre && recettes.length === 0) {
      nomFige.textContent = "";
      contenu.replaceChildren(pageVide("🤔", "Ce livre n'existe pas ou plus.", "Il a peut-être été supprimé du dépôt."));
      return;
    }
    nomFige.textContent = titre;
    const publication = [livre.editeur, livre.annee].filter(Boolean).join(", ");
    contenu.replaceChildren(
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
  return { contenu: el("div", {}, entete, contenu), rafraichir };
}

// Onglets « Favoris » et « À essayer » : les recettes d'un statut donné.
function vueStatut(statut, titre, vide) {
  return async () => {
    const liste = el("div");
    const selection = creerSelection(() => rafraichir());
    const compteur = el("span", { class: "discret" });
    const barreSelection = el("div", { class: "classement" }, selection.boutonSelectionner);
    async function rafraichir() {
      const entrees = (await stockage.lireRecettes()).filter((entree) => lireStatut(entree.recette) === statut);
      barreSelection.hidden = entrees.length === 0;
      compteur.textContent = entrees.length ? nombreRecettes(entrees.length) : "";
      liste.replaceChildren(...(entrees.length ? listeRecettes(entrees, selection) : [vide()]));
    }
    await rafraichir();
    return {
      contenu: el("div", {},
        enteteFige(ligneTitre(titre, compteur), barreSelection),
        selection.message, liste, selection.barre),
      rafraichir,
      quitter: selection.quitter,
    };
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

// Ouvre le menu de partage du téléphone, ou copie le texte si le navigateur ne sait pas partager.
// copie : message affiché après la copie (« Recette copiée… »).
async function partagerTexte(titre, texte, message, copie) {
  const afficherMessage = (contenu, type) => {
    message.textContent = contenu;
    message.className = `message message--${type}`;
  };
  if (navigator.share) {
    try {
      await navigator.share({ title: titre, text: texte });
    } catch (erreur) {
      if (erreur.name !== "AbortError") afficherMessage("Le partage a échoué.", "erreur");
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(texte);
    afficherMessage(copie, "succes");
  } catch {
    afficherMessage("Le partage n'est pas disponible sur cet appareil.", "erreur");
  }
}

const partager = (recette, message, personnes) => partagerTexte(String(recette.nom ?? recette.id),
  recetteEnTexte(recette, personnes ?? recette.portions), message, "Recette copiée : collez-la dans un message.");

// ---- Liste de courses ----
// Rangée sur le téléphone seulement (magasin « meta ») : elle n'est jamais envoyée à GitHub.

const CLE_LISTE_COURSES = "listeCourses";
const lireListeCourses = async () => normaliserListe(await stockage.lireMeta(CLE_LISTE_COURSES));
const ecrireListeCourses = (liste) => stockage.ecrireMeta(CLE_LISTE_COURSES, liste);

async function modifierListeCourses(changement) {
  const liste = changement(await lireListeCourses());
  await ecrireListeCourses(liste);
  return liste;
}

// « Ajoutée à la liste de courses. Voir la liste »
function annoncerAjout(message, texte) {
  message.replaceChildren(`${texte} `, el("a", { href: "#/courses" }, "Voir la liste"));
  message.className = "message message--succes";
}

const PERSONNES_MIN = 1;
const PERSONNES_MAX = 50;

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
  const infos = formaterInfos(recette, { avecPortions: false }); // le nombre de personnes a son propre réglage
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

  // Choix du statut : une pastille en haut à droite qui ouvre la liste de choix du téléphone.
  // Deux gestes volontaires pour changer de statut : pas de changement par un appui accidentel.
  const listeStatuts = el("select", { class: "statut-choix__liste", "aria-label": "Statut de la recette" },
    STATUTS.map((statut) => el("option", { value: statut.valeur }, `${statut.icone} ${statut.libelle}`)));
  const choixStatut = el("label", { class: "statut-choix" }, listeStatuts,
    el("span", { class: "statut-choix__chevron", "aria-hidden": "true" }));
  function afficherStatut() {
    listeStatuts.value = lireStatut(recette);
  }
  listeStatuts.addEventListener("change", () => appliquer("statut", listeStatuts.value));
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

  // Nombre de personnes : ajustable sur cet écran seulement. Jamais enregistré :
  // la recette se rouvre toujours sur son nombre d'origine. Sans nombre d'origine, pas de réglage.
  const origine = Number.isInteger(recette.portions) && recette.portions > 0 ? recette.portions : null;
  let personnes = origine;
  const listeIngredients = el("div");
  const avertissementEtapes = el("p", { class: "message message--info", hidden: true });
  const valeurPersonnes = el("output", { class: "portions__valeur", "aria-live": "polite" });
  // Les signes − et + sont dessinés en CSS : parfaitement centrés, quelle que soit la police du téléphone.
  const boutonMoins = el("button", { type: "button", class: "portions__bouton", "aria-label": "Une personne de moins" });
  const boutonPlus = el("button", { type: "button", class: "portions__bouton portions__bouton--plus", "aria-label": "Une personne de plus" });
  const boutonRevenir = el("button", { type: "button", class: "bouton bouton--secondaire bouton--petit", hidden: true });

  function afficherIngredients() {
    const ajustee = origine !== null && personnes !== origine;
    valeurPersonnes.textContent = origine ? nombrePersonnes(personnes) : "";
    boutonMoins.disabled = personnes <= PERSONNES_MIN;
    boutonPlus.disabled = personnes >= PERSONNES_MAX;
    boutonRevenir.hidden = !ajustee;
    boutonRevenir.textContent = `↩ Revenir à ${origine}`;
    avertissementEtapes.hidden = !ajustee;
    avertissementEtapes.textContent = ajustee
      ? `Les quantités citées dans les étapes sont celles de la recette pour ${nombrePersonnes(origine)}.` : "";
    listeIngredients.replaceChildren(...grouperIngredients(ingredientsPour(recette, personnes)).map((groupe) =>
      el("section", {},
        groupe.nom && el("h4", {}, String(groupe.nom)),
        el("ul", { class: "ingredients" }, groupe.ingredients.map((ingredient) => el("li", {}, formaterIngredient(ingredient)))))));
    afficherBoutonListe();
  }

  // Liste de courses : la recette y entre pour le nombre de personnes affiché.
  // Déjà dans la liste pour ce nombre : le bouton y mène ; pour un autre nombre : il le met à jour.
  const message = el("p", { class: "message", role: "status" });
  const boutonListe = el("button", { type: "button", class: "bouton bouton--secondaire" });
  let dansLaListe = (await lireListeCourses()).recettes.find((choix) => choix.id === id) ?? null;
  const memeNombre = () => dansLaListe && (origine === null || (dansLaListe.personnes ?? origine) === personnes);
  function afficherBoutonListe() {
    boutonListe.textContent = !dansLaListe ? "🛒 Ajouter à la liste"
      : memeNombre() ? "✓ Dans la liste de courses" : "🛒 Mettre à jour la liste";
  }
  boutonListe.addEventListener("click", async () => {
    if (memeNombre()) {
      location.hash = "#/courses";
      return;
    }
    const miseAJour = !!dansLaListe;
    const liste = await modifierListeCourses((actuelle) => ajouterALaListe(actuelle, id, personnes));
    dansLaListe = liste.recettes.find((choix) => choix.id === id);
    afficherBoutonListe();
    const pour = origine ? ` pour ${nombrePersonnes(personnes)}` : "";
    annoncerAjout(message, miseAJour ? `Liste de courses mise à jour${pour}.` : `Ajoutée à la liste de courses${pour}.`);
  });
  const changerPersonnes = (nombre) => {
    personnes = Math.min(Math.max(nombre, PERSONNES_MIN), PERSONNES_MAX);
    afficherIngredients();
  };
  boutonMoins.addEventListener("click", () => changerPersonnes(personnes - 1));
  boutonPlus.addEventListener("click", () => changerPersonnes(personnes + 1));
  boutonRevenir.addEventListener("click", () => changerPersonnes(origine));
  afficherIngredients();

  const reglagePortions = origine && el("div", { class: "portions", role: "group", "aria-label": "Nombre de personnes" },
    el("span", {}, "Pour"), boutonMoins, valeurPersonnes, boutonPlus, boutonRevenir);

  const boutonPartager = el("button", { type: "button", class: "bouton bouton--secondaire" }, "📤 Partager");
  boutonPartager.addEventListener("click", () => partager(recette, message, personnes));
  const ecranAllume = garderEcranAllume();

  return {
    contenu: el("article", { class: "recette" },
      // Barre figée : retour à gauche ; écran allumé et statut à droite, à portée pendant qu'on cuisine.
      enteteFige(el("div", { class: "entete-vue__barre" },
        boutonRetour(),
        el("span", { class: "entete-vue__espace" }),
        ecranAllume.bouton,
        choixStatut)),
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
      el("div", { class: "barre-actions" }, boutonPartager, boutonListe),
      message,
      el("h3", {}, "Ingrédients"),
      reglagePortions,
      listeIngredients,
      el("h3", {}, "Préparation"),
      avertissementEtapes,
      el("ol", { class: "etapes" }, (recette.etapes ?? []).map((etape) => el("li", {}, String(etape)))),
      el("h3", {}, "Mes notes"),
      champNotes,
      el("div", { class: "barre-actions" }, boutonNotes),
      messageNotes),
    quitter: ecranAllume.arreter,
  };
}

// Icône « Garder l'écran allumé » (🔆) : tant qu'elle est activée, le téléphone ne se met pas en veille.
// Jamais mémorisé : il s'arrête en quittant la recette. Quand l'application passe en arrière-plan,
// le navigateur rend la main ; on redemande l'écran allumé au retour.
// Masquée si le navigateur ne sait pas le faire.
function garderEcranAllume() {
  const bouton = el("button", {
    type: "button", class: "bouton-icone", "aria-pressed": "false", "aria-label": "Garder l'écran allumé",
    title: "Garder l'écran allumé", hidden: !("wakeLock" in navigator),
  }, "🔆");
  let verrou = null;
  let actif = false;

  async function demander() {
    try {
      verrou = await navigator.wakeLock.request("screen");
      verrou.addEventListener("release", () => { verrou = null; });
      if (!actif) await liberer(); // arrêté pendant la demande
    } catch {
      arreter();
      notifier("Impossible de garder l'écran allumé (mode économie d'énergie activé ?).", "erreur");
    }
  }

  async function liberer() {
    const actuel = verrou;
    verrou = null;
    await actuel?.release().catch(() => {});
  }

  function auRetour() {
    if (actif && !verrou && document.visibilityState === "visible") demander();
  }

  function afficherEtat() {
    bouton.setAttribute("aria-pressed", String(actif));
  }

  function arreter() {
    if (!actif) return;
    actif = false;
    document.removeEventListener("visibilitychange", auRetour);
    liberer();
    afficherEtat();
  }

  bouton.addEventListener("click", () => {
    if (actif) {
      arreter();
      notifier("Mise en veille normale rétablie.");
      return;
    }
    actif = true;
    document.addEventListener("visibilitychange", auRetour);
    afficherEtat();
    notifier("🔆 Écran maintenu allumé tant que la recette est ouverte.");
    demander();
  });

  return { bouton, arreter };
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

// Liste de courses : recette par recette, ses ingrédients à cocher en magasin.
// Les articles cochés descendent en bas de leur recette.
async function vueCourses() {
  const contenu = el("div");
  const compteur = el("span", { class: "discret" });
  const message = el("p", { class: "message", role: "status" });
  let texte = "";

  async function changer(changement) {
    await modifierListeCourses(changement);
    await rafraichir();
  }

  const boutonPartager = el("button", { type: "button", class: "bouton bouton--secondaire" }, "📤 Partager");
  boutonPartager.addEventListener("click", () =>
    partagerTexte("Liste de courses", texte, message, "Liste copiée : collez-la dans un message."));
  const boutonVider = el("button", { type: "button", class: "bouton bouton--secondaire" }, "🗑️ Vider la liste");
  boutonVider.addEventListener("click", () => {
    if (confirm("Vider la liste de courses ? Toutes les recettes et les articles cochés seront retirés.")) changer(listeVide);
  });

  // Un article : un appui le coche (barré) ou le décoche.
  const articles = (elements) => el("ul", { class: "courses" }, elements.map((article) =>
    el("li", {},
      el("label", { class: `courses__article${article.coche ? " courses__article--coche" : ""}` },
        el("input", {
          type: "checkbox", checked: article.coche,
          onchange: (evenement) => changer((liste) => cocherArticle(liste, article.cle, evenement.target.checked)),
        }),
        el("span", {}, article.texte)))));

  // Une recette de la liste et ses ingrédients. Le titre plie ou déplie les ingrédients (retenu
  // sur le téléphone) ; le nombre de personnes se règle ici aussi, et la recette peut être retirée.
  function carteRecette(recette) {
    const reglage = (ecart, libelle, classe) => el("button", {
      type: "button", class: classe, "aria-label": libelle,
      disabled: recette.personnes + ecart < PERSONNES_MIN || recette.personnes + ecart > PERSONNES_MAX,
      onclick: () => changer((liste) => ajouterALaListe(liste, recette.id, recette.personnes + ecart)),
    });
    const restants = recette.articles.filter((article) => !article.coche).length;
    const idIngredients = `courses-${recette.id}`;
    return el("li", { class: "carte courses__recette" },
      el("button", {
        type: "button", class: "courses__plier", "aria-expanded": String(!recette.plie), "aria-controls": idIngredients,
        onclick: () => changer((liste) => plierRecette(liste, recette.id, !recette.plie)),
      },
      el("span", { class: "courses__chevron", "aria-hidden": "true" }),
      el("strong", {}, recette.nom),
      el("span", { class: "discret courses__compte" },
        restants ? `${restants} / ${recette.articles.length}` : "✓ Tout acheté")),
      el("div", { class: "portions" },
        recette.personnes
          ? [reglage(-1, "Une personne de moins", "portions__bouton"),
            el("output", { class: "portions__valeur" }, nombrePersonnes(recette.personnes)),
            reglage(1, "Une personne de plus", "portions__bouton portions__bouton--plus")]
          : el("span", { class: "discret" }, "Nombre de personnes non indiqué"),
        el("span", { class: "courses__liens" },
          el("a", { href: `#/recette/${encodeURIComponent(recette.id)}`, class: "bouton bouton--secondaire bouton--petit" }, "Voir"),
          el("button", {
            type: "button", class: "bouton bouton--secondaire bouton--petit", "aria-label": `Retirer ${recette.nom} de la liste`,
            title: "Retirer de la liste",
            onclick: () => changer((liste) => retirerDeLaListe(liste, recette.id)),
          }, "✕"))),
      el("div", { id: idIngredients, hidden: recette.plie },
        recette.articles.length ? articles(recette.articles) : el("p", { class: "discret" }, "Aucun ingrédient.")));
  }

  async function rafraichir() {
    const [liste, entrees] = await Promise.all([lireListeCourses(), stockage.lireRecettes()]);
    const construite = construireListe(liste, new Map(entrees.map((entree) => [entree.id, entree.recette])));
    const nettoyee = nettoyerCoches(liste, construite);
    if (nettoyee !== liste) await ecrireListeCourses(nettoyee);
    texte = listeEnTexte(construite);

    compteur.textContent = "";
    if (!liste.recettes.length) {
      contenu.replaceChildren(pageVide("🛒", "Votre liste de courses est vide.",
        "Sur une recette, touchez « 🛒 Ajouter à la liste ». Pour en ajouter plusieurs d'un coup, touchez « 🛒 Sélectionner » dans Mes recettes.",
        el("a", { href: "#/", class: "bouton" }, "Voir mes recettes")));
      return;
    }
    const tous = construite.recettes.flatMap((recette) => recette.articles);
    const restants = tous.filter((article) => !article.coche).length;
    compteur.textContent = restants ? `${restants} à acheter` : "✓ Tout acheté";
    contenu.replaceChildren(
      el("p", { class: "discret" },
        `${nombreRecettes(construite.recettes.length)} · ${restants} article${restants > 1 ? "s" : ""} à acheter sur ${tous.length}`),
      el("div", { class: "barre-actions" }, boutonPartager, boutonVider),
      message,
      el("ul", { class: "liste-recettes" }, construite.recettes.map(carteRecette)),
      ...(construite.introuvables.length === 0 ? [] : [el("div", { class: "carte" },
        el("p", {}, `${construite.introuvables.length} recette(s) de la liste ne sont plus dans le dépôt.`),
        el("button", {
          type: "button", class: "bouton bouton--secondaire bouton--petit",
          onclick: () => changer((liste) => construite.introuvables.reduce(retirerDeLaListe, liste)),
        }, "Les retirer"))]));
  }

  await rafraichir();
  return { contenu: el("div", {}, enteteFige(ligneTitre("Liste de courses", compteur)), contenu), rafraichir };
}

const vues = {
  "/": vueRecettes,
  "/favoris": vueStatut("favorite", "Mes meilleures recettes", () =>
    pageVide("⭐", "Aucune favorite pour l'instant.",
      "Sur l'écran d'une recette, choisissez « ⭐ Favorite » pour la retrouver ici.")),
  "/a-essayer": vueStatut("a-essayer", "À essayer", () =>
    pageVide("📝", "Aucune recette à essayer.",
      "Les recettes jamais cuisinées apparaissent ici, comme une liste de choses à faire.")),
  "/courses": vueCourses,
  "/reglages": vueReglages,
};

// ---- Navigation ----

let rafraichirVue = null;
let quitterVue = null; // fait le ménage de la vue affichée (écran allumé…) avant d'en changer
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

// Position de défilement de chaque liste (Mes recettes, un livre, Favoris…), gardée le temps de la visite :
// en revenant d'une recette, on retrouve la liste là où on l'avait laissée. Une recette s'ouvre toujours en haut.
const positionsDefilement = new Map();
let routeAffichee = null;
// Profondeur de chaque page dans l'historique de l'application (0 = page d'ouverture),
// pour que le bouton ← ne fasse jamais sortir de l'application.
let profondeur = history.state?.profondeur ?? 0;
if (history.state?.profondeur == null) history.replaceState({ profondeur }, "");

async function afficher() {
  const numero = ++numeroAffichage;
  const route = routeCourante();
  const { contenu, rafraichir, quitter } = await chargerVue(route);
  if (numero !== numeroAffichage) return; // une autre page a été demandée entre-temps

  quitterVue?.();
  quitterVue = quitter ?? null;
  rafraichirVue = rafraichir ?? null;
  const conteneur = document.getElementById("vue");
  const estRecette = (chemin) => chemin?.startsWith(PREFIXE_RECETTE);
  if (routeAffichee && !estRecette(routeAffichee)) positionsDefilement.set(routeAffichee, conteneur.scrollTop);
  const recetteQuittee = estRecette(routeAffichee) ? identifiant(routeAffichee, PREFIXE_RECETTE) : null;
  routeAffichee = route;

  conteneur.replaceChildren(contenu);
  conteneur.scrollTop = estRecette(route) ? 0 : positionsDefilement.get(route) ?? 0;
  if (recetteQuittee) retrouverRecette(conteneur, recetteQuittee);

  // Le détail d'une recette ou d'un livre reste rattaché à l'onglet « Recettes ».
  const onglet = estDetail(route) ? "/" : route;
  for (const lien of document.querySelectorAll(".navigation a")) {
    if (lien.dataset.route === onglet) lien.setAttribute("aria-current", "page");
    else lien.removeAttribute("aria-current");
  }
}

// En revenant d'une recette : sa carte est mise en valeur un instant, et ramenée à l'écran
// si elle n'y est pas (liste reclassée ou modifiée entre-temps).
function retrouverRecette(conteneur, id) {
  const lien = `#/recette/${encodeURIComponent(id)}`;
  const carte = [...conteneur.querySelectorAll("a.lien-recette")].find((a) => a.getAttribute("href") === lien);
  if (!carte) return;
  const zone = conteneur.getBoundingClientRect();
  const hautVisible = conteneur.querySelector(".entete-vue")?.getBoundingClientRect().bottom ?? zone.top;
  const basVisible = document.querySelector(".navigation").getBoundingClientRect().top;
  const position = carte.getBoundingClientRect();
  if (position.top < hautVisible || position.bottom > basVisible) carte.scrollIntoView({ block: "center" });
  carte.classList.add("lien-recette--recente");
  carte.addEventListener("animationend", () => carte.classList.remove("lien-recette--recente"), { once: true });
}

// Bouton ← des en-têtes : revient à l'écran précédent (un livre, les Favoris…) comme le bouton
// retour du téléphone. Si l'application vient d'être ouverte sur cette page, il mène à Mes recettes.
function boutonRetour() {
  return el("a", {
    href: "#/", class: "entete-vue__retour", "aria-label": "Retour",
    onclick: (evenement) => {
      if ((history.state?.profondeur ?? 0) === 0) return;
      evenement.preventDefault();
      history.back();
    },
  }, "←");
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

window.addEventListener("hashchange", () => {
  // Nouvelle page : un cran plus loin que la précédente. Retour arrière : la page garde sa profondeur.
  if (history.state?.profondeur == null) history.replaceState({ profondeur: profondeur + 1 }, "");
  profondeur = history.state.profondeur;
  afficher();
});
afficher();
suivreConnexion();
mettreAJourBadge();
enregistrerServiceWorker();
protegerStockage();
synchro.synchroniser().catch(() => {});
