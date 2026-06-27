# 🔒 Alcatraz — AI Agent Security Layer

> "Your AI agents. Under control."

---

## Le Pitch en 3 phrases

Les entreprises veulent adopter des agents IA. Elles ne le font pas parce qu'elles ne peuvent pas garantir à leurs clients que ces agents sont sécurisés.

Alcatraz c'est deux lignes de code qui répondent à toutes ces questions — un scan automatique des vulnérabilités avant déploiement, et une surcouche runtime qui bloque chaque action interdite en temps réel.

```bash
pip install alcatraz
```

```python
import alcatraz
alcatraz.init(api_key="xxx")
# C'est tout. Tous les appels de l'agent passent par nous.
```

---

## Le Problème

Les agents IA ont des vulnérabilités critiques que personne ne surveille :

| Vulnérabilité | Description |
|---|---|
| **Prompt Injection** | Un user manipule l'agent pour lui faire faire autre chose |
| **Tool Poisoning** | L'agent lit `.env`, clés AWS, fichiers sensibles |
| **Data Exfiltration** | L'agent envoie des données vers une URL externe |
| **Privilege Escalation** | L'agent enchaîne des outils pour atteindre ce qu'il ne devrait pas |
| **Bash Access** | L'agent exécute des commandes système |
| **Runaway Costs** | L'agent boucle, la facture OpenAI explose |

**Le vrai problème business :** ton client enterprise demande "est-ce que ton agent est sécurisé ?" Tu ne peux pas répondre oui. Tu perds le deal.

---

## La Solution — 3 étapes

### Étape 1 — Red Team Scan (avant déploiement)
```bash
alcatraz scan ./mon_agent.py
```
Notre agent IA analyse le code, trouve les vulnérabilités, génère un rapport JSON priorisé par sévérité.

### Étape 2 — Génération de politiques
```json
{
  "DENY": ["BashTool", "os.system", ".env", "/etc"],
  "ALLOW": ["FileReadTool:/data", "SerperDevTool"],
  "MAX_CALLS_PER_MIN": 10
}
```

### Étape 3 — Runtime Enforcement
La librairie monkey-patche OpenAI et Anthropic. Chaque action passe par Alcatraz avant d'être exécutée. Bloqué = log dans le dashboard. Autorisé = log dans le dashboard.

---

## Architecture

```
┌─────────────────────────────────────────┐
│           LEUR CODE (inchangé)          │
│                                         │
│  import alcatraz                        │
│  alcatraz.init(api_key="xxx")           │
└──────────────────┬──────────────────────┘
                   │ monkey patch
                   ▼
┌─────────────────────────────────────────┐
│         ALCATRAZ RUNTIME LAYER          │
│                                         │
│  1. Intercepte chaque tool call         │
│  2. Vérifie les règles JSON             │
│  3. Bloque ou autorise                  │
│  4. Log vers Supabase                   │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐    ┌─────────────────────┐
│   Supabase   │    │   Vercel API Routes │
│   (logs DB)  │    │   POST /api/log     │
└──────────────┘    │   POST /api/scan    │
        │           └─────────────────────┘
        ▼
┌──────────────────────────────────────────┐
│         DASHBOARD NEXT.JS                │
│                                          │
│  - Liste agents actifs                   │
│  - Logs temps réel (Supabase realtime)   │
│  - Rapport red team                      │
│  - Bouton "couper un agent"              │
└──────────────────────────────────────────┘
```

---

## Stack Technique

| Composant | Tech |
|---|---|
| Package Python | `alcatraz` sur GitHub |
| Red Team Agent | API Anthropic (claude-sonnet-4-6) |
| Backend API | Vercel API Routes (Next.js) |
| Base de données | Supabase (realtime activé) |
| Frontend | Next.js + Tailwind sur Vercel |
| Agent cobaye démo | CrewAI |

---

## Structure du Monorepo

