# OAB – On Air Broadcast

Internet radio studio by **AD SOUND & SERVICE**.

- `server/` – the OAB server (Python, standard library only) and the web pages:
  studio (`/studio`), listener player (`/`), phone broadcast app (`/mobile`), remote (`/remote`).
- `desktop/` – OAB Studio for Windows (Electron). It starts the server with a bundled Python
  and shows the studio in its own window. Settings live in `%APPDATA%\OAB`.

## Changing the studio

Edit `server/web/core.js`, `server/web/phases.js` or `server/web/studio.tpl.html`, then:

```
python server/dev/gen_light.py   # only after CSS changes (light theme)
python server/dev/assemble.py    # builds server/web/studio.html
```

## Releasing an update

1. Raise the version in `desktop/package.json` (and `VERSION` in `server/server.py`).
2. Commit, then push a tag: `git tag v1.2.3 && git push origin v1.2.3`.
3. GitHub Actions builds `OAB-Studio-Setup-1.2.3.exe` and publishes the release.
   Installed copies of OAB Studio download it and offer to restart.
