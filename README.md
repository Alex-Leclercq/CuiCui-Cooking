# CuiCui Cooking 🐦🍳

**CuiCui Cooking** est une application pensée pour mon téléphone. Elle me sert à garder avec moi, partout, les recettes de cuisine que j'aime.

## Ce que fait l'application

- **Mon carnet de recettes de poche :** je liste et consulte mes recettes préférées où que je sois, même sans connexion.
- **Import par photo :** je prends en photo une recette trouvée dans un livre ou sur un site internet, et ses informations essentielles sont rapatriées dans l'application :
  - le nom de la recette ;
  - les ingrédients et leurs quantités ;
  - les étapes de préparation ;
  - le temps de préparation et le temps de cuisson ;
  - le nombre de personnes ;
  - le chef ou l'auteur ;
  - la source : le livre d'origine ou le site internet.
- **Mes meilleures recettes :** je marque d'une étoile les recettes que je considère comme les meilleures, pour les retrouver dans une liste de favoris.
- **Recettes à essayer :** je marque les recettes que je n'ai encore jamais cuisinées. Elles forment une sorte de to-do list, et je les coche une fois réalisées.
- **Classement :** chaque recette a une catégorie (entrée, plat, dessert…), une cuisine (française, japonaise…), une difficulté et des mots-clés libres (végétarien, rapide, hiver…).
- **Liste de courses :** je sélectionne plusieurs recettes et l'application me donne une seule liste de courses qui regroupe tous les ingrédients nécessaires.
- **En cuisine :**
  - j'ajuste le nombre de portions et les quantités sont recalculées ;
  - l'écran reste allumé pendant que je cuisine ;
  - j'ajoute mes notes personnelles (« moins de sucre », « 5 minutes de cuisson en plus »…).

## Deux façons d'importer une recette

1. **Depuis l'application (OCR) :** je photographie la page, l'application reconnaît le texte sur le téléphone et pré-remplit le formulaire. Je vérifie et corrige les champs avant d'enregistrer.
2. **Via Claude :** j'envoie des captures d'écran de la recette à Claude, depuis mon PC ou mon téléphone. Claude extrait tous les champs, crée la fiche au [format défini](docs/format-recette.md) et la pousse dans le dépôt des recettes.

## Choix techniques

- **Téléphone visé :** Android.
- **Application web installable (PWA) :** elle s'ajoute à l'écran d'accueil comme une vraie application et fonctionne hors ligne. Pas de store, pas de compilation.
- **Léger :** HTML, CSS et JavaScript simples, sans framework lourd.
- **Sans base de données :** GitHub sert de stockage, réparti sur deux dépôts.

| Dépôt | Visibilité | Contenu |
|---|---|---|
| `CuiCui-Cooking` (celui-ci) | **Public** | Uniquement le code de l'application et sa documentation. Il est publié gratuitement sur GitHub Pages. Il ne contient aucune recette ni aucun secret. |
| `CuiCui-Recettes` | **Privé** | Mes recettes : un dossier par recette dans `recettes/`, avec `recette.json` et les photos d'origine. |

Le format d'une fiche recette est décrit dans [docs/format-recette.md](docs/format-recette.md).

## Fonctionnement de la synchronisation

GitHub (le dépôt `CuiCui-Recettes`) est la référence. Le téléphone en garde une copie pour fonctionner hors ligne.

```
  📱 Téléphone                    ☁️ CuiCui-Recettes (privé)            💻 PC + Claude
  copie locale  ── envoi (API) ──▶      recettes/       ◀── git push ──  fiches créées
  + file d'attente ◀─ synchro (API) ─                   ── git pull ──▶  depuis captures
```

- **Envoi depuis le téléphone :** chaque modification (nouvelle recette, étoile, note…) est d'abord enregistrée sur le téléphone (IndexedDB), puis envoyée aussitôt à GitHub par l'API REST : GitHub crée lui-même le commit. Sans réseau, la modification attend dans une file d'attente et part automatiquement au retour de la connexion.
- **Réception sur le téléphone :** à chaque ouverture, ou avec le bouton **Synchroniser**, l'application compare l'empreinte (SHA) du dernier commit de `main` avec celle de la dernière synchronisation. Si elle a changé, elle demande à GitHub la liste des fichiers modifiés et ne télécharge que ceux-là.
- **Ajout depuis le PC :** Claude récupère d'abord la dernière version du dépôt (`git pull`), crée les fiches, puis pousse sur `main`. Les recettes arrivent sur le téléphone à sa prochaine synchronisation.
- **Conflits :** chaque envoi indique la version du fichier connue par le téléphone. Si le fichier a changé entre-temps, GitHub refuse (erreur 409). L'application fusionne alors les changements ou me demande de choisir. Rien n'est écrasé en silence.

