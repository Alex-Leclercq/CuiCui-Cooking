// CuiCui Cooking – point d'entrée de l'application.
// Navigation par « hash » (#/favoris…) : fonctionne sans serveur
// particulier, aussi bien en local que sur GitHub Pages.

import { ouvrirStockage } from "./stockage.js";
import { creerClientGitHub } from "./github.js";
import { creerSynchro } from "./synchro.js";
import {
  CATEGORIES, CLASSEMENTS, ORDRE_CHOIX_STATUT, STATUT_PAR_DEFAUT, TITRE_CARNET, classerRecettes, formaterDuree, formaterModification,
  formaterSource, grouperIngredients, infosStatut, ingredientsPour, lireStatut, majuscule, modifier, nombrePersonnes,
  partiesIngredient, recetteEnTexte, trierParPage, valeurActuelle,
} from "./recette.js";
import {
  agregerListe, ajouterALaListe, cocherArticle, cocherArticles, construireListe, listeAgregeeEnTexte, listeEnTexte,
  listeVide, nettoyerCoches, normaliserListe, plierRecette, portionsOrigine, retirerDeLaListe,
} from "./courses.js";
import { choixDeFiltres, filtrerRecettes, filtresVides, nombreFiltres, rechercheActive } from "./recherche.js";
import {
  QUALITE_JPEG, ROLES, ROLES_NOUVEAU_LIVRE, creerDemande, decrireDemande, dimensionsReduites, identifiantEnvoi,
  verifierEnvoi,
} from "./envoi.js";

const VERSION = "0.29.0";
const DEPOT_PAR_DEFAUT = { proprietaire: "Alex-Leclercq", depot: "CuiCui-Recettes" };

// Thème : clair par défaut, comme la maquette ; sombre au choix dans les Réglages (retenu sur le téléphone).
// Posé avant le premier affichage, pour éviter un éclair de l'autre thème.
const CLE_THEME = "cuicui.theme";

function lireTheme() {
  try {
    return localStorage.getItem(CLE_THEME) === "sombre" ? "sombre" : "clair";
  } catch {
    return "clair";
  }
}

function appliquerTheme(theme) {
  if (theme === "sombre") document.documentElement.dataset.theme = "sombre";
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "sombre" ? "#1d1916" : "#fbf6ee");
}

function choisirTheme(theme) {
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite.
  }
  appliquerTheme(theme);
}

appliquerTheme(lireTheme());

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

// Icônes au trait (SVG), dessinées dans l'application : aucun texte de recette n'y entre.
const ICONES = {
  panier: ["M3 4h2l2.4 11h10.2L20 8H6.2", "M9 19.5h.01", "M17 19.5h.01"],
  panierCoche: ["M3 4h2l2.4 11h10.2L20 8H6.2", "M9 19.5h.01", "M17 19.5h.01", "m10 11 2 2 4-4"],
  loupe: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "m20 20-3.5-3.5"],
  filtres: ["M4 7h10M18 7h2M4 17h4M12 17h8", "M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "M10 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"],
  retour: ["M15 5l-7 7 7 7"],
  partager: ["M12 3v12M7 8l5-5 5 5", "M5 13v6h14v-6"],
  corbeille: ["M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"],
  fermer: ["M6 6l12 12M18 6 6 18"],
  coche: ["m5 12 5 5 9-10"],
  soleil: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
};

function icone(nom) {
  const ns = "http://www.w3.org/2000/svg";
  const dessin = document.createElementNS(ns, "svg");
  dessin.setAttribute("viewBox", "0 0 24 24");
  dessin.setAttribute("class", "icone");
  dessin.setAttribute("aria-hidden", "true");
  for (const trace of ICONES[nom]) {
    const chemin = document.createElementNS(ns, "path");
    chemin.setAttribute("d", trace);
    dessin.append(chemin);
  }
  return dessin;
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
    const valeurStatut = lireStatut(entree.recette);
    const statut = infosStatut(valeurStatut);
    const titre = el("span", { class: "lien-recette__titre" },
      el("strong", {}, nomRecette(entree)),
      recettesDansLaListe.has(entree.id) && el("span", {
        class: "lien-recette__panier", title: "Dans la liste de courses", "aria-label": "Dans la liste de courses",
      }, icone("panier")));
    // Ligne du bas : durée (préparation + cuisson), nombre de personnes, statut en couleur.
    const { tempsPreparation, tempsCuisson, portions } = entree.recette;
    const minutes = (Number(tempsPreparation) || 0) + (Number(tempsCuisson) || 0);
    const meta = el("span", { class: "lien-recette__meta" },
      minutes > 0 && el("span", {}, formaterDuree(minutes)),
      Number.isInteger(portions) && portions > 0 && el("span", {}, `${portions} pers.`),
      // « Pas testée » (sans avis) : rien d'affiché, pour ne pas encombrer les centaines de cartes concernées.
      valeurStatut !== STATUT_PAR_DEFAUT && el("span", { class: "statut-texte", "data-statut": valeurStatut }, statut.libelle));
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
      el("a", { class: "carte lien-recette lien-recette--vignette", href: `#/recette/${encodeURIComponent(entree.id)}` },
        vignette(entree),
        el("span", { class: "lien-recette__corps" },
          titre,
          texte && el("span", { class: "discret" }, texte),
          meta)));
  }));
}

// Vignette de la photo du plat dans les listes : chargée seulement quand la carte arrive à l'écran
// (des centaines de recettes), depuis le téléphone ou GitHub. Sans photo : un aplat aux couleurs du carnet.
const observateurVignettes = new IntersectionObserver((visibles) => {
  for (const { isIntersecting, target } of visibles) {
    if (!isIntersecting) continue;
    observateurVignettes.unobserve(target);
    synchro.photo(target.dataset.id, target.dataset.photo).then((image) => {
      if (image) target.replaceChildren(el("img", { src: URL.createObjectURL(image), alt: "" }));
    }).catch(() => {
      // Hors ligne et photo pas encore téléchargée : la vignette reste un aplat.
    });
  }
}, { rootMargin: "200px" });

function vignette(entree) {
  const cadre = el("span", { class: "vignette", "aria-hidden": "true" });
  const nom = entree.recette.photos?.plat;
  if (nom) {
    cadre.dataset.id = entree.id;
    cadre.dataset.photo = nom;
    observateurVignettes.observe(cadre);
  }
  return cadre;
}

// Liste de recettes triées par nom (le nombre de recettes est affiché dans l'en-tête figé).
function listeRecettes(entrees, selection = null) {
  const [groupe] = classerRecettes(entrees, "nom");
  return [cartesRecettes(groupe?.entrees ?? [], undefined, selection)];
}

// Liste rangée en sections (catégorie, cuisine, chef, statut…).
// pliage : { estPlie(cle), basculer(cle) } ; un appui sur le titre d'une section plie ou déplie ses recettes.
function listeGroupee(groupes, selection = null, pliage = null) {
  return groupes.map((groupe) => {
    const cle = groupe.cle ?? "";
    const plie = pliage?.estPlie(cle) ?? false;
    const titre = [groupe.titre, " ", el("span", { class: "discret" }, String(groupe.entrees.length))];
    return el("section", { class: "groupe", "data-cle": cle },
      el("h3", { class: "groupe__titre" }, pliage
        ? el("button", {
          type: "button", class: "groupe__plier", "aria-expanded": String(!plie),
          onclick: () => pliage.basculer(cle),
        }, el("span", { class: "chevron", "aria-hidden": "true" }), ...titre)
        : titre),
      el("div", { hidden: plie }, cartesRecettes(groupe.entrees, undefined, selection)));
  });
}

