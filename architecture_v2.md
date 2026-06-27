# Proposition d'évolution de l'architecture du SDK Alcatraz

> **Objectif :** faire évoluer Alcatraz d'un simple bloqueur de tool calls vers une plateforme de sécurité couvrant l'ensemble du cycle de vie d'un agent IA.

---

# Pourquoi changer l'architecture actuelle ?

L'architecture actuelle est parfaitement adaptée pour un hackathon :

- simple à comprendre,
- rapide à développer,
- démonstration efficace.

Elle repose sur l'idée suivante :

```text
LLM
    ↓
tool call
    ↓
Alcatraz vérifie
    ↓
ALLOWED / BLOCKED
```

Cependant, cette approche ne protège qu'une partie du pipeline.

Or un agent IA peut être attaqué **avant**, **pendant** et **après** l'exécution des tools.

---

# Les 4 points d'attaque d'un agent IA

```text
Utilisateur
      │
      ▼
Prompt envoyé au LLM
      │
      ▼
LLM
      │
      ▼
Le LLM choisit un tool
      │
      ▼
Le framework exécute le tool
      │
      ▼
Le tool renvoie un résultat
      │
      ▼
Le résultat est renvoyé au LLM
      │
      ▼
Réponse finale
```

## 1. Prompt → LLM

**Attaque :** Prompt Injection.

**Protection :**
- analyse du prompt
- séparation instructions / données
- filtrage des contenus dangereux

## 2. Réponse du LLM

**Attaque :** le LLM demande un tool dangereux (`BashTool`, etc.).

**Protection :**
- validation des tool calls
- application des politiques
- blocage des outils interdits

## 3. Exécution du tool

**Attaque :** arguments dangereux (`FileReadTool(".env")`, `FileWriteTool("/etc/passwd")`).

**Protection :**
- validation des arguments
- sandbox
- contrôle des chemins, URLs et commandes

## 4. Retour du tool

**Attaque :** Indirect Prompt Injection.

**Protection :**
- nettoyer les sorties des tools
- encapsuler les documents externes
- empêcher qu'un document soit interprété comme une instruction

---

# Nouvelle architecture proposée

```text
alcatraz/

│
├── __init__.py
├── config.py
├── runtime.py
│
├── middleware/
│   ├── prompt_guard.py
│   ├── llm_guard.py
│   ├── tool_guard.py
│   └── output_guard.py
│
├── policies/
│   ├── filesystem.py
│   ├── network.py
│   ├── secrets.py
│   ├── tools.py
│   └── rate_limit.py
│
├── integrations/
│   ├── openai.py
│   ├── anthropic.py
│   ├── crewai.py
│   └── langgraph.py
│
├── scanners/
│   ├── redteam.py
│   └── static_analysis.py
│
├── logging/
│   ├── logger.py
│   └── telemetry.py
│
└── utils/
```

# Changements par rapport à l'architecture actuelle

| Architecture actuelle | Nouvelle architecture |
|-----------------------|-----------------------|
| Protection des tool calls | Protection de tout le pipeline |
| `core.py` contient la majorité de la logique | `runtime.py` orchestre uniquement les composants |
| `rules.py` centralise toutes les règles | Politiques spécialisées (`filesystem`, `network`, `tools`, etc.) |
| OpenAI / Anthropic uniquement | Intégrations indépendantes (OpenAI, Anthropic, CrewAI, LangGraph...) |
| Validation du nom du tool | Validation du prompt, des tool calls, des arguments et des sorties |
| Logger unique | Logging et télémétrie séparés |

# Avantages

- meilleure séparation des responsabilités
- architecture modulaire
- extensible à de nouveaux frameworks
- couverture complète des principales surfaces d'attaque
- plus proche d'une architecture de production que d'un prototype de hackathon
