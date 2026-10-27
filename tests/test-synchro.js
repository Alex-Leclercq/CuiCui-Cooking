// Tests de la synchronisation, avec un faux GitHub en mémoire.
// Ouvrir tests/test-synchro.html avec le serveur local.

import { ouvrirStockage } from "../js/stockage.js";
import { creerClientGitHub } from "../js/github.js";
import { creerSynchro, fusionner } from "../js/synchro.js";
import { creerFauxGitHub } from "./faux-github.js";

const NOM_BASE = "cuicui-tests";
const chemin = (id) => `recettes/${id}/recette.json`;
const recette = (id, champs = {}) => ({ id, nom: id, favori: false, aEssayer: true, ...champs });
const recetteAvecPhotos = (id) => recette(id, { photos: { source: ["source-1.jpg"], plat: "plat.jpg" } });
const texte = (objet) => JSON.stringify(objet, null, 2) + "\n";

function verifier(condition, message) {
  if (!condition) throw new Error(message);
}

function supprimerBase() {
  return new Promise((resoudre) => {
    const demande = indexedDB.deleteDatabase(NOM_BASE);
    demande.onsuccess = demande.onerror = demande.onblocked = () => resoudre();
  });
}

let stockageOuvert = null;

// Prépare un environnement neuf : stockage vide, faux GitHub, synchro configurée.
async function environnement({ configurer = true } = {}) {
  stockageOuvert?.fermer(); // une base ouverte bloquerait sa suppression
  await supprimerBase();
  const stockage = stockageOuvert = await ouvrirStockage(NOM_BASE);
  const github = creerFauxGitHub();
  const synchro = creerSynchro({
    stockage,
    creerClient: (config) => creerClientGitHub({ ...config, fetch: github.fetch }),
  });
  if (configurer) await synchro.configurer({ proprietaire: "test", depot: "recettes", jeton: "faux-jeton" });
  return { stockage, github, synchro };
}

