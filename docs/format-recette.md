# Format d'une fiche recette

Chaque recette a son propre dossier dans `recettes/`. Le nom du dossier est l'identifiant de la recette : son nom en minuscules, sans accents, avec des tirets à la place des espaces (par exemple `boeuf-bourguignon`).

```
recettes/
  boeuf-bourguignon/
    recette.json      ← la fiche recette
    source-1.jpg      ← photo(s) d'origine : page de livre, capture d'écran
    plat.jpg          ← photo du plat (facultative)
```

Les photos sont compressées en JPEG avant d'être enregistrées, avec environ 1600 px sur le plus grand côté.

## Contenu de `recette.json`

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | texte | oui | Identique au nom du dossier. |
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
| `notes` | texte | non | Mes remarques personnelles. |
| `favori` | booléen | oui | `true` si c'est une de mes meilleures recettes. |
| `aEssayer` | booléen | oui | `true` si je ne l'ai encore jamais cuisinée. |
| `photos` | objet | non | `source` : liste des photos d'origine ; `plat` : photo du plat ou `null`. |
| `dateAjout` | texte | oui | Date au format `AAAA-MM-JJ`. |

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
