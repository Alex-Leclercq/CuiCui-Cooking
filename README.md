# CuiCui Cooking 🐦🍳

**CuiCui Cooking** est une application pensée pour mon téléphone. Elle me sert à garder avec moi, partout, les recettes de cuisine que j'aime.

## Ce que fait l'application

- **Mon carnet de recettes de poche :** je liste et consulte mes recettes préférées où que je sois, même sans connexion.
- **Présentation (direction « Carnet ») :** papier crème, encre brune et terre cuite de l'icône ; titres en Fraunces, texte en Inter (polices copiées dans `polices/`, sous licence libre OFL) ; icônes au trait plutôt qu'emoji. En haut, l'oiseau, « CuiCui Cooking » et la roue des **Réglages** ; en bas, une barre flottante : Recettes, Favoris, l'ajout en photo au centre, À essayer, Courses. Dans les listes, chaque recette montre la photo du plat, le chef et le livre, la durée, le nombre de personnes et son statut en couleur. Sur la fiche, les quantités des ingrédients sont en terre cuite dans leur propre colonne, aussi large que la plus longue quantité de la recette : tous les noms s'alignent, et un nom long passe à la ligne sans revenir sous les chiffres. Dans cette colonne, les cuillères sont abrégées (« c. à s. », « c. à c. ») et les moitiés et quarts s'écrivent en fraction (« ½ c. à c. », « 1 ½ bottes » ; g, kg, ml, cl et l restent en décimales). Dans la liste de courses, les quantités sont en gras et en terre cuite, comme sur la fiche (grisées une fois l'article acheté). Le texte partagé garde les unités en entier.
- **Apparence (Réglages → Apparence) :** **Clair** (par défaut, comme la maquette, même si le téléphone est en mode sombre) ou **Sombre**. Le choix est appliqué tout de suite et retenu sur le téléphone.
- **Ajout d'une recette en photo (bouton appareil photo au centre de la barre du bas) :**
  - je choisis le livre d'où vient la recette (le dernier choisi reste sélectionné, pour enchaîner les recettes d'un même livre), « Nouveau livre » ou « Pas un livre », puis la page si je la connais ;
  - je prends les pages en photo avec l'appareil photo du téléphone, ou je les choisis dans la galerie (captures d'écran). Sous chaque photo, j'indique ce qu'elle montre : page de la recette, photo du plat (une seule), et pour un nouveau livre la page de copyright (ISBN, éditeur, année) ou la couverture ;
  - **Envoyer** réduit les photos (JPEG, 1 600 px) et les dépose, en un seul commit, dans la boîte `a-traiter/` du dépôt des recettes. Sans réseau, elles attendent sur le téléphone et partent toutes seules au retour de la connexion ;
  - la liste **Envois en attente** montre les photos pas encore envoyées (⏳) et celles qui attendent d'être transformées en fiche par Claude (📬). Un envoi disparaît de la liste une fois sa fiche créée.
- **Ce que Claude extrait des photos :** sur le PC, je demande à Claude de « traiter les recettes en attente ». Il crée les fiches au format du carnet, cherche la couverture officielle d'un nouveau livre et, si possible, une version de meilleure qualité de la photo du plat, puis vide la boîte. Chaque fiche contient :
  - le nom de la recette ;
  - les ingrédients et leurs quantités ;
  - les étapes de préparation ;
  - le temps de préparation et le temps de cuisson ;
  - le nombre de personnes ;
  - le chef ou l'auteur ;
  - la source : le livre d'origine ou le site internet.
