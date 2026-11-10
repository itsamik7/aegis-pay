#!/bin/bash
# ==============================================================================
# PayU AEGIS-PAY - Unified Platform Launcher (Backend & Frontend)
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -d "$SCRIPT_DIR/aegis-pay" ]; then
    PROJECT_DIR="$SCRIPT_DIR/aegis-pay"
else
    PROJECT_DIR="$SCRIPT_DIR"
fi

BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=================================================================="
echo " Starting PayU AEGIS-PAY Merchant Risk Intelligence Console"
echo "=================================================================="
echo "Project Path: $PROJECT_DIR"

# Check Python environment
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "Creating Python virtual environment in $BACKEND_DIR/venv..."
    python3 -m venv "$BACKEND_DIR/venv"
    "$BACKEND_DIR/venv/bin/pip" install --upgrade pip
    "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

# Function to handle graceful shutdown
cleanup() {
    echo ""
    echo "=================================================================="
    echo " Shutting down PayU AEGIS-PAY services..."
    echo "=================================================================="
    if [ ! -z "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi
    # Also clean up any orphan processes on the ports
    lsof -ti :8000 | xargs kill -9 2>/dev/null
    lsof -ti :5173 | xargs kill -9 2>/dev/null
    echo "All PayU services stopped."
    exit 0
}

trap cleanup INT TERM EXIT

# Start Backend
echo "Starting Backend API on http://127.0.0.1:8000 ..."
cd "$BACKEND_DIR"
PYTHONPATH=. ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend UI on http://127.0.0.1:5173 ..."
cd "$FRONTEND_DIR"
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "PayU AEGIS-PAY is LIVE:"
echo "   Frontend Console: http://127.0.0.1:5173"
echo "   Backend REST API: http://127.0.0.1:8000"
echo "   Interactive Docs: http://127.0.0.1:8000/docs"
echo "   Test Credentials: demo@payu.in / Demo1234!"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "=================================================================="

wait
