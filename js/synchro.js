// CuiCui Cooking – synchronisation entre le téléphone et le dépôt GitHub des recettes.
//
// - Envoi : chaque modification est enregistrée localement et mise en file d'attente,
//   puis envoyée à GitHub. Sans réseau, elle attend la prochaine synchronisation.
// - Réception : on compare l'empreinte du dernier commit à celle de la dernière synchro ;
//   si elle a changé, on parcourt l'arborescence et on ne télécharge que les fichiers modifiés.
// - Conflits : GitHub refuse une écriture basée sur une version périmée. On fusionne alors
//   champ par champ ; si les deux côtés ont modifié le même champ, l'utilisateur choisit.

const CHEMIN_RECETTE = /^recettes\/([^/]+)\/recette\.json$/;
const cheminRecette = (id) => `recettes/${id}/recette.json`;
const versTexte = (recette) => JSON.stringify(recette, null, 2) + "\n";
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Fusion à trois versions : base (avant modification), locale et distante.
// Renvoie la recette fusionnée, ou null si un même champ a été modifié différemment des deux côtés.
export function fusionner(base, locale, distante) {
  base ??= {};
  const resultat = {};
  const cles = new Set([...Object.keys(base), ...Object.keys(locale), ...Object.keys(distante)]);
  for (const cle of cles) {
    let valeur;
    if (egal(locale[cle], distante[cle]) || egal(locale[cle], base[cle])) valeur = distante[cle];
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

  async function terminerEnvoi(operation, recette, sha) {
    const actuelle = await stockage.lireAttente(operation.id);
    if (actuelle && actuelle.date !== operation.date) {
      // Modifiée à nouveau pendant l'envoi : la nouvelle version partira au prochain passage.
      await stockage.ecrireAttente({ ...actuelle, shaBase: sha, recetteBase: recette });
      await stockage.ecrireRecette({ id: operation.id, recette: actuelle.recette, sha });
    } else {
      await stockage.supprimerAttente(operation.id);
      await stockage.ecrireRecette({ id: operation.id, recette, sha });
    }
  }

  // ---- Réception ----

  async function recuperer(github) {
    const commit = await github.dernierCommit();
    if (commit === (await stockage.lireMeta("dernierCommit"))) return;

    const distants = new Map();
    for (const fichier of commit ? await github.arborescence(commit) : []) {
      const correspondance = fichier.type === "blob" && fichier.path.match(CHEMIN_RECETTE);
      if (correspondance) distants.set(correspondance[1], fichier.sha);
    }
    const locales = new Map((await stockage.lireRecettes()).map((entree) => [entree.id, entree]));
    const enAttente = new Set((await stockage.lireToutesAttentes()).map((operation) => operation.id));

    for (const [id, sha] of distants) {
      // Une recette modifiée sur le téléphone et pas encore envoyée n'est pas écrasée.
      if (enAttente.has(id) || locales.get(id)?.sha === sha) continue;
      try {
        const recette = JSON.parse(await github.lireBlob(sha));
        await stockage.ecrireRecette({ id, recette, sha });
      } catch (erreur) {
        if (!(erreur instanceof SyntaxError)) throw erreur;
        console.warn(`Recette illisible ignorée : ${id}`);
      }
    }
    for (const id of locales.keys()) {
      if (!distants.has(id) && !enAttente.has(id)) await stockage.supprimerRecette(id);
    }
    await stockage.ecrireMeta("dernierCommit", commit);
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

    ecouter(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },

    // Enregistre une recette sur le téléphone puis tente de l'envoyer.
    // La promesse renvoyée se termine après la tentative d'envoi, sans jamais échouer.
    async enregistrer(recette) {
      const existante = await stockage.lireRecette(recette.id);
      const precedente = await stockage.lireAttente(recette.id);
      await stockage.ecrireRecette({ id: recette.id, recette, sha: existante?.sha ?? null });
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
        await stockage.ecrireRecette({ id, recette: recetteDistante, sha });
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