const tests = {
  "Fusion : champs différents des deux côtés → fusionnés"() {
    const base = recette("a");
    const resultat = fusionner(base, { ...base, favori: true }, { ...base, nom: "A corrigé" });
    verifier(resultat.favori === true && resultat.nom === "A corrigé", JSON.stringify(resultat));
  },

  "Fusion : historiques des deux côtés additionnés, dans l'ordre"() {
    const ligne = (date, champ) => ({ date, champ, avant: "x", apres: "y" });
    const commune = ligne("2026-10-27T08:00:00.000Z", "statut");
    const base = { ...recette("a"), historique: [commune] };
    const locale = { ...base, statut: "favorite", historique: [commune, ligne("2026-10-27T10:00:00.000Z", "statut")] };
    const distante = { ...base, notes: "PC", historique: [commune, ligne("2026-10-27T09:00:00.000Z", "notes")] };
    const resultat = fusionner(base, locale, distante);
    verifier(resultat, "ne doit pas être un conflit");
    verifier(resultat.statut === "favorite" && resultat.notes === "PC", "les deux champs doivent être gardés");
    verifier(resultat.historique.map((l) => l.date.slice(11, 13)).join() === "08,09,10", JSON.stringify(resultat.historique));
  },

  "Fusion : même champ modifié différemment → conflit"() {
    const base = recette("a");
    verifier(fusionner(base, { ...base, nom: "X" }, { ...base, nom: "Y" }) === null, "aurait dû être un conflit");
  },

  async "Non configuré : la synchro ne fait rien et ne plante pas"() {
    const { synchro, stockage, github } = await environnement({ configurer: false });
    await synchro.synchroniser();
    verifier(github.etat.appels.length === 0, "aucun appel attendu");
    verifier((await stockage.lireRecettes()).length === 0, "aucune recette attendue");
  },

  async "Dépôt vide : synchro sans erreur"() {
    const { synchro, stockage } = await environnement();
    await synchro.synchroniser();
    verifier((await stockage.lireRecettes()).length === 0, "aucune recette attendue");
  },

  async "Recettes ajoutées depuis le PC → arrivent sur le téléphone"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("quiche"), texte(recette("quiche", { nom: "Quiche lorraine" })));
    github.ecrire(chemin("tarte"), texte(recette("tarte", { nom: "Tarte Tatin 🍏" })));
    github.ecrire("README.md", "# Pas une recette");
    await synchro.synchroniser();
    const recettes = await stockage.lireRecettes();
    verifier(recettes.length === 2, `2 recettes attendues, ${recettes.length} reçues`);
    verifier((await stockage.lireRecette("tarte")).recette.nom === "Tarte Tatin 🍏", "accents/emoji mal décodés");
  },

  async "Rien n'a changé → aucun téléchargement"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("quiche"), texte(recette("quiche")));
    await synchro.synchroniser();
    github.etat.appels.length = 0;
    await synchro.synchroniser();
    verifier(github.etat.appels.join() === "GET /git/ref/heads/main", github.etat.appels.join(" | "));
  },

  async "Une recette modifiée sur le PC → seule celle-ci est retéléchargée"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire(chemin("b"), texte(recette("b")));
    await synchro.synchroniser();
    github.ecrire(chemin("b"), texte(recette("b", { nom: "B modifiée" })));
    github.etat.appels.length = 0;
    await synchro.synchroniser();
    const telechargements = github.etat.appels.filter((appel) => appel.includes("/git/blobs/"));
    verifier(telechargements.length === 1, `1 téléchargement attendu, ${telechargements.length}`);
    verifier((await stockage.lireRecette("b")).recette.nom === "B modifiée", "modification non reçue");
  },

  async "Une recette supprimée sur le PC → supprimée du téléphone"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire(chemin("b"), texte(recette("b")));
    await synchro.synchroniser();
    github.supprimer(chemin("a"));
    await synchro.synchroniser();
    verifier(!(await stockage.lireRecette("a")), "la recette aurait dû disparaître");
    verifier(!!(await stockage.lireRecette("b")), "l'autre recette doit rester");
  },

  async "Recette créée sur le téléphone → envoyée sur GitHub"() {
    const { synchro, stockage, github } = await environnement();
    await synchro.enregistrer(recette("crepes", { nom: "Crêpes" }));
    const fichier = github.lire(chemin("crepes"));
    verifier(fichier && JSON.parse(fichier.texte).nom === "Crêpes", "fichier absent ou incorrect sur GitHub");
    verifier((await stockage.lireToutesAttentes()).length === 0, "la file d'attente doit être vide");
    verifier((await stockage.lireRecette("crepes")).sha === fichier.sha, "empreinte locale non mise à jour");
  },

  async "Hors ligne → mise en attente, puis envoi au retour du réseau"() {
    const { synchro, stockage, github } = await environnement();
    github.etat.horsLigne = true;
    await synchro.enregistrer(recette("soupe", { nom: "Soupe" }));
    verifier(!!(await stockage.lireRecette("soupe")), "la recette doit être visible localement");
    verifier((await stockage.lireToutesAttentes()).length === 1, "1 modification en attente attendue");
    const etat = await synchro.lireEtat();
    verifier(etat.derniereErreur?.estHorsLigne, "l'erreur hors ligne doit être signalée");
    github.etat.horsLigne = false;
    await synchro.synchroniser();
    verifier(!!github.lire(chemin("soupe")), "la recette doit être envoyée");
    verifier((await stockage.lireToutesAttentes()).length === 0, "la file d'attente doit être vide");
  },

  async "Plusieurs modifications hors ligne → un seul envoi, dernière version"() {
    const { synchro, github } = await environnement();
    github.etat.horsLigne = true;
    await synchro.enregistrer(recette("gratin", { nom: "Gratin v1" }));
    await synchro.enregistrer(recette("gratin", { nom: "Gratin v2" }));
    github.etat.horsLigne = false;
    github.etat.appels.length = 0;
    await synchro.synchroniser();
    const envois = github.etat.appels.filter((appel) => appel.startsWith("PUT"));
    verifier(envois.length === 1, `1 envoi attendu, ${envois.length}`);
    verifier(JSON.parse(github.lire(chemin("gratin")).texte).nom === "Gratin v2", "dernière version attendue");
  },

  async "Une modification locale en attente n'est pas écrasée par la réception"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    await synchro.synchroniser();
    github.etat.horsLigne = true;
    await synchro.enregistrer(recette("a", { favori: true }));
    github.etat.horsLigne = false;
    github.ecrire(chemin("a"), texte(recette("a", { nom: "A du PC" })));
    await synchro.synchroniser();
    const finale = JSON.parse(github.lire(chemin("a")).texte);
    verifier(finale.favori === true && finale.nom === "A du PC", `fusion attendue : ${JSON.stringify(finale)}`);
    verifier((await stockage.lireRecette("a")).recette.nom === "A du PC", "la copie locale doit être fusionnée");
  },

  async "Vrai conflit → signalé, puis « Garder ma version »"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    await synchro.synchroniser();
    github.etat.horsLigne = true;
    await synchro.enregistrer(recette("a", { nom: "Nom téléphone" }));
    github.etat.horsLigne = false;
    github.ecrire(chemin("a"), texte(recette("a", { nom: "Nom PC" })));
    await synchro.synchroniser();
    const etat = await synchro.lireEtat();
    verifier(etat.conflits.length === 1, "1 conflit attendu");
    verifier(JSON.parse(github.lire(chemin("a")).texte).nom === "Nom PC", "GitHub ne doit pas être écrasé en silence");
    await synchro.choisirVersion("a", "locale");
    verifier(JSON.parse(github.lire(chemin("a")).texte).nom === "Nom téléphone", "la version du téléphone doit gagner");
    verifier((await stockage.lireToutesAttentes()).length === 0, "plus rien en attente");
  },

  async "Vrai conflit → « Garder la version GitHub »"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    await synchro.synchroniser();
    github.etat.horsLigne = true;
    await synchro.enregistrer(recette("a", { nom: "Nom téléphone" }));
    github.etat.horsLigne = false;
    github.ecrire(chemin("a"), texte(recette("a", { nom: "Nom PC" })));
    await synchro.synchroniser();
    await synchro.choisirVersion("a", "distante");
    verifier((await stockage.lireRecette("a")).recette.nom === "Nom PC", "la version GitHub doit gagner");
    verifier((await stockage.lireToutesAttentes()).length === 0, "plus rien en attente");
  },

  async "Recette supprimée sur GitHub mais modifiée sur le téléphone → recréée"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    await synchro.synchroniser();
    github.etat.horsLigne = true;
    await synchro.enregistrer(recette("a", { favori: true }));
    github.etat.horsLigne = false;
    github.supprimer(chemin("a"));
    await synchro.synchroniser();
    verifier(JSON.parse(github.lire(chemin("a")).texte).favori === true, "la recette doit être recréée");
  },

  async "Fichier JSON illisible sur GitHub → ignoré, les autres arrivent"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("cassee"), "{ pas du json");
    github.ecrire(chemin("bonne"), texte(recette("bonne")));
    await synchro.synchroniser();
    verifier(!!(await stockage.lireRecette("bonne")), "la recette valide doit arriver");
    verifier(!(await stockage.lireRecette("cassee")), "la recette illisible doit être ignorée");
  },

  async "Photos : empreintes des fichiers de chaque recette mémorisées"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    github.ecrire("recettes/a/source-1.jpg", "PAGE-A");
    await synchro.synchroniser();
    const entree = await stockage.lireRecette("a");
    verifier(Object.keys(entree.fichiers).sort().join() === "plat.jpg,source-1.jpg", JSON.stringify(entree.fichiers));
  },

  async "Photos : nouvelle photo ajoutée sans changer la fiche → repérée"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    await synchro.synchroniser();
    github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    await synchro.synchroniser();
    verifier((await stockage.lireRecette("a")).fichiers?.["plat.jpg"], "la photo doit être repérée");
  },

  async "Photos : téléchargée une seule fois, puis disponible hors ligne"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    await synchro.synchroniser();
    github.etat.appels.length = 0;
    const premiere = await synchro.photo("a", "plat.jpg");
    verifier(premiere && (await premiere.text()) === "IMAGE-A" && premiere.type === "image/jpeg", "photo incorrecte");
    github.etat.horsLigne = true;
    const seconde = await synchro.photo("a", "plat.jpg");
    verifier(seconde && (await seconde.text()) === "IMAGE-A", "la photo doit rester disponible hors ligne");
    verifier(github.etat.appels.filter((a) => a.includes("/git/blobs/")).length === 1, github.etat.appels.join(" | "));
  },

  async "Photos : téléchargées brutes, sans passer par le base64"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire("recettes/a/plat.jpg", "IMAGE-É");
    await synchro.synchroniser();
    github.etat.appels.length = 0;
    const image = await synchro.photo("a", "plat.jpg");
    verifier(image && (await image.text()) === "IMAGE-É", "contenu incorrect");
    verifier(github.etat.appels.some((a) => a.includes("/git/blobs/") && a.endsWith("(brut)")), github.etat.appels.join(" | "));
  },

  async "Préchargement : photos de plat téléchargées après la synchro, pas les pages du livre"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recetteAvecPhotos("a")));
    github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    github.ecrire("recettes/a/source-1.jpg", "PAGE-A");
    github.ecrire(chemin("b"), texte(recette("b"))); // sans photo
    await synchro.synchroniser();
    await synchro.prechargerPhotos();
    github.etat.horsLigne = true;
    const plat = await synchro.photo("a", "plat.jpg");
    verifier(plat && (await plat.text()) === "IMAGE-A", "la photo du plat doit être déjà sur le téléphone");
    verifier((await synchro.photo("a", "source-1.jpg")) === null, "la page du livre ne doit pas être préchargée");
  },

  async "Préchargement : photo déjà sur le téléphone → pas retéléchargée"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recetteAvecPhotos("a")));
    const sha = github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    await synchro.synchroniser();
    await synchro.prechargerPhotos();
    github.ecrire(chemin("b"), texte(recette("b")));
    await synchro.synchroniser();
    await synchro.prechargerPhotos();
    const telechargements = github.etat.appels.filter((a) => a.includes(`/git/blobs/${sha}`));
    verifier(telechargements.length === 1, github.etat.appels.join(" | "));
  },

  async "Préchargement : photo ouverte pendant le préchargement → téléchargée une seule fois"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recetteAvecPhotos("a")));
    const sha = github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    await synchro.synchroniser(); // le préchargement démarre en arrière-plan
    const [image] = await Promise.all([synchro.photo("a", "plat.jpg"), synchro.prechargerPhotos()]);
    verifier(image && (await image.text()) === "IMAGE-A", "photo incorrecte");
    const telechargements = github.etat.appels.filter((a) => a.includes(`/git/blobs/${sha}`));
    verifier(telechargements.length === 1, github.etat.appels.join(" | "));
  },

  async "Préchargement : connexion coupée → sans erreur, repris à la synchro suivante"() {
    const { synchro, github, stockage } = await environnement();
    github.ecrire(chemin("a"), texte(recetteAvecPhotos("a")));
    const sha = github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    github.etat.photosEnPanne = true;
    await synchro.synchroniser();
    await synchro.prechargerPhotos(); // ne doit pas échouer
    verifier(!(await stockage.lirePhoto(sha)), "la photo ne peut pas être là");
    github.etat.photosEnPanne = false;
    await synchro.synchroniser();
    await synchro.prechargerPhotos();
    verifier(await stockage.lirePhoto(sha), "la photo doit être téléchargée une fois la connexion revenue");
  },

  async "Photos : absente ou hors ligne au premier affichage → rien, sans erreur"() {
    const { synchro, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    await synchro.synchroniser();
    verifier((await synchro.photo("a", "inexistante.jpg")) === null, "photo inexistante");
    verifier((await synchro.photo("a", undefined)) === null, "pas de nom de photo");
    github.etat.horsLigne = true;
    verifier((await synchro.photo("a", "plat.jpg")) === null, "hors ligne sans cache");
  },

  async "Livres : fiche reçue, couverture préchargée et disponible hors ligne"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire("livres/mentor/livre.json", texte({ id: "mentor", titre: "Méthode Mentor", couverture: "couverture.jpg" }));
    github.ecrire("livres/mentor/couverture.jpg", "COUVERTURE");
    github.ecrire("livres/sans-fiche/couverture.jpg", "ORPHELINE"); // dossier sans livre.json : ignoré
    await synchro.synchroniser();
    await synchro.prechargerPhotos();
    const livres = await stockage.lireLivres();
    verifier(livres.length === 1 && livres[0].livre.titre === "Méthode Mentor", JSON.stringify(livres));
    github.etat.horsLigne = true;
    const image = await synchro.couverture("mentor");
    verifier(image && (await image.text()) === "COUVERTURE", "la couverture doit être sur le téléphone");
    verifier((await synchro.couverture("inconnu")) === null, "livre inconnu");
  },

  async "Livres : modifié puis supprimé sur le PC → mis à jour, puis supprimé du téléphone"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire("livres/mentor/livre.json", texte({ id: "mentor", titre: "Ancien titre" }));
    await synchro.synchroniser();
    github.ecrire("livres/mentor/livre.json", texte({ id: "mentor", titre: "Nouveau titre" }));
    await synchro.synchroniser();
    verifier((await stockage.lireLivre("mentor"))?.livre.titre === "Nouveau titre", "le titre doit être mis à jour");
    github.supprimer("livres/mentor/livre.json");
    await synchro.synchroniser();
    verifier(!(await stockage.lireLivre("mentor")), "le livre doit être supprimé");
  },

  async "Modifier une recette sur le téléphone garde la liste de ses photos"() {
    const { synchro, stockage, github } = await environnement();
    github.ecrire(chemin("a"), texte(recette("a")));
    github.ecrire("recettes/a/plat.jpg", "IMAGE-A");
    await synchro.synchroniser();
    await synchro.enregistrer(recette("a", { statut: "favorite" }));
    verifier((await stockage.lireRecette("a")).fichiers?.["plat.jpg"], "la photo doit rester connue");
  },

  async "Le jeton n'est jamais renvoyé à l'interface"() {
    const { synchro } = await environnement();
    const config = await synchro.lireConfig();
    verifier(!("jeton" in config) && config.aUnJeton === true, JSON.stringify(config));
  },

  async "Jeton vide lors d'une nouvelle saisie → l'ancien est conservé"() {
    const { synchro, stockage } = await environnement();
    await synchro.configurer({ proprietaire: "test", depot: "recettes", jeton: "" });
    verifier((await stockage.lireMeta("config")).jeton === "faux-jeton", "le jeton doit être conservé");
  },
};