- **Statut de chaque recette :** sur l'écran d'une recette, la pastille colorée à côté de la catégorie ouvre, juste en dessous (ou au-dessus en bas d'écran), le menu des statuts : une pastille colorée par statut et une coche sur le statut actuel ; toucher à côté, Échap ou le geste retour le ferment sans rien changer. Changer de statut demande deux gestes, ce qui évite les changements par erreur :
  - **Pas testée** (par défaut, pastille « Statut » en contour beige) : jamais cuisinée, aucun avis ; rien n'est affiché sur les cartes des listes ;
  - **À essayer** (rose) : ma sélection de recettes à tester bientôt, réunies dans l'onglet « À essayer », rangées par catégorie comme les Favoris ;
  - **Favorite** (jaune) : cuisinée et adorée ; une petite étoile jaune suit son nom dans toutes les listes, et précède « Favorite » sur la pastille ; ces recettes sont dans l'onglet « Favoris », rangées par catégorie dans le même ordre que Mes recettes (Petit-déjeuner, Apéritif, Entrée, Plat…). Toutes les sections sont ouvertes au départ ; un appui sur le titre d'une section la replie ou la rouvre, sans toucher aux autres (le choix est gardé en allant voir une recette, tant que l'application est ouverte) ;
  - **Bonne** (vert) : cuisinée, réussie, mais pas un coup de cœur ;
  - **Pas pour moi** (gris ardoise) : cuisinée, pas aimée, à ne pas refaire.
- **Mes notes :** sur l'écran d'une recette, j'écris mes remarques dans l'encadré « Mes notes » et je les enregistre.
- **Écran d'une recette :** en plein écran, sans la barre des onglets. La photo du plat occupe le haut, en carré centré sur toute la largeur (le format pour lequel les photos sont recadrées, comme avant la refonte), avec les boutons retour, écran allumé et partage posés dessus. Dessous : catégorie et statut, nom, chef et livre (un lien vers toutes les recettes du livre), temps de préparation, de repos et de cuisson en cases, mots-clés, puis deux onglets **Ingrédients** / **Étapes** (étapes numérotées). En haut à droite, sur la photo : le **panier** (ajouter aux courses), l'**écran allumé** et le **partage** ; aucune barre en bas, la recette occupe tout l'écran.
- **Feuilleter les recettes :** sur une recette, glisser vers la gauche passe à la suivante, vers la droite à la précédente (flèches ← → au clavier), dans l'ordre où elles apparaissent sur l'écran d'où l'on vient : un livre dans l'ordre des pages ; Favoris, À essayer, Catégorie et Statut section après section (sections repliées comprises), par nom dans chaque section ; Nom de A à Z ; une recherche ou des filtres, seulement les résultats. Aucune flèche ni repère à l'écran. À la dernière recette, la page résiste et un court message dit « Dernière recette du livre » (ou « de la liste ») ; de même au début. Un glissement parti du bord de l'écran reste le retour du téléphone, un geste surtout vertical fait défiler la recette. Les recettes voisines sont préparées pendant la lecture (photo comprise) : la page tourne sans attente. Le bouton ← ramène à la liste, sur la dernière recette lue : si elle est hors de l'écran, la liste la ramène au milieu ; si elle est dans une section repliée, cette section s'ouvre ; sa carte s'entoure un instant d'un liseré coloré pour montrer où l'on s'est arrêté (seulement après avoir feuilleté). Une recette ouverte depuis les courses ou par un lien ne se feuillette pas. Une astuce l'explique à la première recette ouverte.
- **Photo du plat :** affichée en haut de la recette, sans attente : elle est téléchargée en arrière-plan dès la synchronisation, puis gardée sur le téléphone. Elle apparaît aussi en vignette dans les listes, chargée au fur et à mesure du défilement.
- **Historique des modifications :** chaque changement de statut ou de notes est noté (date, recette, avant → après). Toutes les recettes sont regroupées dans **Réglages → Historique des modifications**. En cas de mauvaise manipulation, un bouton **↩ Revenir** restaure la valeur précédente.
- **Classement :** chaque recette a une catégorie (entrée, plat, dessert…), une cuisine (française, japonaise…), une difficulté et des mots-clés libres (végétarien, rapide, hiver…), affichés sous forme de capsules. En haut de la liste, une rangée de pastilles (**Livre**, **Catégorie**, **Statut**, **Nom**) range les recettes. À chaque ouverture de l'application, Mes recettes s'ouvre sur **Livre** (l'étagère) ; le choix fait ensuite est gardé tant que l'application est ouverte. La cuisine se choisit dans les **Filtres**, un chef se retrouve par la recherche. Quand les recettes sont rangées en sections (catégorie, statut), la liste montre d'abord les sections, toutes repliées. Un appui sur le titre d'une section l'ouvre et referme celle qui était ouverte : le titre touché reste en place pendant que l'autre se replie, puis glisse en haut de l'écran, sous l'en-tête, avec ses recettes en dessous. Un nouvel appui la referme. Changer de classement replie toutes les sections ; la section ouverte reste ouverte en allant voir une recette puis en revenant. Pendant le défilement, le titre de la section en cours reste collé sous l'en-tête, comme dans les contacts du téléphone.
- **Recherche et filtres :** dans Mes recettes, la barre de recherche trouve les recettes par leur nom, leurs ingrédients, leur chef, leur livre ou leurs mots-clés, sans tenir compte des accents ni des majuscules (« boeuf » trouve « Bœuf »), chaque mot tapé devant être le début d'un mot de la recette ; une croix ✕ efface la recherche. Le bouton **Filtres** ouvre un écran à part (sans onglets ni sélection) avec des pastilles à cocher par catégorie, statut et cuisine : **Afficher N recettes** applique les choix (il n'apparaît qu'après un changement), la croix ou le geste retour les abandonne, **Tout effacer** décoche tout. Le nombre de recettes trouvées s'affiche en haut (« 12 sur 100 recettes »). Pendant une recherche, toutes les sections sont dépliées ; la section ouverte habituelle revient quand la recherche est effacée. Faire défiler la liste pendant la saisie ferme le clavier. Recherche et filtres restent actifs tant que l'application est ouverte, et repartent à zéro à la prochaine ouverture.
- **Étagère des livres :** la pastille **Livre** affiche les couvertures de mes livres de recettes, avec leur nombre de recettes. Un livre ouvre ses recettes dans l'ordre des pages, comme une table des matières. Les couvertures sont gardées prêtes tant que l'application est ouverte : au retour d'un livre, elles s'affichent aussitôt. À l'ouverture, l'étagère attend un court instant (au plus un tiers de seconde) que les couvertures soient prêtes, pour s'afficher d'un coup ; une couverture plus lente apparaît ensuite en fondu sur un cadre neutre. Le titre sur fond coloré ne sert qu'aux livres sans couverture. Sur l'écran d'un livre, un appui sur la couverture l'ouvre en grand, sur le fond de l'appli : zoom à deux doigts (jusqu'à ×5), double appui pour zoomer ou revenir, glisser pour se déplacer une fois zoomé, molette sur ordinateur ; fermeture par ✕, Échap ou le geste retour du téléphone. Depuis une recette, un lien mène à toutes les recettes du même livre.
- **En-têtes figés :** le haut de chaque liste (titre, nombre de recettes, Classer par, Sélectionner) et la barre du haut d'une recette ou d'un livre restent en place pendant que je fais défiler l'écran. En revenant d'une recette (bouton ← ou retour du téléphone), je retrouve la liste exactement là où je l'avais laissée. Le bouton ← ramène à l'écran précédent (un livre, les Favoris…), comme le retour du téléphone.
- **Retour arrière :** depuis une recette ou un livre, il ramène à la page d'où je l'ai ouvert ; depuis un autre onglet (Favoris, À essayer, Courses), les Réglages ou l'ajout en photo, il ramène toujours à Mes recettes, car les onglets ne s'empilent pas ; depuis Mes recettes, il met l'application en arrière-plan, comme les autres applications du téléphone.
- **Partager une recette :** un bouton envoie la recette en texte (ingrédients, étapes, temps, source) par WhatsApp, SMS, e-mail… via le menu de partage du téléphone. Mes notes personnelles ne sont pas partagées.
- **Liste de courses (onglet Courses) :**
  - j'ajoute une recette avec l'icône **panier** en haut de sa fiche, pour le nombre de personnes affiché : le panier devient vert coché, et un court message le confirme en bas de l'écran. Si je change ensuite le nombre de personnes, un point terre cuite apparaît sur le panier : un appui **met à jour la liste**. Le message propose **Voir la liste**. Quand la recette y est déjà (panier vert), un appui sur le panier la **retire** de la liste ; le message propose alors **Annuler** pendant quelques secondes, qui la remet telle quelle (nombre de personnes et articles déjà cochés compris). Ou, dans Mes recettes, Favoris ou À essayer, **Sélectionner** me laisse cocher plusieurs recettes et les ajouter d'un coup, chacune pour son nombre de personnes d'origine. Dans les listes de recettes, un petit panier vert signale celles qui sont déjà dans la liste de courses. Pendant la sélection, la barre « Annuler / Ajouter » remplace la barre des onglets en bas de l'écran, et le geste retour du téléphone quitte la sélection ;
  - en haut, une barre de progression indique ce qui reste à acheter (« 24 articles à acheter », « 1 / 25 ») ;
  - deux vues, au choix (retenu sur le téléphone) : **Par recette** (le détail de chaque recette, décrit ci-dessous) et **Tout ensemble** (les ingrédients de toutes les recettes additionnés, une ligne par ingrédient par ordre alphabétique : « 9 gousses d'ail », avec en petit les recettes qui en ont besoin). Les grammes et kilos, les ml, cl et litres s'additionnent ; des unités différentes (« 1 ail » et « 5 gousses d'ail ») restent sur deux lignes. Le pluriel, les majuscules et les accents ne comptent pas : « haricot blanc » et « haricots blancs », « 1 poireau » et « 12 poireaux » se regroupent. Cocher une ligne de **Tout ensemble** coche cet ingrédient dans chaque recette concernée. Un ingrédient acheté seulement en partie s'affiche sur deux lignes : ce qui reste à acheter, avec ses seules recettes, à sa place (« 12 poireaux ← Fondue de poireau »), et ce qui est acheté, coché, tout en bas (« 6 poireaux ← Potée au jambonneau ») ; dès que tout est coché ou tout décoché, elles se rejoignent en une seule ligne (« 18 poireaux »), avec les deux recettes. **Partager** envoie la vue affichée ;
  - chaque recette a sa carte : photo, nom, compteur des articles achetés (« 3 / 7 », puis « Tout acheté ») et réglage − / + des personnes ; en dessous, ses ingrédients pour ce nombre de personnes. Un appui sur le nom plie ou déplie les ingrédients (le choix est retenu) ;
  - en magasin, je touche un article pour cocher sa case, qui devient verte : il descend en bas de sa recette. Si je change ensuite le nombre de personnes, il redevient à acheter (sauf les ingrédients sans quantité, comme le sel) ;
  - la photo d'une recette l'ouvre, et **Retirer de la liste** l'enlève ; l'icône corbeille, en haut, vide toute la liste, après confirmation ;
  - l'icône de partage, en haut, envoie en texte, recette par recette, ce qui reste à acheter. La liste reste sur le téléphone : elle n'est pas envoyée à GitHub.
- **En cuisine :**
  - j'ajuste le nombre de personnes (− / +) et les quantités sont recalculées, arrondies à ce qui se mesure en cuisine (œufs à l'entier, cuillères et pièces au ½ près, passage en kg ou en litres). Le réglage n'est jamais enregistré : la recette se rouvre toujours sur son nombre d'origine. Les recettes sans nombre de personnes (pâtes fraîches, bouillons, fonds) n'ont pas de réglage, et les quantités citées dans les étapes restent celles d'origine ;
  - l'icône soleil, en haut à droite d'une recette (entre le panier et le partage), garde l'écran allumé pendant que je cuisine : elle se colore quand elle est active, et un court message le confirme. Elle s'arrête en quittant la recette ou en la touchant à nouveau, et reprend tout seul si je reviens dans l'application après l'avoir quittée un instant. Elle n'apparaît pas si le navigateur ne sait pas le faire.

## Deux façons d'importer une recette

1. **Depuis l'application :** je photographie la page avec le téléphone ; les photos sont déposées dans la boîte `a-traiter/` du dépôt des recettes, et Claude les transforme en fiches à la demande, depuis le PC. Pas d'OCR sur le téléphone : la lecture par Claude est bien plus fiable (quantités, étapes, unités), et aucune clé ni aucun nouveau site n'est nécessaire.
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
- **Photos de recettes :** chaque envoi part en un seul commit (API Git de GitHub : fichiers, arborescence, commit, puis déplacement de `main`) dans `a-traiter/<date-heure>/`, avec un fichier `demande.json` (livre, page, rôle de chaque photo). Si `main` a avancé pendant l'envoi, le commit est refait par-dessus. L'envoi ne quitte le téléphone qu'une fois le commit fait. La synchronisation ignore ce dossier pour les recettes ; elle s'en sert seulement pour lister les envois en attente de traitement.
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
| `js/envoi.js` | L'ajout d'une recette en photo : rôle et nom des photos, réduction, contenu de `demande.json`. |
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
- recherche et filtres : http://localhost:8080/tests/test-recherche.html

## Installer sur le téléphone

1. Sur GitHub, dans ce dépôt (public) : **Settings → Pages**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
2. Après une ou deux minutes, l'application est en ligne sur https://alex-leclercq.github.io/CuiCui-Cooking/
3. Sur le téléphone Android, ouvrir cette adresse dans Chrome, puis menu **⋮ → Installer l'application** (ou **Ajouter à l'écran d'accueil**).

Après chaque mise à jour de `main`, l'application cherche la nouvelle version à chaque ouverture et à chaque retour dessus. Elle se recharge d'elle-même si elle vient de s'ouvrir, sinon elle affiche un bandeau **Nouvelle version disponible → Mettre à jour**.

Pour la connecter aux recettes : créer le jeton (voir « Sécurité » ci-dessus), puis dans l'application **Réglages → Connexion à GitHub**, coller le jeton et appuyer sur **Enregistrer et tester**. Une fois connectée, la zone **Connexion à GitHub** est repliée (son titre indique « Connecté à … ») pour éviter de modifier un champ par mégarde : la flèche la déplie. **Oublier le jeton** demande une confirmation.

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
- [x] Choisir le statut d'une recette (pas testée, à essayer, favorite, bonne, pas pour moi) et afficher les onglets Favoris et À essayer
- [x] Historique des modifications de statut et de notes, avec retour en arrière
- [x] Classer les recettes (nom, livre, catégorie, cuisine, chef, statut) et étagère des livres
- [x] Rechercher les recettes (nom, ingrédient, chef, livre, mots-clés) et les filtrer par catégorie, statut et cuisine
- [ ] Filtrer par saison, par temps de préparation et de cuisson (recettes rapides), par difficulté
- [x] Ajuster les portions
- [x] Garder l'écran allumé en cuisine
- [x] Feuilleter les recettes d'un livre ou d'une liste en glissant
- [x] Ajouter des notes personnelles
- [x] Générer une liste de courses à partir de plusieurs recettes
- [x] Ajouter une recette à partir d'une photo (boîte `a-traiter/`, fiches créées par Claude)
- [x] Refonte graphique « Carnet » (polices, icônes au trait, photos dans les listes, recette en plein écran)
- [ ] Importer des recettes via Claude à partir de captures d'écran
