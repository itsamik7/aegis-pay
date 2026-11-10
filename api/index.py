import os
import sys

# Ensure backend directory is in python module search path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

# Export ASGI app directly for Vercel Python runtime
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    handler = app
