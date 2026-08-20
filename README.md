# HYROX Dashboard · Sub-60 · Basel 2027

Statisches Dashboard, gehostet über GitHub Pages.

## Dateien

| Datei | Wer pflegt | Inhalt |
|---|---|---|
| `data.json` | Claude liefert, Import schreibt | Periodisierung, Wochenpläne + Prompts, Benchmarks, Gap-Analyse, Referenz-Splits, Metrik-Definitionen |
| `log.json` | Marc (im Dashboard) | Erfasste Sessions inkl. Kennzahlen |
| `index.html` | – | Markup + CSS |
| `app.js` | – | Rendering, Formular, GitHub-Sync |

Datei und Layout sind getrennt: Inhalt ändern heisst JSON ändern, nicht HTML.

## Einträge erfassen

Reiter **Log** → *Session erfassen*. Kennzahlen (`lunge30`, `comprun`, `int1k`, `wb9`, `simtotal`, `hrv`, `rhr`)
speisen automatisch die Fortschrittskurven im Reiter *Daten*.

## Plan aktualisieren

Claudes GitHub-Connector ist **read-only** (bekanntes Problem, siehe anthropics/claude-ai-mcp#822),
er kann `data.json` also nicht selber committen. Stattdessen:

1. Neue `data.json` von Claude herunterladen
2. Dashboard → Reiter **Log** → *Plan importieren*
3. Datei reinziehen → *Prüfen* → *Übernehmen*

Der Import validiert vor dem Schreiben: gültiges JSON, vorhandene Pflichtabschnitte, gültiges `meta.raceDate`,
und er warnt, wenn eine Kennzahl wegfällt, die in bestehenden Log-Einträgen vorkommt.
Geschrieben wird mit **deinem** Token, nicht mit Claudes Rechten.

Der gleiche Dialog nimmt auch `log.json` an — nützlich zum Zurücksetzen aus einem Export.

## Sync einrichten

1. github.com/settings/personal-access-tokens → *Fine-grained token*
2. Nur dieses Repository, Berechtigung **Contents: Read and write**
3. Im Dashboard ⚙ → Repo + Token eintragen

Ohne Token funktioniert alles, die Einträge bleiben aber nur im Browser dieses Geräts.

## Neue Kennzahl

In `data.json` unter `metrics` ergänzen:

```json
{ "k": "sledpull", "n": "Sled Pull 12,5 m", "u": "time",
  "lo": "0:15", "hi": "0:45", "goal": "0:22", "dir": "down", "hint": "@ 150 kg" }
```

`dir: "down"` = kleiner ist besser. `u`: `time` | `pace` | `num`.
