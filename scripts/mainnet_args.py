"""JSON argument files for the mainnet deploy (docs/MAINNET-RUNBOOK.md). Writes, never sends anything.

  python3 scripts/mainnet_args.py --owner ADMIN.near --team TEAM.near --base-uri https://ipfs.io/ipfs/<CID>

→ contracts/drop1/res/mainnet/init.json      (args of `new`: limit 5 per account, provenance from metadata)
  contracts/drop1/res/mainnet/catalog-1.json … catalog-6.json   (args of `load_catalog`, 50 tokens each)
contracts/drop1/res is gitignored; the files hold public data only (account ids, metadata), no keys.
"""
import argparse, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, "metadata", "drop1")
OUT = os.path.join(ROOT, "contracts", "drop1", "res", "mainnet")
ACCOUNT = re.compile(r"^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner", required=True, help="admin account (Ledger), e.g. you.near")
    ap.add_argument("--team", required=True, help="team account: receives distribute() and the 5%% royalty")
    ap.add_argument("--base-uri", default=None, help="https gateway + /ipfs/<CID> (no trailing slash); can be set later")
    ap.add_argument("--limit", type=int, default=5, help="mints per account (mainnet: 5)")
    args = ap.parse_args()
    for acc in (args.owner, args.team):
        if not ACCOUNT.match(acc) or len(acc) < 2 or len(acc) > 64:
            raise SystemExit(f"not a NEAR account id: {acc}")
        if acc.endswith(".testnet"):
            raise SystemExit(f"{acc} is a testnet account")
    with open(os.path.join(META, "collection.json")) as fh:
        provenance = json.load(fh)["summary"]["manifest"]
    os.makedirs(OUT, exist_ok=True)
    init = {"owner_id": args.owner, "team_id": args.team, "royalty_account": None, "base_uri": args.base_uri,
            "provenance": provenance, "max_per_account": args.limit}
    with open(os.path.join(OUT, "init.json"), "w") as fh:
        json.dump(init, fh, indent=1)
    for batch, start in enumerate(range(1, 301, 50), 1):
        entries = []
        for tid in range(start, start + 50):
            with open(os.path.join(META, f"{tid}.json")) as fh:
                entries.append({"token_id": tid, "metadata": json.load(fh)})
        with open(os.path.join(OUT, f"catalog-{batch}.json"), "w") as fh:
            json.dump({"entries": entries}, fh, separators=(",", ":"))
    print(f"ok: {OUT}/init.json + catalog-1..6.json")
    print(json.dumps(init, indent=1))


if __name__ == "__main__":
    main()
