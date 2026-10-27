// Faux GitHub en mémoire, pour tester la synchronisation sans réseau ni jeton.
// Il imite les quelques routes de l'API utilisées par js/github.js.

import { versBase64, depuisBase64 } from "../js/github.js";

export function creerFauxGitHub() {
  const fichiers = new Map(); // chemin → { texte, sha }
  const blobs = new Map();    // sha → texte
  let commit = null;
  let compteur = 0;
  // photosEnPanne : seuls les téléchargements de photos échouent (connexion coupée en plein préchargement).
  const etat = { horsLigne: false, photosEnPanne: false, appels: [] };

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
    etat,
  };
}
