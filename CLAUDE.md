# CuiCui Cooking – consignes pour Claude

Application web installable (PWA) de recettes de cuisine, pour un téléphone Android. Le contexte complet est dans le [README](README.md).

## Architecture

- **Ce dépôt (`CuiCui-Cooking`, public)** : uniquement le code de l'application, publié sur GitHub Pages depuis `main`. Jamais de recette, de photo de recette ni de secret ici.
- **`Alex-Leclercq/CuiCui-Recettes` (privé)** : les recettes, une par dossier dans `recettes/<id>/` (`recette.json` + photos).
- L'application lit et écrit les recettes via l'API REST de GitHub, avec un jeton saisi sur le téléphone, et garde une copie locale dans IndexedDB.
- Pas de framework, pas d'étape de build : HTML, CSS et JavaScript simples.
- Format des fiches et règle des identifiants : [docs/format-recette.md](docs/format-recette.md). Le respecter strictement, y compris les unités autorisées.

## Méthode de travail

- Toujours commencer par `git pull`.
- **Code de l'application** : une branche par fonctionnalité, puis une pull request. Ne jamais pousser du code directement sur `main` (`main` = version installée sur le téléphone).
- **Pull requests** : une fois les tests au vert, Claude pousse la branche et crée la pull request avec `gh pr create`, sans demander : cela ne touche pas le téléphone. **Avant chaque fusion, il demande l'accord de l'utilisateur** (« Je fusionne ? »), en résumant ce que contient la pull request. Si l'utilisateur demande d'ajouter autre chose, Claude l'ajoute sur la même branche (la pull request se met à jour toute seule), puis redemande. Il ne fusionne (`gh pr merge --merge --delete-branch`) qu'après un « oui » explicite pour cette pull request. L'utilisateur n'est pas un expert de GitHub : expliquer en mots simples. Sur ce PC, `gh` est dans `C:\Program Files\GitHub CLI\gh.exe` ; l'appeler par ce chemin s'il n'est pas trouvé. Ne jamais afficher le jeton (`gh auth token`).
- **Petites corrections de documentation** : directement sur `main`, après accord de l'utilisateur.
- **Ajout de recettes depuis des captures** : dans le dépôt `CuiCui-Recettes`, directement sur `main`. Vérifier qu'aucun identifiant n'existe déjà avant de créer un dossier.
- Cocher l'étape correspondante de la feuille de route du README quand une fonctionnalité est terminée.
- Tout en français : interface, noms de variables et de fonctions, commentaires, messages de commit.

## Sécurité (non négociable)

- **Jamais de données de recette dans du HTML** : pas d'`innerHTML`, d'`insertAdjacentHTML` ni de gabarit HTML contenant du texte venant d'une recette, de l'OCR ou de GitHub. Construire les éléments avec `document.createElement` et remplir avec `textContent`.
- **Conserver la CSP** de `index.html`. Ne pas l'assouplir (pas de `unsafe-inline`, pas de nouveau domaine) sans l'accord explicite de l'utilisateur.
- **Aucune bibliothèque chargée depuis un site tiers** : la copier dans le dépôt, à une version figée.
- **Le jeton GitHub** n'est jamais écrit dans un fichier, un log ou un commit. Il est uniquement saisi dans l'application et envoyé à `api.github.com`.
- Pour toute écriture via l'API, envoyer le SHA connu du fichier, et traiter le 409 (conflit) sans écraser.

## Pièges connus

- **À chaque modification d'un fichier de l'application**, incrémenter `CACHE` dans `sw.js` et `VERSION` dans `js/app.js`. Sinon les téléphones gardent l'ancienne version en cache.
- Tout nouveau fichier de l'application doit être ajouté à `FICHIERS_APPLICATION` dans `sw.js`.
- Les pages de tests chargent `js/*.js` à travers le cache du service worker : après une modification, incrémenter `CACHE`, mettre à jour le service worker (recharger l'application), puis relancer les tests. Sinon ils testent l'ancien code.
- Chemins toujours relatifs (`css/app.css`, pas `/css/app.css`) : le site est servi sous `/CuiCui-Cooking/`.
- Toute modification de `js/synchro.js`, `js/github.js` ou `js/stockage.js` doit garder les tests `tests/test-synchro.html` au vert ; ajouter un test pour chaque nouveau cas.
- Pour afficher du contenu, utiliser la fonction `el()` de `js/app.js` : elle ne crée que des nœuds texte.
- Toute modification du statut ou des notes d'une recette passe par `modifier()` de `js/recette.js`, qui ajoute la ligne d'historique. Ne jamais modifier ces champs directement.
- Tester avec le serveur local (`outils/serveur-local.ps1`, http://localhost:8080), en affichage mobile, mode sombre compris. Le mode hors ligne ne fonctionne pas en ouvrant `index.html` directement.