// Mode sélection : cocher plusieurs recettes, puis les ajouter d'un coup à la liste de courses,
// chacune pour son nombre de personnes d'origine. reafficher : redessine la liste des recettes.
// Pendant la sélection, la barre « Annuler / Ajouter » prend la place de la barre de navigation.
function creerSelection(reafficher) {
  let active = false;
  const choisies = new Set();
  let dejaDansLaListe = new Set();
  const message = el("p", { class: "message", role: "status" });
  const boutonSelectionner = el("button", { type: "button", class: "puce puce--action" }, icone("panier"), "Sélectionner");
  const boutonAjouter = el("button", { type: "button", class: "bouton barre-selection__ajouter" });
  const boutonAnnuler = el("button", { type: "button", class: "bouton bouton--secondaire" }, "Annuler");
  const barre = el("div", { class: "barre-selection", hidden: true }, boutonAnnuler, boutonAjouter);

  function afficherBarre() {
    boutonSelectionner.hidden = active;
    barre.hidden = !active;
    document.body.classList.toggle("selection-en-cours", active);
    boutonAjouter.disabled = choisies.size === 0;
    boutonAjouter.textContent = choisies.size ? `Ajouter ${nombreRecettes(choisies.size)}` : "Cochez des recettes";
  }

  function changerMode(nouveau) {
    active = nouveau;
    choisies.clear();
    afficherBarre();
    reafficher();
  }

  // La sélection ajoute une étape à l'historique (même adresse) : le geste retour du téléphone
  // quitte la sélection, comme Annuler, au lieu de changer de page.
  function surRetour() {
    window.removeEventListener("popstate", surRetour);
    if (active) changerMode(false);
  }
  function entrer() {
    history.pushState({ ...history.state, selection: true }, "");
    window.addEventListener("popstate", surRetour);
    changerMode(true);
  }
  // Annuler ou Ajouter : on retire aussi l'étape ajoutée, pour que le retour suivant change bien de page.
  function sortir() {
    window.removeEventListener("popstate", surRetour);
    changerMode(false);
    if (history.state?.selection) history.back();
  }

  boutonSelectionner.addEventListener("click", async () => {
    dejaDansLaListe = new Set((await lireListeCourses()).recettes.map((choix) => choix.id));
    message.textContent = "";
    entrer();
  });
  boutonAnnuler.addEventListener("click", sortir);
  boutonAjouter.addEventListener("click", async () => {
    const recettes = await Promise.all([...choisies].map((id) => stockage.lireRecette(id)));
    const nombre = recettes.filter(Boolean).length;
    await modifierListeCourses((liste) => recettes.filter(Boolean)
      .reduce((suite, entree) => ajouterALaListe(suite, entree.id, portionsOrigine(entree.recette)), liste));
    sortir();
    annoncerAjout(message, `${nombreRecettes(nombre)} ajoutée${nombre > 1 ? "s" : ""} à la liste de courses.`);
  });
  afficherBarre();

  return {
    boutonSelectionner, barre, message,
    active: () => active,
    // En quittant l'écran : la barre de navigation revient.
    quitter() {
      window.removeEventListener("popstate", surRetour);
      document.body.classList.remove("selection-en-cours");
    },
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

// Couverture du carnet de CuiCui : une image de l'application, la même pour tous.
function couvertureCarnet() {
  return el("div", { class: "couverture" },
    el("img", { src: "icones/carnet-cuicui.jpg", alt: `Couverture : ${TITRE_CARNET}` }));
}

// Étagère : un livre par couverture, avec son nombre de recettes ; les recettes sans livre à la fin,
// dans « Le carnet de CuiCui », avec sa propre couverture.
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
        : couvertureCarnet(),
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

// Recherche et filtres de Mes recettes : gardés tant que l'application est ouverte (changement d'onglet,
// retour d'une recette), jamais enregistrés : ils repartent à zéro à la prochaine ouverture.
let filtresRecettes = filtresVides();

// Section ouverte (une seule à la fois) : toutes repliées au départ et à chaque changement de classement ;
// gardée en allant voir une recette puis en revenant, tant que l'application est ouverte.
let sectionOuverte = null;

// Mêmes valeurs cochées (catégorie, statut, cuisine), quel que soit l'ordre ?
const memesFiltres = (a, b) => ["categories", "statuts", "cuisines"]
  .every((champ) => [...a[champ]].sort().join("|") === [...b[champ]].sort().join("|"));

// Écran Filtres : une rangée de pastilles à cocher par filtre (catégorie, statut, cuisine).
// choix : valeurs proposées ({ cle, titre, nombre }) ; changer(cle, coche) à chaque pastille touchée.
function groupeFiltre(titre, choix, cochees, changer) {
  if (!choix.length) return null;
  return el("fieldset", { class: "filtres__groupe" },
    el("legend", {}, titre),
    el("div", { class: "filtres__pastilles" }, choix.map(({ cle, titre: libelle, nombre }) =>
      el("label", { class: "pastille" },
        el("input", {
          type: "checkbox", checked: cochees.includes(cle),
          onchange: (evenement) => changer(cle, evenement.target.checked),
        }),
        libelle, el("span", { class: "pastille__nombre" }, String(nombre))))));
}

// La synchronisation est automatique : son état et son bouton sont dans les Réglages,
// et le badge en haut de l'écran signale ce qui demande attention.
async function vueRecettes() {
  const liste = el("div");
  const choix = el("select", { class: "classement__choix", id: "classement" },
    CLASSEMENTS.map((classement) => el("option", { value: classement.valeur }, classement.libelle)));
  choix.value = lireClassement();
  // Nouveau classement : la liste repart du haut (l'ancienne position n'a plus de sens).
  choix.addEventListener("change", async () => {
    retenirClassement(choix.value);
    sectionOuverte = null;
    await rafraichir();
    document.getElementById("vue").scrollTop = 0;
  });
  const selection = creerSelection(() => rafraichir());
  // « Classer par » : une rangée de pastilles (même ordre qu'avant) ; la liste de choix, cachée,
  // garde la valeur choisie pour le reste de l'écran.
  const puces = CLASSEMENTS.map((classement) => el("button", {
    type: "button", class: "puce", "aria-pressed": String(classement.valeur === choix.value),
    onclick: () => {
      if (choix.value === classement.valeur) return;
      choix.value = classement.valeur;
      for (const [rang, puce] of puces.entries()) puce.setAttribute("aria-pressed", String(CLASSEMENTS[rang].valeur === choix.value));
      choix.dispatchEvent(new Event("change"));
    },
  }, classement.libelle));
  choix.hidden = true;
  const barreClassement = el("div", { class: "classement classement--puces", role: "group", "aria-label": "Classer par" },
    ...puces, choix, selection.boutonSelectionner);
  const compteur = el("span", { class: "discret" });

  // Recherche : nom, ingrédients, chef, livre, mots-clés. La liste repart du haut à chaque changement.
  const champRecherche = el("input", {
    type: "search", class: "recherche__champ", value: filtresRecettes.texte, enterkeyhint: "search",
    placeholder: "Nom, ingrédient, chef…", "aria-label": "Rechercher une recette",
  });
  // Notre propre croix d'effacement : visible dès qu'il y a du texte, même champ quitté
  // (celle du navigateur n'apparaît que pendant la saisie).
  const boutonEffacerTexte = el("button", {
    type: "button", class: "recherche__effacer", "aria-label": "Effacer la recherche", hidden: !filtresRecettes.texte,
  }, "✕");
  const boutonFiltres = el("button", { type: "button", class: "bouton-carre" });
  const barreRecherche = el("div", { class: "recherche" },
    el("div", { class: "recherche__zone" }, icone("loupe"), champRecherche, boutonEffacerTexte), boutonFiltres);
  const vue = () => document.getElementById("vue");
  // Pliages faits pendant une recherche : ils ne valent que pour elle (tout est déplié à chaque changement)
  // et ne touchent pas aux pliages habituels, qui reviennent quand la recherche est effacée.
  let plisRecherche = new Set();
  async function changerFiltres(modification) {
    filtresRecettes = { ...filtresRecettes, ...modification };
    plisRecherche = new Set();
    await rafraichir();
    vue().scrollTop = 0;
  }
  champRecherche.addEventListener("input", () => {
    boutonEffacerTexte.hidden = !champRecherche.value;
    changerFiltres({ texte: champRecherche.value });
  });
  // Touche « Rechercher » du clavier : le clavier se ferme pour laisser voir les résultats.
  champRecherche.addEventListener("keydown", (evenement) => {
    if (evenement.key === "Enter") champRecherche.blur();
  });
  // Faire défiler la liste pendant la saisie ferme aussi le clavier, pour voir les résultats en plein écran.
  // Un petit seuil évite de le fermer sur un simple appui.
  let departToucher = null;
  const fermerClavierAuDefilement = (evenement) => {
    if (document.activeElement !== champRecherche || evenement.target === champRecherche || departToucher === null) return;
    if (Math.abs(evenement.touches[0].clientY - departToucher) > 10) champRecherche.blur();
  };
  boutonEffacerTexte.addEventListener("click", () => {
    champRecherche.value = "";
    boutonEffacerTexte.hidden = true;
    changerFiltres({ texte: "" });
  });
  const effacer = () => {
    champRecherche.value = "";
    boutonEffacerTexte.hidden = true;
    changerFiltres(filtresVides());
  };

  // Écran Filtres : remplace la liste (onglets, sélection et recherche masqués). Les pastilles cochées
  // restent un brouillon jusqu'à « Afficher N recettes » ; la croix ou le geste retour l'abandonnent.
  const vueListe = el("div");
  vueListe.addEventListener("touchstart", (evenement) => { departToucher = evenement.touches[0].clientY; }, { passive: true });
  vueListe.addEventListener("touchmove", fermerClavierAuDefilement, { passive: true });
  const ecranFiltres = el("div", { class: "ecran-filtres", hidden: true });
  let brouillon = null;
  let derniereLecture = { toutes: [], titresLivres: [] };
  let positionListe = 0;

  function masquerFiltres() {
    window.removeEventListener("popstate", surRetourFiltres);
    brouillon = null;
    document.body.classList.remove("filtres-ouverts");
    ecranFiltres.hidden = true;
    vueListe.hidden = false;
  }
  function surRetourFiltres() {
    masquerFiltres();
    vue().scrollTop = positionListe;
  }
  function ouvrirFiltres() {
    brouillon = {
      categories: [...filtresRecettes.categories], statuts: [...filtresRecettes.statuts],
      cuisines: [...filtresRecettes.cuisines],
    };
    positionListe = vue().scrollTop;
    // Une étape d'historique (même adresse) : le geste retour ferme l'écran Filtres, comme la croix.
    history.pushState({ ...history.state, filtres: true }, "");
    window.addEventListener("popstate", surRetourFiltres);
    document.body.classList.add("filtres-ouverts");
    vueListe.hidden = true;
    ecranFiltres.hidden = false;
    dessinerFiltres();
    vue().scrollTop = 0;
  }
  function fermerFiltres(appliquer) {
    const choisis = brouillon;
    masquerFiltres();
    if (history.state?.filtres) history.back();
    if (appliquer) changerFiltres(choisis);
    else vue().scrollTop = positionListe;
  }
  function dessinerFiltres() {
    const { toutes, titresLivres } = derniereLecture;
    const valeurs = choixDeFiltres(toutes);
    const nombre = filtrerRecettes(toutes, { ...filtresRecettes, ...brouillon }, titresLivres).length;
    const coche = (champ) => (cle, oui) => {
      brouillon = { ...brouillon, [champ]: oui ? [...brouillon[champ], cle] : brouillon[champ].filter((autre) => autre !== cle) };
      dessinerFiltres();
    };
    // Le bouton d'application n'apparaît qu'après un changement ; sinon, simplement « Fermer ».
    const modifie = !memesFiltres(brouillon, filtresRecettes);
    const valider = !modifie
      ? el("button", { type: "button", class: "bouton barre-selection__ajouter", onclick: () => fermerFiltres(false) }, "Fermer")
      : el("button", {
        type: "button", class: "bouton barre-selection__ajouter", disabled: nombre === 0,
        onclick: () => fermerFiltres(true),
      }, nombre ? `Afficher ${nombreRecettes(nombre)}` : "Aucune recette");
    ecranFiltres.replaceChildren(
      enteteFige(el("div", { class: "entete-vue__barre" },
        el("strong", { class: "entete-vue__nom" }, "Filtres"),
        el("span", { class: "entete-vue__espace" }),
        el("button", {
          type: "button", class: "bouton-icone", "aria-label": "Fermer les filtres", onclick: () => fermerFiltres(false),
        }, "✕"))),
      groupeFiltre("Catégorie", valeurs.categories, brouillon.categories, coche("categories")),
      groupeFiltre("Statut", valeurs.statuts, brouillon.statuts, coche("statuts")),
      groupeFiltre("Cuisine", valeurs.cuisines, brouillon.cuisines, coche("cuisines")),
      el("div", { class: "barre-selection" },
        el("button", {
          type: "button", class: "bouton bouton--secondaire",
          onclick: () => {
            brouillon = { categories: [], statuts: [], cuisines: [] };
            dessinerFiltres();
          },
        }, "Tout effacer"),
        valider));
  }
  boutonFiltres.addEventListener("click", ouvrirFiltres);

  // Accordéon : ouvrir une section referme celle qui était ouverte. Pour que l'écran ne saute pas,
  // le titre touché reste d'abord à sa place pendant que l'autre section se replie, puis glisse
  // en haut, juste sous l'en-tête figé, avec ses recettes en dessous.
  const sectionDe = (cle) => [...liste.querySelectorAll("section.groupe")].find((element) => element.dataset.cle === cle);
  async function basculerSection(cle) {
    const avant = sectionDe(cle)?.getBoundingClientRect().top;
    const ouvrir = sectionOuverte !== cle;
    sectionOuverte = ouvrir ? cle : null;
    await rafraichir();
    const section = sectionDe(cle);
    if (!section || avant === undefined) return;
    vue().scrollTop += section.getBoundingClientRect().top - avant;
    if (!ouvrir) return;
    const basEntete = vueListe.querySelector(".entete-vue")?.getBoundingClientRect().bottom ?? 0;
    const douceur = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    vue().scrollTo({ top: vue().scrollTop + section.getBoundingClientRect().top - basEntete, behavior: douceur });
  }

  async function rafraichir() {
    const [toutes, livres, statut] = await Promise.all([stockage.lireRecettes(), stockage.lireLivres(), synchro.lireEtat()]);
    const titresLivres = livres.map((entree) => ({ id: entree.id, titre: entree.livre?.titre }));
    derniereLecture = { toutes, titresLivres };
    if (brouillon) dessinerFiltres();
    const filtree = rechercheActive(filtresRecettes);
    const entrees = filtree ? filtrerRecettes(toutes, filtresRecettes, titresLivres) : toutes;

    const nombre = nombreFiltres(filtresRecettes);
    boutonFiltres.replaceChildren(icone("filtres"), nombre ? el("span", { class: "bouton-carre__nombre" }, String(nombre)) : "");
    boutonFiltres.setAttribute("aria-label", nombre ? `Filtres (${nombre} actifs)` : "Filtres");
    // Pendant la sélection, pas d'écran Filtres : seule la recherche reste disponible.
    boutonFiltres.hidden = selection.active();

    barreClassement.hidden = toutes.length === 0;
    barreRecherche.hidden = toutes.length === 0;
    compteur.textContent = !toutes.length ? ""
      : filtree ? `${entrees.length} sur ${nombreRecettes(toutes.length)}` : nombreRecettes(toutes.length);
    if (filtree && entrees.length === 0) {
      liste.replaceChildren(pageVide("🔍", "Aucune recette ne correspond.",
        "Essayez d'autres mots ou retirez des filtres.",
        el("button", { type: "button", class: "bouton", onclick: effacer }, "Tout effacer")));
      return;
    }
    if (entrees.length === 0) {
      liste.replaceChildren(statut.configure
        ? pageVide("📖", "Aucune recette dans le dépôt.",
          "Photographiez une recette avec l'application, ou envoyez des captures à Claude.",
          el("a", { href: "#/photo", class: "bouton" }, "📷 Ajouter une recette en photo"))
        : pageVide("📖", "Aucune recette pour l'instant.",
          "Connectez l'application à votre dépôt de recettes dans les Réglages.",
          el("a", { href: "#/reglages", class: "bouton" }, "Aller aux Réglages")));
      return;
    }
    const critere = choix.value;
    if (critere === "nom") liste.replaceChildren(...listeRecettes(entrees, selection));
    // En mode sélection ou pendant une recherche, l'étagère laisse place aux recettes rangées par livre.
    else if (critere === "livre" && !selection.active() && !filtree) liste.replaceChildren(etagere(entrees, livres));
    else {
      const groupes = classerRecettes(entrees, critere, titresLivres);
      if (!filtree) {
        // Hors recherche : la liste des sections, toutes repliées sauf celle qu'on a ouverte.
        // Une seule section (par exemple un seul chef) : elle est simplement dépliée, sans pliage.
        liste.replaceChildren(...listeGroupee(groupes, selection, groupes.length > 1 ? {
          estPlie: (cle) => cle !== sectionOuverte,
          basculer: (cle) => basculerSection(cle),
        } : null));
        return;
      }
      // Pendant une recherche, tout est déplié au départ (pliages libres, oubliés à chaque changement).
      liste.replaceChildren(...listeGroupee(groupes, selection, {
        estPlie: (cle) => plisRecherche.has(cle),
        basculer: (cle) => {
          if (!plisRecherche.delete(cle)) plisRecherche.add(cle);
          return rafraichir();
        },
      }));
    }
  }

  await rafraichir();
  vueListe.append(
    enteteFige(ligneTitre("Mes recettes", compteur),
      barreClassement, barreRecherche),
    selection.message, liste, selection.barre);
  return {
    contenu: el("div", {}, vueListe, ecranFiltres),
    rafraichir,
    quitter() {
      selection.quitter();
      masquerFiltres();
    },
  };
}

// Menu des statuts, sous la pastille de la fiche recette (comme la maquette) : une pastille colorée
// par statut, une coche sur le statut actuel. Un appui choisit et ferme ; toucher à côté, Échap ou
// le geste retour du téléphone ferment sans rien changer. S'il manque de place sous la pastille,
// le menu s'ouvre au-dessus. Flèches haut / bas au clavier.
function ouvrirMenuStatut(pastille, actuel, choisir) {
  const fond = el("div", { class: "menu-statut__fond" });
  const options = ORDRE_CHOIX_STATUT.map((valeur) => el("button", {
    type: "button", class: "menu-statut__option", role: "menuitemradio", "aria-checked": String(valeur === actuel),
    onclick: () => {
      fermer();
      if (valeur !== actuel) choisir(valeur);
    },
  },
  el("span", { class: "statut-pastille", "data-statut": valeur }, infosStatut(valeur).libelle),
  valeur === actuel && icone("coche")));
  const menu = el("div", { class: "menu-statut", role: "menu", "aria-label": "Statut de la recette" }, options);

  // Placé sous la pastille, aligné sur son bord droit ; au-dessus si l'écran est trop court en dessous.
  function placer() {
    const zone = pastille.getBoundingClientRect();
    const hauteur = menu.offsetHeight;
    const marge = 8;
    const enDessous = zone.bottom + marge + hauteur <= window.innerHeight - marge;
    menu.style.top = `${enDessous ? zone.bottom + marge : Math.max(marge, zone.top - marge - hauteur)}px`;
    menu.style.right = `${Math.max(marge, window.innerWidth - zone.right)}px`;
  }

  function retirer() {
    window.removeEventListener("popstate", surRetour);
    window.removeEventListener("resize", placer);
    document.removeEventListener("keydown", surTouche);
    pastille.setAttribute("aria-expanded", "false");
    fond.remove();
    menu.remove();
  }
  function surRetour() {
    retirer();
    pastille.focus();
  }
  function fermer() {
    retirer();
    if (history.state?.menuStatut) history.back();
    pastille.focus();
  }
  function surTouche(evenement) {
    if (evenement.key === "Escape") fermer();
    if (evenement.key === "ArrowDown" || evenement.key === "ArrowUp") {
      evenement.preventDefault();
      const rang = options.indexOf(document.activeElement);
      const suivant = (rang + (evenement.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[suivant].focus();
    }
  }
  fond.addEventListener("click", fermer);

  history.pushState({ ...history.state, menuStatut: true }, "");
  window.addEventListener("popstate", surRetour);
  window.addEventListener("resize", placer);
  document.addEventListener("keydown", surTouche);
  pastille.setAttribute("aria-expanded", "true");
  document.body.append(fond, menu);
  placer();
  (options.find((option) => option.getAttribute("aria-checked") === "true") ?? options[0]).focus();
}

// Visionneuse plein écran (couverture d'un livre) : l'image en grand sur le fond de l'appli.
// Zoom à deux doigts (jusqu'à ×5), double appui pour zoomer / revenir, glisser pour se déplacer
// une fois zoomé ; molette sur ordinateur. Fermeture : ✕, touche Échap ou geste retour du téléphone
// (une étape d'historique est ajoutée, à la même adresse, comme pour l'écran Filtres).
function ouvrirVisionneuse(source, description) {
  const image = el("img", { src: source, alt: description, class: "visionneuse__image", draggable: "false" });
  const boutonFermer = el("button", { type: "button", class: "visionneuse__fermer", "aria-label": "Fermer" }, icone("fermer"));
  const cadre = el("div", { class: "visionneuse", role: "dialog", "aria-modal": "true", "aria-label": description },
    image, boutonFermer);

  let echelle = 1;
  let decalageX = 0;
  let decalageY = 0;
  const ECHELLE_MAX = 5;
  const appliquer = () => {
    image.style.transform = `translate(${decalageX}px, ${decalageY}px) scale(${echelle})`;
  };
  // L'image ne peut pas sortir du cadre : le déplacement est limité à ce qui dépasse.
  function borner() {
    if (echelle <= 1) {
      echelle = 1;
      decalageX = 0;
      decalageY = 0;
      return;
    }
    const largeur = (image.offsetWidth * echelle - cadre.clientWidth) / 2;
    const hauteur = (image.offsetHeight * echelle - cadre.clientHeight) / 2;
    decalageX = Math.min(Math.max(decalageX, -Math.max(largeur, 0)), Math.max(largeur, 0));
    decalageY = Math.min(Math.max(decalageY, -Math.max(hauteur, 0)), Math.max(hauteur, 0));
  }
  // Zoom autour d'un point de l'écran (doigts, double appui, curseur) : ce point reste sous le doigt.
  function zoomer(nouvelle, pointX, pointY) {
    const borne = Math.min(Math.max(nouvelle, 1), ECHELLE_MAX);
    const zone = cadre.getBoundingClientRect();
    const versX = pointX - (zone.left + zone.width / 2);
    const versY = pointY - (zone.top + zone.height / 2);
    decalageX = versX - ((versX - decalageX) * borne) / echelle;
    decalageY = versY - ((versY - decalageY) * borne) / echelle;
    echelle = borne;
  }

  const pointeurs = new Map();
  let geste = null;
  let dernierAppui = { temps: 0, x: 0, y: 0 };
  const distance = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
  const centre = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function commencerGeste() {
    const liste = [...pointeurs.values()];
    geste = liste.length >= 2
      ? { type: "pincer", distance: distance(liste), centre: centre(liste), echelle, decalageX, decalageY }
      : liste.length === 1 ? { type: "glisser", x: liste[0].x, y: liste[0].y, decalageX, decalageY, bouge: false } : null;
  }
  cadre.addEventListener("pointerdown", (evenement) => {
    if (evenement.target.closest(".visionneuse__fermer")) return;
    try {
      cadre.setPointerCapture(evenement.pointerId); // le geste continue même si le doigt sort de l'image
    } catch {
      // Pointeur déjà relâché : le geste se poursuit sans capture.
    }
    pointeurs.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    image.classList.add("visionneuse__image--geste");
    commencerGeste();
  });
  cadre.addEventListener("pointermove", (evenement) => {
    if (!pointeurs.has(evenement.pointerId) || !geste) return;
    pointeurs.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    const liste = [...pointeurs.values()];
    if (geste.type === "pincer" && liste.length >= 2) {
      echelle = geste.echelle;
      decalageX = geste.decalageX;
      decalageY = geste.decalageY;
      const point = centre(liste);
      zoomer(geste.echelle * (distance(liste) / geste.distance), geste.centre.x, geste.centre.y);
      decalageX += point.x - geste.centre.x;
      decalageY += point.y - geste.centre.y;
    } else if (geste.type === "glisser") {
      const dx = evenement.clientX - geste.x;
      const dy = evenement.clientY - geste.y;
      if (Math.hypot(dx, dy) > 6) geste.bouge = true;
      if (echelle > 1) {
        decalageX = geste.decalageX + dx;
        decalageY = geste.decalageY + dy;
      }
    }
    appliquer();
  });
  function finirPointeur(evenement) {
    if (!pointeurs.has(evenement.pointerId)) return;
    const simpleAppui = geste?.type === "glisser" && !geste.bouge && pointeurs.size === 1;
    pointeurs.delete(evenement.pointerId);
    // Double appui : zoom ×2,5 à cet endroit, ou retour à la taille normale.
    if (simpleAppui && evenement.type === "pointerup") {
      const maintenant = Date.now();
      if (maintenant - dernierAppui.temps < 300
        && Math.hypot(evenement.clientX - dernierAppui.x, evenement.clientY - dernierAppui.y) < 30) {
        zoomer(echelle > 1 ? 1 : 2.5, evenement.clientX, evenement.clientY);
        dernierAppui = { temps: 0, x: 0, y: 0 };
      } else {
        dernierAppui = { temps: maintenant, x: evenement.clientX, y: evenement.clientY };
      }
    }
    if (!pointeurs.size) image.classList.remove("visionneuse__image--geste");
    borner();
    appliquer();
    commencerGeste();
  }
  cadre.addEventListener("pointerup", finirPointeur);
  cadre.addEventListener("pointercancel", finirPointeur);
  // Molette (ordinateur) : zoom autour du curseur.
  cadre.addEventListener("wheel", (evenement) => {
    evenement.preventDefault();
    zoomer(echelle * Math.exp(-evenement.deltaY / 300), evenement.clientX, evenement.clientY);
    borner();
    appliquer();
  }, { passive: false });

  function retirer() {
    window.removeEventListener("popstate", surRetour);
    document.removeEventListener("keydown", surTouche);
    document.body.classList.remove("visionneuse-ouverte");
    cadre.remove();
  }
  function surRetour() {
    retirer();
  }
  function fermer() {
    retirer();
    if (history.state?.visionneuse) history.back();
  }
  function surTouche(evenement) {
    if (evenement.key === "Escape") fermer();
  }
  boutonFermer.addEventListener("click", fermer);
  history.pushState({ ...history.state, visionneuse: true }, "");
  window.addEventListener("popstate", surRetour);
  document.addEventListener("keydown", surTouche);
  document.body.classList.add("visionneuse-ouverte");
  document.body.append(cadre);
  boutonFermer.focus();
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
    const titre = idLivre ? livre.titre ?? recettes[0]?.recette.source?.titre ?? idLivre : TITRE_CARNET;

    if (idLivre && !entreeLivre && recettes.length === 0) {
      nomFige.textContent = "";
      contenu.replaceChildren(pageVide("🤔", "Ce livre n'existe pas ou plus.", "Il a peut-être été supprimé du dépôt."));
      return;
    }
    nomFige.textContent = titre;
    const publication = [livre.editeur, livre.annee].filter(Boolean).join(", ");
    // La couverture est un bouton : un appui l'ouvre en grand (visionneuse plein écran, zoom possible).
    const couverture = idLivre ? couvertureLivre(idLivre, titre) : couvertureCarnet();
    const agrandir = el("button", {
      type: "button", class: "livre__agrandir", "aria-label": `Agrandir la couverture : ${titre}`,
      onclick: () => {
        const image = couverture.querySelector("img");
        if (image) ouvrirVisionneuse(image.src, image.alt);
      },
    }, couverture);
    contenu.replaceChildren(
      el("div", { class: "livre" },
        agrandir,
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
// parCategorie : recettes rangées en sections par catégorie (Petit-déjeuner, Apéritif, Entrée…),
// dans le même ordre que Mes recettes → Catégorie ; toutes les sections sont ouvertes.
function vueStatut(statut, titre, vide, { parCategorie = false } = {}) {
  return async () => {
    const liste = el("div");
    const selection = creerSelection(() => rafraichir());
    const compteur = el("span", { class: "discret" });
    const barreSelection = el("div", { class: "classement" }, selection.boutonSelectionner);
    async function rafraichir() {
      const entrees = (await stockage.lireRecettes()).filter((entree) => lireStatut(entree.recette) === statut);
      barreSelection.hidden = entrees.length === 0;
      compteur.textContent = entrees.length ? nombreRecettes(entrees.length) : "";
      if (!entrees.length) liste.replaceChildren(vide());
      else if (parCategorie) liste.replaceChildren(...listeGroupee(classerRecettes(entrees, "categorie"), selection));
      else liste.replaceChildren(...listeRecettes(entrees, selection));
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
// Recettes de la liste de courses : une icône 🛒 les signale dans les listes de recettes.
// Tenu à jour à chaque lecture et écriture de la liste.
let recettesDansLaListe = new Set();
const retenirRecettesDeLaListe = (liste) => { recettesDansLaListe = new Set(liste.recettes.map((choix) => choix.id)); };

async function lireListeCourses() {
  const liste = normaliserListe(await stockage.lireMeta(CLE_LISTE_COURSES));
  retenirRecettesDeLaListe(liste);
  return liste;
}

function ecrireListeCourses(liste) {
  retenirRecettesDeLaListe(liste);
  return stockage.ecrireMeta(CLE_LISTE_COURSES, liste);
}

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
  const categorie = recette.categorie && (CATEGORIES[recette.categorie] ?? majuscule(String(recette.categorie)));
  // Surtitre « Plat · Française » ; les mots-clés en petites capsules, tels qu'écrits dans la fiche.
  const surtitre = [categorie, recette.cuisine && majuscule(String(recette.cuisine))].filter(Boolean).join(" · ");
  const etiquettes = [
    recette.difficulte,
    ...(Array.isArray(recette.motsCles) ? recette.motsCles : []),
  ].filter(Boolean).map(String);

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
  // Le cadre est réservé dès l'ouverture quand la recette a une photo : l'écran ne saute pas à son arrivée.
  const photoPlat = el("figure", { class: "photo-plat", hidden: !recette.photos?.plat });
  synchro.photo(id, recette.photos?.plat).then((image) => {
    if (!image) {
      photoPlat.hidden = true;
      return;
    }
    const adresse = URL.createObjectURL(image);
    photoPlat.replaceChildren(el("img", { src: adresse, alt: `Photo : ${recette.nom ?? id}` }));
  }).catch(() => {
    photoPlat.hidden = true; // hors ligne et photo pas encore téléchargée
  });

  // Choix du statut : une pastille colorée qui ouvre le menu des statuts (voir ouvrirMenuStatut).
  // Deux gestes volontaires pour changer de statut : le premier ouvre le menu, le second choisit ;
  // un appui accidentel ne change rien. Sans avis (« Pas testée »), la pastille affiche « Statut ».
  const texteStatut = el("span", { class: "statut-choix__texte" });
  const choixStatut = el("button", { type: "button", class: "statut-choix", "aria-haspopup": "menu", "aria-expanded": "false" },
    texteStatut, el("span", { class: "statut-choix__chevron", "aria-hidden": "true" }));
  function afficherStatut() {
    const valeur = lireStatut(recette);
    const statut = infosStatut(valeur);
    texteStatut.textContent = statut.pastille ?? statut.libelle;
    choixStatut.dataset.statut = valeur; // couleur de la pastille
    choixStatut.setAttribute("aria-label", `Statut : ${statut.libelle}. Changer le statut`);
  }
  choixStatut.addEventListener("click", () =>
    ouvrirMenuStatut(choixStatut, lireStatut(recette), (valeur) => appliquer("statut", valeur)));
  afficherStatut();

  // Notes personnelles : enregistrées sur demande (une modification = une ligne d'historique).
  const champNotes = el("textarea", {
    class: "notes-saisie", rows: "3", id: "notes-recette",
    placeholder: "Ce que je changerais la prochaine fois…",
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
  const libellePersonnes = el("span", { class: "portions__libelle" });

  function afficherIngredients() {
    const ajustee = origine !== null && personnes !== origine;
    valeurPersonnes.textContent = origine ? String(personnes) : "";
    libellePersonnes.textContent = origine ? `Pour ${nombrePersonnes(personnes)}` : "";
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
        el("ul", { class: "ingredients" }, groupe.ingredients.map((ingredient) => {
          // Deux colonnes : la quantité (en terre cuite), puis le nom et, dessous, la précision.
          const parties = partiesIngredient(ingredient);
          return el("li", { class: "ingredient" },
            el("span", { class: "ingredient__quantite" }, parties.quantite),
            el("span", { class: "ingredient__nom" }, parties.nom,
              parties.precision && el("small", { class: "ingredient__precision" }, parties.precision)));
        })))));
    afficherBoutonListe();
  }

  // Liste de courses : une icône panier en haut de l'écran (avant l'écran allumé et le partage).
  // La recette y entre pour le nombre de personnes affiché. Panier vide : à ajouter ; vert coché :
  // déjà dans la liste pour ce nombre (un appui y mène) ; point terre cuite : nombre changé (un appui met à jour).
  const message = el("p", { class: "message", role: "status" });
  const boutonListe = el("button", { type: "button", class: "bouton-icone bouton--courses" });
  let dansLaListe = (await lireListeCourses()).recettes.find((choix) => choix.id === id) ?? null;
  const memeNombre = () => dansLaListe && (origine === null || (dansLaListe.personnes ?? origine) === personnes);
  function afficherBoutonListe() {
    const etat = !dansLaListe ? "ajouter" : memeNombre() ? "dedans" : "mettre-a-jour";
    const libelle = etat === "ajouter" ? "Ajouter aux courses"
      : etat === "dedans" ? "Dans la liste de courses : voir la liste" : "Mettre à jour la liste de courses";
    boutonListe.dataset.etat = etat;
    boutonListe.setAttribute("aria-label", libelle);
    boutonListe.title = libelle;
    boutonListe.replaceChildren(icone(etat === "dedans" ? "panierCoche" : "panier"),
      etat === "mettre-a-jour" ? el("span", { class: "bouton--courses__point", "aria-hidden": "true" }) : "");
  }
  boutonListe.addEventListener("click", async () => {
    if (memeNombre()) {
      allerVersOnglet("/courses");
      return;
    }
    const miseAJour = !!dansLaListe;
    const liste = await modifierListeCourses((actuelle) => ajouterALaListe(actuelle, id, personnes));
    dansLaListe = liste.recettes.find((choix) => choix.id === id);
    afficherBoutonListe();
    const pour = origine ? ` pour ${nombrePersonnes(personnes)}` : "";
    // Le bouton est en haut : la confirmation s'affiche en bas de l'écran, visible où qu'on soit dans la recette.
    notifier(miseAJour ? `Liste de courses mise à jour${pour}.` : `Ajoutée à la liste de courses${pour}.`);
  });
  const changerPersonnes = (nombre) => {
    personnes = Math.min(Math.max(nombre, PERSONNES_MIN), PERSONNES_MAX);
    afficherIngredients();
  };
  boutonMoins.addEventListener("click", () => changerPersonnes(personnes - 1));
  boutonPlus.addEventListener("click", () => changerPersonnes(personnes + 1));
  boutonRevenir.addEventListener("click", () => changerPersonnes(origine));
  afficherIngredients();

  // « Pour 6 personnes » à gauche ; à droite, le réglage − 6 + dans une petite boîte.
  const reglagePortions = origine && el("div", { class: "portions", role: "group", "aria-label": "Nombre de personnes" },
    libellePersonnes,
    el("div", { class: "portions__reglage" }, boutonMoins, valeurPersonnes, boutonPlus),
    boutonRevenir);

  const boutonPartager = el("button", { type: "button", class: "bouton-icone", "aria-label": "Partager", title: "Partager" }, icone("partager"));
  boutonPartager.addEventListener("click", () => partager(recette, message, personnes));
  const ecranAllume = garderEcranAllume();

  // Onglets Ingrédients / Étapes : une seule partie affichée à la fois, les notes restent en dessous.
  const partieIngredients = el("section", { class: "recette__partie", id: "partie-ingredients" },
    reglagePortions, listeIngredients);
  const partieEtapes = el("section", { class: "recette__partie", id: "partie-etapes", hidden: true },
    avertissementEtapes,
    el("ol", { class: "etapes" }, (recette.etapes ?? []).map((etape) => el("li", {}, String(etape)))));
  const ongletIngredients = el("button", {
    type: "button", class: "onglets__bouton", "aria-controls": "partie-ingredients", "aria-pressed": "true",
  }, "Ingrédients");
  const ongletEtapes = el("button", {
    type: "button", class: "onglets__bouton", "aria-controls": "partie-etapes", "aria-pressed": "false",
  }, "Étapes");
  function montrer(etapes) {
    partieIngredients.hidden = etapes;
    partieEtapes.hidden = !etapes;
    ongletIngredients.setAttribute("aria-pressed", String(!etapes));
    ongletEtapes.setAttribute("aria-pressed", String(etapes));
  }
  ongletIngredients.addEventListener("click", () => montrer(false));
  ongletEtapes.addEventListener("click", () => montrer(true));

  return {
    contenu: el("article", { class: "recette" },
      // Barre figée, posée sur la photo : retour à gauche ; panier, écran allumé et partage à droite.
      enteteFige(el("div", { class: "entete-vue__barre" },
        boutonRetour(),
        el("span", { class: "entete-vue__espace" }),
        boutonListe,
        ecranAllume.bouton,
        boutonPartager)),
      photoPlat,
      // La fiche remonte sur la photo, comme une feuille posée dessus.
      el("div", { class: "recette__feuille" },
      el("div", { class: "recette__surligne" },
        el("p", { class: "recette__surtitre" }, surtitre),
        choixStatut),
      el("h2", {}, String(recette.nom ?? id)),
      // Chef, puis le livre et sa page : le livre mène à toutes ses recettes.
      recette.source?.livre
        ? el("p", { class: "discret" },
          recette.chef ? `${recette.chef} · ` : "",
          el("a", { href: `#/livre/${encodeURIComponent(recette.source.livre)}` },
            [recette.source.titre, recette.source.page ? `p. ${recette.source.page}` : null].filter(Boolean).join(", ")
              || "Toutes les recettes du livre"))
        : source && el("p", { class: "discret" }, source),
      lienSource && el("p", {}, el("a", { href: lienSource, target: "_blank", rel: "noopener noreferrer" }, "Voir la recette en ligne")),
      tuilesTemps(recette),
      etiquettes.length > 0 && el("ul", { class: "etiquettes" },
        etiquettes.map((etiquette) => el("li", {}, etiquette))),
      message,
      el("div", { class: "onglets", role: "group", "aria-label": "Partie de la recette" }, ongletIngredients, ongletEtapes),
      partieIngredients,
      partieEtapes,
      el("section", { class: "recette__notes" },
        el("h3", {}, el("label", { for: "notes-recette" }, "Mes notes")),
        champNotes,
        el("div", { class: "barre-actions" }, boutonNotes),
        messageNotes))),
    quitter: ecranAllume.arreter,
  };
}

// Temps de la recette en petites cases (préparation, repos, cuisson), seulement ceux connus.
function tuilesTemps(recette) {
  const tuiles = [["Préparation", recette.tempsPreparation], ["Repos", recette.tempsRepos], ["Cuisson", recette.tempsCuisson]]
    .filter(([, minutes]) => formaterDuree(minutes))
    .map(([libelle, minutes]) => el("div", { class: "temps__case" },
      el("span", { class: "temps__libelle" }, libelle), el("strong", {}, formaterDuree(minutes))));
  return tuiles.length ? el("div", { class: "temps" }, tuiles) : null;
}

// Icône « Garder l'écran allumé » (🔆) : tant qu'elle est activée, le téléphone ne se met pas en veille.
// Jamais mémorisé : il s'arrête en quittant la recette. Quand l'application passe en arrière-plan,
// le navigateur rend la main ; on redemande l'écran allumé au retour.
// Masquée si le navigateur ne sait pas le faire.
function garderEcranAllume() {
  const bouton = el("button", {
    type: "button", class: "bouton-icone", "aria-pressed": "false", "aria-label": "Garder l'écran allumé",
    title: "Garder l'écran allumé", hidden: !("wakeLock" in navigator),
  }, icone("soleil"));
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

  // Connexion à GitHub, en soufflet : repliée dès que l'appli est connectée (pour ne rien modifier
  // par mégarde), ouverte tant qu'il faut saisir le jeton. Le titre rappelle l'état de la connexion.
  const etatConnexion = el("span", { class: "discret soufflet__etat" });
  const afficherEtatConnexion = (connecte, depot) => {
    etatConnexion.textContent = connecte ? `Connecté à ${depot}` : "Non connecté";
  };
  afficherEtatConnexion(config?.aUnJeton, `${config?.proprietaire ?? ""}/${config?.depot ?? ""}`);
  const contenuConnexion = el("div", { class: "soufflet__contenu", id: "connexion-github", hidden: !!config?.aUnJeton });
  const titreConnexion = el("button", {
    type: "button", class: "soufflet__titre", "aria-controls": "connexion-github", "aria-expanded": String(!config?.aUnJeton),
  }, el("span", { class: "soufflet__textes" }, el("strong", {}, "Connexion à GitHub"), etatConnexion),
  el("span", { class: "chevron", "aria-hidden": "true" }));
  titreConnexion.addEventListener("click", () => {
    contenuConnexion.hidden = !contenuConnexion.hidden;
    titreConnexion.setAttribute("aria-expanded", String(!contenuConnexion.hidden));
  });

  const formulaire = el("form", { class: "carte formulaire soufflet" }, titreConnexion, contenuConnexion);
  contenuConnexion.append(
    champ("Propriétaire du dépôt", { name: "proprietaire", required: true, autocomplete: "off", autocapitalize: "off", spellcheck: "false", value: config?.proprietaire ?? DEPOT_PAR_DEFAUT.proprietaire }),
    champ("Dépôt des recettes", { name: "depot", required: true, autocomplete: "off", autocapitalize: "off", spellcheck: "false", value: config?.depot ?? DEPOT_PAR_DEFAUT.depot }),
    el("label", { class: "champ" }, el("span", {}, "Jeton d'accès"), champJeton),
    el("p", { class: "discret" },
      "Jeton « fine-grained » limité à ce seul dépôt, permission Contents en lecture et écriture. Il reste sur ce téléphone."),
    el("div", { class: "barre-actions" }, el("button", { type: "submit", class: "bouton" }, "Enregistrer et tester"), boutonOublier));
  // Le message de résultat reste visible même zone repliée.
  formulaire.append(message);

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
      afficherEtatConnexion(true, infos.nomComplet);
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
    // Geste lourd (il faudra ressaisir le jeton) : une confirmation évite un appui par erreur.
    if (!confirm("Oublier le jeton ? L'appli ne se synchronisera plus avec GitHub tant que vous ne l'aurez pas ressaisi.")) return;
    await synchro.oublierJeton();
    afficherJetonEnregistre(false);
    afficherEtatConnexion(false);
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
      // replaceChildren() écrirait « false » à l'écran : le bouton n'est passé que s'il existe.
      ...(lignes.length > LIGNES_HISTORIQUE ? [el("button", {
        type: "button", class: "bouton bouton--secondaire bouton--petit",
        onclick: () => { toutAfficher = !toutAfficher; afficherHistoriqueGlobal(); },
      }, toutAfficher ? "Afficher moins" : `Tout afficher (${lignes.length})`)] : []));
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

  // Apparence : deux pastilles, Clair (par défaut) ou Sombre, appliquées tout de suite.
  const themeActuel = lireTheme();
  const choixTheme = el("div", { class: "filtres__pastilles", role: "radiogroup", "aria-label": "Thème" },
    [["clair", "Clair"], ["sombre", "Sombre"]].map(([valeur, libelle]) => el("label", { class: "pastille" },
      el("input", { type: "radio", name: "theme", value: valeur, checked: themeActuel === valeur, onchange: () => choisirTheme(valeur) }),
      libelle)));

  return {
    contenu: page("Réglages",
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "Apparence")), choixTheme),
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

  const boutonPartager = el("button", {
    type: "button", class: "bouton-carre", "aria-label": "Partager la liste", title: "Partager la liste",
  }, icone("partager"));
  boutonPartager.addEventListener("click", () =>
    partagerTexte("Liste de courses", texte, message, "Liste copiée : collez-la dans un message."));
  const boutonVider = el("button", {
    type: "button", class: "bouton-carre", "aria-label": "Vider la liste", title: "Vider la liste",
  }, icone("corbeille"));
  const actions = el("span", { class: "entete-vue__actions" }, boutonPartager, boutonVider);
  const progression = el("div", { class: "progression" });
  let recettesConnues = new Map();

  // Deux vues : « Par recette » (chaque recette et ses ingrédients) ou « Tout ensemble »
  // (les ingrédients de toutes les recettes, additionnés). Le choix est retenu sur le téléphone.
  let ensemble = lireVueCourses() === "ensemble";
  const ongletRecettes = el("button", { type: "button", class: "onglets__bouton" }, "Par recette");
  const ongletEnsemble = el("button", { type: "button", class: "onglets__bouton" }, "Tout ensemble");
  const onglets = el("div", { class: "onglets onglets--courses", role: "group", "aria-label": "Présentation de la liste" },
    ongletRecettes, ongletEnsemble);
  function choisirVue(valeur) {
    ensemble = valeur;
    retenirVueCourses(valeur ? "ensemble" : "recettes");
    rafraichir();
  }
  ongletRecettes.addEventListener("click", () => choisirVue(false));
  ongletEnsemble.addEventListener("click", () => choisirVue(true));

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
        el("span", {}, ...texteArticle(partiesIngredient(article.ingredient)))))));

  // Une recette de la liste et ses ingrédients. Le titre plie ou déplie les ingrédients (retenu
  // sur le téléphone) ; le nombre de personnes se règle ici aussi, et la recette peut être retirée.
  function carteRecette(recette) {
    const reglage = (ecart, libelle, classe) => el("button", {
      type: "button", class: classe, "aria-label": libelle,
      disabled: recette.personnes + ecart < PERSONNES_MIN || recette.personnes + ecart > PERSONNES_MAX,
      onclick: () => changer((liste) => ajouterALaListe(liste, recette.id, recette.personnes + ecart)),
    });
    const restants = recette.articles.filter((article) => !article.coche).length;
    const achetes = recette.articles.length - restants;
    const idIngredients = `courses-${recette.id}`;
    const entree = recettesConnues.get(recette.id);
    // En-tête de la carte : photo (ouvre la recette), nom et compteur (plie ou déplie), réglage des personnes.
    return el("li", { class: "courses__recette" },
      el("div", { class: "courses__tete" },
        el("a", { href: `#/recette/${encodeURIComponent(recette.id)}`, class: "courses__photo", "aria-label": `Voir ${recette.nom}` },
          entree ? vignette(entree) : el("span", { class: "vignette" })),
        el("button", {
          type: "button", class: "courses__plier", "aria-expanded": String(!recette.plie), "aria-controls": idIngredients,
          onclick: () => changer((liste) => plierRecette(liste, recette.id, !recette.plie)),
        },
        el("strong", {}, recette.nom),
        el("span", { class: "discret courses__compte" },
          restants ? [`${achetes} / ${recette.articles.length}`, recette.personnes ? ` · ${recette.personnes} pers.` : ""] : "Tout acheté")),
        recette.personnes && el("div", { class: "portions portions--compact", role: "group", "aria-label": "Nombre de personnes" },
          reglage(-1, "Une personne de moins", "portions__bouton"),
          el("output", { class: "portions__valeur" }, String(recette.personnes)),
          reglage(1, "Une personne de plus", "portions__bouton portions__bouton--plus"))),
      el("div", { id: idIngredients, hidden: recette.plie },
        recette.articles.length ? articles(recette.articles) : el("p", { class: "discret courses__vide" }, "Aucun ingrédient."),
        el("div", { class: "courses__pied" },
          el("button", {
            type: "button", class: "courses__retirer",
            onclick: () => changer((liste) => retirerDeLaListe(liste, recette.id)),
          }, "Retirer de la liste"))));
  }

  async function rafraichir() {
    const [liste, entrees] = await Promise.all([lireListeCourses(), stockage.lireRecettes()]);
    recettesConnues = new Map(entrees.map((entree) => [entree.id, entree]));
    const construite = construireListe(liste, new Map(entrees.map((entree) => [entree.id, entree.recette])));
    const nettoyee = nettoyerCoches(liste, construite);
    if (nettoyee !== liste) await ecrireListeCourses(nettoyee);
    const agregee = agregerListe(construite);
    texte = ensemble ? listeAgregeeEnTexte(agregee) : listeEnTexte(construite);
    ongletRecettes.setAttribute("aria-pressed", String(!ensemble));
    ongletEnsemble.setAttribute("aria-pressed", String(ensemble));

    compteur.textContent = "";
    actions.hidden = !liste.recettes.length;
    progression.hidden = !liste.recettes.length;
    onglets.hidden = !liste.recettes.length;
    if (!liste.recettes.length) {
      contenu.replaceChildren(pageVide("🛒", "Votre liste de courses est vide.",
        "Sur une recette, touchez « Ajouter aux courses ». Pour en ajouter plusieurs d'un coup, touchez « Sélectionner » dans Mes recettes.",
        el("a", { href: "#/", class: "bouton" }, "Voir mes recettes")));
      return;
    }
    // La progression compte les lignes de la vue affichée.
    const tous = ensemble ? agregee.articles : construite.recettes.flatMap((recette) => recette.articles);
    const restants = tous.filter((article) => !article.coche).length;
    // Barre de progression : ce qui reste à acheter, puis « achetés / total ».
    const part = tous.length ? Math.round(((tous.length - restants) / tous.length) * 100) : 0;
    const jauge = el("div", { class: "progression__remplie" });
    jauge.style.width = `${part}%`; // propriété réglée en script : permise par la CSP (pas d'attribut style)
    progression.replaceChildren(
      el("div", { class: "progression__texte" },
        el("span", {}, restants ? `${restants} article${restants > 1 ? "s" : ""} à acheter` : "Tout est acheté"),
        el("span", {}, `${tous.length - restants} / ${tous.length}`)),
      el("div", { class: "progression__barre", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(part), "aria-label": "Articles achetés" },
        jauge));
    contenu.replaceChildren(
      message,
      ensemble ? carteEnsemble(construite, agregee) : el("ul", { class: "courses__recettes" }, construite.recettes.map(carteRecette)),
      ...(construite.introuvables.length === 0 ? [] : [el("div", { class: "carte" },
        el("p", {}, `${construite.introuvables.length} recette(s) de la liste ne sont plus dans le dépôt.`),
        el("button", {
          type: "button", class: "bouton bouton--secondaire bouton--petit",
          onclick: () => changer((liste) => construite.introuvables.reduce(retirerDeLaListe, liste)),
        }, "Les retirer"))]));
  }

  // Vue « Tout ensemble » : une seule carte, un ingrédient par ligne avec les recettes qui en ont besoin.
  // Cocher une ligne coche cet ingrédient dans chacune de ses recettes (la vue « Par recette » suit).
  function carteEnsemble(construite, agregee) {
    const pour = construite.recettes
      .map((recette) => (recette.personnes ? `${recette.nom} (${recette.personnes} pers.)` : recette.nom)).join(", ");
    return el("section", { class: "courses__recette courses__ensemble" },
      el("p", { class: "discret courses__pour" }, `Pour : ${pour}`),
      agregee.articles.length
        ? el("ul", { class: "courses" }, agregee.articles.map((article) => el("li", {},
          el("label", { class: `courses__article${article.coche ? " courses__article--coche" : ""}` },
            el("input", {
              type: "checkbox", checked: article.coche,
              onchange: (evenement) => changer((liste) => cocherArticles(liste, article.cles, evenement.target.checked)),
            }),
            el("span", { class: "courses__ligne" },
              el("span", {}, ...texteArticle(article.parties)),
              el("small", { class: "courses__origine" }, article.recettes.join(" · ")))))))
        : el("p", { class: "discret courses__vide" }, "Aucun ingrédient."));
  }

  await rafraichir();
  return { contenu: el("div", {}, enteteFige(ligneTitre("Courses", actions), progression, onglets), contenu), rafraichir };
}

// Un article de la liste de courses : la quantité en gras, puis le nom (« **2 tranches** lard fumé »).
function texteArticle({ quantite, nom, precision }) {
  return [quantite && el("strong", { class: "courses__quantite" }, quantite), quantite ? " " : "", nom,
    precision ? ` (${precision})` : ""];
}

// Vue choisie dans Courses : retenue sur ce téléphone (simple confort, sans importance si elle se perd).
const CLE_VUE_COURSES = "cuicui.vueCourses";

function lireVueCourses() {
  try {
    return localStorage.getItem(CLE_VUE_COURSES) === "ensemble" ? "ensemble" : "recettes";
  } catch {
    return "recettes";
  }
}

function retenirVueCourses(valeur) {
  try {
    localStorage.setItem(CLE_VUE_COURSES, valeur);
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite.
  }
}

// ---- Ajout d'une recette en photo ----
// Les photos sont réduites (1 600 px, JPEG) sur le téléphone, puis déposées dans la boîte « a-traiter/ »
// du dépôt, avec le livre et la page. Claude les transforme ensuite en fiches (voir README).

const CLE_DERNIER_LIVRE = "cuicui.dernierLivre";

// Photo du téléphone → JPEG réduit, redressé selon l'orientation de la prise de vue.
async function preparerPhoto(fichier) {
  const image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  const { largeur, hauteur } = dimensionsReduites(image.width, image.height);
  const toile = el("canvas", { width: largeur, height: hauteur });
  toile.getContext("2d").drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  return new Promise((resoudre, rejeter) => toile.toBlob(
    (blob) => (blob ? resoudre(blob) : rejeter(new Error("Photo illisible."))), "image/jpeg", QUALITE_JPEG));
}

function lireDernierLivre() {
  try {
    return localStorage.getItem(CLE_DERNIER_LIVRE);
  } catch {
    return null;
  }
}

function retenirDernierLivre(valeur) {
  try {
    localStorage.setItem(CLE_DERNIER_LIVRE, valeur);
  } catch {
    // Stockage indisponible : le livre sera simplement à choisir de nouveau.
  }
}

async function vuePhoto() {
  const statut = await synchro.lireEtat();
  const entete = enteteFige(el("div", { class: "entete-vue__barre" },
    boutonRetour(), el("strong", { class: "entete-vue__nom" }, "Ajouter une recette en photo")));
  if (!statut.configure) {
    return {
      contenu: el("div", {}, entete, pageVide("🔑", "Application non connectée à GitHub.",
        "Les photos sont envoyées dans votre dépôt de recettes : connectez-le d'abord dans les Réglages.",
        el("a", { href: "#/reglages", class: "bouton" }, "Aller aux Réglages"))),
    };
  }

  const livres = (await stockage.lireLivres())
    .map((entree) => ({ id: entree.id, titre: String(entree.livre?.titre ?? entree.id) }))
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  const photos = []; // { image (Blob), url (aperçu), role }

  // Livre : le dernier choisi reste sélectionné, pour enchaîner les recettes d'un même livre.
  const choixLivre = el("select", { id: "livre-envoi", class: "formulaire__choix" },
    el("option", { value: "aucun" }, "Pas un livre (site, magazine, capture…)"),
    el("option", { value: "nouveau" }, "➕ Nouveau livre"),
    livres.map((livre) => el("option", { value: `livre:${livre.id}` }, livre.titre)));
  const valeurInitiale = lireDernierLivre();
  choixLivre.value = [...choixLivre.options].some((option) => option.value === valeurInitiale) ? valeurInitiale : "aucun";
  const aideNouveauLivre = el("p", { class: "discret" },
    "Ajoutez une photo de la page de copyright (au dos de la page de titre : ISBN, éditeur, année). "
    + "La couverture officielle sera cherchée en ligne ; une photo de la couverture sert de secours.");
  const champPage = el("input", { id: "page-envoi", type: "number", inputmode: "numeric", min: "1", step: "1", placeholder: "Facultatif" });
  const zonePage = el("label", { class: "champ", for: "page-envoi" }, el("span", {}, "Page"), champPage);

  const livreChoisi = () => {
    const valeur = choixLivre.value;
    if (valeur === "aucun" || valeur === "nouveau") return { type: valeur };
    const id = valeur.slice("livre:".length);
    return { type: "existant", id, titre: livres.find((livre) => livre.id === id)?.titre ?? null };
  };

  // Photos : appareil photo du téléphone (une à la fois) ou galerie (plusieurs, captures d'écran…).
  const entreeAppareil = el("input", { type: "file", accept: "image/*", capture: "environment", hidden: true });
  const entreeGalerie = el("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  const grille = el("div", { class: "photos-envoi" });
  const message = el("p", { class: "message", role: "status" });
  const boutonEnvoyer = el("button", { type: "button", class: "bouton" }, "Envoyer");

  const afficherMessage = (texte, type) => {
    message.textContent = texte;
    message.className = `message message--${type}`;
  };

  async function ajouterPhotos(fichiers) {
    if (!fichiers.length) return;
    afficherMessage("Préparation des photos…", "info");
    for (const fichier of fichiers) {
      try {
        const image = await preparerPhoto(fichier);
        photos.push({ image, url: URL.createObjectURL(image), role: "recette" });
      } catch {
        notifier("Impossible de lire une des photos.", "erreur");
      }
    }
    afficherMessage("", "info");
    dessinerPhotos();
  }
  for (const entree of [entreeAppareil, entreeGalerie]) {
    entree.addEventListener("change", () => {
      const fichiers = [...entree.files];
      entree.value = ""; // la même photo pourra être choisie de nouveau
      ajouterPhotos(fichiers);
    });
  }

  function retirerPhoto(index) {
    URL.revokeObjectURL(photos[index].url);
    photos.splice(index, 1);
    dessinerPhotos();
  }

  function dessinerPhotos() {
    const nouveau = choixLivre.value === "nouveau";
    aideNouveauLivre.hidden = !nouveau;
    zonePage.hidden = choixLivre.value === "aucun";
    // Couverture et page de copyright n'ont de sens que pour un nouveau livre.
    if (!nouveau) for (const photo of photos) if (ROLES_NOUVEAU_LIVRE.includes(photo.role)) photo.role = "recette";
    const roles = Object.entries(ROLES).filter(([role]) => nouveau || !ROLES_NOUVEAU_LIVRE.includes(role));
    grille.replaceChildren(...photos.map((photo, index) => {
      const choixRole = el("select", { class: "formulaire__choix", "aria-label": `Contenu de la photo ${index + 1}` },
        roles.map(([role, libelle]) => el("option", { value: role }, libelle)));
      choixRole.value = photo.role;
      choixRole.addEventListener("change", () => {
        // Une seule photo du plat : la précédente redevient une page de la recette.
        if (choixRole.value === "plat") for (const autre of photos) if (autre.role === "plat") autre.role = "recette";
        photo.role = choixRole.value;
        dessinerPhotos();
      });
      return el("figure", { class: "photo-envoi" },
        el("img", { src: photo.url, alt: `Photo ${index + 1}` }),
        el("figcaption", {}, choixRole,
          el("button", {
            type: "button", class: "bouton bouton--secondaire bouton--petit",
            "aria-label": `Retirer la photo ${index + 1}`, onclick: () => retirerPhoto(index),
          }, "✕")));
    }));
    boutonEnvoyer.disabled = photos.length === 0;
  }
  choixLivre.addEventListener("change", dessinerPhotos);

  boutonEnvoyer.addEventListener("click", async () => {
    const livre = livreChoisi();
    const roles = photos.map((photo) => photo.role);
    const probleme = verifierEnvoi({ roles, livre });
    if (probleme) {
      afficherMessage(probleme, "erreur");
      return;
    }
    const date = new Date();
    const demande = creerDemande({ date, livre, page: Number.parseInt(champPage.value, 10), roles });
    const id = identifiantEnvoi(date);
    boutonEnvoyer.disabled = true;
    afficherMessage("Envoi en cours…", "info");
    try {
      await synchro.deposerPhotos(id, demande,
        photos.map((photo, index) => ({ fichier: demande.photos[index].fichier, image: photo.image })));
    } catch (erreur) {
      afficherMessage(`Les photos n'ont pas pu être enregistrées : ${erreur.message}`, "erreur");
      boutonEnvoyer.disabled = false;
      return;
    }
    retenirDernierLivre(choixLivre.value);
    for (const photo of photos) URL.revokeObjectURL(photo.url);
    photos.length = 0;
    champPage.value = "";
    dessinerPhotos();
    const encoreLa = (await synchro.lireEnvois()).some((envoi) => envoi.id === id && envoi.statut === "envoi");
    const erreur = (await synchro.lireEtat()).derniereErreur;
    if (!encoreLa) afficherMessage("Photos envoyées. Claude créera la fiche lors du prochain traitement.", "succes");
    else if (!erreur || erreur.estHorsLigne) {
      afficherMessage("Photos gardées sur le téléphone : elles partiront dès le retour du réseau.", "info");
    } else {
      afficherMessage(`Photos gardées sur le téléphone, mais l'envoi a échoué : ${erreur.message} `
        + "Nouvel essai à chaque synchronisation.", "erreur");
    }
    await rafraichir();
  });

  // Envois pas encore transformés en fiches : encore sur le téléphone, ou déposés sur GitHub.
  const listeEnvois = el("div");
  async function rafraichir() {
    const envois = await synchro.lireEnvois();
    listeEnvois.replaceChildren(envois.length
      ? el("ul", { class: "envois" }, envois.map((envoi) => el("li", {},
        el("span", {}, envoi.statut === "envoi" ? "⏳ En attente d'envoi" : "📬 Envoyé, à traiter par Claude"),
        el("span", { class: "discret" },
          [envoi.demande?.date && formaterDate(Date.parse(envoi.demande.date)), decrireDemande(envoi.demande)]
            .filter(Boolean).join(" · ")))))
      : el("p", { class: "discret" }, "Aucune photo en attente de traitement."));
  }
  await rafraichir();
  dessinerPhotos();

  return {
    contenu: el("div", {}, entete,
      el("section", { class: "carte formulaire" },
        el("p", {}, el("strong", {}, "1. Le livre")),
        el("label", { class: "champ", for: "livre-envoi" }, el("span", {}, "Recette tirée de"), choixLivre),
        aideNouveauLivre,
        zonePage),
      el("section", { class: "carte formulaire" },
        el("p", {}, el("strong", {}, "2. Les photos")),
        el("p", { class: "discret" },
          "Livre bien à plat, à la lumière du jour, photo prise d'aplomb et sans flash. "
          + "Une photo par page ; indiquez sous chacune ce qu'elle montre."),
        el("div", { class: "barre-actions" },
          el("button", { type: "button", class: "bouton bouton--secondaire", onclick: () => entreeAppareil.click() }, "📷 Prendre une photo"),
          el("button", { type: "button", class: "bouton bouton--secondaire", onclick: () => entreeGalerie.click() }, "🖼️ Galerie")),
        entreeAppareil, entreeGalerie, grille,
        el("div", { class: "barre-actions" }, boutonEnvoyer),
        message),
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "Envois en attente")),
        listeEnvois)),
    rafraichir,
    quitter() {
      for (const photo of photos) URL.revokeObjectURL(photo.url);
    },
  };
}

