---
name: dora-regulation
description: DORA (Règlement UE 2022/2554) reference layer — Digital Operational Resilience Act for the EU financial sector. Loaded when target_frameworks includes DORA. Mandatory for banks, insurers, investment firms, payment institutions, crypto-asset providers, etc. Operational pointer to `ontologies/dora/`.
---

# DORA — Operational guidance

DORA = Règlement (UE) 2022/2554 sur la résilience opérationnelle numérique du secteur financier. Application : 17 janvier 2025. Régulation directe (pas de transposition). Couvre tous les acteurs financiers EU + leurs prestataires ICT critiques.

## Périmètre d'application

Acteurs financiers EU : banques, sociétés d'investissement, assurances, IORP, OPCVM, gestionnaires alternatifs, crypto-actifs (MiCA-aligned), institutions de paiement, agences de notation, contreparties centrales, dépositaires centraux, etc.

**Exclusion** : très petits acteurs sous seuils de l'Article 16 (mesures simplifiées).

## Architecture en 5 piliers

DORA structure les obligations en 5 chapitres opérationnels :

### Chapitre 1 — Cadre de gestion des risques ICT (Art. 5-15)
Le conseil d'administration est **personnellement responsable** du framework.
- Identification des actifs ICT et dépendances
- Protection (politiques, contrôles)
- Détection (monitoring continu)
- Réponse et récupération (BCP/DRP)
- Apprentissage et évolution

### Chapitre 2 — Gestion des incidents ICT (Art. 17-23)
- Classification des incidents (majeurs vs significatifs)
- **Reporting strict** :
  - Notification initiale : 4h après classification "majeur"
  - Rapport intermédiaire : sous 72h
  - Rapport final : 1 mois
- Cyber threats voluntary reporting

### Chapitre 3 — Tests de résilience opérationnelle (Art. 24-27)
- Tests basiques annuels (vulnerability assessment, scenario-based)
- **TLPT** (Threat-Led Penetration Testing) : tous les 3 ans pour les acteurs significatifs
- Coordination avec autorités compétentes

### Chapitre 4 — Gestion des risques tiers ICT (Art. 28-44)
- Inventaire des prestataires ICT critiques
- Due diligence pré-contractuelle
- **Clauses contractuelles obligatoires** (Art. 30) : right to audit, exit strategy, incident notification, etc.
- Stratégie de sortie pour chaque CTPP critique

### Chapitre 5 — Partage d'informations (Art. 45-49)
Volontaire mais encouragé : threat intelligence sharing entre entités financières.

## Mapping vers la pyramide

| DORA Chapter | Pyramid implication |
|---|---|
| Chap. 1 | Politique master "ICT Risk Management" + 5-7 procédures (identification, protection, détection, réponse, récupération) |
| Chap. 2 | Pyramide "Incident Management ICT" avec timer events 4h/72h/1mois |
| Chap. 3 | Procédure "Resilience testing" + KPIs annuels + TLPT triannuel |
| Chap. 4 | Registre fournisseurs ICT (lié OSCAL) + clauses-types + procédure exit |
| Chap. 5 | Optionnel — procédure threat intel sharing |

## Concept clé : **CTPP (Critical Third-Party Provider)**

Les fournisseurs ICT considérés "critiques" par les autorités européennes (EBA, EIOPA, ESMA + Joint Oversight Forum) sont sous **supervision directe**. AWS, Microsoft Azure, Google Cloud sont les premiers candidats CTPP.

## Articulation avec NIS2

DORA = **lex specialis** pour le secteur financier. Pour un acteur financier :
- DORA prime sur NIS2 (mais NIS2 reste applicable hors-cybersec)
- En pratique : pyramide commune + tags `dora_applicable: true` sur les artefacts

## Cross-framework

| DORA | Mappable vers |
|---|---|
| Chap. 1 ICT risk framework | ISO 27001 Clause 6 + 27005 |
| Chap. 2 incident reporting | NIS2 Art. 23 + ITIL Incident Management |
| Chap. 3 testing | ISO 27001 A.8.34 + NIST CSF |
| Chap. 4 third-party risk | ISO 27001 A.5.19-23 |
| Chap. 4 exit strategy | ITIL Supplier Management + ISO 22301 |

## Reference paths

- `ontologies/dora/chapters.ttl` — 5 chapitres, articles
- `ontologies/dora/rts-and-its.ttl` — Regulatory Technical Standards (RTS) + Implementing Technical Standards (ITS) publiés par EBA/EIOPA/ESMA
- `ontologies/dora/shacl-rules.ttl`

## Sanctions

Régulateurs nationaux : ACPR (FR banques + assurances), AMF (FR investissement). Amendes jusqu'à **2% CA mondial** ou montant fixé selon RTS sectoriels. Responsabilité personnelle dirigeants possible.

## Why this matters for our trajectory A

DORA touche **toutes les fintechs et néobanques** sur lesquelles nos personae financières (cf. `fr-consumer-finance-perso` du projet précédent — pour mémoire) sont actives. Le secteur fin-tech mid-market (institutions de paiement, courtiers, gestionnaires alternatifs petit format) est une cible secondaire pour la trajectoire A après ISO 9001/27001.

## Audit-readiness extras

`A_DORA_01-04` :
- ICT risk management framework signé conseil
- Classification incidents documentée et testée
- TLPT plan triennal présent (si applicable)
- Registre fournisseurs ICT à jour avec clauses Art. 30
