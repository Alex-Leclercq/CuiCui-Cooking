// Faux GitHub en mémoire, pour tester la synchronisation sans réseau ni jeton.
// Il imite les quelques routes de l'API utilisées par js/github.js.

import { versBase64, depuisBase64 } from "../js/github.js";

export function creerFauxGitHub() {
  const fichiers = new Map(); // chemin → { texte, sha }
  const blobs = new Map();    // sha → texte
  let commit = null;
  let compteur = 0;
  const arbres = new Map();   // sha → entrées ajoutées par l'application (API Git : photos à traiter)
  const commits = new Map();  // sha → { arbre, parents, message }
  // photosEnPanne : seuls les téléchargements de photos échouent (connexion coupée en plein préchargement).
  // avancerAvantMaj : un commit arrive « depuis le PC » juste avant la mise à jour de main par l'application.
  const etat = { horsLigne: false, photosEnPanne: false, avancerAvantMaj: false, appels: [], messages: [] };

  const nouveauSha = () => `sha${++compteur}`;

  // Modifications faites « depuis le PC » (hors application).
  function ecrire(chemin, texte) {
    const sha = nouveauSha();
    fichiers.set(chemin, { texte, sha });
    blobs.set(sha, texte);
    commit = nouveauSha();
    return sha;
  }

  function supprimer(chemin) {
    fichiers.delete(chemin);
    commit = nouveauSha();
  }

  const reponse = (statut, corps) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

  async function fetch(url, options = {}) {
    if (etat.horsLigne) throw new TypeError("Failed to fetch");
    const methode = options.method ?? "GET";
    const adresse = new URL(url);
    const route = adresse.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, "");
    const brut = options.headers?.Accept === "application/vnd.github.raw+json";
    etat.appels.push(`${methode} ${route}${brut ? " (brut)" : ""}`);
    let correspondance;

    if (route === "") return reponse(200, { full_name: "test/recettes", private: true });

    if (route === "/git/ref/heads/main") {
      return commit ? reponse(200, { object: { sha: commit } }) : reponse(409, { message: "Git Repository is empty." });
    }

    if ((correspondance = route.match(/^\/git\/trees\/(.+)$/))) {
      const arbre = [...fichiers].map(([path, fichier]) => ({ path, type: "blob", sha: fichier.sha }));
      return reponse(200, { tree: arbre, truncated: false });
    }

    // API Git : blobs, arbre, commit, puis déplacement de main (ajout de plusieurs fichiers en un commit).
    if (route === "/git/blobs" && methode === "POST") {
      const sha = nouveauSha();
      blobs.set(sha, depuisBase64(JSON.parse(options.body).content));
      return reponse(201, { sha });
    }
    if ((correspondance = route.match(/^\/git\/commits\/(.+)$/))) {
      return reponse(200, { sha: correspondance[1], tree: { sha: `arbre-${correspondance[1]}` } });
    }
    if (route === "/git/trees" && methode === "POST") {
      const sha = nouveauSha();
      arbres.set(sha, JSON.parse(options.body).tree);
      return reponse(201, { sha });
    }
    if (route === "/git/commits" && methode === "POST") {
      const corps = JSON.parse(options.body);
      const sha = nouveauSha();
      commits.set(sha, { arbre: corps.tree, parents: corps.parents, message: corps.message });
      return reponse(201, { sha });
    }
    if (route === "/git/refs/heads/main" && methode === "PATCH") {
      if (etat.avancerAvantMaj) {
        etat.avancerAvantMaj = false;
        ecrire("recettes/pc/recette.json", JSON.stringify({ id: "pc", nom: "Depuis le PC" }));
      }
      const nouveau = commits.get(JSON.parse(options.body).sha);
      if (!nouveau || nouveau.parents[0] !== commit) return reponse(422, { message: "Update is not a fast forward" });
      for (const entree of arbres.get(nouveau.arbre)) fichiers.set(entree.path, { texte: blobs.get(entree.sha), sha: entree.sha });
      commit = JSON.parse(options.body).sha;
      etat.messages.push(nouveau.message);
      return reponse(200, { object: { sha: commit } });
    }

    if ((correspondance = route.match(/^\/git\/blobs\/(.+)$/))) {
      if (etat.photosEnPanne && brut) throw new TypeError("Failed to fetch");
      const contenu = blobs.get(correspondance[1]);
      if (brut) {
        return new Response(new TextEncoder().encode(contenu), {
          status: 200, headers: { "Content-Type": "application/octet-stream" },
        });
      }
      return reponse(200, { content: versBase64(contenu), encoding: "base64" });
    }

    if ((correspondance = route.match(/^\/contents\/(.+)$/))) {
      const chemin = correspondance[1].split("/").map(decodeURIComponent).join("/");
      const fichier = fichiers.get(chemin);
      if (methode === "GET") {
        return fichier ? reponse(200, { content: versBase64(fichier.texte), sha: fichier.sha })
          : reponse(404, { message: "Not Found" });
      }
      const corps = JSON.parse(options.body);
      if (fichier && !corps.sha) return reponse(422, { message: "sha wasn't supplied" });
      if (fichier && corps.sha !== fichier.sha) return reponse(409, { message: "does not match" });
      if (!fichier && corps.sha) return reponse(404, { message: "Not Found" });
      const sha = ecrire(chemin, depuisBase64(corps.content));
      return reponse(fichier ? 200 : 201, { content: { sha }, commit: { sha: commit } });
    }

    return reponse(404, { message: "Not Found" });
  }

  return {
    fetch,
    ecrire,
    supprimer,
    lire: (chemin) => fichiers.get(chemin),
    chemins: () => [...fichiers.keys()],
    etat,
  };
}
