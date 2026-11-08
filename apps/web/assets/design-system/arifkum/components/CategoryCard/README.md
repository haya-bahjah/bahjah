# CategoryCard

One of the three question banks, tilted on its own angle, which the room picks in two steps: preview, then confirm.

| Category | Arabic | Accent | Glyph |
|---|---|---|---|
| Break the ice | اكسروا الجليد | green | ● |
| Imagine if | تخيل لو … | yellow | ▲ |
| For close ones only | للمقربين فقط | pink | ✕ |

- `data-cat-color` sets the 4px border, the tinted fill and the hover glow. The tilts are -1.8°, .9° and 2.1°.
- The pending card (`is-picked`) lifts 6px, scales to 1.03 and glows. The others (`is-dimmed`) fall back to 42% opacity. The TV renders the same cards with `is-static`.
- Under the cards, the sub-line reads *Imagine if is on the table. Not confirmed yet.* and the CTA reads *Start on Imagine if*. The gap between the two is the room's window to argue.