const vues = {
  "/": vueRecettes,
  "/favoris": vueStatut("favorite", "Mes meilleures recettes", () =>
    pageVide("⭐", "Aucune favorite pour l'instant.",
      "Sur l'écran d'une recette, choisissez « Favorite » dans la pastille de statut pour la retrouver ici."),
    { parCategorie: true }),
  "/a-essayer": vueStatut("a-essayer", "À essayer", () =>
    pageVide("📝", "Aucune recette à essayer.",
      "Sur l'écran d'une recette, choisissez « À essayer » dans la pastille de statut : elle rejoint ici votre sélection de recettes à tester.")),
  "/courses": vueCourses,
  "/reglages": vueReglages,
  "/photo": vuePhoto,
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
// Historique de l'application, toujours de la forme : Mes recettes (profondeur 0), puis au plus
// un autre onglet (profondeur 1), puis les recettes et livres ouverts (un cran de plus chacun).
// Le retour arrière ramène donc toujours à Mes recettes, et depuis Mes recettes il quitte
// l'application, comme les autres applications du téléphone.
let profondeur = history.state?.profondeur ?? 0;
if (history.state?.profondeur == null) {
  if (routeCourante() === "/") history.replaceState({ profondeur }, "");
  else {
    // Ouverte directement sur une autre page : Mes recettes est glissé en dessous.
    const adresse = location.hash;
    history.replaceState({ profondeur: 0 }, "", "#/");
    history.pushState({ profondeur: 1 }, "", adresse);
    profondeur = 1;
  }
}

// Onglet demandé depuis une recette ou un livre : on revient d'abord à l'onglet de profondeur 1.
let ongletDemande = null;

// Aller à un onglet (barre du bas ou lien vers un onglet) sans empiler les pages :
// l'onglet remplace celui de profondeur 1, et Mes recettes ramène au bas de l'historique.
function allerVersOnglet(route) {
  if (route === "/") {
    if (profondeur > 0) history.go(-profondeur);
    return;
  }
  if (profondeur === 0) location.hash = `#${route}`;
  else if (profondeur === 1) location.replace(`#${route}`);
  else {
    ongletDemande = route;
    history.go(-(profondeur - 1));
  }
}

window.addEventListener("popstate", () => {
  if (ongletDemande == null) return;
  const route = ongletDemande;
  ongletDemande = null;
  location.replace(`#${route}`);
});

document.addEventListener("click", (evenement) => {
  const lien = evenement.target.closest?.('a[href^="#/"]');
  if (!lien || evenement.defaultPrevented || evenement.button !== 0
    || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
  const route = lien.getAttribute("href").slice(1);
  if (!(route in vues)) return;
  evenement.preventDefault();
  allerVersOnglet(route);
});

async function afficher() {
  const numero = ++numeroAffichage;
  const route = routeCourante();
  await lireListeCourses(); // pour l'icône 🛒 des recettes déjà dans la liste
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
  // Type d'écran, pour la mise en page : une recette s'affiche en plein écran (sans en-tête ni onglets).
  document.body.dataset.ecran = estRecette(route) ? "recette" : route.startsWith(PREFIXE_LIVRE) ? "livre" : "onglet";
  suivreHauteurEntete(conteneur);
  conteneur.scrollTop = estRecette(route) ? 0 : positionsDefilement.get(route) ?? 0;
  if (recetteQuittee) retrouverRecette(conteneur, recetteQuittee);

  // Le détail d'une recette ou d'un livre reste rattaché à l'onglet « Recettes ».
  const onglet = estDetail(route) || route === "/photo" ? "/" : route;
  for (const lien of document.querySelectorAll(".navigation a")) {
    if (lien.dataset.route === onglet) lien.setAttribute("aria-current", "page");
    else lien.removeAttribute("aria-current");
  }
}

// Hauteur de l'en-tête figé de l'écran affiché, dans la variable CSS --hauteur-entete :
// les titres de section (chef, catégorie…) se collent juste en dessous pendant le défilement.
const observateurEntete = new ResizeObserver(([mesure]) =>
  mesure.target.closest(".vue")?.style.setProperty("--hauteur-entete", `${mesure.target.offsetHeight}px`));

function suivreHauteurEntete(conteneur) {
  observateurEntete.disconnect();
  const entete = conteneur.querySelector(".entete-vue");
  if (!entete) return;
  conteneur.style.setProperty("--hauteur-entete", `${entete.offsetHeight}px`); // tout de suite, puis à chaque changement
  observateurEntete.observe(entete);
}

// En revenant d'une recette : sa carte est ramenée à l'écran si elle n'y est pas
// (liste reclassée ou modifiée entre-temps).
function retrouverRecette(conteneur, id) {
  const lien = `#/recette/${encodeURIComponent(id)}`;
  const carte = [...conteneur.querySelectorAll("a.lien-recette")].find((a) => a.getAttribute("href") === lien);
  if (!carte || !carte.offsetParent) return; // absente, ou dans une section pliée
  const zone = conteneur.getBoundingClientRect();
  const hautVisible = conteneur.querySelector(".entete-vue")?.getBoundingClientRect().bottom ?? zone.top;
  const basVisible = document.querySelector(".navigation").getBoundingClientRect().top;
  const position = carte.getBoundingClientRect();
  if (position.top < hautVisible || position.bottom > basVisible) carte.scrollIntoView({ block: "center" });
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
  }, icone("retour"));
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
  // Nouvelle page : Mes recettes à 0, un autre onglet à 1, une recette ou un livre un cran plus loin
  // que la page précédente. Retour arrière : la page garde sa profondeur.
  if (history.state?.profondeur == null) {
    const route = routeCourante();
    const nouvelle = route === "/" ? 0 : route in vues ? 1 : profondeur + 1;
    history.replaceState({ profondeur: nouvelle }, "");
  }
  profondeur = history.state.profondeur;
  afficher();
});
afficher();
suivreConnexion();
mettreAJourBadge();
enregistrerServiceWorker();
protegerStockage();
synchro.synchroniser().catch(() => {});
