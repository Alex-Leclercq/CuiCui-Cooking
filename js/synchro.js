// CuiCui Cooking – synchronisation entre le téléphone et le dépôt GitHub des recettes.
//
// - Envoi : chaque modification est enregistrée localement et mise en file d'attente,
//   puis envoyée à GitHub. Sans réseau, elle attend la prochaine synchronisation.
// - Réception : on compare l'empreinte du dernier commit à celle de la dernière synchro ;
//   si elle a changé, on parcourt l'arborescence et on ne télécharge que les fichiers modifiés.
// - Conflits : GitHub refuse une écriture basée sur une version périmée. On fusionne alors
//   champ par champ ; si les deux côtés ont modifié le même champ, l'utilisateur choisit.

const DOSSIER_RECETTE = /^recettes\/([^/]+)\/([^/]+)$/;
const DOSSIER_LIVRE = /^livres\/([^/]+)\/([^/]+)$/;
const cheminRecette = (id) => `recettes/${id}/recette.json`;
const versTexte = (recette) => JSON.stringify(recette, null, 2) + "\n";
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Historique : les lignes ajoutées des deux côtés sont toutes conservées, dans l'ordre chronologique.
function fusionnerHistoriques(locale = [], distante = []) {
  const lignes = new Map();
  for (const ligne of [...distante, ...locale]) lignes.set(JSON.stringify(ligne), ligne);
  return [...lignes.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Fusion à trois versions : base (avant modification), locale et distante.
// Renvoie la recette fusionnée, ou null si un même champ a été modifié différemment des deux côtés.
export function fusionner(base, locale, distante) {
  base ??= {};
  const resultat = {};
  const cles = new Set([...Object.keys(base), ...Object.keys(locale), ...Object.keys(distante)]);
  for (const cle of cles) {
    let valeur;
    if (cle === "historique") valeur = fusionnerHistoriques(locale[cle], distante[cle]);
    else if (egal(locale[cle], distante[cle]) || egal(locale[cle], base[cle])) valeur = distante[cle];
    else if (egal(distante[cle], base[cle])) valeur = locale[cle];
    else return null;
    if (valeur !== undefined) resultat[cle] = valeur;
  }
  return resultat;
}

export function creerSynchro({ stockage, creerClient }) {
  const ecouteurs = new Set();
  let enCours = null;
  let relancer = false;
  let derniereErreur = null;

  const notifier = (type) => ecouteurs.forEach((ecouteur) => ecouteur(type));

  async function client() {
    const config = await stockage.lireMeta("config");
    return config?.jeton ? creerClient(config) : null;
  }

  // ---- Envoi ----

  async function envoyer(github) {
    const operations = (await stockage.lireToutesAttentes()).sort((a, b) => a.date - b.date);
    for (const operation of operations) {
      if (operation.conflit) continue;
      const message = `${operation.shaBase ? "Modification" : "Ajout"} : ${operation.recette.nom ?? operation.id}`;
      try {
        const { sha } = await github.ecrireFichier(
          cheminRecette(operation.id), versTexte(operation.recette), operation.shaBase, message);
        await terminerEnvoi(operation, operation.recette, sha);
      } catch (erreur) {
        if (!erreur.estConflit) throw erreur;
        await traiterConflit(github, operation, message);
      }
    }
  }

  async function traiterConflit(github, operation, message) {
    const chemin = cheminRecette(operation.id);
    const distant = await github.lireFichier(chemin);
    const recetteDistante = distant ? JSON.parse(distant.texte) : null;
    // Supprimée sur GitHub entre-temps : on la recrée avec la version locale.
    const fusion = recetteDistante
      ? fusionner(operation.recetteBase, operation.recette, recetteDistante)
      : operation.recette;
    if (!fusion) {
      await stockage.ecrireAttente({ ...operation, conflit: { recetteDistante, sha: distant.sha } });
      return;
    }
    const { sha } = await github.ecrireFichier(chemin, versTexte(fusion), distant?.sha ?? null, message);
    await terminerEnvoi(operation, fusion, sha);
  }

  // Écrit l'entrée locale d'une recette en gardant ce qui n'a pas changé (liste de ses fichiers…).
  async function mettreAJourEntree(id, changements) {
    const existante = await stockage.lireRecette(id);
    await stockage.ecrireRecette({ ...existante, id, ...changements });
  }

  async function terminerEnvoi(operation, recette, sha) {
    const actuelle = await stockage.lireAttente(operation.id);
    if (actuelle && actuelle.date !== operation.date) {
      // Modifiée à nouveau pendant l'envoi : la nouvelle version partira au prochain passage.
      await stockage.ecrireAttente({ ...actuelle, shaBase: sha, recetteBase: recette });
      await mettreAJourEntree(operation.id, { recette: actuelle.recette, sha });
    } else {
      await stockage.supprimerAttente(operation.id);
      await mettreAJourEntree(operation.id, { recette, sha });
    }
  }

  // ---- Réception ----

  async function recuperer(github) {
    const commit = await github.dernierCommit();
    if (commit === (await stockage.lireMeta("dernierCommit"))) return;

    const arbre = commit ? await github.arborescence(commit) : [];
    await recevoirRecettes(github, parDossier(arbre, DOSSIER_RECETTE, "recette.json"));
    await recevoirLivres(github, parDossier(arbre, DOSSIER_LIVRE, "livre.json"));
    await stockage.ecrireMeta("dernierCommit", commit);
  }

  // Pour chaque dossier (recette ou livre) : l'empreinte de sa fiche et celles de ses autres fichiers (photos).
  // Un dossier sans fiche est ignoré.
  function parDossier(arbre, motif, fiche) {
    const dossiers = new Map();
    for (const fichier of arbre) {
      const correspondance = fichier.type === "blob" && fichier.path.match(motif);
      if (!correspondance) continue;
      const [, id, nom] = correspondance;
      if (!dossiers.has(id)) dossiers.set(id, { sha: null, fichiers: {} });
      if (nom === fiche) dossiers.get(id).sha = fichier.sha;
      else dossiers.get(id).fichiers[nom] = fichier.sha;
    }
    for (const [id, dossier] of dossiers) if (!dossier.sha) dossiers.delete(id);
    return dossiers;
  }

  async function recevoirRecettes(github, distants) {
    const locales = new Map((await stockage.lireRecettes()).map((entree) => [entree.id, entree]));
    const enAttente = new Set((await stockage.lireToutesAttentes()).map((operation) => operation.id));

    for (const [id, { sha, fichiers }] of distants) {
      const locale = locales.get(id);
      // Une recette modifiée sur le téléphone et pas encore envoyée n'est pas écrasée.
      if (enAttente.has(id) || locale?.sha === sha) {
        if (locale && !egal(locale.fichiers ?? {}, fichiers)) await mettreAJourEntree(id, { fichiers });
        continue;
      }
      try {
        const recette = JSON.parse(await github.lireBlob(sha));
        await mettreAJourEntree(id, { recette, sha, fichiers });
      } catch (erreur) {
        if (!(erreur instanceof SyntaxError)) throw erreur;
        console.warn(`Recette illisible ignorée : ${id}`);
      }
    }
    for (const id of locales.keys()) {
      if (!distants.has(id) && !enAttente.has(id)) await stockage.supprimerRecette(id);
    }
  }

  // Les livres ne sont modifiés que sur GitHub : la version distante remplace toujours la locale.
  async function recevoirLivres(github, distants) {
    const locaux = new Map((await stockage.lireLivres()).map((entree) => [entree.id, entree]));
    for (const [id, { sha, fichiers }] of distants) {
      const local = locaux.get(id);
      if (local?.sha === sha) {
        if (!egal(local.fichiers ?? {}, fichiers)) await stockage.ecrireLivre({ ...local, fichiers });
        continue;
      }
      try {
        await stockage.ecrireLivre({ id, livre: JSON.parse(await github.lireBlob(sha)), sha, fichiers });
      } catch (erreur) {
        if (!(erreur instanceof SyntaxError)) throw erreur;
        console.warn(`Livre illisible ignoré : ${id}`);
      }
    }
    for (const id of locaux.keys()) if (!distants.has(id)) await stockage.supprimerLivre(id);
  }

  // ---- Photos ----
  // Les photos de plat et les couvertures de livres sont préchargées après chaque synchronisation,
  // pour s'afficher sans attente ;
  // les autres (pages de livre) sont téléchargées à la première consultation.
  // Toutes restent ensuite sur le téléphone (hors ligne).

  const TYPES_PHOTO = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const PRECHARGEMENTS_SIMULTANES = 3;
  const telechargements = new Map(); // sha → promesse : une photo n'est jamais téléchargée deux fois à la fois
  let prechargement = null;
  let relancerPrechargement = false;

  function telecharger(github, sha, nom) {
    if (!telechargements.has(sha)) {
      const extension = nom.split(".").pop().toLowerCase();
      const promesse = (async () => {
        const image = new Blob([await github.lireBlobBinaire(sha)], { type: TYPES_PHOTO[extension] ?? "image/jpeg" });
        await stockage.ecrirePhoto(sha, image);
        return image;
      })().finally(() => telechargements.delete(sha));
      telechargements.set(sha, promesse);
    }
    return telechargements.get(sha);
  }

  // Photo d'une recette (« plat.jpg », « source-1.jpg »…), ou null.
  async function photo(id, nom) {
    if (!nom) return null;
    return image((await stockage.lireRecette(id))?.fichiers?.[nom], nom);
  }

  // Couverture d'un livre, ou null.
  async function couverture(idLivre) {
    const entree = await stockage.lireLivre(idLivre);
    const nom = entree?.livre?.couverture;
    return nom ? image(entree.fichiers?.[nom], nom) : null;
  }

  // Image d'empreinte connue : depuis le téléphone, sinon depuis GitHub (puis gardée sur le téléphone).
  async function image(sha, nom) {
    if (!sha) return null;
    const enCache = await stockage.lirePhoto(sha);
    if (enCache) return enCache;
    const github = await client();
    if (!github) return null;
    try {
      return await telecharger(github, sha, nom);
    } catch {
      return null; // hors ligne : la photo sera téléchargée plus tard
    }
  }

  // Couvertures et photos de plat pas encore sur le téléphone : [{ sha, nom }], sans doublon.
  // Les couvertures d'abord : elles s'affichent dès l'étagère.
  async function imagesManquantes() {
    const presentes = new Set(await stockage.lireEmpreintesPhotos());
    const manquantes = new Map();
    const ajouter = (nom, fichiers) => {
      const sha = nom && fichiers?.[nom];
      if (sha && !presentes.has(sha)) manquantes.set(sha, nom);
    };
    for (const { livre, fichiers } of await stockage.lireLivres()) ajouter(livre?.couverture, fichiers);
    for (const { recette, fichiers } of await stockage.lireRecettes()) ajouter(recette?.photos?.plat, fichiers);
    return [...manquantes].map(([sha, nom]) => ({ sha, nom }));
  }

  async function passerPrechargement() {
    const github = await client();
    if (!github || globalThis.navigator?.connection?.saveData) return; // économiseur de données activé
    const file = await imagesManquantes();
    // Quelques téléchargements en parallèle ; à la première erreur (hors ligne…), tout s'arrête.
    const telechargerLaFile = async () => {
      try {
        for (let suivante; (suivante = file.shift());) await telecharger(github, suivante.sha, suivante.nom);
      } catch (erreur) {
        file.length = 0;
        throw erreur;
      }
    };
    await Promise.all(Array.from({ length: PRECHARGEMENTS_SIMULTANES }, telechargerLaFile));
  }

  // Un seul préchargement à la fois ; une demande pendant l'exécution relance un passage.
  // N'échoue jamais : ce qui manque sera repris à la prochaine synchronisation.
  function prechargerPhotos() {
    if (prechargement) {
      relancerPrechargement = true;
      return prechargement;
    }
    prechargement = (async () => {
      try {
        do {
          relancerPrechargement = false;
          await passerPrechargement();
        } while (relancerPrechargement);
      } catch {
        // Hors ligne, limite de requêtes atteinte… : réessayé à la prochaine synchronisation.
      } finally {
        prechargement = null;
      }
    })();
    return prechargement;
  }

  // ---- Orchestration ----

  async function executer() {
    const github = await client();
    if (!github) return;
    notifier("debut");
    try {
      await envoyer(github);
      await recuperer(github);
      derniereErreur = null;
      await stockage.ecrireMeta("derniereSynchro", Date.now());
      prechargerPhotos(); // en arrière-plan : la synchronisation est déjà terminée
    } catch (erreur) {
      derniereErreur = erreur;
      throw erreur;
    } finally {
      notifier("fin");
    }
  }

  // Une seule synchronisation à la fois ; une demande pendant l'exécution relance un passage.
  function synchroniser() {
    if (enCours) {
      relancer = true;
      return enCours;
    }
    enCours = (async () => {
      try {
        do {
          relancer = false;
          await executer();
        } while (relancer);
      } finally {
        enCours = null;
      }
    })();
    return enCours;
  }

  return {
    synchroniser,
    photo,
    couverture,
    prechargerPhotos,

    ecouter(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },

    // Enregistre une recette sur le téléphone puis tente de l'envoyer.
    // La promesse renvoyée se termine après la tentative d'envoi, sans jamais échouer.
    async enregistrer(recette) {
      const existante = await stockage.lireRecette(recette.id);
      const precedente = await stockage.lireAttente(recette.id);
      await mettreAJourEntree(recette.id, { recette, sha: existante?.sha ?? null });
      await stockage.ecrireAttente({
        id: recette.id,
        recette,
        // La version de départ reste celle d'avant la première modification non envoyée.
        shaBase: precedente ? precedente.shaBase : existante?.sha ?? null,
        recetteBase: precedente ? precedente.recetteBase : existante?.recette ?? null,
        conflit: precedente?.conflit ?? null,
        date: Date.now(),
      });
      notifier("modification");
      return synchroniser().catch(() => {});
    },

    // Après un conflit : garder la version du téléphone ("locale") ou celle de GitHub ("distante").
    async choisirVersion(id, choix) {
      const operation = await stockage.lireAttente(id);
      if (!operation?.conflit) return;
      const { recetteDistante, sha } = operation.conflit;
      if (choix === "locale") {
        await stockage.ecrireAttente({ ...operation, conflit: null, shaBase: sha, recetteBase: recetteDistante });
      } else {
        await stockage.supprimerAttente(id);
        await mettreAJourEntree(id, { recette: recetteDistante, sha });
      }
      notifier("modification");
      return synchroniser().catch(() => {});
    },

    // Teste la connexion puis enregistre les réglages. Un jeton vide garde le jeton actuel.
    async configurer({ proprietaire, depot, jeton }) {
      const precedente = await stockage.lireMeta("config");
      const config = {
        proprietaire: proprietaire.trim(),
        depot: depot.trim(),
        jeton: jeton?.trim() || precedente?.jeton,
      };
      if (!config.jeton) throw new Error("Saisissez un jeton d'accès.");
      const infos = await creerClient(config).verifier();

      const changementDepot = precedente &&
        (precedente.proprietaire !== config.proprietaire || precedente.depot !== config.depot);
      if (changementDepot) {
        if ((await stockage.lireToutesAttentes()).length) {
          throw new Error("Des modifications attendent encore d'être envoyées à l'ancien dépôt.");
        }
        await stockage.viderRecettes();
        await stockage.viderLivres();
        await stockage.supprimerMeta("dernierCommit");
      }
      await stockage.ecrireMeta("config", config);
      notifier("modification");
      return infos;
    },

    async oublierJeton() {
      const config = await stockage.lireMeta("config");
      if (config) await stockage.ecrireMeta("config", { ...config, jeton: null });
      notifier("modification");
    },

    // Réglages sans le jeton : il n'est jamais renvoyé à l'interface.
    async lireConfig() {
      const config = await stockage.lireMeta("config");
      return config && { proprietaire: config.proprietaire, depot: config.depot, aUnJeton: !!config.jeton };
    },

    async lireEtat() {
      const operations = await stockage.lireToutesAttentes();
      return {
        configure: !!(await stockage.lireMeta("config"))?.jeton,
        enCours: !!enCours,
        derniereErreur,
        derniereSynchro: await stockage.lireMeta("derniereSynchro"),
        enAttente: operations.length,
        conflits: operations.filter((operation) => operation.conflit),
      };
    },
  };
}
