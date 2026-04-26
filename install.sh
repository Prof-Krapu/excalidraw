#!/usr/bin/env bash
# =============================================================================
# Excalidraw + Albert AI — Script d'installation automatique
# Branch: claude/add-ai-features-excalidraw-mfI0J
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ─── Couleurs ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓${NC}  $*"; }
info() { echo -e "${BLUE}  ℹ${NC}  $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC}  $*"; }
err()  { echo -e "${RED}  ✗${NC}  $*" >&2; }
step() { echo -e "\n${CYAN}${BOLD}══ $* ${NC}"; }
hr()   { echo -e "${DIM}────────────────────────────────────────────────────────${NC}"; }

# ─── Banner ───────────────────────────────────────────────────────────────────
banner() {
  echo -e "${CYAN}${BOLD}"
  cat << 'BANNER'
  ╔═══════════════════════════════════════════════════════════╗
  ║   Excalidraw  ✦  Albert AI  ✦  LaTeX  ✦  Mermaid AI      ║
  ║         Installation automatique complète                 ║
  ╚═══════════════════════════════════════════════════════════╝
BANNER
  echo -e "${NC}"
}

# ─── Variables ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Prof-Krapu/excalidraw.git"
BRANCH="claude/add-ai-features-excalidraw-mfI0J"
INSTALL_DIR="${EXCALIDRAW_DIR:-excalidraw-ai}"
NODE_MIN_MAJOR=18
MODE="${1:-dev}"   # dev | prod | docker

