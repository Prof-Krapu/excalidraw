<a href="https://excalidraw.com/" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" alt="Excalidraw" srcset="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2_dark.png" />
    <img alt="Excalidraw" src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" />
  </picture>
</a>

<h4 align="center">
  <a href="https://excalidraw.com">Éditeur Excalidraw</a> |
  <a href="https://plus.excalidraw.com/blog">Blog</a> |
  <a href="https://docs.excalidraw.com">Documentation</a> |
  <a href="https://albert.api.etalab.gouv.fr">API Albert</a>
</h4>

<div align="center">
  <h2>
    Tableau blanc collaboratif open source au style dessin à la main.<br/>
    Chiffrement de bout en bout — et maintenant propulsé par l'IA française Albert. ✦
  </h2>
</div>

<br />

<p align="center">
  <a href="https://github.com/excalidraw/excalidraw/blob/master/LICENSE">
    <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-blue.svg" /></a>
  <a href="https://www.npmjs.com/package/@excalidraw/excalidraw">
    <img alt="npm téléchargements/mois" src="https://img.shields.io/npm/dm/@excalidraw/excalidraw" /></a>
  <a href="https://albert.api.etalab.gouv.fr">
    <img alt="Propulsé par Albert API" src="https://img.shields.io/badge/IA-Albert%20API-5B67D8?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyTDE1LjA5IDguMjZMMjIgOS4yN0wxNyAxNC4xNEwxOC4xOCAyMS4wMkwxMiAxNy43N0w1LjgyIDIxLjAyTDcgMTQuMTRMMiA5LjI3TDguOTEgOC4yNkwxMiAyWiIvPjwvc3ZnPg==" /></a>
  <a href="https://discord.gg/UexuTaE">
    <img alt="Chat Discord" src="https://img.shields.io/discord/723672430744174682?color=738ad6&label=Discord&logo=discord&logoColor=ffffff" /></a>
</p>

---

