"""Test-only JSON-lines transport: React/jsdom -> real FastAPI -> migrated SQLite.

Not an HTTP endpoint or browser-cookie test. Never used by production routes.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory


def reply(value):
    print(json.dumps(value), flush=True)


def main():
    with TemporaryDirectory(prefix="t16-ui-database-") as directory:
        path = Path(directory) / "acceptance.db"
        # Set isolated configuration before importing any application module.
        os.environ["DATABASE_URL"] = f"sqlite:///{path.as_posix()}"
        os.environ["TMDB_READ_ACCESS_TOKEN"] = ""
        root = Path(__file__).resolve().parents[3]
        sys.path.insert(0, str(root / "backend"))
        sys.path.insert(0, str(root / "backend" / "tests"))
        from filter_verification_support import (
            filter_scenario,
            migrate_database,
            preference_rows,
        )

        migrate_database(path)
        with filter_scenario(path, rating_ties=True) as state:
            reply({"ready": True})
            for line in sys.stdin:
                request = json.loads(line)
                request_id = request["id"]
                operation = request["op"]
                if operation == "close":
                    reply({"id": request_id, "result": True})
                    break
                if operation == "preferences":
                    result = preference_rows(path)
                elif operation == "request":
                    http = state.account_b if request.get("account") == "b" else state.account_a
                    response = http.request(
                        request["method"],
                        request["url"],
                        headers={"Origin": "http://testserver"},
                        **({"json": request["body"]} if "body" in request else {}),
                    )
                    result = {"status": response.status_code, "body": response.json()}
                else:
                    raise ValueError("Unknown T16 test operation")
                reply({"id": request_id, "result": result})


if __name__ == "__main__":
    main()