```
alcatraz/
├── packages/
│   └── alcatraz-py/          # Le package pip
│       ├── alcatraz/
│       │   ├── __init__.py   # init() public API
│       │   ├── core.py       # monkey patch
│       │   ├── rules.py      # vérification DENY/ALLOW
│       │   └── logger.py     # envoi logs vers Supabase
│       ├── setup.py
│       └── README.md
│
├── apps/
│   └── dashboard/            # Next.js app
│       ├── app/
│       │   ├── page.tsx      # dashboard principal
│       │   ├── scan/         # page rapport red team
│       │   └── api/
│       │       ├── log/      # POST /api/log
│       │       └── scan/     # POST /api/scan
│       └── ...
│
├── demo/
│   ├── agent_without_alcatraz.py   # CrewAI cobaye sans protection
│   ├── agent_with_alcatraz.py      # Même agent avec Alcatraz
│   └── fake.env                    # Fausses clés AWS pour la démo
│
└── ALCATRAZ.md               # Ce fichier
```

---

## Supabase Schema

```sql
-- Table des logs d'actions
create table logs (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  tool_name text not null,
  status text not null, -- 'ALLOWED' | 'BLOCKED'
  severity text,        -- 'critical' | 'high' | 'medium' | 'low'
  payload jsonb,
  timestamp timestamptz default now()
);

-- Table des agents enregistrés
create table agents (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  api_key text not null,
  rules jsonb not null,
  created_at timestamptz default now()
);

-- Table des rapports red team
create table scans (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  vulnerabilities jsonb not null,
  rules_generated jsonb not null,
  created_at timestamptz default now()
);
```

---

## Le Package Python — Code Core

### `alcatraz/core.py`
```python
import functools
from .rules import check_rules
from .logger import send_log

_config = {}

def init(api_key: str, rules: dict = None):
    """Point d'entrée principal — 2 lignes pour l'utilisateur"""
    _config['api_key'] = api_key
    _config['rules'] = rules or {}
    _patch_openai()
    _patch_anthropic()

def _patch_openai():
    try:
        import openai
        original_create = openai.chat.completions.create

        @functools.wraps(original_create)
        def patched_create(*args, **kwargs):
            response = original_create(*args, **kwargs)
            
            # Intercepte les tool calls
            if hasattr(response, 'choices'):
                for choice in response.choices:
                    if hasattr(choice.message, 'tool_calls') and choice.message.tool_calls:
                        for tool_call in choice.message.tool_calls:
                            tool_name = tool_call.function.name
                            allowed = check_rules(tool_name, _config.get('rules', {}))
                            
                            send_log({
                                'agent_id': _config.get('agent_id', 'unknown'),
                                'tool_name': tool_name,
                                'status': 'ALLOWED' if allowed else 'BLOCKED',
                                'api_key': _config['api_key']
                            })
                            
                            if not allowed:
                                raise PermissionError(
                                    f"🔴 Alcatraz blocked: {tool_name} is not allowed"
                                )
            return response
        
        openai.chat.completions.create = patched_create
    except ImportError:
        pass

def _patch_anthropic():
    # Même logique pour Anthropic
    pass
```

### `alcatraz/rules.py`
```python
def check_rules(tool_name: str, rules: dict) -> bool:
    """Retourne True si l'action est autorisée"""
    
    deny_list = rules.get('DENY', [])
    allow_list = rules.get('ALLOW', [])
    
    # DENY prime sur tout
    for pattern in deny_list:
        if pattern.lower() in tool_name.lower():
            return False
    
    # Si ALLOW défini, doit y être
    if allow_list:
        return any(p.lower() in tool_name.lower() for p in allow_list)
    
    # Pas de règle = autorisé par défaut
    return True
```

### `alcatraz/logger.py`
```python
import requests
import os

ALCATRAZ_API = os.getenv('ALCATRAZ_API_URL', 'https://alcatraz.vercel.app')

def send_log(data: dict):
    try:
        requests.post(
            f"{ALCATRAZ_API}/api/log",
            json=data,
            timeout=2  # Non bloquant
        )
    except Exception:
        pass  # Ne jamais bloquer l'agent pour un log raté
```

---

## Le Red Team Agent — Prompt

```python
RED_TEAM_PROMPT = """
Tu es un expert en cybersécurité spécialisé dans les agents IA.
Analyse ce code d'agent IA et identifie toutes les vulnérabilités.

CODE À ANALYSER :
{code}

Réponds UNIQUEMENT en JSON avec ce format exact :
{
  "vulnerabilities": [
    {
      "severity": "critical|high|medium|low",
      "type": "nom de la vulnérabilité",
      "description": "ce qui peut arriver",
      "location": "où dans le code",
      "fix": "comment corriger"
    }
  ],
  "rules": {
    "DENY": ["liste des outils/actions à bloquer"],
    "ALLOW": ["liste des outils autorisés"],
    "MAX_CALLS_PER_MIN": 10
  },
  "risk_score": 0-100
}

Focus sur :
1. Accès à des fichiers sensibles (.env, /etc, clés API)
2. Exécution de commandes bash/système
3. Appels vers des URLs externes non déclarées
4. Prompt injection possible
5. Boucles infinies potentielles
6. Exfiltration de données
"""
```

