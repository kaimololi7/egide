# HDS — Hébergeur de Données de Santé (FR)

HDS = certification française obligatoire pour héberger des données de santé
à caractère personnel. Référentiel : ANS (Agence du Numérique en Santé). Norme
sous-jacente alignée ISO 27001 + obligations sectorielles santé.

Acteurs : tout hébergeur ou prestataire qui traite des données de santé
identifiantes pour le compte d'un responsable de traitement (établissement
de santé, professionnel libéral, éditeur SaaS santé, mutuelle, complémentaire).

## Périmètre couvert par la certification HDS

| Activité | Couverte par HDS |
|---|---|
| Mise à disposition d'une infrastructure matérielle | oui (activité 1) |
| Mise à disposition d'une infrastructure virtuelle | oui (activité 2) |
| Mise à disposition d'une infrastructure logicielle | oui (activité 3) |
| Infogérance applicative | oui (activité 4) |
| Sauvegarde externalisée | oui (activité 5) |
| Archivage | oui (activité 6) |

Un hébergeur peut être certifié sur 1 ou plusieurs activités. Le client
HDS doit choisir un hébergeur certifié sur les activités correspondant à son
besoin.

## Structure du référentiel

Le référentiel HDS 2018 (en vigueur) impose :

1. **ISO 27001:2013/2022** comme socle (SMSI obligatoire).
2. **ISO 20000-1** (gestion des services IT) — partiel.
3. **Exigences spécifiques santé** :
   - Localisation : données stockées en France ou EU (souveraineté).
   - Sous-traitance encadrée : tout sous-traitant doit être HDS lui-même
     ou conformer aux exigences.
   - Notifications spécifiques en cas d'incident.
   - Réversibilité : le client peut récupérer ses données et changer
     d'hébergeur sans verrou technique.
   - Effacement sécurisé en fin de contrat.

## Mapping vers la pyramide Egide

| Exigence HDS | Pyramid impact |
|---|---|
| SMSI ISO 27001 complet | Pyramide entière "ISO 27001" obligatoire (cf. skill iso27001-2022.md) |
| Localisation des données | Politique "Souveraineté données" + procédure choix hébergeur + KPI sur datacenters utilisés |
| Sous-traitance HDS | Cluster supplier-management adapté avec contrôle "fournisseur HDS-certifié" |
| Notifications incidents santé | Procédure incident dédiée avec timer events vers ANS et patient si applicable |
| Réversibilité | Politique + procédure "exit strategy" + tests annuels |
| Effacement sécurisé | Procédure "fin de contrat" + KPI taux d'effacement vérifié |

## Exigences techniques transversales (pour le compilateur PaC)

Quand un cluster HDS-tagué est compilé en policy-as-code, les générateurs
ajoutent automatiquement :

- **Rego** : règles bloquant les déploiements vers régions non-EU.
- **Kyverno** : policies bloquant les `StorageClass` ne respectant pas le
  chiffrement at-rest avec clés contrôlées par le client.
- **Ansible** : playbooks pour wipe sécurisé (NIST SP 800-88 Clear/Purge).
- **AWS Config** : règles EU-only + S3 SSE-KMS.
- **Scaleway IAM** : policies restreignant aux régions FR.

## Articulation avec d'autres frameworks

| HDS | Mappable vers |
|---|---|
| SMSI ISO 27001 | iso27001-2022 (entière) |
| Localisation | NIS2 Art. 21 si entité essentielle santé |
| Sous-traitance | DORA Chap. 4 si fintech santé / paiement |
| Réversibilité | DORA Art. 30 exit strategy |
| Notifications | NIS2 Art. 23 + obligation CNIL si données personnelles |

## Reference paths

- `ontologies/hds/v2018.yaml` — exigences HDS structurées (à créer en M2)
- `.claude/skills/iso27001-2022.md` — base SMSI
- `services/compiler/generators/policy-targets-by-framework/hds.go` — règles
  d'enrichissement HDS appliquées au moment de la compilation

## Audit-readiness extras

`A_HDS_01-05` (à formaliser) :
- SMSI ISO 27001 certifié et à jour
- Liste des sous-traitants avec attestations HDS / engagements équivalents
- Plan de réversibilité documenté + testé < 12 mois
- Localisation EU prouvée (preuves contractuelles + cloud audit)
- Procédure d'effacement avec preuves NIST SP 800-88

## Why this matters for Egide

Le marché santé français mid-market (cliniques, ESPIC, mutuelles, éditeurs
santé) est un débouché premier de souveraineté. Egide Enterprise air-gappable
+ HDS-aware policy compiler = différenciateur fort. Aucun outil GRC US ne
peut couvrir HDS proprement.
