import subprocess
import sys
import os
import time

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 60)
    print("STARTING MULETRACE AML INVESTIGATION PLATFORM")
    print("=" * 60)

    # 1. Start FastAPI backend
    print("\n[1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=backend_dir
    )

    # 2. Install frontend deps and start Vite
    print("\n[2/2] Installing frontend dependencies and launching React UI on http://localhost:3000 ...")
    subprocess.run(["npm.cmd" if os.name == "nt" else "npm", "install"], cwd=frontend_dir, check=True)
    frontend_proc = subprocess.Popen(
        ["npm.cmd" if os.name == "nt" else "npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"],
        cwd=frontend_dir
    )

    print("\n" + "=" * 60)
    print("MULETRACE PLATFORM IS LIVE!")
    print("Web UI:  http://localhost:3000")
    print("API Doc: http://127.0.0.1:8000/docs")
    print("Press Ctrl+C to terminate both servers.")
    print("=" * 60)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down MuleTrace platform...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Shutdown complete.")

if __name__ == "__main__":
    main()
