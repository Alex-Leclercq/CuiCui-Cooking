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
- **Statut de chaque recette :** sur l'écran d'une recette, je choisis où j'en suis :
  - 📝 **À essayer** : jamais cuisinée. Ces recettes forment une to-do list dans l'onglet « À essayer » ;
  - ✅ **Déjà cuisinée** : testée, correcte ;
  - ⭐ **Favorite** : testée et adorée. Ces recettes sont dans l'onglet « Favoris ».
- **Mes notes :** sur l'écran d'une recette, j'écris mes remarques et je les enregistre.
- **Photo du plat :** affichée en haut de la recette, téléchargée une fois puis gardée sur le téléphone.
- **Historique des modifications :** chaque changement de statut ou de notes est noté (date, recette, avant → après). Toutes les recettes sont regroupées dans **Réglages → Historique des modifications**. En cas de mauvaise manipulation, un bouton **↩ Revenir** restaure la valeur précédente.
- **Classement :** chaque recette a une catégorie (entrée, plat, dessert…), une cuisine (française, japonaise…), une difficulté et des mots-clés libres (végétarien, rapide, hiver…), affichés sous forme de capsules.
- **Partager une recette :** un bouton envoie la recette en texte (ingrédients, étapes, temps, source) par WhatsApp, SMS, e-mail… via le menu de partage du téléphone. Mes notes personnelles ne sont pas partagées.
- **Liste de courses :** je sélectionne plusieurs recettes et l'application me donne une seule liste de courses qui regroupe tous les ingrédients nécessaires.
- **En cuisine :**
  - j'ajuste le nombre de portions et les quantités sont recalculées ;
  - l'écran reste allumé pendant que je cuisine.

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

- **Envoi depuis le téléphone :** chaque modification (nouvelle recette, changement de statut, note…) est d'abord enregistrée sur le téléphone (IndexedDB), puis envoyée aussitôt à GitHub par l'API REST : GitHub crée lui-même le commit. Sans réseau, la modification attend dans une file d'attente et part automatiquement au retour de la connexion.
- **Réception sur le téléphone :** à chaque ouverture, à chaque retour sur l'application, ou avec le bouton **Réglages → Synchronisation → Synchroniser**, l'application compare l'empreinte (SHA) du dernier commit de `main` avec celle de la dernière synchronisation. Si elle a changé, elle récupère la liste des fichiers du dépôt avec leurs empreintes et ne télécharge que les recettes dont l'empreinte a changé. Les recettes supprimées sur GitHub disparaissent du téléphone. Les photos du plat sont téléchargées à la première consultation de la recette, puis gardées sur le téléphone.
- **Où voir l'état :** la synchronisation est automatique et n'apparaît pas sur la page des recettes. En haut de l'écran, un badge signale les modifications en attente, un conflit ou une erreur (« ⚠️ Synchro ») ; un appui dessus ouvre les Réglages.
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
| `js/app.js` | L'interface : navigation entre les pages et affichage. |
| `js/stockage.js` | Le stockage local sur le téléphone (IndexedDB) : copie des recettes, file d'attente, réglages. |
| `js/github.js` | Les échanges avec l'API GitHub (lecture et écriture des fichiers). |
| `js/synchro.js` | La synchronisation : envoi, réception, fusion et conflits. |
| `js/recette.js` | La mise en forme d'une recette en texte (quantités, durées, texte partagé). |
| `tests/` | Les tests : synchronisation (avec un faux GitHub en mémoire) et mise en forme des recettes. |
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

Les tests s'ouvrent dans le navigateur :
- synchronisation : http://localhost:8080/tests/test-synchro.html (faux GitHub en mémoire : aucun appel réseau, aucun jeton) ;
- mise en forme des recettes : http://localhost:8080/tests/test-recette.html

## Installer sur le téléphone

1. Sur GitHub, dans ce dépôt (public) : **Settings → Pages**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
2. Après une ou deux minutes, l'application est en ligne sur https://alex-leclercq.github.io/CuiCui-Cooking/
3. Sur le téléphone Android, ouvrir cette adresse dans Chrome, puis menu **⋮ → Installer l'application** (ou **Ajouter à l'écran d'accueil**).

Après chaque mise à jour de `main`, l'application cherche la nouvelle version à chaque ouverture et à chaque retour dessus. Elle se recharge d'elle-même si elle vient de s'ouvrir, sinon elle affiche un bandeau **Nouvelle version disponible → Mettre à jour**.

Pour la connecter aux recettes : créer le jeton (voir « Sécurité » ci-dessus), puis dans l'application **Réglages → Connexion à GitHub**, coller le jeton et appuyer sur **Enregistrer et tester**.

## Feuille de route

- [x] Choisir la technologie
- [x] Définir le format d'une fiche recette
- [x] Créer le squelette de l'application (PWA installable, hors ligne, GitHub Pages)
- [x] Choisir l'hébergement (code public sur GitHub Pages, recettes dans un dépôt privé)
- [x] Connecter l'application au dépôt des recettes (jeton, lecture, écriture, synchronisation)
- [x] Afficher la liste des recettes et le détail d'une recette
- [x] Partager une recette en texte (menu de partage du téléphone)
- [x] Afficher la photo du plat
- [ ] Ajouter et modifier une recette à la main
- [x] Choisir le statut d'une recette (à essayer, déjà cuisinée, favorite) et afficher les onglets Favoris et À essayer
- [x] Historique des modifications de statut et de notes, avec retour en arrière
- [ ] Rechercher et filtrer les recettes (catégorie, cuisine, difficulté, mots-clés, statut)
- [ ] Ajuster les portions
- [ ] Garder l'écran allumé en cuisine
- [x] Ajouter des notes personnelles
- [ ] Générer une liste de courses à partir de plusieurs recettes
- [ ] Importer une recette à partir d'une photo (OCR)
- [ ] Importer des recettes via Claude à partir de captures d'écran