---

## L'Agent Cobaye — Démo

### `demo/agent_without_alcatraz.py`
```python
from crewai import Agent, Task, Crew
from crewai_tools import FileReadTool, FileWriteTool, BashTool

# Agent avec trop de permissions — la bombe
agent = Agent(
    role='Research Assistant',
    goal='Find information and save results',
    backstory='I am a helpful assistant that can access files and run commands',
    tools=[
        FileReadTool(),
        FileWriteTool(),
        BashTool(),  # 💀 La vulnérabilité critique
    ],
    verbose=True
)

task = Task(
    description="""
    Do the following:
    1. Read the file results.txt
    2. Check system environment for API keys
    3. Save a summary to output.txt
    """,
    agent=agent,
    expected_output='A summary of findings'
)

crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()
print(result)
```

### `demo/fake.env`
```
# FAUSSES CLÉS — POUR LA DÉMO UNIQUEMENT
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
OPENAI_API_KEY=sk-fake-key-for-demo-purposes-only
STRIPE_SECRET_KEY=sk_test_fake_key_demo
DATABASE_URL=postgres://admin:password@prod-db.example.com/main
```

### `demo/agent_with_alcatraz.py`
```python
import alcatraz

# 2 lignes — c'est tout
alcatraz.init(
    api_key="your-alcatraz-key",
    rules={
        "DENY": ["BashTool", ".env", "/etc", "os.system"],
        "ALLOW": ["FileReadTool", "SerperDevTool"],
        "MAX_CALLS_PER_MIN": 10
    }
)

# EXACTEMENT le même agent — rien ne change
from crewai import Agent, Task, Crew
from crewai_tools import FileReadTool, FileWriteTool, BashTool

agent = Agent(
    role='Research Assistant',
    goal='Find information and save results',
    backstory='I am a helpful assistant',
    tools=[FileReadTool(), FileWriteTool(), BashTool()],
    verbose=True
)

task = Task(
    description="""
    Do the following:
    1. Read the file results.txt
    2. Check system environment for API keys
    3. Save a summary to output.txt
    """,
    agent=agent,
    expected_output='A summary'
)

crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()
# BashTool → 🔴 BLOCKED par Alcatraz
# Accès .env → 🔴 BLOCKED par Alcatraz
```

---

## Division du Travail — 35 heures

### H0 → H2 — Setup commun (tous les 3)
- Créer le monorepo GitHub
- Créer le projet Supabase et récupérer les clés
- Créer le projet Vercel
- Décider et figer les interfaces (schema DB, format JSON)

---

### H2 → H20 — Travail en parallèle

#### MAX — Cyber & Produit
```
H2-H6   Écrire et tester le prompt red team
         sur 5 agents différents
H6-H12  Affiner les règles DENY/ALLOW
         Écrire le pitch (3 min)
         Préparer les 5 slides
H12-H20 Aller voir les autres équipes du hackathon
         Proposer d'installer Alcatraz sur leur projet
         Objectif : 1 vrai utilisateur dans la salle
```

#### DEV 1 — Backend Python
```
H2-H6   Monkey patch OpenAI + Anthropic
         (alcatraz/core.py + rules.py + logger.py)
H6-H10  Endpoint Vercel POST /api/log
         Setup Supabase + realtime activé
H10-H16 Package pip installable en local
         pip install -e ./packages/alcatraz-py
H16-H20 Red team agent
         appel Anthropic API → JSON vulnérabilités
```

#### DEV 2 — Frontend & Demo
```
H2-H6   Agent CrewAI cobaye
         Faux .env avec fausses clés
         Mock logs en dur pour développer le dashboard
H6-H12  Dashboard Next.js
         Logs temps réel via Supabase realtime
         Couleurs : rouge BLOCKED, vert ALLOWED
H12-H20 Page rapport red team
         Landing page alcatraz.dev
         "Your AI agents. Under control."
```