> **✦ Fork enrichi avec des fonctionnalités IA** — Ce dépôt est un fork d'[Excalidraw](https://github.com/excalidraw/excalidraw) qui intègre l'**API Albert** (service IA public français d'Étalab), le rendu **LaTeX via KaTeX**, et un **assistant IA contextuel** directement dans l'interface.

---

## 🆕 Nouveautés IA de ce fork

### ✦ Intégration Albert API

[Albert](https://albert.api.etalab.gouv.fr) est le service d'IA du gouvernement français (Étalab), compatible avec le format OpenAI. Ce fork s'y connecte directement depuis le navigateur, sans backend intermédiaire.

| Fonctionnalité | Description |
|---|---|
| **Texte → Diagramme** | Décrivez un diagramme en français, l'IA génère le Mermaid |
| **Formule LaTeX** | Décrivez une formule, l'IA génère le code KaTeX |
| **Assistant contextuel** | L'IA analyse le contenu de votre canvas et répond à vos questions |
| **Streaming temps réel** | Réponses en flux continu avec indicateur de génération |

### ∑ LaTeX / KaTeX

Nouvel onglet **LaTeX** dans le dialogue Text-to-Diagram :

- Éditeur avec **aperçu en temps réel** (KaTeX)
- **Génération IA** : décrire la formule → Albert génère le code
- **6 exemples** prêts à l'emploi (intégrale, Euler, Fourier, matrice…)
- Mode **affichage** (grande formule centrée) ou **inline**
- Export direct comme **image** dans le canvas (`Ctrl+Enter`)

```latex
% Exemples de formules supportées
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}

e^{i\pi} + 1 = 0

\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x)e^{-2\pi i x\xi}\,dx
```

### 🤖 Panneau Assistant IA (sidebar)

Nouvel onglet **⭐** dans la barre latérale :

- **3 modes** : Assistant général · Diagramme Mermaid · Formule LaTeX
- **Contextuel** : injecte automatiquement le texte du canvas
- **6 actions rapides** : flowchart, séquence API, mindmap, intégrales…
- Boutons d'action intégrés : *↗ Insérer le diagramme*, *∑ Copier LaTeX*
- Historique multi-tours (6 derniers messages)
- Bouton **Stop** pour interrompre la génération

### 📊 Mermaid amélioré

- Génération via Albert API (plus de backend requis)
- Auto-correction des erreurs de syntaxe (BFS, profondeur 4)
- Support de tous les types : `flowchart`, `sequenceDiagram`, `classDiagram`, `mindmap`, `gitGraph`, `gantt`, `pie`, `timeline`, `xychart-beta`…

---

## 🚀 Installation rapide

### Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | ≥ 18 |
| Yarn | ≥ 1.22 |
| Git | toute version récente |

> **Clé API Albert (optionnelle)** — Sans clé, l'application fonctionne normalement mais les fonctions IA sont désactivées.
> Obtenez une clé gratuite sur [albert.api.etalab.gouv.fr](https://albert.api.etalab.gouv.fr).

---

### Option 1 — Script automatique (recommandé)

```bash
# Cloner et lancer en une seule commande
curl -fsSL https://raw.githubusercontent.com/Prof-Krapu/excalidraw/claude/add-ai-features-excalidraw-mfI0J/install.sh | bash
```

Ou en téléchargeant d'abord le script :

```bash
git clone -b claude/add-ai-features-excalidraw-mfI0J \
  https://github.com/Prof-Krapu/excalidraw.git excalidraw-ai
cd excalidraw-ai

# Mode développement (demande la clé Albert de façon sécurisée)
bash install.sh

# Ou en passant la clé directement
ALBERT_API_KEY=votre_clé bash install.sh dev
```

Le script s'occupe de tout :
1. Vérifie les prérequis (Node, Yarn, Git)
2. Installe les dépendances
3. Crée `.env.local` (saisie de la clé API **masquée**)
4. Vérifie la compilation TypeScript
5. Lance le serveur de développement → **http://localhost:3001**

---

### Option 2 — Makefile (développeurs)

```bash
git clone -b claude/add-ai-features-excalidraw-mfI0J \
  https://github.com/Prof-Krapu/excalidraw.git excalidraw-ai
cd excalidraw-ai

make install          # Installe les dépendances + crée .env.local
make dev              # Serveur de développement
make prod             # Build production + serveur HTTP
make docker           # Docker Compose
```

Toutes les commandes disponibles :

```bash
make help
```

---

### Option 3 — Docker (production)

```bash
git clone -b claude/add-ai-features-excalidraw-mfI0J \
  https://github.com/Prof-Krapu/excalidraw.git excalidraw-ai
cd excalidraw-ai

ALBERT_API_KEY=votre_clé \
  docker compose -f docker-compose.ai.yml up --build -d

# L'application est disponible sur http://localhost:3000
```

---

### Option 4 — Manuel (pas à pas)

```bash
# 1. Cloner la branche IA
git clone -b claude/add-ai-features-excalidraw-mfI0J \
  https://github.com/Prof-Krapu/excalidraw.git excalidraw-ai
cd excalidraw-ai

# 2. Installer les dépendances
yarn install

# 3. Configurer la clé Albert API
cat > .env.local << 'EOF'
VITE_APP_ALBERT_API_KEY=votre_clé_ici
VITE_APP_ALBERT_API_BASE=https://albert.api.etalab.gouv.fr/v1
VITE_APP_ALBERT_MODEL=AgentPublic/llama3-instruct-8b
VITE_APP_PORT=3001
EOF

# 4. Lancer le serveur de développement
yarn start
# → http://localhost:3001
```

---

## ⚙️ Configuration

Toute la configuration se fait dans `.env.local` (jamais versionné) :

```bash
# ─── Albert API ───────────────────────────────────────────────
# Clé API — https://albert.api.etalab.gouv.fr
VITE_APP_ALBERT_API_KEY=votre_clé_ici

# URL de base (Albert officiel par défaut)
VITE_APP_ALBERT_API_BASE=https://albert.api.etalab.gouv.fr/v1

# Modèle LLM (valeur par défaut recommandée)
VITE_APP_ALBERT_MODEL=AgentPublic/llama3-instruct-8b

# ─── Serveur de développement ─────────────────────────────────
VITE_APP_PORT=3001
```

> **Compatible avec tout LLM OpenAI-compatible** — Vous pouvez pointer `VITE_APP_ALBERT_API_BASE` vers n'importe quelle API compatible : OpenAI, Mistral, Ollama local, vLLM…

### Vérifier la configuration

```bash
make env-check
# ou
grep ALBERT .env.local
```

---

## ✨ Fonctionnalités d'origine (Excalidraw)

- 💯&nbsp;Gratuit & open source (licence MIT)
- 🎨&nbsp;Canvas infini, style dessin à la main
- 🌓&nbsp;Mode sombre
- 📷&nbsp;Support des images
- 😀&nbsp;Bibliothèques de formes
- 🌐&nbsp;Internationalisation (i18n)
- 🖼️&nbsp;Export PNG, SVG, presse-papier
- 💾&nbsp;Format ouvert `.excalidraw` (JSON)
- ⚒️&nbsp;Outils : rectangle, cercle, losange, flèche, ligne, dessin libre, gomme…
- ➡️&nbsp;Flèches liées et étiquetées
- 🔙&nbsp;Annuler / Rétablir
- 🔍&nbsp;Zoom et déplacement
- 📡&nbsp;PWA (fonctionne hors ligne)
- 🤼&nbsp;Collaboration en temps réel
- 🔒&nbsp;Chiffrement de bout en bout
- 💾&nbsp;Sauvegarde locale automatique (navigateur)
- 🔗&nbsp;Liens partageables en lecture seule

---

## 📁 Structure du projet

```
excalidraw/
├── excalidraw-app/              Application web principale
│   ├── components/
│   │   ├── AI.tsx               ← Intégration Albert API (TTD + DiagramToCode)
│   │   ├── AIAssistantPanel.tsx ← Panneau assistant IA (sidebar) ✦ NOUVEAU
│   │   └── AppSidebar.tsx       ← Sidebar avec onglet IA ✦ MODIFIÉ
│   └── .env.local               ← Votre configuration (non versionné)
│
├── packages/excalidraw/
│   └── components/TTDDialog/
│       ├── LaTeXToExcalidraw.tsx     ← Éditeur LaTeX + KaTeX ✦ NOUVEAU
│       └── utils/
│           ├── albertApi.ts          ← Client Albert API ✦ NOUVEAU
│           └── latexToSVG.ts         ← Rendu LaTeX → image ✦ NOUVEAU
│
├── install.sh                   ← Script d'installation automatique ✦ NOUVEAU
├── Makefile                     ← Commandes développeur ✦ NOUVEAU
├── docker-compose.ai.yml        ← Docker avec Albert API ✦ NOUVEAU
└── Dockerfile                   ← Build avec ARGs Albert ✦ MODIFIÉ
```

---

## 🛠️ Commandes de développement

```bash
yarn start              # Serveur de développement
yarn build              # Build production
yarn test:typecheck     # Vérification TypeScript
yarn test:update        # Suite de tests complète
yarn fix                # Auto-fix ESLint + Prettier
```

---

## 🤝 Contribuer

- Un bug ou une idée ? [Ouvrir une issue](https://github.com/Prof-Krapu/excalidraw/issues)
- Contribuer au projet original : [guide de contribution](https://docs.excalidraw.com/docs/introduction/contributing)
- Traductions : [guide de traduction](https://docs.excalidraw.com/docs/introduction/contributing#translating)

---

## 🔗 Intégrations

- [Extension VSCode](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor)
- [Package npm](https://www.npmjs.com/package/@excalidraw/excalidraw)
- [API Albert — Documentation](https://albert.api.etalab.gouv.fr/docs)
- [KaTeX — Fonctions supportées](https://katex.org/docs/supported.html)
- [Mermaid — Syntaxe](https://mermaid.js.org/syntax/flowchart.html)

---

## 📜 Licence

[MIT](./LICENSE) — Ce fork conserve la licence MIT du projet original Excalidraw.

Les fonctionnalités IA ajoutées utilisent l'[API Albert](https://albert.api.etalab.gouv.fr), service public français distribué sous licence MIT.

---

<div align="center">
  <sub>Fork réalisé à partir d'<a href="https://github.com/excalidraw/excalidraw">Excalidraw</a> — Fonctionnalités IA par <a href="https://albert.api.etalab.gouv.fr">Albert / Étalab</a></sub>
</div>