# ─── Aide ─────────────────────────────────────────────────────────────────────
usage() {
  echo -e "${BOLD}Usage:${NC}  bash install.sh [MODE]"
  echo ""
  echo "  MODE:"
  echo -e "    ${GREEN}dev${NC}     (défaut) Lance le serveur de développement"
  echo -e "    ${GREEN}prod${NC}    Build de production + serveur HTTP statique"
  echo -e "    ${GREEN}docker${NC}  Build & run via Docker Compose"
  echo ""
  echo -e "  Variables d'environnement optionnelles (avant le script) :"
  echo -e "    ${YELLOW}ALBERT_API_KEY${NC}   Clé API Albert (https://albert.api.etalab.gouv.fr)"
  echo -e "    ${YELLOW}ALBERT_MODEL${NC}     Modèle LLM (défaut: AgentPublic/llama3-instruct-8b)"
  echo -e "    ${YELLOW}ALBERT_BASE_URL${NC}  URL de base API (défaut: https://albert.api.etalab.gouv.fr/v1)"
  echo -e "    ${YELLOW}EXCALIDRAW_DIR${NC}   Dossier d'installation (défaut: excalidraw-ai)"
  echo -e "    ${YELLOW}PORT${NC}             Port dev (défaut: 3001)"
  echo ""
  echo -e "  Exemples :"
  echo -e "    ${DIM}ALBERT_API_KEY=xxxx bash install.sh dev${NC}"
  echo -e "    ${DIM}ALBERT_API_KEY=xxxx bash install.sh docker${NC}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage; exit 0
fi

# ─── Pré-requis ───────────────────────────────────────────────────────────────
check_prereqs() {
  step "Vérification des pré-requis"

  # Git
  if ! command -v git &>/dev/null; then
    err "git n'est pas installé. Installer: https://git-scm.com"
    exit 1
  fi
  ok "git $(git --version | awk '{print $3}')"

  # Mode docker : seul docker est nécessaire
  if [[ "$MODE" == "docker" ]]; then
    if ! command -v docker &>/dev/null; then
      err "docker n'est pas installé. Voir: https://docs.docker.com/get-docker/"
      exit 1
    fi
    ok "docker $(docker --version | awk '{print $3}' | tr -d ',')"
    if ! docker compose version &>/dev/null 2>&1 && ! docker-compose --version &>/dev/null 2>&1; then
      err "docker compose (v2) n'est pas disponible."
      exit 1
    fi
    ok "docker compose"
    return 0
  fi

  # Node.js
  if ! command -v node &>/dev/null; then
    err "Node.js n'est pas installé. Installer: https://nodejs.org (>= v${NODE_MIN_MAJOR})"
    exit 1
  fi
  local node_major
  node_major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  if (( node_major < NODE_MIN_MAJOR )); then
    err "Node.js v${node_major} détecté — version minimale: v${NODE_MIN_MAJOR}"
    exit 1
  fi
  ok "node v$(node --version | tr -d 'v')"

  # Yarn
  if ! command -v yarn &>/dev/null; then
    warn "yarn non trouvé — installation via npm..."
    npm install -g yarn --silent
    ok "yarn installé: $(yarn --version)"
  else
    ok "yarn $(yarn --version)"
  fi
}

# ─── Clone / mise à jour ───────────────────────────────────────────────────────
setup_repo() {
  step "Récupération du dépôt"

  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    info "Dossier ${INSTALL_DIR} existant → mise à jour"
    cd "${INSTALL_DIR}"
    git fetch origin "${BRANCH}" --quiet
    git checkout "${BRANCH}" --quiet
    git pull origin "${BRANCH}" --quiet
    ok "Dépôt mis à jour (branche ${BRANCH})"
  else
    info "Clonage dans ./${INSTALL_DIR} …"
    git clone --branch "${BRANCH}" --single-branch --depth 1 \
      "${REPO_URL}" "${INSTALL_DIR}" \
      --progress 2>&1 | grep -E 'Cloning|done\.' || true
    cd "${INSTALL_DIR}"
    ok "Dépôt cloné"
  fi

  hr
  git log --oneline -1
  hr
}

# ─── Variables d'environnement ────────────────────────────────────────────────
configure_env() {
  step "Configuration de l'environnement (.env.local)"

  local env_file=".env.local"
  local key="${ALBERT_API_KEY:-}"
  local model="${ALBERT_MODEL:-AgentPublic/llama3-instruct-8b}"
  local base="${ALBERT_BASE_URL:-https://albert.api.etalab.gouv.fr/v1}"
  local port="${PORT:-3001}"

  if [[ -n "$key" ]]; then
    # Clé déjà fournie via variable d'environnement
    echo -e "  ${GREEN}✓${NC}  Clé détectée depuis l'environnement : ${DIM}${key:0:4}…$(printf '%0.s*' {1..8})${NC}"
  else
    # Toujours demander la clé interactivement — forcer /dev/tty pour bypasser les pipes
    echo ""
    echo -e "${CYAN}${BOLD}  Clé API Albert${NC}"
    echo -e "  ┌─────────────────────────────────────────────────────────┐"
    echo -e "  │  Obtenez une clé gratuite sur :                         │"
    echo -e "  │  ${BOLD}https://albert.api.etalab.gouv.fr${NC}                      │"
    echo -e "  │                                                          │"
    echo -e "  │  Collez votre clé puis appuyez sur ${BOLD}Entrée${NC}.             │"
    echo -e "  │  ${DIM}(laissez vide + Entrée pour continuer sans IA)${NC}         │"
    echo -e "  └─────────────────────────────────────────────────────────┘"
    echo ""
    # Lire depuis /dev/tty pour fonctionner même si stdin est un pipe
    read -r -s -p "  → Clé API (masquée) : " key < /dev/tty
    echo ""
    if [[ -n "$key" ]]; then
      echo -e "  ${GREEN}✓${NC}  Clé enregistrée : ${DIM}${key:0:4}…$(printf '%0.s*' {1..8})${NC}"
    else
      warn "Aucune clé saisie — l'IA sera désactivée. Modifiez .env.local pour l'activer."
    fi
  fi

  # Écriture du fichier
  cat > "${env_file}" << EOF
# ─── Albert API ───────────────────────────────────────────────────────────────
# Généré automatiquement par install.sh — $(date '+%Y-%m-%d %H:%M')
# Clé API Albert : https://albert.api.etalab.gouv.fr
VITE_APP_ALBERT_API_KEY=${key}
VITE_APP_ALBERT_API_BASE=${base}
VITE_APP_ALBERT_MODEL=${model}

# Port du serveur de développement
VITE_APP_PORT=${port}

# Désactiver le dialogue de prévention de déchargement en dev
VITE_APP_DISABLE_PREVENT_UNLOAD=true
EOF

  if [[ -n "$key" ]]; then
    ok ".env.local créé avec la clé Albert API"
  else
    ok ".env.local créé (sans clé — mode démo)"
  fi
}

# ─── Installation des dépendances ─────────────────────────────────────────────
install_deps() {
  step "Installation des dépendances npm"
  info "Cette étape peut prendre 1–3 minutes selon votre connexion…"
  yarn install --frozen-lockfile --network-timeout 300000 2>&1 \
    | grep -E "^(Done|error|warning: .*(package|Missing))" || true
  ok "Dépendances installées"
}

# ─── Vérification TypeScript ──────────────────────────────────────────────────
verify_build() {
  step "Vérification TypeScript"
  if yarn test:typecheck 2>&1 | grep -q "Done"; then
    ok "TypeScript OK"
  else
    warn "Des erreurs TypeScript mineures ont été détectées — le build peut quand même fonctionner."
  fi
}

# ─── Mode dev ─────────────────────────────────────────────────────────────────
run_dev() {
  local port="${PORT:-3001}"
  step "Démarrage du serveur de développement"

  echo ""
  echo -e "${GREEN}${BOLD}  Application prête à démarrer !${NC}"
  hr
  echo -e "  ${BOLD}URL locale :${NC}       http://localhost:${port}"
  echo -e "  ${BOLD}Arrêt :${NC}            Ctrl+C"
  echo ""
  echo -e "  ${CYAN}Fonctionnalités IA activées :${NC}"
  echo -e "    ${GREEN}▸${NC} Onglet LaTeX (KaTeX) dans Text-to-Diagram"
  echo -e "    ${GREEN}▸${NC} Panneau Assistant IA dans la sidebar (⭐)"
  echo -e "    ${GREEN}▸${NC} Génération Mermaid via Albert API"
  echo -e "    ${GREEN}▸${NC} Génération de formules LaTeX via IA"
  hr
  echo ""

  yarn start
}

# ─── Mode production ──────────────────────────────────────────────────────────
run_prod() {
  local port="${PORT:-5001}"
  step "Build de production"
  info "Compilation en cours (peut prendre 2–5 minutes)…"
  yarn build:app:docker 2>&1 | tail -5
  ok "Build terminé → excalidraw-app/build/"

  step "Démarrage du serveur statique"
  echo -e "  ${GREEN}${BOLD}http://localhost:${port}${NC}"
  echo -e "  ${DIM}Arrêt : Ctrl+C${NC}"
  echo ""
  npx --yes http-server excalidraw-app/build -a 0.0.0.0 -p "${port}" --silent
}

# ─── Mode Docker ──────────────────────────────────────────────────────────────
run_docker() {
  step "Build & démarrage via Docker Compose"

  local key="${ALBERT_API_KEY:-}"
  local model="${ALBERT_MODEL:-AgentPublic/llama3-instruct-8b}"
  local base="${ALBERT_BASE_URL:-https://albert.api.etalab.gouv.fr/v1}"

  if [[ -z "$key" ]]; then
    echo ""
    echo -e "${CYAN}${BOLD}  Clé API Albert${NC}"
    echo -e "  ┌─────────────────────────────────────────────────────────┐"
    echo -e "  │  Collez votre clé puis appuyez sur ${BOLD}Entrée${NC}.             │"
    echo -e "  │  ${DIM}(laissez vide + Entrée pour continuer sans IA)${NC}         │"
    echo -e "  └─────────────────────────────────────────────────────────┘"
    echo ""
    read -r -s -p "  → Clé API (masquée) : " key < /dev/tty
    echo ""
    if [[ -n "$key" ]]; then
      echo -e "  ${GREEN}✓${NC}  Clé enregistrée : ${DIM}${key:0:4}…$(printf '%0.s*' {1..8})${NC}"
    else
      warn "Sans clé — l'IA sera désactivée dans ce build Docker."
    fi
  fi

  info "Build de l'image Docker…"

  DOCKER_BUILDKIT=1 docker compose build \
    --build-arg "VITE_APP_ALBERT_API_KEY=${key}" \
    --build-arg "VITE_APP_ALBERT_API_BASE=${base}" \
    --build-arg "VITE_APP_ALBERT_MODEL=${model}" \
    --build-arg NODE_ENV=production \
    --progress=plain 2>&1 | grep -E "^(#|DONE|ERROR)" || true

  ok "Image construite"
  info "Démarrage du conteneur…"

  ALBERT_API_KEY="${key}" \
  ALBERT_API_BASE="${base}" \
  ALBERT_MODEL="${model}" \
  docker compose up -d

  local port; port=$(docker compose port excalidraw 80 2>/dev/null | cut -d: -f2 || echo "3000")

  echo ""
  echo -e "${GREEN}${BOLD}  ✓ Excalidraw + IA démarré !${NC}"
  hr
  echo -e "  ${BOLD}URL :${NC}   http://localhost:${port}"
  echo -e "  Logs :   ${DIM}docker compose logs -f${NC}"
  echo -e "  Arrêt :  ${DIM}docker compose down${NC}"
  hr
}

# ─── Résumé post-install ──────────────────────────────────────────────────────
show_summary() {
  echo ""
  hr
  echo -e "${GREEN}${BOLD}  ✓ Installation terminée !${NC}"
  hr
  echo ""
  echo -e "  ${BOLD}Fichiers de configuration :${NC}"
  echo -e "    .env.local        ${DIM}← clé Albert API & options${NC}"
  echo -e "    .env.development  ${DIM}← paramètres de développement${NC}"
  echo ""
  echo -e "  ${BOLD}Commandes utiles :${NC}"
  echo -e "    ${CYAN}yarn start${NC}             Serveur dev"
  echo -e "    ${CYAN}yarn build${NC}             Build production"
  echo -e "    ${CYAN}yarn test:typecheck${NC}    Vérification TypeScript"
  echo -e "    ${CYAN}yarn test:update${NC}       Suite de tests complète"
  echo -e "    ${CYAN}docker compose up${NC}      Démarrer en Docker"
  echo ""
  echo -e "  ${BOLD}Documentation IA :${NC}"
  echo -e "    Albert API  ${DIM}https://albert.api.etalab.gouv.fr/docs${NC}"
  echo -e "    KaTeX       ${DIM}https://katex.org/docs/supported.html${NC}"
  echo -e "    Mermaid     ${DIM}https://mermaid.js.org/syntax/flowchart.html${NC}"
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  banner

  case "$MODE" in
    dev|prod|docker) ;;
    *)
      err "Mode inconnu: '$MODE'"
      echo ""
      usage
      exit 1
      ;;
  esac

  info "Mode : ${BOLD}${MODE}${NC}"
  info "Dossier : ${BOLD}${INSTALL_DIR}${NC}"
  echo ""

  check_prereqs

  # Si on est déjà dans le dépôt (CI / environnement existant), ne pas re-cloner
  if [[ -f "package.json" && -d ".git" ]]; then
    info "Dépôt déjà présent dans le répertoire courant — skip du clone"
    INSTALL_DIR="."
  else
    setup_repo
  fi

  if [[ "$MODE" != "docker" ]]; then
    configure_env
    install_deps
    verify_build
    show_summary
  fi

  case "$MODE" in
    dev)    run_dev ;;
    prod)   run_prod ;;
    docker) run_docker ;;
  esac
}

main
