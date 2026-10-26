// Tests de la synchronisation, avec un faux GitHub en mémoire.
// Ouvrir tests/test-synchro.html avec le serveur local.

import { ouvrirStockage } from "../js/stockage.js";
import { creerClientGitHub } from "../js/github.js";
import { creerSynchro, fusionner } from "../js/synchro.js";
import { creerFauxGitHub } from "./faux-github.js";

const NOM_BASE = "cuicui-tests";
const chemin = (id) => `recettes/${id}/recette.json`;
const recette = (id, champs = {}) => ({ id, nom: id, favori: false, aEssayer: true, ...champs });
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
