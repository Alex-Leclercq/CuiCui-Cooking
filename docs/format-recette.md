# Format d'une fiche recette

Les recettes sont stockées dans le dépôt **privé** `CuiCui-Recettes`, pas dans ce dépôt public. Chaque recette a son propre dossier dans `recettes/`. Le nom du dossier est l'identifiant unique de la recette.

## Choix de l'identifiant

Plusieurs recettes peuvent porter le même nom, par exemple plusieurs bœufs bourguignons tirés de livres différents. L'identifiant est donc construit ainsi :

1. le nom de la recette, suivi du chef (ou, sans chef, du titre de la source) ;
2. le tout en minuscules, sans accents, avec des tirets à la place des espaces et de la ponctuation ;
3. si cet identifiant existe déjà, on ajoute `-2`, `-3`, etc.

| Recette | Chef / source | Identifiant |
|---|---|---|
| Bœuf bourguignon | Paul Bocuse | `boeuf-bourguignon-paul-bocuse` |
| Bœuf bourguignon | Cyril Lignac | `boeuf-bourguignon-cyril-lignac` |
| Bœuf bourguignon | sans chef, site Marmiton | `boeuf-bourguignon-marmiton` |
| Bœuf bourguignon | Paul Bocuse, deuxième version | `boeuf-bourguignon-paul-bocuse-2` |
| Bœuf bourguignon | ni chef ni source | `boeuf-bourguignon` |

L'identifiant ne change plus après la création, même si je renomme la recette ou corrige le chef. Il sert uniquement à ranger les fichiers. Dans l'application, c'est toujours le nom, le chef et la source qui sont affichés.

## Organisation des fichiers

```
recettes/
  boeuf-bourguignon-paul-bocuse/
    recette.json      ← la fiche recette
    source-1.jpg      ← photo(s) d'origine : page de livre, capture d'écran
    plat.jpg          ← photo du plat (facultative)
```

Les photos sont compressées en JPEG avant d'être enregistrées, avec environ 1600 px sur le plus grand côté.

## Contenu de `recette.json`

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | texte | oui | Identique au nom du dossier (voir « Choix de l'identifiant »). |
| `nom` | texte | oui | Nom de la recette. |
| `chef` | texte | non | Chef ou auteur. |
| `source` | objet | non | D'où vient la recette (voir ci-dessous). |
| `categorie` | texte | oui | Une valeur parmi : `aperitif`, `entree`, `plat`, `accompagnement`, `dessert`, `boisson`, `sauce`, `autre`. |
| `cuisine` | texte | non | Ex. `française`, `italienne`, `japonaise`. |
| `difficulte` | texte | non | `facile`, `moyen` ou `difficile`. |
| `motsCles` | liste de textes | non | Mots-clés libres, en minuscules : `végétarien`, `rapide`, `hiver`… |
| `portions` | nombre | oui | Nombre de personnes prévu par la recette. |
| `tempsPreparation` | nombre | non | En minutes. |
| `tempsCuisson` | nombre | non | En minutes. |
| `tempsRepos` | nombre | non | En minutes (marinade, réfrigération, levée…). |
| `ingredients` | liste d'objets | oui | Voir ci-dessous. |
| `etapes` | liste de textes | oui | Une entrée par étape, dans l'ordre. |
| `notes` | texte | non | Mes remarques personnelles, modifiables dans l'application. |
| `statut` | texte | oui | Où j'en suis avec cette recette (voir ci-dessous). `a-essayer` pour une nouvelle recette. |
| `historique` | liste d'objets | non | Journal des modifications de statut et de notes (voir ci-dessous). |
| `photos` | objet | non | `source` : liste des photos d'origine ; `plat` : photo du plat ou `null`. |
| `dateAjout` | texte | oui | Date au format `AAAA-MM-JJ`. |

### `statut`

| Valeur | Affichage | Signification |
|---|---|---|
| `a-essayer` | 📝 À essayer | Jamais cuisinée. Apparaît dans l'onglet « À essayer ». |
| `cuisinee` | ✅ Déjà cuisinée | Testée, correcte. |
| `favorite` | ⭐ Favorite | Testée et adorée. Apparaît dans l'onglet « Favoris ». |

Anciens formats, toujours compris par l'application :
- `favori` et `aEssayer` (booléens) : la fiche passe au champ `statut` dès que le statut est changé dans l'application ;
- `a-eviter` (statut retiré) : lu comme `cuisinee`.

### `historique`

Liste des modifications faites sur la recette, la plus ancienne en premier. L'application ajoute une ligne à chaque changement de statut ou de notes. Les historiques de toutes les recettes sont affichés ensemble dans **Réglages → Historique des modifications**, avec un retour à la valeur précédente.

| Champ | Description |
|---|---|
| `date` | Date et heure, au format ISO (`2026-10-27T09:12:00.000Z`). |
| `champ` | `statut` ou `notes`. |
| `avant` | Valeur avant la modification. |
| `apres` | Valeur après la modification. |

Exemple :

```json
"historique": [
  { "date": "2026-10-27T09:12:00.000Z", "champ": "statut", "avant": "a-essayer", "apres": "favorite" },
  { "date": "2026-10-27T09:15:00.000Z", "champ": "notes", "avant": "", "apres": "Moins de sucre" }
]
```

Lors d'une synchronisation, les lignes ajoutées sur le téléphone et sur GitHub sont toutes conservées.

### `source`

| Champ | Description |
|---|---|
| `type` | `livre`, `site` ou `autre`. |
| `titre` | Titre du livre ou nom du site. |
| `url` | Adresse de la page, pour un site. |
| `page` | Numéro de page, pour un livre. |

### Un ingrédient

| Champ | Description |
|---|---|
| `quantite` | Nombre (`250`, `0.5`) ou `null` pour « sel, poivre ». |
| `unite` | Une unité de la liste ci-dessous, ou `null` pour un nombre de pièces (« 3 œufs »). |
| `nom` | Nom de l'ingrédient, au singulier et sans précision : `oignon`, `farine`, `beurre`. |
| `precision` | Facultatif : `émincé`, `mou`, `bio`… |
| `groupe` | Facultatif : sous-partie de la recette (`Pâte`, `Garniture`…). |

Unités autorisées : `g`, `kg`, `ml`, `cl`, `l`, `c. à café`, `c. à soupe`, `pincée`, `gousse`, `tranche`, `botte`, `brin`, `feuille`, `boîte`, `sachet`.

Ces règles, avec des noms au singulier et des unités normalisées, permettent à l'application de recalculer les portions et d'additionner les ingrédients de plusieurs recettes pour la liste de courses (par exemple 200 g + 0,5 kg de farine = 700 g).

## Exemple

Voir [exemple-recette.json](exemple-recette.json).
