"""JSON argument files for the mainnet deploy (docs/MAINNET-RUNBOOK.md). Writes, never sends anything.

  python3 scripts/mainnet_args.py --owner drop1.OWNER.near --team TEAM.near [--base-uri https://<gateway>/ipfs/<CID>/]

→ contracts/drop1/res/mainnet/init.json      (args of `new`: limit 5 per account, provenance from metadata)
  contracts/drop1/res/mainnet/catalog-1.json … catalog-6.json   (args of `load_catalog`, 50 tokens each)
contracts/drop1/res is gitignored; the files hold public data only (account ids, metadata), no keys.
"""
import argparse, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, "metadata", "drop1")
OUT = os.path.join(ROOT, "contracts", "drop1", "res", "mainnet")
# Drop 1 images + metadata on IPFS (Pinata, uploaded 2026-11-11; all 300 PNG + JSON verified, docs/REPORT.md DONE: 071)
CID = "bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm"
# NEP-177: an https gateway. Dedicated Pinata gateway (paid Picnic plan) — the one on mainnet since 2026-11-12.
# Not ipfs.io / dweb.link (retired for hotlinks 2026-09-21) and not the public gateway.pinata.cloud (429 after ~5
# requests). Trailing "/" on purpose: clients that glue base_uri + media without a separator still get a valid URL;
# the ones that add "/" either trim it (Nearblocks, MyNearWallet) or produce "//", which the gateway serves too.
GATEWAY = "https://lavender-known-gorilla-623.mypinata.cloud"
DEFAULT_BASE_URI = f"{GATEWAY}/ipfs/{CID}/"
ACCOUNT = re.compile(r"^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner", required=True, help="owner during setup = the contract account itself (drop1.OWNER.near); step 10 hands it to OWNER.near")
    ap.add_argument("--team", required=True, help="team account: receives distribute() and the 5%% royalty")
    ap.add_argument("--base-uri", default=DEFAULT_BASE_URI, help="https gateway + /ipfs/<CID>/ (default: %(default)s)")
    ap.add_argument("--limit", type=int, default=5, help="mints per account (mainnet: 5)")
    ap.add_argument("--network", choices=["mainnet", "testnet"], default="mainnet", help="testnet only for a dry run")
    args = ap.parse_args()
    for acc in (args.owner, args.team):
        if not ACCOUNT.match(acc) or len(acc) < 2 or len(acc) > 64:
            raise SystemExit(f"not a NEAR account id: {acc}")
        if acc.endswith(".testnet") != (args.network == "testnet") and len(acc) != 64:
            raise SystemExit(f"{acc} is not a {args.network} account")
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
