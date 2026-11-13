# Drop 1 na mainnecie — komendy do skopiowania

Ściąga do `docs/MAINNET-RUNBOOK.md` (tam uzasadnienia i plan incydentów). Kolejność jest **sztywna**: A → B → C → D → E → F → G → H → I → J. Nie przeskakuj kroków; po każdym uruchom blok „sprawdź” i idź dalej dopiero, gdy wynik się zgadza.

- Każda komenda to jedna linia w osobnym bloku. Kopiuj cały blok.
- Komendy z `send` **wysyłają transakcję z prawdziwym NEAR**. Zamień `send` na `display`, żeby podpisać i wydrukować transakcję bez wysyłania.
- Klucze: OWNER (`neargochi-dev.near`) jest już w keychainie near-cli-rs; klucz CONTRACT tworzy krok A (też keychain) i znika w kroku J.
- Cena gazu na mainnecie (2026-11-12): 0,0001 NEAR za 1 Tgas. Niezużyty prepaid gas wraca.

**Stan mainnetu (2026-11-12, wieczór):** A, B, C, E, G, H wykonane przez ownera, plus `distribute` (1,99 NEAR → `neargotchiai.near`); `base_uri` przestawione na **dedykowaną bramkę Pinaty** (podpis OWNER). **F (freeze) i J (kasowanie klucza) — nie wykonane, celowo.** Tx id i błędy po drodze: `docs/MAINNET-RUNBOOK.md` → „Mainnet record”. Po H wszystkie funkcje ownera (`set_base_uri`, `pause`/`unpause`, `freeze_metadata`) podpisuje **`$OWNER`**; klucz CONTRACT dostaje „owner only”.

Stan na 2026-11-12 (sprawdzone lokalnie, przed jakąkolwiek transakcją):
- `cargo test --lib`: 34/34 OK.
- `contracts/drop1/res/neargotchi_drop1.wasm` = czysty build `--locked` z bieżącego kodu, bajt w bajt; sha256 `b41638a10ea0fa6345ae3ba5d92b0db2c6aba5313e684f715e5ba7729a7eb634`, 376 348 B.
- `init.json` + `catalog-1..6.json` wygenerowane (`scripts/mainnet_args.py`), 300 wpisów, bez duplikatów, `media_hash` = sha256 PNG; preflight: all checks passed (owner 14 NEAR, team 0,202 NEAR, kontrakt jeszcze nie istnieje).

| krok | co | podpisuje | koszt (NEAR) |
|---|---|---|---|
| A | utworzenie `drop1.neargochi-dev.near` | OWNER | 8 (przelew) + gaz < 0,001 |
| B | deploy + init (jedna tx) | CONTRACT | gaz ≤ 0,01; ~3,91 zablokowane na storage (z 8 kontraktu) |
| C | 6 × `load_catalog` | CONTRACT | gaz ~0,0015 za partię; storage +0,94 → ~4,85 zablokowane |
| D | `base_uri` (już w init) | — | 0 (tylko odczyt) |
| E | test mint (unpause → mint → pause) | CONTRACT / OWNER / CONTRACT | 2 (mint) + gaz ~0,005 |
| F | `freeze_metadata` — nieodwracalne | CONTRACT | gaz ≤ 0,003 |
| G | `propose_owner(neargochi-dev.near)` | CONTRACT | gaz ≤ 0,003 |
| H | `accept_owner` | OWNER | gaz ≤ 0,003 |
| I | weryfikacja ownera (+ `pause` jako dowód uprawnień) | OWNER | gaz ≤ 0,003 |
| J | kasowanie kluczy kontraktu — nieodwracalne | CONTRACT | gaz < 0,001 |

Po wszystkim: OWNER ≈ 3,99 NEAR, CONTRACT ≈ 7,97 NEAR (z czego ~4,86 zablokowane na storage), TEAM ma 1,99 NEAR do odebrania przez `distribute`.

---

## 0. Zmienne (raz na sesję terminala, w katalogu repo)

```sh
export NET=mainnet OWNER=neargochi-dev.near CONTRACT=drop1.neargochi-dev.near TEAM=neargotchiai.near
```

