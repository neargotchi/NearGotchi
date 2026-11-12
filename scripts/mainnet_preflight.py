"""Read-only preflight for the drop 1 deploy (docs/MAINNET-RUNBOOK.md, task 069). It NEVER sends a transaction:
the only network calls are JSON-RPC `query` reads (view_account, view_access_key_list, call_function) against the
same free endpoints the site uses. No keys are read or needed.

  python3 scripts/mainnet_preflight.py --owner OWNER.near --contract drop1.OWNER.near --team TEAM.near
  python3 scripts/mainnet_preflight.py --network testnet --owner neargotchi-admin-ng67.testnet \\
      --contract neargotchi-drop1-ng67.testnet --team neargotchi-team-ng67.testnet          # try it on testnet

Checks (each line OK / WARN / FAIL; exit code 1 if any FAIL):
  local   wasm built (contracts/drop1/res/neargotchi_drop1.wasm) + its sha256; init.json + catalog-1..6.json exist,
          have the expected sizes, ids 1..300 once each, metadata identical to metadata/drop1, init args match
          the accounts you pass (owner = the contract account during setup, team, limit 5, provenance)
  chain   accounts exist on the chosen network, balances ≥ what the next step needs; if the contract is deployed:
          its code hash == the local wasm, owner / team / limit / pause / freeze / base_uri / catalog state, and
          how many access keys the contract account still has (0 = code is final)
"""
import argparse, base64, hashlib, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WASM = os.path.join(ROOT, "contracts", "drop1", "res", "neargotchi_drop1.wasm")
ARGS = os.path.join(ROOT, "contracts", "drop1", "res", "mainnet")
META = os.path.join(ROOT, "metadata", "drop1")
RPCS = {  # same list as lib/chain.ts PUBLIC_RPCS
    "mainnet": ["https://free.rpc.fastnear.com", "https://near.drpc.org", "https://api.zan.top/near-mainnet", "https://rpc.intea.rs"],
    "testnet": ["https://test.rpc.fastnear.com", "https://near-testnet.drpc.org", "https://api.zan.top/near-testnet", "https://testnet-rpc.intea.rs"],
}
NEAR = 10**24
CID = "bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm"   # drop 1 folder on IPFS (scripts/mainnet_args.py)
ACCOUNT = re.compile(r"^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$")
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

fails = 0


def say(level, text):
    global fails
    if level == "FAIL":
        fails += 1
    print(f"  {level:<4} {text}")


