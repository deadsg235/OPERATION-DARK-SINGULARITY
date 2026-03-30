# Onboarding Guide — OPERATION-DARK-SINGULARITY

Welcome to the kagenti ecosystem! This guide gets you from clone to running service.

## Quick Start

```bash
cd /home/mdupont/git/github.com/deadsg235/OPERATION-DARK-SINGULARITY
make install
make dev
```

## Prerequisites

### Option A: Nix (recommended)
```bash
nix develop   # drops you into a shell with all deps
make dev
```

### Option B: Manual
```bash
npm install
npm run dev
```

## Project Structure

- `Makefile` — build/dev/test/clean targets
- `flake.nix` — reproducible Nix dev environment
- Service port: **9123**

## Testing

```bash
npm test
```

## kagenti Integration

This repo is registered as a kagenti agent in the `deadsg` namespace.

| Field | Value |
|-------|-------|
| Agent name | `deadsg-operation-dark-singularity` |
| Namespace | `deadsg` |
| Type | `node` |
| Port | `9123` |
| Health | `http://127.0.0.1:9123/` |

### systemd

```bash
# Install the service
cp systemd/deadsg-operation-dark-singularity.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now deadsg-operation-dark-singularity

# Check status
systemctl --user status deadsg-operation-dark-singularity
curl http://127.0.0.1:9123/
```

## Monster Group Orbifold

Your repo maps to orbifold coordinate **(35, 19, 19)** in the 196,883-cell Monster torus (71 × 59 × 47).

- Conformal weight: h = 1.2192
- Bott class: B1
- Eigenspace: Spoke

This coordinate is used by the FRACTRAN navigator and CFT analysis tools.

## erdfa Shards

Source files are content-hashed to DA51 CBOR shards for the erdfa content-addressed layer.

```bash
make erdfa   # regenerate shard index
```

## Contributing

1. Fork this repo
2. `nix develop` for reproducible environment
3. Make changes, `make test`
4. PR back to `deadsg235/OPERATION-DARK-SINGULARITY`

## Links

- [kagenti ecosystem](https://github.com/meta-introspector/kagenti)
- [notebooklm-tools](https://github.com/meta-introspector/notebooklm-tools)
- [FRACTRAN breeder](https://github.com/meta-introspector/fractran-breed-rs)
