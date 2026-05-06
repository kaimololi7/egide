---
name: nis2-directive
description: NIS2 (Directive UE 2022/2555) reference layer — cybersecurity for essential and important entities. Loaded when target_frameworks includes NIS2. Operational pointer to `ontologies/nis2/`.
---

# NIS2 — Operational guidance

NIS2 = Directive (UE) 2022/2555 du Parlement européen et du Conseil concernant des mesures destinées à assurer un niveau élevé commun de cybersécurité dans l'ensemble de l'Union. Transposition deadline: 17 octobre 2024. Apply to **essential entities** (services critiques) and **important entities** (autres secteurs régulés).

## Scope determination

```
Si organisation ∈ secteurs Annexe I (énergie, transport, santé, eau, finance, infra digitale, admin pub, espace) ET (taille moyenne ou grande) → essential entity
Si organisation ∈ secteurs Annexe II (postal, déchets, chimie, alimentaire, manufacturing, recherche, fournisseurs digitaux) ET (taille moyenne ou grande) → important entity
Sinon → hors NIS2 (mais bonnes pratiques)
```

Taille moyenne = ≥50 salariés OU ≥10M€ CA (UE recommandation 2003/361/CE).

## Articles clés à modéliser

### Article 21 — Mesures de gestion des risques (10 obligations)
Texte de la directive : « Les entités essentielles et importantes prennent les mesures techniques, opérationnelles et organisationnelles appropriées et proportionnées pour gérer les risques [...]. »

10 catégories d'obligations (Article 21 §2) :
- (a) Politiques relatives à l'analyse des risques et à la sécurité des systèmes d'information
- (b) Gestion des incidents (prévention, détection, réponse)
- (c) Continuité des activités (sauvegardes, gestion de crise)
- (d) Sécurité de la chaîne d'approvisionnement
- (e) Sécurité dans l'acquisition, le développement et la maintenance
- (f) Politiques et procédures pour évaluer l'efficacité des mesures
- (g) Pratiques de cyberhygiène et formation
- (h) Politiques et procédures relatives à l'utilisation de la cryptographie
- (i) Sécurité des ressources humaines, contrôle d'accès, gestion des actifs
- (j) Authentification multifacteur, communications sécurisées, plans d'urgence

### Article 23 — Obligations de notification d'incidents

Timeline strict (NON-NÉGOCIABLE) :
- **24h** : alerte précoce au CSIRT national (FR : ANSSI / CSIRT-FR)
- **72h** : notification d'incident détaillée
- **1 mois** : rapport final
- **Communication aux destinataires** des services si l'incident affecte la prestation

### Article 32 — Sanctions
Amendes administratives jusqu'à 10M€ ou 2% CA mondial (essential entities), 7M€ ou 1.4% (important).

## Cartographie obligations → pyramide

| Article | Pyramid impact |
|---|---|
| 21.2.a Risk policies | Policy N1 + Procedure N2 + Risk Register OSCAL |
| 21.2.b Incident management | Pyramide complète "Incident Management" obligatoire |
| 21.2.c Business continuity | Pyramide BCM + DORA chap. 4 si fin services |
| 21.2.d Supply chain security | Procédure dédiée + KPIs sur fournisseurs critiques |
| 21.2.e Secure SDLC | Procédure dev sécurisé + tests + déploiement |
| 21.2.f Effectiveness assessment | KPI N4 + audit cycle |
| 21.2.g Cyber hygiene + training | Awareness program documenté |
| 21.2.h Cryptography | Policy crypto + key management |
| 21.2.i Access control | IAM Policy + Procedure |
| 21.2.j MFA + secure comms | Tech standards declared |
| Art. 23 Reporting | Dedicated procedure with 24h/72h/1mo timer events |

## Trigger pour les ETI françaises

NIS2 transposition FR via **Loi REIA** (Résilience des Entités Importantes et Activités Critiques) entrée en vigueur 2024-2025. ETI manufacturing, alimentaire, logistique potentiellement concernées (Annexe II).

ANSSI publie en 2025-2026 les guides d'application sectoriels — ces guides deviennent référentiels d'audit en pratique.

## Cross-framework

| NIS2 | Mappable vers |
|---|---|
| 21.2.b + Art. 23 | ITIL Incident Mgmt + ISO 27001 A.5.24 |
| 21.2.c | DORA Chap. 4 + ISO 22301 |
| 21.2.d | ISO 27001 A.5.19-23 (supplier) |
| 21.2.e | ISO 27001 A.8.25-28 (secure dev) |
| 21.2.h | ISO 27001 A.8.24 |
| 21.2.i | ISO 27001 A.5.15-18 (access) |
| 21.2.j | ISO 27001 A.8.5 + A.8.6 |

## Reference paths

- `ontologies/nis2/articles.ttl` — Articles 1-46 + Annexes I, II
- `ontologies/nis2/shacl-rules.ttl`
- `ontologies/nis2/version.json` — directive version + transposition FR

## Audit-readiness extras

`A_NIS2_01-04` (cf. `audit-readiness-checker`) :
- 21 mesures couvertes
- Reporting timelines procéduralement implémentées (test obligatoire)
- Supply chain risk register
- Management body accountability documentée (sanctions personnelles si non-respect)
