#!/usr/bin/env bash
# ==============================================================================
# Script de lancement unifié - The Universal Media Stack (Fedora & Bazzite)
# ==============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"

echo "==========================================================="
echo "🚀 Démarrage de The Universal Media Stack (Bazzite & Fedora)"
echo "==========================================================="

# 1. Détection de la distribution
OS_ID="unknown"
[ -f /etc/os-release ] && OS_ID=$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
echo "🐧 Système détecté : $OS_ID"

# 2. Chargement de l'environnement .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "📄 Création de .env à partir de .env.example..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi
set -a
[ -f "$SCRIPT_DIR/.env" ] && . "$SCRIPT_DIR/.env"
set +a

# 3. Détection et préparation du moteur de conteneurs (Docker ou Podman)
COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v podman >/dev/null 2>&1; then
    echo "🦭 Détection de Podman..."
    PODMAN_SOCK="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
    if [ ! -S "$PODMAN_SOCK" ]; then
        echo "🔌 Initialisation de la socket Podman ($PODMAN_SOCK)..."
        mkdir -p "$(dirname "$PODMAN_SOCK")"
        systemctl --user restart podman.socket >/dev/null 2>&1 || true
        sleep 0.5
        if [ ! -S "$PODMAN_SOCK" ]; then
            podman system service --time=0 "unix://$PODMAN_SOCK" >/dev/null 2>&1 &
            sleep 1
        fi
    fi
    export DOCKER_HOST="unix://$PODMAN_SOCK"
    if [ -S "$PODMAN_SOCK" ]; then
        echo "✅ Podman socket connectée : $DOCKER_HOST"
    fi

    if podman compose version >/dev/null 2>&1; then
        COMPOSE_CMD="podman compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    fi
fi

[ -z "$COMPOSE_CMD" ] && { echo "❌ Erreur : Ni docker compose ni podman compose n'ont été trouvés."; exit 1; }

echo "🐳 Lancement des conteneurs via $COMPOSE_CMD..."
cd "$SCRIPT_DIR"
$COMPOSE_CMD up --build -d

# 4. Lancement du Frontend Expo
echo ""
echo "📱 Préparation du Frontend universel..."
cd "$SCRIPT_DIR/frontend"
[ ! -f ".env" ] && ln -sf ../.env .env

JS_RUNNER=""
command -v bun >/dev/null 2>&1 && JS_RUNNER="bun"
command -v npm >/dev/null 2>&1 && JS_RUNNER="npm"

[ -z "$JS_RUNNER" ] && { echo "❌ Erreur : Aucun runtime JS (Bun ou Node) détecté."; exit 1; }

if [ ! -d "node_modules" ]; then
    echo "⚙️ Installation des dépendances avec $JS_RUNNER..."
    if [ "$JS_RUNNER" = "bun" ]; then bun install; else npm install; fi
fi

EXPO_PORT=${PORT:-8081}
export PORT=$EXPO_PORT
echo "🌐 Démarrage du serveur Expo sur le port $EXPO_PORT..."
if command -v npx >/dev/null 2>&1; then
    exec npx expo start -c --port "$EXPO_PORT"
else
    exec bun x expo start -c --port "$EXPO_PORT"
fi