Tout cela est gratuit : l'API GitHub autorise 5 000 requêtes par heure, et une synchronisation n'en utilise que quelques-unes.

## Sécurité

L'application accède au dépôt privé avec un **jeton d'accès personnel**, saisi une seule fois dans les Réglages de l'application sur le téléphone.

**Créer le jeton :** GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
- **Repository access :** *Only select repositories* → `CuiCui-Recettes` uniquement.
- **Permissions :** *Contents* → *Read and write*. Rien d'autre.
- **Expiration :** une date limite, par exemple un an.

Règles appliquées dans l'application :

| Risque | Protection |
|---|---|
| Vol du jeton (téléphone perdu ou volé) | Jeton limité à un seul dépôt et aux seuls fichiers. Il est révocable à tout moment depuis GitHub. Téléphone verrouillé. |
| Injection de code via le texte d'une recette (XSS) | Les données des recettes sont toujours affichées comme du texte, jamais interprétées comme du HTML. |
| Envoi de données vers un autre site | Une politique de sécurité du contenu (CSP) n'autorise que les fichiers de l'application et les connexions vers `api.github.com`. |
| Bibliothèque externe compromise (OCR…) | Les bibliothèques sont copiées dans ce dépôt, à une version figée. Aucune n'est chargée depuis un site tiers. |
| Jeton publié par erreur | Le jeton n'est jamais écrit dans un fichier du projet. GitHub révoque automatiquement un jeton détecté dans un dépôt public. |
| Recettes modifiées ou supprimées | L'historique Git permet de tout restaurer. Le clone du dépôt sur le PC sert de sauvegarde complète. |

Recommandations pour le compte GitHub : activer la **double authentification (2FA)** et l'**adresse e-mail privée** pour les commits (Settings → Emails).

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html` | La page de l'application : en-tête, zone de contenu, barre de navigation. |
| `css/app.css` | L'apparence, avec un thème clair et un thème sombre automatiques. |
| `js/app.js` | La logique : navigation entre les pages et affichage. |
| `sw.js` | Le « service worker » qui garde l'application en mémoire pour l'utiliser hors ligne. |
| `manifest.webmanifest` | La carte d'identité de l'application (nom, icône, couleurs), qui permet de l'installer sur le téléphone. |
| `icones/` | Les icônes de l'application. |
| `outils/serveur-local.ps1` | Un petit serveur pour tester l'application sur l'ordinateur. |

## Tester sur l'ordinateur

Dans un terminal PowerShell ouvert dans le dossier du projet :

```
powershell -ExecutionPolicy Bypass -File outils\serveur-local.ps1
```

Puis ouvrir http://localhost:8080 dans le navigateur. `Ctrl+C` arrête le serveur.

## Installer sur le téléphone

1. Sur GitHub, dans ce dépôt (public) : **Settings → Pages**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
2. Après une ou deux minutes, l'application est en ligne sur https://alex-leclercq.github.io/CuiCui-Cooking/
3. Sur le téléphone Android, ouvrir cette adresse dans Chrome, puis menu **⋮ → Installer l'application** (ou **Ajouter à l'écran d'accueil**).

Après chaque mise à jour de `main`, l'application se met à jour sur le téléphone à sa prochaine ouverture (parfois la suivante).

## Feuille de route

- [x] Choisir la technologie
- [x] Définir le format d'une fiche recette
- [x] Créer le squelette de l'application (PWA installable, hors ligne, GitHub Pages)
- [x] Choisir l'hébergement (code public sur GitHub Pages, recettes dans un dépôt privé)
- [ ] Connecter l'application au dépôt des recettes (jeton, lecture, écriture, synchronisation)
- [ ] Afficher la liste des recettes et le détail d'une recette
- [ ] Ajouter et modifier une recette à la main
- [ ] Marquer les meilleures recettes (favoris)
- [ ] Marquer les recettes jamais cuisinées (à essayer)
- [ ] Rechercher et filtrer les recettes (catégorie, cuisine, difficulté, mots-clés, favoris, à essayer)
- [ ] Ajuster les portions
- [ ] Garder l'écran allumé en cuisine
- [ ] Ajouter des notes personnelles
- [ ] Générer une liste de courses à partir de plusieurs recettes
- [ ] Importer une recette à partir d'une photo (OCR)
- [ ] Importer des recettes via Claude à partir de captures d'écran
