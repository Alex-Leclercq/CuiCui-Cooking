// CuiCui Cooking – point d'entrée de l'application.
// Navigation par « hash » (#/favoris…) : fonctionne sans serveur
// particulier, aussi bien en local que sur GitHub Pages.

import { ouvrirStockage } from "./stockage.js";
import { creerClientGitHub } from "./github.js";
import { creerSynchro } from "./synchro.js";
import {
  STATUTS, avecStatut, formaterIngredient, formaterInfos, formaterSource, grouperIngredients,
  infosStatut, lireStatut, majuscule, recetteEnTexte,
} from "./recette.js";

const VERSION = "0.4.0";
const DEPOT_PAR_DEFAUT = { proprietaire: "Alex-Leclercq", depot: "CuiCui-Recettes" };

const stockage = await ouvrirStockage();
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

// Liste de recettes triées par nom, chacune menant à son écran de détail.
function listeRecettes(entrees) {
  const nom = (entree) => String(entree.recette.nom ?? entree.id);
  const triees = [...entrees].sort((a, b) => nom(a).localeCompare(nom(b), "fr"));
  return [
    el("p", { class: "discret" }, `${triees.length} recette(s)`),
    el("ul", { class: "liste-recettes" }, triees.map((entree) => {
      const { chef, source } = entree.recette;
      const details = [chef, source?.titre].filter(Boolean).join(" · ");
      const statut = infosStatut(lireStatut(entree.recette));
      return el("li", {},
        el("a", { class: "carte lien-recette", href: `#/recette/${encodeURIComponent(entree.id)}` },
          el("span", { class: "lien-recette__titre" },
            el("strong", {}, nom(entree)),
            el("span", { class: "lien-recette__statut", title: statut.libelle, "aria-label": statut.libelle }, statut.icone)),
          details && el("span", { class: "discret" }, details)));
    })),
  ];
}

async function vueRecettes() {
  const etat = el("p", { class: "discret" });
  const liste = el("div");

  async function rafraichir() {
    const [entrees, statut] = await Promise.all([stockage.lireRecettes(), synchro.lireEtat()]);
    etat.textContent = texteEtat(statut);

    if (entrees.length === 0) {
      liste.replaceChildren(statut.configure
        ? pageVide("📖", "Aucune recette dans le dépôt.",
          "Ajoutez-en depuis le téléphone ou en envoyant des captures à Claude.")
        : pageVide("📖", "Aucune recette pour l'instant.",
          "Connectez l'application à votre dépôt de recettes dans les Réglages.",
          el("a", { href: "#/reglages", class: "bouton" }, "Aller aux Réglages")));
      return;
    }
    liste.replaceChildren(...listeRecettes(entrees));
  }

  await rafraichir();
  return {
    contenu: page("Mes recettes", el("div", { class: "barre-actions" }, boutonSynchroniser()), etat, liste),
    rafraichir,
  };
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

const CATEGORIES = {
  aperitif: "Apéritif", entree: "Entrée", plat: "Plat", accompagnement: "Accompagnement",
  dessert: "Dessert", boisson: "Boisson", sauce: "Sauce", autre: "Autre",
};

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

  // Choix du statut : un appui enregistre sur le téléphone puis envoie à GitHub.
  const choixStatut = el("div", { class: "statuts", role: "radiogroup", "aria-label": "Statut de la recette" },
    STATUTS.map((statut) => el("button", {
      type: "button", class: "statut", role: "radio", "data-valeur": statut.valeur,
      "aria-checked": String(statut.valeur === lireStatut(recette)),
    }, `${statut.icone} ${statut.libelle}`)));
  choixStatut.addEventListener("click", (evenement) => {
    const bouton = evenement.target.closest(".statut");
    if (!bouton || bouton.getAttribute("aria-checked") === "true") return;
    for (const autre of choixStatut.querySelectorAll(".statut")) {
      autre.setAttribute("aria-checked", String(autre === bouton));
    }
    recette = avecStatut(recette, bouton.dataset.valeur);
    synchro.enregistrer(recette);
  });

  const message = el("p", { class: "message", role: "status" });
  const boutonPartager = el("button", { type: "button", class: "bouton bouton--secondaire" }, "📤 Partager");
  boutonPartager.addEventListener("click", () => partager(recette, message));

  return {
    contenu: el("article", { class: "recette" },
      el("a", { href: "#/", class: "retour" }, "← Mes recettes"),
      el("h2", {}, String(recette.nom ?? id)),
      source && el("p", { class: "discret" }, source),
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
      recette.notes && [el("h3", {}, "Mes notes"), el("p", { class: "notes" }, String(recette.notes))]),
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
  }
  await rafraichir();

  const horsLigne = el("p", { class: "discret" }, "Vérification du mode hors ligne…");
  afficherEtatHorsLigne(horsLigne);

  return {
    contenu: page("Réglages",
      formulaire,
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "Synchronisation")), etat, conflits,
        el("div", { class: "barre-actions" }, boutonSynchroniser())),
      el("section", { class: "carte" },
        el("p", {}, el("strong", {}, "À propos")),
        el("p", { class: "discret" }, `CuiCui Cooking, version ${VERSION}.`),
        horsLigne)),
    rafraichir,
  };
}

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

function routeCourante() {
  const route = location.hash.replace(/^#/, "") || "/";
  if (route.startsWith(PREFIXE_RECETTE)) return route;
  return route in vues ? route : "/";
}

function chargerVue(route) {
  if (!route.startsWith(PREFIXE_RECETTE)) return vues[route]();
  let id;
  try {
    id = decodeURIComponent(route.slice(PREFIXE_RECETTE.length));
  } catch {
    id = "";
  }
  return vueRecette(id);
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

  // Le détail d'une recette reste rattaché à l'onglet « Recettes ».
  const onglet = route.startsWith(PREFIXE_RECETTE) ? "/" : route;
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

async function mettreAJourBadge() {
  const badge = document.getElementById("etat-synchro");
  const etat = await synchro.lireEtat();
  if (etat.conflits.length) badge.textContent = "⚠️ Conflit";
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

function enregistrerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((erreur) => {
      console.error("Échec de l'installation du mode hors ligne :", erreur);
    });
  }
}

synchro.ecouter(() => {
  rafraichirVue?.();
  mettreAJourBadge();
});

// Synchronisation à l'ouverture et à chaque retour sur l'application.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") synchro.synchroniser().catch(() => {});
});

window.addEventListener("hashchange", afficher);
afficher();
suivreConnexion();
mettreAJourBadge();
enregistrerServiceWorker();
synchro.synchroniser().catch(() => {});
