# =============================================================================
# Excalidraw + Albert AI — Makefile
# =============================================================================
.DEFAULT_GOAL := help
SHELL         := /bin/bash
PORT          ?= 3001
ALBERT_MODEL  ?= AgentPublic/llama3-instruct-8b
ALBERT_BASE   ?= https://albert.api.etalab.gouv.fr/v1

# Couleurs
CY  = \033[0;36m
GR  = \033[0;32m
YL  = \033[1;33m
NC  = \033[0m
BLD = \033[1m

.PHONY: help install dev prod docker docker-down docker-logs \
        typecheck test test-update lint fix clean env-check

# ─── Aide ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  $(CY)$(BLD)Excalidraw + Albert AI$(NC)"
	@echo ""
	@echo "  $(BLD)Installation & démarrage$(NC)"
	@echo "    $(GR)make install$(NC)        Installe les dépendances + configure .env.local"
	@echo "    $(GR)make dev$(NC)            Serveur de développement (localhost:$(PORT))"
	@echo "    $(GR)make prod$(NC)           Build production + serveur HTTP"
	@echo "    $(GR)make docker$(NC)         Build & start via Docker Compose"
	@echo "    $(GR)make docker-down$(NC)    Arrêter les conteneurs Docker"
	@echo "    $(GR)make docker-logs$(NC)    Logs Docker en temps réel"
	@echo ""
	@echo "  $(BLD)Qualité$(NC)"
	@echo "    $(GR)make typecheck$(NC)      Vérification TypeScript"
	@echo "    $(GR)make test$(NC)           Tests unitaires"
	@echo "    $(GR)make test-update$(NC)    Tests + mise à jour des snapshots"
	@echo "    $(GR)make lint$(NC)           Vérification ESLint + Prettier"
	@echo "    $(GR)make fix$(NC)            Auto-fix ESLint + Prettier"
	@echo ""
	@echo "  $(BLD)Utilitaires$(NC)"
	@echo "    $(GR)make env-check$(NC)      Vérifier la configuration Albert API"
	@echo "    $(GR)make clean$(NC)          Supprimer les builds et node_modules"
	@echo ""
	@echo "  $(BLD)Variables$(NC)"
	@echo "    ALBERT_API_KEY=xxx   Clé API (ou dans .env.local)"
	@echo "    PORT=$(PORT)            Port du serveur de dev"
	@echo ""

# ─── Installation ─────────────────────────────────────────────────────────────
install:
	@echo -e "\n$(CY)$(BLD)▸ Installation des dépendances$(NC)\n"
	yarn install --frozen-lockfile --network-timeout 300000
	@$(MAKE) --no-print-directory _create_env
	@echo -e "\n$(GR)✓ Installation terminée ! Lancez: make dev$(NC)\n"

_create_env:
	@if [ ! -f .env.local ]; then \
	  echo -e "$(YL)⚠  .env.local non trouvé — création avec valeurs par défaut$(NC)"; \
	  echo "VITE_APP_ALBERT_API_KEY=$${ALBERT_API_KEY:-}" > .env.local; \
	  echo "VITE_APP_ALBERT_API_BASE=$(ALBERT_BASE)"    >> .env.local; \
	  echo "VITE_APP_ALBERT_MODEL=$(ALBERT_MODEL)"      >> .env.local; \
	  echo "VITE_APP_PORT=$(PORT)"                      >> .env.local; \
	  echo "VITE_APP_DISABLE_PREVENT_UNLOAD=true"       >> .env.local; \
	  echo -e "$(GR)✓ .env.local créé — ajoutez VITE_APP_ALBERT_API_KEY$(NC)"; \
	else \
	  echo -e "$(GR)✓ .env.local déjà présent$(NC)"; \
	fi

# ─── Développement ────────────────────────────────────────────────────────────
dev:
	@echo -e "\n$(CY)$(BLD)▸ Démarrage du serveur de développement$(NC)"
	@echo -e "  URL : $(GR)http://localhost:$(PORT)$(NC)  (Ctrl+C pour arrêter)\n"
	yarn start

# ─── Production ───────────────────────────────────────────────────────────────
prod:
	@echo -e "\n$(CY)$(BLD)▸ Build de production$(NC)\n"
	yarn build:app:docker
	@echo -e "\n$(GR)✓ Build OK → excalidraw-app/build/$(NC)"
	@echo -e "  Serveur : $(GR)http://localhost:5001$(NC)\n"
	npx --yes http-server excalidraw-app/build -a 0.0.0.0 -p 5001

# ─── Docker ───────────────────────────────────────────────────────────────────
docker:
	@echo -e "\n$(CY)$(BLD)▸ Build Docker + démarrage$(NC)\n"
	ALBERT_API_KEY="$${ALBERT_API_KEY:-}" \
	ALBERT_API_BASE="$(ALBERT_BASE)" \
	ALBERT_MODEL="$(ALBERT_MODEL)" \
	docker compose -f docker-compose.ai.yml up --build -d
	@echo -e "\n$(GR)✓ Excalidraw AI démarré → http://localhost:3000$(NC)"
	@echo -e "  Logs : $(CY)make docker-logs$(NC)"

docker-down:
	docker compose -f docker-compose.ai.yml down

docker-logs:
	docker compose -f docker-compose.ai.yml logs -f

# ─── Qualité ──────────────────────────────────────────────────────────────────
typecheck:
	@echo -e "\n$(CY)$(BLD)▸ Vérification TypeScript$(NC)\n"
	yarn test:typecheck

test:
	@echo -e "\n$(CY)$(BLD)▸ Tests unitaires$(NC)\n"
	yarn test:app --watch=false

test-update:
	@echo -e "\n$(CY)$(BLD)▸ Tests + mise à jour des snapshots$(NC)\n"
	yarn test:update

lint:
	@echo -e "\n$(CY)$(BLD)▸ ESLint + Prettier$(NC)\n"
	yarn test:code && yarn test:other

fix:
	@echo -e "\n$(CY)$(BLD)▸ Auto-fix ESLint + Prettier$(NC)\n"
	yarn fix

# ─── Utilitaires ──────────────────────────────────────────────────────────────
env-check:
	@echo -e "\n$(CY)$(BLD)▸ Configuration Albert API$(NC)\n"
	@if [ -f .env.local ]; then \
	  KEY=$$(grep VITE_APP_ALBERT_API_KEY .env.local | cut -d= -f2); \
	  if [ -n "$$KEY" ]; then \
	    echo -e "  $(GR)✓ VITE_APP_ALBERT_API_KEY définie ($$( echo $$KEY | head -c4 )…)$(NC)"; \
	  else \
	    echo -e "  $(YL)⚠  VITE_APP_ALBERT_API_KEY vide dans .env.local$(NC)"; \
	    echo -e "     → Obtenir une clé : https://albert.api.etalab.gouv.fr"; \
	  fi; \
	  echo -e "  $(GR)✓ VITE_APP_ALBERT_API_BASE:$(NC) $$(grep VITE_APP_ALBERT_API_BASE .env.local | cut -d= -f2-)"; \
	  echo -e "  $(GR)✓ VITE_APP_ALBERT_MODEL:$(NC)    $$(grep VITE_APP_ALBERT_MODEL .env.local | cut -d= -f2-)"; \
	else \
	  echo -e "  $(YL)⚠  .env.local non trouvé — lancez: make install$(NC)"; \
	fi
	@echo ""

clean:
	@echo -e "\n$(CY)$(BLD)▸ Nettoyage$(NC)\n"
	rm -rf \
	  node_modules \
	  excalidraw-app/node_modules \
	  excalidraw-app/build \
	  packages/excalidraw/node_modules \
	  packages/common/node_modules \
	  packages/element/node_modules \
	  packages/math/node_modules
	@echo -e "$(GR)✓ Nettoyage terminé$(NC)"
