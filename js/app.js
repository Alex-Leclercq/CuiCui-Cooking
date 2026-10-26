// CuiCui Cooking – point d'entrée de l'application.
// Navigation par « hash » (#/favoris…) : fonctionne sans serveur
// particulier, aussi bien en local que sur GitHub Pages.

const VERSION = "0.1.0";

// Chaque vue renvoie le HTML de la page correspondante.
// Pour l'instant ce sont des pages d'attente : les fonctionnalités
// arriveront étape par étape (voir la feuille de route du README).
const vues = {
  "/": () => `
    <h2>Mes recettes</h2>
    ${pageVide("📖", "Aucune recette pour l'instant.",
      "Les recettes seront lues depuis le dépôt GitHub une fois la connexion configurée dans les Réglages.")}
  `,
  "/favoris": () => `
    <h2>Mes meilleures recettes</h2>
    ${pageVide("⭐", "Aucun favori pour l'instant.",
      "Marquez une recette d'une étoile pour la retrouver ici.")}
  `,
  "/a-essayer": () => `
    <h2>À essayer</h2>
    ${pageVide("📝", "Aucune recette à essayer.",
      "Les recettes jamais cuisinées apparaîtront ici, comme une liste de choses à faire.")}
  `,
  "/courses": () => `
    <h2>Liste de courses</h2>
    ${pageVide("🛒", "Votre liste de courses est vide.",
      "Sélectionnez plusieurs recettes pour obtenir la liste de tous les ingrédients à acheter.")}
  `,
  "/reglages": () => `
    <h2>Réglages</h2>
    <section class="carte">
      <p><strong>Connexion à GitHub</strong></p>
      <p class="discret">Bientôt : saisie du dépôt et du jeton d'accès pour lire et enregistrer vos recettes.</p>
    </section>
    <section class="carte">
      <p><strong>À propos</strong></p>
      <p class="discret">CuiCui Cooking, version ${VERSION}.</p>
      <p class="discret" id="etat-hors-ligne">Vérification du mode hors ligne…</p>
    </section>
  `,
};

function pageVide(icone, titre, explication) {
  return `
    <div class="vide">
      <span class="vide__icone" aria-hidden="true">${icone}</span>
      <p><strong>${titre}</strong></p>
      <p class="discret">${explication}</p>
    </div>
  `;
}

function routeCourante() {
  const route = location.hash.replace(/^#/, "") || "/";
  return route in vues ? route : "/";
}

function afficher() {
  const route = routeCourante();
  const conteneur = document.getElementById("vue");
  conteneur.innerHTML = vues[route]();
  conteneur.scrollTop = 0;

  for (const lien of document.querySelectorAll(".navigation a")) {
    if (lien.dataset.route === route) {
      lien.setAttribute("aria-current", "page");
    } else {
      lien.removeAttribute("aria-current");
    }
  }

  if (route === "/reglages") {
    afficherEtatHorsLigne();
  }
}

async function afficherEtatHorsLigne() {
  const element = document.getElementById("etat-hors-ligne");
  if (!element) return;
  if (!("serviceWorker" in navigator)) {
    element.textContent = "Mode hors ligne non pris en charge par ce navigateur.";
    return;
  }
  const enregistrement = await navigator.serviceWorker.getRegistration();
  element.textContent = enregistrement?.active
    ? "Mode hors ligne prêt : l'application fonctionne sans connexion."
    : "Mode hors ligne en cours d'installation…";
}

function suivreConnexion() {
  const badge = document.getElementById("etat-connexion");
  const mettreAJour = () => { badge.hidden = navigator.onLine; };
  window.addEventListener("online", mettreAJour);
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

window.addEventListener("hashchange", afficher);
afficher();
suivreConnexion();
enregistrerServiceWorker();