```sh
echo "$NET | owner $OWNER | contract $CONTRACT | team $TEAM"
```
Przeczytaj dwa razy: `mainnet | owner neargochi-dev.near | contract drop1.neargochi-dev.near | team neargotchiai.near`.

```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM
```
Oczekiwane: `all checks passed`, owner ≥ 11 NEAR, WARN „contract … does not exist (fine before step 4)”.

---

## A. Utworzenie konta kontraktu (OWNER płaci 8 NEAR)

```sh
near account create-account fund-myself $CONTRACT '8 NEAR' autogenerate-new-keypair save-to-keychain sign-as $OWNER network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near account view-account-summary $CONTRACT network-config $NET now
```
Oczekiwane: 8 NEAR, brak kontraktu, 1 access key.

---

## B. Deploy + init (jedna transakcja, podpisuje CONTRACT)

```sh
near contract deploy $CONTRACT use-file contracts/drop1/res/neargotchi_drop1.wasm with-init-call new json-args "$(cat contracts/drop1/res/mainnet/init.json)" prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM
```
Oczekiwane: `deployed code hash … == local build`; `drop_status: minted 0/300, pending 0, paused True, catalog 0/300, limit 5, frozen False`; `team() = neargotchiai.near`; `owner() = drop1.neargochi-dev.near (setup phase…)`; `base_uri = https://ipfs.io/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm`; WARN „1 access key(s)” (zgodnie z planem do kroku J).

---

## C. Katalog: 6 partii po 50 (podpisuje CONTRACT)

Po każdej partii sprawdź `catalog_loaded`. Jeśli partia padnie: nie wysyłaj kolejnych; wyślij ponownie **tylko** brakującą (partia k = id 50·(k−1)+1 … 50·k). Ponowne wysłanie partii, która już weszła, kończy się „token id already loaded” i niczego nie zmienia.

```sh
near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-1.json)" prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `catalog_loaded: 50`.

```sh
near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-2.json)" prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `catalog_loaded: 100`.

```sh
near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-3.json)" prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `catalog_loaded: 150`.

```sh
near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-4.json)" prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `catalog_loaded: 200`.

```sh
near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-5.json)" prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `catalog_loaded: 250`.

```sh
near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-6.json)" prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `catalog_loaded: 300`.

---

## D. base_uri — dedykowana bramka Pinaty

ipfs.io i dweb.link są od 2026-09-21 wyłączone dla hotlinków (każde żądanie = 429), a publiczna `gateway.pinata.cloud` daje 429 po ok. 5 żądaniach z IP — żadnej z nich nie używać (`docs/DEVLOG.md`). `base_uri` = dedykowana bramka projektu, **z `/` na końcu**. Na mainnecie już ustawione (tx `36Hu1Zb3cBiNJ8NLKA1Puj6fkNdbmgBdJTrEc4nC21V4`); blok poniżej tylko przy ponownej zmianie (podpisuje **OWNER**, bo własność już przeszła; przed krokiem H podpisywał CONTRACT):

```sh
near contract call-function as-transaction $CONTRACT set_base_uri json-args '{"base_uri":"https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/"}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near contract call-function as-read-only $CONTRACT nft_metadata json-args '{}' network-config $NET now
```
Oczekiwane: `"base_uri": "https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/"`.

```sh
curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download} B\n' https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/195.png
```
Oczekiwane: `200 image/png 489933 B` (sprawdzone 2026-11-12). Bramka wymaga płatnego planu Pinaty (Picnic): Free mieści 500 plików, drop 1 to 600.

---

## E. Test mint (sprzedaż otwarta tylko na kilka sekund)

```sh
near contract call-function as-transaction $CONTRACT unpause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```

```sh
near contract call-function as-transaction $CONTRACT nft_mint json-args '{}' prepaid-gas '100.0 Tgas' attached-deposit '2 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
```

