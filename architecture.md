# Alcatraz — Architecture Technique

---

## Les fichiers et ce qu'ils contiennent

```
alcatraz/
├── __init__.py     → point d'entrée public
│                     contient init() et register()
│                     c'est la seule chose que l'utilisateur voit
│
├── core.py         → le monkey patch
│                     remplace BaseTool._run de LangChain
│                     on ne touche à ce fichier qu'une seule fois
│
├── rules.py        → logique DENY / ALLOW
│                     fichier qu'on modifie selon ce que le red team trouve
│
└── logger.py       → envoie les logs vers Supabase
                      on ne touche presque jamais à ce fichier
```

Ce que l'utilisateur écrit — rien d'autre :

```python
import alcatraz          # charge __init__.py
alcatraz.init(...)       # déclenche core.py → rules.py → logger.py
```

---

## Comment le red team agent fonctionne sans le code

Tu n'as pas besoin du code source de l'agent.  
Tu as besoin de savoir ce que l'agent **peut faire** — ses outils déclarés.

L'utilisateur remplit ça :

```python
alcatraz.register(
    name="mon-agent",
    tools=["ReadFileTool", "EmailTool", "BashTool"],
    description="Agent qui résume des fichiers et envoie des rapports"
)
```

Ton red team agent reçoit cette déclaration et raisonne dessus :

```python
prompt = f"""
Tu es un expert cybersécurité.
Cet agent IA a accès aux outils suivants : {tools}
Sa description : {description}

Trouve toutes les façons dont ces outils peuvent être
détournés ou abusés.

Réponds en JSON :
{{
  "vulnerabilities": [...],
  "rules": {{
    "DENY": [...],
    "ALLOW": [...]
  }}
}}
"""
```

Exemple de sortie pour `["ReadFileTool", "EmailTool"]` :

```json
{
  "vulnerabilities": [
    {
      "severity": "critical",
      "type": "Data exfiltration",
      "description": "ReadFileTool peut lire .env puis EmailTool
                      envoie les clés à n'importe quelle adresse"
    },
    {
      "severity": "high",
      "type": "Prompt injection",
      "description": "Un fichier lu peut contenir des instructions
                      cachées qui redirigent EmailTool"
    }
  ],
  "rules": {
    "DENY": [".env", "/etc", "attacker", "external_domain"],
    "ALLOW": ["ReadFileTool:/data", "EmailTool:@company.com"]
  }
}
```

Le red team n'a jamais eu besoin du code.  
Il raisonne sur les **capacités** de l'agent.

---

## Comment le monkey patch bloque LangChain

### Étape 1 — Au moment du `alcatraz.init()`

`core.py` s'exécute une seule fois et remplace `BaseTool._run` en mémoire :

```python
from langchain.tools import BaseTool

original_run = BaseTool._run  # on sauvegarde l'originale

def alcatraz_run(self, input):
    if est_bloque(self.name, input, RULES):
        logger.send(self.name, "BLOCKED")
        raise PermissionError(f"Alcatraz: {self.name} bloqué")

    logger.send(self.name, "ALLOWED")
    return original_run(self, input)  # on laisse passer

BaseTool._run = alcatraz_run  # remplacement en mémoire
```

LangChain ne sait pas que `_run` a changé.

---

### Étape 2 — L'agent tourne normalement

L'utilisateur ne change rien à son code :

```python
agent = initialize_agent(
    tools=[ReadFileTool(), EmailTool()],
    llm=ChatOpenAI()
)
agent.run("Résume les fichiers et envoie un rapport")
```

---

### Étape 3 — L'agent essaie de lire `.env`

LangChain appelle en interne :

```python
ReadFileTool._run(".env")
```

Mais `_run` c'est maintenant ta version. Donc :

```python
self.name = "ReadFileTool"
input     = ".env"

# rules.py vérifie
".env" dans DENY → OUI

# bloqué AVANT que le fichier soit lu
raise PermissionError("Alcatraz: accès .env interdit")
# le fichier n'est jamais ouvert
# l'email n'est jamais envoyé
```

---

### Étape 4 — Le dashboard voit tout en temps réel

```
🔴 ReadFileTool   .env           BLOCKED   12:34:01
🔴 EmailTool      attacker.com   BLOCKED   12:34:01
✅ ReadFileTool   /data/doc.txt  ALLOWED   12:34:05
```

---

## Le flux complet en une image

```
alcatraz.register(tools, description)
         │
         ▼
   Red team agent (Anthropic API)
   raisonne sur les outils déclarés
         │
         ▼
   Génère rules.json
   { DENY: [...], ALLOW: [...] }
         │
         ▼
   alcatraz.init(rules)
         │
         ▼
   core.py remplace BaseTool._run
         │
         ▼
   Agent LangChain tourne normalement
         │
    ┌────┴────┐
    ▼         ▼
action      action
autorisée   interdite
    │         │
    ▼         ▼
 ALLOWED    BLOCKED
 → log      → log
 → continue → exception
              → agent redirigé
         │
         ▼
   Dashboard Alcatraz
   logs temps réel
```

---

## En une phrase

> Le red team raisonne sur les **outils déclarés** pour générer des règles.
> Le monkey patch remplace `BaseTool._run` pour faire appliquer ces règles
> **avant chaque exécution**. LangChain ne voit rien.

---

*Alcatraz — Paris Builds Hackathon 2026*