// Base bloquée par une ancienne version ouverte ailleurs : signalée, puis reprise une fois libérée.
tests["Base bloquée par une autre fenêtre → signalée, puis ouverte une fois libérée"] = async () => {
  stockageOuvert?.fermer();
  const nom = "cuicui-tests-blocage";
  await new Promise((ok) => { const d = indexedDB.deleteDatabase(nom); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
  // « Ancienne version » : connexion en version 1 qui ne se ferme pas d'elle-même.
  const ancienne = await new Promise((ok) => { const d = indexedDB.open(nom, 1); d.onsuccess = () => ok(d.result); });
  let bloque = false;
  const ouverture = ouvrirStockage(nom, { version: 2, siBloque: () => { bloque = true; } });
  await new Promise((ok) => setTimeout(ok, 300));
  verifier(bloque, "le blocage doit être signalé");
  ancienne.close();
  const stockage = await ouverture;
  verifier(typeof stockage.lirePhoto === "function", "la base doit s'ouvrir une fois libérée");
  stockage.fermer();
  await new Promise((ok) => { const d = indexedDB.deleteDatabase(nom); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
};

// Passage à la version 3 (livres) : le dernier commit est oublié pour relire l'arborescence,
// sinon un téléphone déjà synchronisé ne recevrait les livres qu'au prochain commit.
tests["Mise à niveau de la base (livres) → arborescence relue, recettes conservées"] = async () => {
  stockageOuvert?.fermer();
  const nom = "cuicui-tests-mise-a-niveau";
  await new Promise((ok) => { const d = indexedDB.deleteDatabase(nom); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
  // Base en version 2, telle qu'elle existe sur les téléphones (sans magasin « livres »).
  await new Promise((ok) => {
    const d = indexedDB.open(nom, 2);
    d.onupgradeneeded = () => {
      for (const magasin of ["recettes", "attente"]) d.result.createObjectStore(magasin, { keyPath: "id" });
      for (const magasin of ["meta", "photos"]) d.result.createObjectStore(magasin);
      d.transaction.objectStore("meta").put("sha-commit", "dernierCommit");
      d.transaction.objectStore("recettes").put({ id: "a", recette: recette("a"), sha: "sha-a" });
    };
    d.onsuccess = () => { d.result.close(); ok(); };
  });
  const stockage = await ouvrirStockage(nom);
  verifier((await stockage.lireMeta("dernierCommit")) === undefined, "le dernier commit doit être oublié");
  verifier((await stockage.lireRecette("a"))?.sha === "sha-a", "les recettes doivent être conservées");
  verifier(Array.isArray(await stockage.lireLivres()), "le magasin des livres doit exister");
  stockage.fermer();
  await new Promise((ok) => { const d = indexedDB.deleteDatabase(nom); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
};

// Une version plus récente ouverte ailleurs : la connexion actuelle se libère d'elle-même.
tests["Nouvelle version ouverte ailleurs → la base est libérée"] = async () => {
  const nom = "cuicui-tests-liberation";
  await new Promise((ok) => { const d = indexedDB.deleteDatabase(nom); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
  let prevenu = false;
  await ouvrirStockage(nom, { version: 2, siNouvelleVersion: () => { prevenu = true; } });
  const plusRecente = await new Promise((ok, ko) => {
    const d = indexedDB.open(nom, 3);
    const delai = setTimeout(() => ko(new Error("la nouvelle version est restée bloquée")), 2000);
    d.onsuccess = () => { clearTimeout(delai); ok(d.result); };
  });
  verifier(prevenu, "l'application doit être prévenue");
  plusRecente.close();
  await new Promise((ok) => { const d = indexedDB.deleteDatabase(nom); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
};

const lignes = [];
let echecs = 0;
for (const [nom, test] of Object.entries(tests)) {
  try {
    await test();
    lignes.push(`✅ ${nom}`);
  } catch (erreur) {
    echecs++;
    lignes.push(`❌ ${nom}\n   → ${erreur.message}`);
  }
}
stockageOuvert?.fermer();
await supprimerBase();
lignes.push("", echecs ? `${echecs} test(s) en échec sur ${Object.keys(tests).length}.` : `Tous les tests passent (${Object.keys(tests).length}).`);
document.getElementById("resultats").textContent = lignes.join("\n");
window.resultatsTests = { echecs, total: Object.keys(tests).length, lignes };
