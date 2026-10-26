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
2. **Via Claude :** j'envoie des captures d'écran de la recette à Claude, depuis mon PC ou mon téléphone. Claude extrait tous les champs, crée la fiche au [format défini](docs/format-recette.md) et la pousse dans ce dépôt.

## Choix techniques

- **Téléphone visé :** Android.
- **Application web installable (PWA) :** elle s'ajoute à l'écran d'accueil comme une vraie application, fonctionne hors ligne et est hébergée gratuitement sur GitHub Pages. Pas de store, pas de compilation.
- **Sans base de données :** ce dépôt GitHub sert de stockage.
  - Chaque recette a son propre dossier dans `recettes/`, avec un fichier `recette.json` et la ou les photos d'origine.
  - L'application lit et écrit ces fichiers via l'API GitHub, avec un jeton personnel saisi une seule fois sur le téléphone.
  - Les recettes sont gardées en mémoire sur le téléphone. À chaque ouverture, seules les recettes modifiées sont téléchargées.
- **Léger :** HTML, CSS et JavaScript simples, sans framework lourd.

Le format d'une fiche recette est décrit dans [docs/format-recette.md](docs/format-recette.md).

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

1. Sur GitHub : **Settings → Pages**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
2. Après une ou deux minutes, l'application est en ligne sur https://alex-leclercq.github.io/CuiCui-Cooking/
3. Sur le téléphone Android, ouvrir cette adresse dans Chrome, puis menu **⋮ → Installer l'application** (ou **Ajouter à l'écran d'accueil**).

Après chaque mise à jour de `main`, l'application se met à jour sur le téléphone à sa prochaine ouverture (parfois la suivante).

## Feuille de route

- [x] Choisir la technologie
- [x] Définir le format d'une fiche recette
- [x] Créer le squelette de l'application (PWA installable, hors ligne, GitHub Pages)
- [ ] Connecter l'application au dépôt GitHub (lecture et écriture des recettes)
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