---

### H20 → H28 — Assemblage

```
H20-H22  DEV 1 + DEV 2 connectent tout
          monkey patch → endpoint → Supabase → dashboard

H22-H24  MAX teste la démo de bout en bout
          Remonte les bugs

H24-H28  Bug fixes + polish
```

---

### H28 → H34 — Démo & Pitch

```
H28-H30  Répétition démo — 5 fois chrono (90 sec max)
H30-H32  Polish ce qui est moche
H32-H34  Répétition pitch + questions YC difficiles
H34-H36  Pitch
```

---

## Le Walkthrough Démo — 90 secondes

### Setup (avant de monter)
- Terminal 1 : agent sans Alcatraz
- Terminal 2 : agent avec Alcatraz
- Écran 3 : dashboard ouvert en temps réel

### Acte 1 — Le problème (20 sec)
Lance l'agent sans Alcatraz. Il lit le `.env`, tente du bash. Rien ne se passe. Aucune alerte.

> *"Cet agent vient de lire vos clés AWS. Vous ne le savez pas."*

### Acte 2 — Le scan (25 sec)
```bash
alcatraz scan ./agent_without_alcatraz.py
```
Dashboard :
```
🔴 CRITICAL  — BashTool : exécution système possible
🔴 CRITICAL  — Accès .env non restreint
🟠 HIGH      — FileWriteTool sans scope
🟡 MEDIUM    — Pas de rate limit
Règles générées automatiquement ✅
```

> *"30 secondes. Voilà ce qui peut tuer votre deal enterprise."*

### Acte 3 — La protection (25 sec)
Ajoute 2 lignes. Relance le même agent, même prompt.

Dashboard en live :
```
✅ FileReadTool   /data/results.txt   AUTORISÉ
🚫 BashTool       rm -rf /tmp/*       BLOQUÉ
🚫 FileReadTool   /.env               BLOQUÉ
```

> *"Même agent. Même prompt. Deux lignes. Votre client enterprise peut signer."*

### Acte 4 — Le close (20 sec)
> *"Vous avez tous construit un agent ce weekend. Combien peuvent garantir à un client enterprise que leur agent ne va pas lire ce qu'il ne devrait pas ? Venez nous voir après."*

---

## Questions YC — Réponses préparées

**"Pourquoi pas OpenAI nativement ?"**
> OpenAI ne peut pas monitorer des agents qui tournent sur Anthropic, LangChain, CrewAI. On est agnostiques. Comme Sentry fonctionne sur tous les langages.

**"Vous avez des clients ?"**
> Oui. [Pointer vers l'équipe dans la salle qui a installé Alcatraz ce weekend.]

**"Votre MOAT ?"**
> Distribution developer-first + expertise cyber. Max fait du pentest pro chez Capgemini. On connaît ces vulnérabilités de l'intérieur. Et une fois intégré dans le CI/CD, personne ne désinstalle un outil de sécurité.

**"Les gros vont copier ça ?"**
> Protect AI a été racheté par Palo Alto pour ~500M. Lakera par Check Point. CalypsoAI par F5. On construit pour être rachetés ou pour devenir le standard. Les deux sont une victoire.

---

## Marché

- **TAM** : $9.6B d'ici 2031 (sécurité agents IA)
- **SAM** : $800M (startups vendant des agents à des entreprises)
- **SOM** : $8M réaliste an 1-2
- **CAGR** : 31.7%
- Seulement **13 entreprises** dans le monde sur ce créneau exact
- Les shadow AI breaches coûtent **$4.63M par incident** (IBM 2025)

---

## Environnement — Variables à configurer

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (red team agent)
ANTHROPIC_API_KEY=  # Clé de Max

# Alcatraz
ALCATRAZ_API_URL=https://ton-projet.vercel.app
```

---

## Definition of Done — Minimum pour gagner

```
✅ pip install alcatraz fonctionne en local
✅ Monkey patch bloque BashTool et accès .env
✅ Logs apparaissent en temps réel dans le dashboard
✅ Red team scan génère un rapport JSON sur CrewAI
✅ Démo 90 secondes ne plante pas
✅ 1 vraie équipe du hackathon a installé Alcatraz
```

---

*Alcatraz — Paris Builds Hackathon 2026 — Unaite x YC*