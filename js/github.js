// CuiCui Cooking – client minimal de l'API REST de GitHub.
// Toutes les requêtes partent vers api.github.com, avec le jeton de l'utilisateur.
// Le jeton n'est jamais écrit ailleurs que dans le stockage local du téléphone.

const API = "https://api.github.com";

export class ErreurGitHub extends Error {
  constructor(message, statut) {
    super(message);
    this.name = "ErreurGitHub";
    this.statut = statut;
  }

  // 409 : le fichier a changé sur GitHub ; 422 : il existe déjà alors qu'on croyait le créer.
  get estConflit() {
    return this.statut === 409 || this.statut === 422;
  }

  get estHorsLigne() {
    return this.statut === 0;
  }
}

function messageErreur(statut) {
  switch (statut) {
    case 401: return "Jeton invalide ou expiré.";
    case 403: return "Accès refusé : vérifiez les permissions du jeton (ou limite de requêtes atteinte).";
    case 404: return "Dépôt introuvable, ou le jeton n'y a pas accès.";
    case 409:
    case 422: return "Conflit : le fichier a changé sur GitHub.";
    default: return `Erreur GitHub (${statut}).`;
  }
}

// Encodage base64 du texte en UTF-8 (accents, emojis…), comme l'attend l'API.
export function versBase64(texte) {
  let binaire = "";
  for (const octet of new TextEncoder().encode(texte)) binaire += String.fromCharCode(octet);
  return btoa(binaire);
}

export function depuisBase64(base64) {
  const binaire = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0)));
}

const encoderChemin = (chemin) => chemin.split("/").map(encodeURIComponent).join("/");

export function creerClientGitHub({ proprietaire, depot, jeton, fetch: appeler = (...a) => fetch(...a) }) {
  const racine = `${API}/repos/${encodeURIComponent(proprietaire)}/${encodeURIComponent(depot)}`;

  async function requete(chemin, { methode = "GET", corps } = {}) {
    let reponse;
    try {
      reponse = await appeler(racine + chemin, {
        method: methode,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jeton}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(corps ? { "Content-Type": "application/json" } : {}),
        },
        body: corps ? JSON.stringify(corps) : undefined,
      });
    } catch {
      throw new ErreurGitHub("Pas de connexion à GitHub.", 0);
    }
    if (!reponse.ok) throw new ErreurGitHub(messageErreur(reponse.status), reponse.status);
    return reponse.json();
  }

  return {
    // Vérifie que le dépôt est accessible avec ce jeton.
    async verifier() {
      const infos = await requete("");
      return { nomComplet: infos.full_name, prive: infos.private };
    },

    // Empreinte (SHA) du dernier commit de la branche, ou null si le dépôt est vide.
    async dernierCommit(branche = "main") {
      try {
        return (await requete(`/git/ref/heads/${branche}`)).object.sha;
      } catch (erreur) {
        if (erreur.statut === 409) return null; // « Git Repository is empty »
        throw erreur;
      }
    },

    // Liste de tous les fichiers du dépôt à ce commit : [{ path, type, sha }].
    async arborescence(sha) {
      return (await requete(`/git/trees/${sha}?recursive=1`)).tree;
    },

    // Contenu texte d'un fichier à partir de son empreinte.
    async lireBlob(sha) {
      return depuisBase64((await requete(`/git/blobs/${sha}`)).content);
    },

    // Contenu actuel d'un fichier, ou null s'il n'existe pas.
    async lireFichier(chemin) {
      try {
        const fichier = await requete(`/contents/${encoderChemin(chemin)}?ref=main`);
        return { texte: depuisBase64(fichier.content), sha: fichier.sha };
      } catch (erreur) {
        if (erreur.statut === 404) return null;
        throw erreur;
      }
    },

    // Crée ou remplace un fichier : GitHub crée lui-même le commit.
    // sha = empreinte de la version qu'on modifie (null pour une création).
    // Si le fichier a changé entre-temps, GitHub refuse : ErreurGitHub avec estConflit.
    async ecrireFichier(chemin, texte, sha, message) {
      try {
        const resultat = await requete(`/contents/${encoderChemin(chemin)}`, {
          methode: "PUT",
          corps: { message, content: versBase64(texte), branch: "main", ...(sha ? { sha } : {}) },
        });
        return { sha: resultat.content.sha, commit: resultat.commit.sha };
      } catch (erreur) {
        // Fichier supprimé sur GitHub alors qu'on croyait le modifier : c'est aussi un conflit.
        if (erreur.statut === 404 && sha) throw new ErreurGitHub(messageErreur(409), 409);
        throw erreur;
      }
    },
  };
}
