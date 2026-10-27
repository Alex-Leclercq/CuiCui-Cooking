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
- **Statut de chaque recette :** sur l'écran d'une recette, la pastille en haut à droite (par exemple « ⭐ Favorite ▾ ») ouvre la liste des statuts. Changer de statut demande deux gestes, ce qui évite les changements par erreur :
  - 📝 **À essayer** : jamais cuisinée. Ces recettes forment une to-do list dans l'onglet « À essayer » ;
  - ✅ **Déjà cuisinée** : testée, correcte ;
  - ⭐ **Favorite** : testée et adorée. Ces recettes sont dans l'onglet « Favoris ».
- **Mes notes :** sur l'écran d'une recette, j'écris mes remarques et je les enregistre.
- **Photo du plat :** affichée en haut de la recette, sans attente : elle est téléchargée en arrière-plan dès la synchronisation, puis gardée sur le téléphone.
- **Historique des modifications :** chaque changement de statut ou de notes est noté (date, recette, avant → après). Toutes les recettes sont regroupées dans **Réglages → Historique des modifications**. En cas de mauvaise manipulation, un bouton **↩ Revenir** restaure la valeur précédente.
- **Classement :** chaque recette a une catégorie (entrée, plat, dessert…), une cuisine (française, japonaise…), une difficulté et des mots-clés libres (végétarien, rapide, hiver…), affichés sous forme de capsules. En haut de la liste, **Classer par** range les recettes par nom, catégorie, cuisine, chef ou statut (le choix est retenu sur le téléphone). Quand les recettes sont rangées en sections (catégorie, cuisine, chef, statut), un appui sur le titre d'une section plie ou déplie ses recettes, et **Tout plier / Tout déplier** agit sur toutes les sections. Les sections pliées sont retenues sur le téléphone, pour chaque critère.
- **Étagère des livres :** **Classer par → Livre** affiche les couvertures de mes livres de recettes, avec leur nombre de recettes. Un livre ouvre ses recettes dans l'ordre des pages, comme une table des matières. Depuis une recette, un lien mène à toutes les recettes du même livre.
- **En-têtes figés :** le haut de chaque liste (titre, nombre de recettes, Classer par, Sélectionner) et la barre du haut d'une recette ou d'un livre restent en place pendant que je fais défiler l'écran. En revenant d'une recette (bouton ← ou retour du téléphone), je retrouve la liste exactement là où je l'avais laissée, et la recette que je viens de quitter est entourée un instant. Le bouton ← ramène à l'écran précédent (un livre, les Favoris…), comme le retour du téléphone.
- **Partager une recette :** un bouton envoie la recette en texte (ingrédients, étapes, temps, source) par WhatsApp, SMS, e-mail… via le menu de partage du téléphone. Mes notes personnelles ne sont pas partagées.
- **Liste de courses (onglet 🛒 Courses) :**
  - j'ajoute une recette avec **🛒 Ajouter à la liste**, pour le nombre de personnes affiché (si je change ce nombre ensuite, le bouton propose de **mettre à jour la liste**). Ou, dans Mes recettes, Favoris ou À essayer, **🛒 Sélectionner** me laisse cocher plusieurs recettes et les ajouter d'un coup, chacune pour son nombre de personnes d'origine. Pendant la sélection, la barre « Annuler / Ajouter » remplace la barre des onglets en bas de l'écran ;
  - la liste présente chaque recette avec, en dessous, ses ingrédients pour son nombre de personnes. Un appui sur le titre d'une recette plie ou déplie ses ingrédients (le choix est retenu), et le compteur indique ce qui reste à acheter (« 3 / 7 », puis « ✓ Tout acheté ») ;
  - en magasin, je touche un article pour le barrer : il descend en bas de sa recette. Si je change ensuite le nombre de personnes, il redevient à acheter (sauf les ingrédients sans quantité, comme le sel) ;
  - chaque recette garde son réglage − / +, un bouton **Voir** pour l'ouvrir et un bouton **✕** pour la retirer ; **🗑️ Vider la liste** efface tout, après confirmation ;
  - **📤 Partager** envoie en texte, recette par recette, ce qui reste à acheter. La liste reste sur le téléphone : elle n'est pas envoyée à GitHub.
