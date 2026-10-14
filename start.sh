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

# 1. Détection de la distribution (Bazzite / Fedora Atomic / Fedora standard)
OS_ID="unknown"
[ -f /etc/os-release ] && OS_ID=$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
echo "🐧 Système détecté : $OS_ID"

# 2. Vérification et chargement de l'environnement .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "📄 Création de .env à partir de .env.example..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi
export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

# 3. Détection du moteur de conteneurs (Docker ou Podman)
COMPOSE_CMD=""
if command -v docker &>/dev/null && docker info &>/dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v podman &>/dev/null; then
    echo "🦭 Utilisation de Podman (environnement Bazzite / Fedora Atomic)..."
    if systemctl --user is-active --quiet podman.socket 2>/dev/null; then
        echo "🔌 Podman socket utilisateur actif."
    elif systemctl --user is-enabled --quiet podman.socket 2>/dev/null; then
        systemctl --user start podman.socket 2>/dev/null || true
    fi
    export DOCKER_HOST="unix://${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
    if podman compose version &>/dev/null; then
        COMPOSE_CMD="podman compose"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE_CMD="docker-compose"
    fi
fi

[ -z "$COMPOSE_CMD" ] && { echo "❌ Erreur : Ni docker compose ni podman compose n'ont été trouvés."; exit 1; }

echo "🐳 Lancement des conteneurs via $COMPOSE_CMD..."
cd "$SCRIPT_DIR"
$COMPOSE_CMD up --build -d

# 4. Préparation et lancement du Frontend Expo
echo ""
echo "📱 Préparation du Frontend universel..."
cd "$SCRIPT_DIR/frontend"
[ ! -f ".env" ] && ln -sf ../.env .env

# Détection de l'exécutable JavaScript (Node ou Bun)
JS_RUNNER=""
command -v bun &>/dev/null && JS_RUNNER="bun"
command -v npm &>/dev/null && JS_RUNNER="npm"

[ -z "$JS_RUNNER" ] && { echo "❌ Erreur : Ni Node.js ni Bun n'ont été détectés dans le PATH."; exit 1; }

if [ ! -d "node_modules" ]; then
    echo "⚙️ Installation des dépendances Frontend avec $JS_RUNNER..."
    if [ "$JS_RUNNER" = "bun" ]; then bun install; else npm install; fi
fi

EXPO_PORT=${PORT:-8081}
export PORT=$EXPO_PORT
echo "🌐 Démarrage du serveur Expo sur le port $EXPO_PORT..."
if command -v npx &>/dev/null; then
    exec npx expo start -c --port "$EXPO_PORT"
else
    exec bun x expo start -c --port "$EXPO_PORT"
fi