def b58(data: bytes) -> str:
    n = int.from_bytes(data, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = B58[r] + out
    return "1" * (len(data) - len(data.lstrip(b"\0"))) + out


def rpc(network, params):
    """One read-only `query`; tries the endpoints in turn. Returns (result, error_name)."""
    body = json.dumps({"jsonrpc": "2.0", "id": "preflight", "method": "query", "params": params}).encode()
    last = None
    for url in RPCS[network]:
        try:
            req = urllib.request.Request(url, data=body, headers={"content-type": "application/json", "user-agent": "neargotchi-preflight"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.load(resp)
        except Exception as error:  # noqa: BLE001 — next endpoint
            last = str(error)
            continue
        if "error" in data:
            name = (data["error"].get("cause") or {}).get("name") or data["error"].get("message")
            if name in ("UNKNOWN_ACCOUNT", "CONTRACT_EXECUTION_ERROR", "NO_CONTRACT_CODE", "INVALID_ACCOUNT"):
                return None, name
            last = name
            continue
        return data["result"], None
    raise SystemExit(f"every RPC endpoint failed ({last})")


def view_account(network, account):
    return rpc(network, {"request_type": "view_account", "finality": "final", "account_id": account})


def view(network, contract, method, args=None):
    result, err = rpc(network, {"request_type": "call_function", "finality": "final", "account_id": contract, "method_name": method,
                                "args_base64": base64.b64encode(json.dumps(args or {}).encode()).decode()})
    if err or result is None or result.get("error"):
        return None
    return json.loads(bytes(result["result"]).decode())


RETIRED_GATEWAYS = ("ipfs.io", "dweb.link")          # retired for hotlinked content 2026-09-21 (docs/DEVLOG.md)
RATE_LIMITED_GATEWAYS = ("gateway.pinata.cloud",)    # public Pinata: 429 + bot challenge after ~5 requests per IP


def base_uri_verdict(base):
    """(level, text) for a drop 1 base_uri: https gateway + /ipfs/<CID>, with or without one trailing '/'."""
    if base is None:
        return "WARN", "base_uri is null — set it with set_base_uri before freeze (step 7)"
    host = base.split("://", 1)[-1].split("/", 1)[0]
    if not base.startswith("https://") or base.endswith("//") or "<CID>" in base or "TODO" in base:
        return "FAIL", f"base_uri {base!r}: must be https://<gateway>/ipfs/<CID>/"
    if host in RETIRED_GATEWAYS or host.endswith("." + RETIRED_GATEWAYS[1]):
        return "FAIL", f"base_uri {base}: {host} is retired for hotlinks since 2026-09-21 — wallets show no image"
    if host in RATE_LIMITED_GATEWAYS:
        return "FAIL", f"base_uri {base}: public {host} rate-limits (429) — use the dedicated gateway"
    if not base.rstrip("/").endswith("/ipfs/" + CID):
        return "WARN", f"base_uri {base} does not point at the drop 1 CID {CID}"
    return "OK", f"base_uri {base}"


def local_checks(a):
    print("local files")
    wasm_hash = None
    if os.path.exists(WASM):
        raw = open(WASM, "rb").read()
        wasm_hash = hashlib.sha256(raw)
        say("OK", f"wasm {len(raw)} B, sha256 {wasm_hash.hexdigest()}")
    else:
        say("FAIL", "no contracts/drop1/res/neargotchi_drop1.wasm — run contracts/drop1/build.sh")
    init_path = os.path.join(ARGS, "init.json")
    if not os.path.exists(init_path):
        say("FAIL", "no res/mainnet/init.json — run scripts/mainnet_args.py (runbook step 5)")
    else:
        init = json.load(open(init_path))
        provenance = json.load(open(os.path.join(META, "collection.json")))["summary"]["manifest"]
        size = os.path.getsize(init_path)
        say("OK" if 150 < size < 1000 else "WARN", f"init.json {size} B")
        for key, want in (("owner_id", a.contract), ("team_id", a.team), ("max_per_account", 5 if a.network == "mainnet" else init.get("max_per_account")),
                          ("provenance", provenance), ("royalty_account", None)):
            got = init.get(key)
            say("OK" if got == want else "FAIL", f"init.{key} = {got!r}" + ("" if got == want else f" (expected {want!r})"))
        level, text = base_uri_verdict(init.get("base_uri"))
        say(level, f"init.{text}")
    seen = []
    for i in range(1, 7):
        path = os.path.join(ARGS, f"catalog-{i}.json")
        if not os.path.exists(path):
            say("FAIL", f"no res/mainnet/catalog-{i}.json")
            continue
        size = os.path.getsize(path)
        entries = json.load(open(path))["entries"]
        bad = [e["token_id"] for e in entries if e["metadata"] != json.load(open(os.path.join(META, f"{e['token_id']}.json")))]
        seen += [e["token_id"] for e in entries]
        ok = len(entries) == 50 and 20_000 < size < 30_000 and not bad
        say("OK" if ok else "FAIL", f"catalog-{i}.json {size} B, {len(entries)} entries, ids {entries[0]['token_id']}–{entries[-1]['token_id']}"
            + (f", metadata differs for {bad[:5]}" if bad else ""))
    if seen:
        say("OK" if sorted(seen) == list(range(1, 301)) else "FAIL", f"catalog covers ids 1..300 exactly once ({len(seen)} entries, {len(set(seen))} unique)")
    return wasm_hash


def chain_checks(a, wasm_hash):
    print(f"chain ({a.network}, read-only)")
    accounts = {}
    # what OWNER still has to pay depends on how far the setup is: before step 4 the contract funding (8) + test mint
    # (2) + gas; deployed but nothing minted: the test mint; afterwards gas only
    contract_info, _ = view_account(a.network, a.contract)
    deployed = bool(contract_info) and contract_info["code_hash"] != "11111111111111111111111111111111"
    minted = (view(a.network, a.contract, "drop_status") or {}).get("minted", 0) if deployed else 0
    owner_need = a.owner_min if not contract_info else (2.1 if minted == 0 else 0.05)
    for role, account, need in (("owner", a.owner, owner_need), ("team", a.team, None), ("contract", a.contract, None)):
        info, err = (contract_info, None) if role == "contract" else view_account(a.network, account)
        accounts[role] = info
        if err == "UNKNOWN_ACCOUNT" or info is None:
            say("WARN" if role == "contract" else "FAIL", f"{role} {account} does not exist on {a.network}"
                + (" (fine before step 4)" if role == "contract" else ""))
            continue
        bal = int(info["amount"]) / NEAR
        if need is not None:
            say("OK" if bal >= need else "FAIL", f"{role} {account}: {bal:.3f} NEAR (need ≥ {need} for the remaining steps)")
        else:
            say("OK", f"{role} {account}: {bal:.3f} NEAR")
    contract = accounts.get("contract")
    if not contract:
        return
    if not a.contract.endswith("." + a.owner) and a.network == "mainnet":
        say("WARN", f"{a.contract} is not a sub-account of {a.owner}")
    bal = int(contract["amount"]) / NEAR
    storage = contract["storage_usage"] / 100_000
    has_code = contract["code_hash"] != "11111111111111111111111111111111"
    if not has_code:
        say("OK" if bal >= 8 else "FAIL", f"contract not deployed yet; balance {bal:.3f} NEAR (need ≥ 8 for code + catalog storage)")
    else:
        say("OK" if bal >= storage else "FAIL", f"contract balance {bal:.3f} NEAR, storage {contract['storage_usage']} B = {storage:.3f} NEAR")
        if wasm_hash is not None:
            local = b58(wasm_hash.digest())
            say("OK" if contract["code_hash"] == local else "FAIL",
                f"deployed code hash {contract['code_hash']} " + ("== local build" if contract["code_hash"] == local else f"!= local build {local}"))
        status = view(a.network, a.contract, "drop_status")
        if status is None:
            say("FAIL", "drop_status failed: not initialised (`new`) or not this contract")
        else:
            say("OK", f"drop_status: minted {status['minted']}/{status['total']}, pending {status['pending']}, paused {status['paused']}, "
                      f"catalog {status['catalog_loaded']}/300, limit {status['max_per_account']}, frozen {status['metadata_frozen']}")
            if a.network == "mainnet" and status["max_per_account"] != 5:
                say("FAIL", "mainnet limit must be 5 per account")
            if status["catalog_loaded"] != 300:
                say("WARN", f"catalog {status['catalog_loaded']}/300: load the missing batches (step 6) — batch k holds ids {50 * (status['catalog_loaded'] // 50) + 1}…")
            owner = view(a.network, a.contract, "owner")
            team = view(a.network, a.contract, "team")
            say("OK" if team == a.team else "FAIL", f"team() = {team}")
            say("OK" if owner in (a.contract, a.owner) else "FAIL", f"owner() = {owner}"
                + (" (setup phase: the contract itself, step 10 moves it to the owner account)" if owner == a.contract else ""))
            meta = view(a.network, a.contract, "nft_metadata") or {}
            level, text = base_uri_verdict(meta.get("base_uri"))
            say(level, f"on chain {text}")
        keys, _ = rpc(a.network, {"request_type": "view_access_key_list", "finality": "final", "account_id": a.contract})
        n = len((keys or {}).get("keys", []))
        say("OK" if n == 0 else "WARN", f"contract account has {n} access key(s)" + (" — code is final" if n == 0 else " — delete before unpausing (step 11)"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--network", choices=["mainnet", "testnet"], default="mainnet")
    ap.add_argument("--owner", required=True, help="project account (owner after step 10)")
    ap.add_argument("--contract", required=True, help="drop1.<owner>")
    ap.add_argument("--team", required=True, help="receives the team half (may equal --owner)")
    ap.add_argument("--owner-min", type=float, default=11.0, help="NEAR the owner needs before step 4 (8 contract + 2 test mint + gas)")
    ap.add_argument("--skip-local", action="store_true", help="only the chain checks")
    a = ap.parse_args()
    print(f"preflight — {a.network} — nothing is sent")
    for role, acc in (("owner", a.owner), ("contract", a.contract), ("team", a.team)):
        valid = ACCOUNT.match(acc) and 2 <= len(acc) <= 64
        suffix_ok = acc.endswith(".testnet") == (a.network == "testnet") or len(acc) == 64  # 64 hex = implicit account
        say("OK" if valid and suffix_ok else "FAIL", f"{role} id {acc!r}" + ("" if suffix_ok else f" does not look like a {a.network} account"))
    wasm_hash = None if a.skip_local else local_checks(a)
    if a.skip_local and os.path.exists(WASM):
        wasm_hash = hashlib.sha256(open(WASM, "rb").read())
    chain_checks(a, wasm_hash)
    print(f"\n{'FAILED: ' + str(fails) + ' check(s)' if fails else 'all checks passed (WARN = read it, not a blocker)'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