```sh
near contract call-function as-transaction $CONTRACT pause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `minted: 1`, `pending: 0`, `paused: true`, `catalog_loaded: 300`, `metadata_frozen: false`.

```sh
near contract call-function as-read-only $CONTRACT accrued json-args '{}' network-config $NET now
```
Oczekiwane: `team: "1990000000000000000000000"` (1,99 NEAR — pierwszy mint idzie w całości do TEAM), `holders_credited: "0"`.

```sh
near contract call-function as-read-only $CONTRACT nft_tokens_for_owner json-args "{\"account_id\":\"$OWNER\"}" network-config $NET now
```
Oczekiwane: jeden token; zapamiętaj `token_id` (dalej `<ID>`); `media` = `<ID>.png`.

Otwórz w przeglądarce `https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/<ID>.png` (mainnet: `<ID>` = 195) i sprawdź token w zakładce NFT portfela (Meteor / MyNearWallet) — obrazek musi się wyświetlić. Jeśli nie: **stop**, nie rób F (po freeze `base_uri` nie da się poprawić; przed freeze — `set_base_uri`, runbook §7).

---

## F. Freeze metadanych — NIEODWRACALNE — ODŁOŻONE

**Na mainnecie celowo nie wykonane:** `base_uri` zostaje zmienne do czasu, aż będzie drugi dostawca pinów (po CID) i/lub własna domena bramki; integralność obrazków chroni `media_hash` + CID. Plan: freeze po hackathonie. Ponieważ krok H już był, freeze podpisuje **OWNER** (komenda niżej).

Po tej transakcji `base_uri` i katalog są zamrożone na zawsze. Najpierw sprawdź jeszcze raz:

```sh
python3 scripts/ipfs_drop1.py cid ipfs/drop1 bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm
```
Oczekiwane: wypisuje dokładnie `bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm`.

```sh
near contract call-function as-read-only $CONTRACT nft_metadata json-args '{}' network-config $NET now
```
Oczekiwane: `base_uri` jak w D, a obrazek z E się otworzył.

```sh
near contract call-function as-transaction $CONTRACT freeze_metadata json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
```
Oczekiwane: `metadata_frozen: true`, `paused: true`.

---

## G. propose_owner(neargochi-dev.near) — podpisuje CONTRACT

```sh
near contract call-function as-transaction $CONTRACT propose_owner json-args "{\"owner_id\":\"$OWNER\"}" prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near contract call-function as-read-only $CONTRACT proposed_owner json-args '{}' network-config $NET now
```
Oczekiwane: dokładnie `"neargochi-dev.near"`. Inna nazwa (literówka) = nieszkodliwe, nikt jej nie przyjmie: powtórz G z poprawną.

---

## H. accept_owner — podpisuje OWNER

```sh
near contract call-function as-transaction $CONTRACT accept_owner json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near contract call-function as-read-only $CONTRACT proposed_owner json-args '{}' network-config $NET now
```
Oczekiwane: `null` (propozycja zużyta).

---

## I. Weryfikacja ownera — warunek konieczny przed J

```sh
near contract call-function as-read-only $CONTRACT owner json-args '{}' network-config $NET now
```
Oczekiwane: dokładnie `"neargochi-dev.near"` (kontrakt nie ma pola `owner_id` w widokach; właściciela zwraca metoda `owner`).

Dowód, że OWNER naprawdę ma uprawnienia (kontrakt jest już zapauzowany, więc `pause` niczego nie zmienia; przy złym ownerze transakcja padnie z „owner only”):
```sh
near contract call-function as-transaction $CONTRACT pause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
```
Oczekiwane: sukces, bez „owner only”.

```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM
```
Oczekiwane: `owner() = neargochi-dev.near` (bez dopisku „setup phase”), `frozen True`, `paused True`, `catalog 300/300`, `minted 1/300`, `team() = neargotchiai.near`, `all checks passed`; WARN „1 access key(s)” zostaje do J.

**Jeśli `owner()` to nadal `drop1.neargochi-dev.near` albo cokolwiek innego niż `neargochi-dev.near` — STOP, nie rób J.** Po skasowaniu kluczy kontrakt będący własnym ownerem nie może już podpisać niczego: nikt nigdy nie zrobi `unpause`, `pause`, `set_team` ani `withdraw_surplus`.

---

## J. Kasowanie kluczy kontraktu — NIEODWRACALNE

> **UWAGA: tego nie da się cofnąć.** Po usunięciu ostatniego klucza konto `drop1.neargochi-dev.near` nie ma żadnego klucza dostępu: nikt (Ty też) nie wgra innego kodu, nie poprawi błędu w kontrakcie i nie podpisze transakcji w imieniu kontraktu. O to chodzi (holderzy nie muszą ufać posiadaczowi klucza), ale wolno to zrobić **dopiero gdy I pokazało `owner() = neargochi-dev.near`** i test mint z E jest poprawny. Błąd znaleziony później = `pause` + nowy kontrakt na nowym koncie (runbook „Rollback”).

Wypisz klucze — **konta kontraktu** (`$CONTRACT`), nie ownera:
```sh
near account list-keys $CONTRACT network-config $NET now
```
Oczekiwane: dokładnie jeden klucz full access (ten z kroku A). Skopiuj jego `ed25519:…`.

Wstaw klucz zamiast `ed25519:WKLEJ_KLUCZ_Z_LIST_KEYS`:
```sh
export CONTRACT_PK=ed25519:WKLEJ_KLUCZ_Z_LIST_KEYS
```

```sh
echo "kasuję klucz $CONTRACT_PK z konta $CONTRACT (NIE z $OWNER)"
```
Przeczytaj: konto musi być `drop1.neargochi-dev.near`, klucz ten sam co z `list-keys`.

```sh
near account delete-keys $CONTRACT public-keys $CONTRACT_PK network-config $NET sign-with-keychain send
```

Sprawdź:
```sh
near account list-keys $CONTRACT network-config $NET now
```
Oczekiwane: pusta lista. Jeśli `list-keys` pokazał więcej niż jeden klucz, usuń wszystkie (lista po przecinku w `public-keys`).

```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM
```
Oczekiwane: `contract account has 0 access key(s) — code is final`, `owner() = neargochi-dev.near`, `all checks passed`.

```sh
near account list-keys $OWNER network-config $NET now
```
Oczekiwane: klucze ownera **nadal są** (sprawdzenie, że nie skasowano kluczy nie tego konta).

---

Dalej: front na mainnet (runbook §12), potem start sprzedaży `unpause` podpisany przez OWNER (runbook §13). Wpis klucza CONTRACT w keychainie jest po J bezużyteczny; można go zostawić albo usunąć w Keychain Access (wpis „near-cli”, konto `drop1.neargochi-dev.near`).

---

## Upgrade drop1 (A-01): bramka gazu przeciw przesiewaniu losowania — PRZYGOTOWANE, NIEWYKONANE

Zadanie 102. Zmiana kodu: `nft_mint` odrzuca < 35 Tgas, `on_reveal` / `reveal` odrzucają < 18 Tgas **przed** losowaniem
(`contracts/drop1/src/lib.rs`: `GAS_MINT_MIN`, `GAS_REVEAL_MIN`). Układ stanu bez zmian, bez migracji, bez `init`.
Front (100 Tgas) bez zmian. **Nic z tej sekcji nie zostało wykonane na mainnecie.**

**Kiedy:** dopiero gdy klucz FullAccess konta kontraktu **jeszcze istnieje** (przed krokiem J) i `paused: true`. Po J
nikt nie może już zmienić kodu: wtedy zostaje stary kod z A-01 na zawsze. Podpisuje CONTRACT (jego klucz jest w keychainie
near-cli-rs), nie OWNER.

### (a) PRZED: zapisz stan do pliku
```sh
export NET=mainnet OWNER=neargochi-dev.near CONTRACT=drop1.neargochi-dev.near TEAM=neargotchiai.near
```
```sh
for m in drop_status nft_total_supply proposed_owner accrued reward_per_token locked_balance owner team provenance nft_metadata; do echo "-- $m"; near contract call-function as-read-only $CONTRACT $m json-args '{}' network-config $NET now 2>&1 | grep -v -E '^$|console command|^\s*near contract'; done | tee /tmp/drop1-before.txt
```
```sh
for id in 195 253 286; do echo "-- nft_token $id"; near contract call-function as-read-only $CONTRACT nft_token json-args "{\"token_id\":\"$id\"}" network-config $NET now 2>&1 | grep -v -E '^$|console command|^\s*near contract'; done | tee -a /tmp/drop1-before.txt
```
```sh
near account view-account-summary $CONTRACT network-config $NET now 2>&1 | tee -a /tmp/drop1-before.txt | grep -i -E "hash|balance|storage"
```
Oczekiwane (stan z 2026-11-13): `paused:true`, `minted:3`, `pending:0`, `nft_total_supply "3"`, `proposed_owner null`,
`owner neargochi-dev.near`, `team neargotchiai.near`, tokeny 195 / 253 / 286, kod `D7z3DKfjddZ6XRRpQUX7BXSMzLn24wHtwFePtCFpArTM`
(= `b41638a1…`, stary wasm). Jeśli cokolwiek innego: stop.

### (b) Hash nowego wasm (sprawdź przed deployem)
```sh
(cd contracts/drop1 && ./build.sh) && shasum -a 256 contracts/drop1/res/neargotchi_drop1.wasm
```
Wynik z 2026-11-13 (bieżący kod, `build.sh` bez `--locked`; sprawdź ponownie przed deployem; jeśli kod się zmienił, hash też):
`a3412e7aa1e1f6df63beb0dd32ce7e2241d6543fcd51cfd7cf1603512d8b003a`, 376 608 B, w base58 (tak widzi go łańcuch) `BzH6tuQv4EDojTH2Fw2utZQKzP7HCGnma1FVL3vanhwf`.
Stary wasm mainnetu leży lokalnie jako `contracts/drop1/res/neargotchi_drop1-mainnet-b41638a1.wasm` (katalog `res/` jest w `.gitignore`).

### (c) Deploy (WYSYŁA transakcję; zamień `send` na `display`, żeby tylko podpisać)
```sh
near contract deploy $CONTRACT use-file contracts/drop1/res/neargotchi_drop1.wasm without-init-call network-config $NET sign-with-keychain send
```
Bez `init`: wywołanie `new` drugi raz zepsułoby stan. Koszt: gaz ≈ 0,003 NEAR + ok. 0,02 NEAR więcej blokady na storage (większy wasm).

### (d) PO: te same widoki muszą dać te same wartości
```sh
for m in drop_status nft_total_supply proposed_owner accrued reward_per_token locked_balance owner team provenance nft_metadata; do echo "-- $m"; near contract call-function as-read-only $CONTRACT $m json-args '{}' network-config $NET now 2>&1 | grep -v -E '^$|console command|^\s*near contract'; done > /tmp/drop1-after.txt; for id in 195 253 286; do echo "-- nft_token $id"; near contract call-function as-read-only $CONTRACT nft_token json-args "{\"token_id\":\"$id\"}" network-config $NET now 2>&1 | grep -v -E '^$|console command|^\s*near contract'; done >> /tmp/drop1-after.txt; diff /tmp/drop1-before.txt /tmp/drop1-after.txt
```
Różnić się może **tylko** `locked_balance` (rośnie o koszt storage większego wasm, na ng67: +0,002 NEAR) i kod w `view-account-summary`.
`drop_status` nadal `paused:true`. Nie rób `unpause`.

Sprawdź też bramkę (bez wydawania 2 NEAR: kontrakt jest zapauzowany, więc `nft_mint` i tak by się cofnął, ale bramka gazu odpowiada pierwsza):
```sh
near contract call-function as-transaction $CONTRACT nft_mint json-args '{}' prepaid-gas '20.0 Tgas' attached-deposit '2 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
```
Oczekiwane: `attach more gas: at least 35 Tgas`; saldo OWNER spada tylko o gaz.

### (e) Hash z kodu i gdzie go wpisać
- Odtworzenie: `cd contracts/drop1 && ./build.sh && shasum -a 256 res/neargotchi_drop1.wasm`, zestaw z `code_hash` z RPC (base58 sha256 pliku).
- **Dopiero po Twoim potwierdzeniu, że deploy się odbył** wpisz nowy hash jako wdrożony w: `README.md` (sekcja kontraktu / "How it works"),
  `docs/MAINNET-RUNBOOK.md` (rekord deployu), `docs/CONTRACT-SETUP.md` oraz zaktualizuj w `lib/copy.ts` FAQ tylko to, co wtedy będzie prawdą
  (klucz kontraktu i `freeze_metadata` to osobne kroki F / J; patrz audyt A-02). Do tej pory w dokumentach mainnetowy kod to `b41638a1…`.