- **En cuisine :**
  - j'ajuste le nombre de personnes (− / +) et les quantités sont recalculées, arrondies à ce qui se mesure en cuisine (œufs à l'entier, cuillères et pièces au ½ près, passage en kg ou en litres). Le réglage n'est jamais enregistré : la recette se rouvre toujours sur son nombre d'origine. Les recettes sans nombre de personnes (pâtes fraîches, bouillons, fonds) n'ont pas de réglage, et les quantités citées dans les étapes restent celles d'origine ;
  - l'icône **🔆**, en haut à droite d'une recette (à côté du statut), garde l'écran allumé pendant que je cuisine : elle se colore quand elle est active, et un court message le confirme. Elle s'arrête en quittant la recette ou en la touchant à nouveau, et reprend tout seul si je reviens dans l'application après l'avoir quittée un instant. Elle n'apparaît pas si le navigateur ne sait pas le faire.

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
| `CuiCui-Recettes` | **Privé** | Mes recettes : un dossier par recette dans `recettes/`, avec `recette.json` et les photos d'origine ; un dossier par livre de recettes dans `livres/`, avec `livre.json` et la couverture. |

Le format d'une fiche recette est décrit dans [docs/format-recette.md](docs/format-recette.md).

## Fonctionnement de la synchronisation

GitHub (le dépôt `CuiCui-Recettes`) est la référence. Le téléphone en garde une copie pour fonctionner hors ligne.

```
  📱 Téléphone                    ☁️ CuiCui-Recettes (privé)            💻 PC + Claude
  copie locale  ── envoi (API) ──▶      recettes/       ◀── git push ──  fiches créées
  + file d'attente ◀─ synchro (API) ─                   ── git pull ──▶  depuis captures
```

- **Envoi depuis le téléphone :** chaque modification (nouvelle recette, changement de statut, note…) est d'abord enregistrée sur le téléphone (IndexedDB), puis envoyée aussitôt à GitHub par l'API REST : GitHub crée lui-même le commit. Sans réseau, la modification attend dans une file d'attente et part automatiquement au retour de la connexion.
- **Réception sur le téléphone :** à chaque ouverture, à chaque retour sur l'application, ou avec le bouton **Réglages → Synchronisation → Synchroniser**, l'application compare l'empreinte (SHA) du dernier commit de `main` avec celle de la dernière synchronisation. Si elle a changé, elle récupère la liste des fichiers du dépôt avec leurs empreintes et ne télécharge que les recettes dont l'empreinte a changé. Les recettes supprimées sur GitHub disparaissent du téléphone. Les fiches des livres (`livres/<id>/livre.json`) sont reçues de la même façon. Les couvertures et les photos du plat qui manquent sur le téléphone sont ensuite téléchargées en arrière-plan (trois à la fois, en binaire plutôt qu'en base64, et pas du tout si l'économiseur de données est activé) ; les photos d'origine (pages de livre) ne le sont qu'à leur première consultation. Toutes restent ensuite sur le téléphone. L'application demande au navigateur de protéger ces données pour qu'Android ne les efface pas quand la place manque ; l'état de cette protection est affiché dans **Réglages → À propos**.
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
| `js/stockage.js` | Le stockage local sur le téléphone (IndexedDB) : copie des recettes, file d'attente, réglages, photos. |
| `js/github.js` | Les échanges avec l'API GitHub (lecture et écriture des fichiers). |
| `js/synchro.js` | La synchronisation : envoi, réception, fusion et conflits. |
| `js/recette.js` | La mise en forme d'une recette en texte (quantités, durées, texte partagé). |
| `js/courses.js` | La liste de courses : ingrédients de chaque recette, articles cochés, texte partagé. |
| `tests/` | Les tests : synchronisation (avec un faux GitHub en mémoire), mise en forme des recettes et liste de courses. |
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
- mise en forme des recettes : http://localhost:8080/tests/test-recette.html ;
- liste de courses : http://localhost:8080/tests/test-courses.html

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
- [x] Classer les recettes (nom, livre, catégorie, cuisine, chef, statut) et étagère des livres
- [ ] Rechercher et filtrer les recettes (catégorie, cuisine, difficulté, mots-clés, statut)
- [x] Ajuster les portions
- [x] Garder l'écran allumé en cuisine
- [x] Ajouter des notes personnelles
- [x] Générer une liste de courses à partir de plusieurs recettes
- [ ] Importer une recette à partir d'une photo (OCR)
- [ ] Importer des recettes via Claude à partir de captures d'écran
