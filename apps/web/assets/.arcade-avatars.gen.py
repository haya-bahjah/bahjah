"""Extract the arcade avatar pack out of the Claude Design handoff into a
single data file the site can load. Reads the three prototype files, takes
every <symbol> and every gradient <defs> child verbatim, namespaces their ids,
and writes apps/web/assets/arcade-avatars.js."""
import re, json, os, sys

SRC = "/tmp/av/bahjah-avatar-library-design/project"
FILES = ["Avatar Library.dc.html", "Avatar Pack Rich.dc.html", "Avatar Pack Helm.dc.html"]
OUT = "/home/user/bahjah/apps/web/assets/arcade-avatars.js"

sym_re = re.compile(r'<symbol id="(av-[^"]+)"(.*?)</symbol>', re.S)
grad_re = re.compile(r'<(linearGradient|radialGradient) id="([^"]+)"(.*?)</\1>', re.S)
avatars_re = re.compile(r'const AVATARS = \[(.*?)\n\];', re.S)
row_re = re.compile(r'\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]*)"\]')

symbols, grads, meta, order = {}, {}, {}, []

for f in FILES:
    s = open(os.path.join(SRC, f), encoding="utf-8").read()

    for m in grad_re.finditer(s):
        gid, body = m.group(2), m.group(0)
        if gid in grads and grads[gid] != body:
            sys.exit(f"gradient id clash with different bodies: {gid} in {f}")
        grads[gid] = body

    for m in sym_re.finditer(s):
        sid, inner = m.group(1), m.group(2)
        inner = inner.split(">", 1)[1]  # drop the rest of the opening tag (viewBox)
        if sid in symbols and symbols[sid] != inner:
            sys.exit(f"symbol id clash with different bodies: {sid} in {f}")
        symbols[sid] = inner

    am = avatars_re.search(s)
    if not am:
        sys.exit(f"no AVATARS array in {f}")
    for r in row_re.finditer(am.group(1)):
        aid, name, color, trait = r.group(1), r.group(2), r.group(3), r.group(4)
        if f"av-{aid}" not in symbols:
            sys.exit(f"AVATARS lists {aid} but no symbol for it in {f}")
        if aid in meta:
            if meta[aid] != (name, color, trait):
                sys.exit(f"metadata clash for {aid}")
            continue
        meta[aid] = (name, color, trait)
        order.append(aid)

if set(f"av-{a}" for a in order) != set(symbols):
    sys.exit("symbols and AVATARS disagree")

# Namespace every id so nothing can collide with ids already on a page, and
# repoint every url(#...) reference at the renamed ones.
def ns(markup):
    for gid in grads:
        markup = markup.replace(f"url(#{gid})", f"url(#bh-{gid})")
    return markup

defs = [body.replace(f'id="{gid}"', f'id="bh-{gid}"', 1) for gid, body in grads.items()]
for aid in order:
    inner = ns(symbols[f"av-{aid}"]).strip()
    defs.append(f'<symbol id="bh-av-{aid}" viewBox="0 0 120 120">{inner}</symbol>')

sprite = "".join(defs)
leftovers = [g for g in grads if f"url(#{g})" in sprite]
if leftovers:
    sys.exit(f"unrenamed references remain: {leftovers}")

roster = [{"id": a, "name": meta[a][0], "color": meta[a][1], "trait": meta[a][2]} for a in order]

HEADER = '''// The arcade avatar pack, lifted verbatim from the Claude Design handoff
// (Bahjah Avatar Library: "Avatar Library", "Avatar Pack Rich" and "Avatar
// Pack Helm"). Every path, gradient and colour here is the designer's --
// extracted by script, not redrawn -- so the avatars match the handoff
// exactly.
//
// The artwork is one SVG sprite: all the gradients the symbols reference,
// then one <symbol> per avatar. This file injects the sprite into the page
// once, the first time an arcade avatar renders, and assets/avatars.js draws
// each avatar as a <use> of its symbol -- which is how the handoff itself
// draws them. Every id carries a "bh-" prefix so the sprite can never collide
// with ids already in a page.
window.BahjahArcadeAvatars = (function () {
'''

FOOTER = '''
  let injected = false;
  function ensureSprite() {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute; width:0; height:0; overflow:hidden;';
    host.innerHTML = '<svg width="0" height="0"><defs>' + SPRITE + '</defs></svg>';
    (document.body || document.documentElement).appendChild(host);
  }

  function byId(id) {
    return ROSTER.find((a) => a.id === id) || null;
  }

  // The handoff frames these two ways: square tiles use the symbol's own
  // 0 0 120 120 box, and its round player chips pull back to -14 -10 148 148
  // so the character still reads once a circle crops the corners. Every place
  // this site shows an avatar is a circle, so the round framing is the
  // default and the tile framing is opt-in.
  const VIEWBOX_ROUND = '-14 -10 148 148';
  const VIEWBOX_TILE = '0 0 120 120';

  function markup(id, opts) {
    const avatar = byId(id);
    if (!avatar) return '';
    ensureSprite();
    const o = opts || {};
    const viewBox = o.tile ? VIEWBOX_TILE : VIEWBOX_ROUND;
    const glow = o.glow === false ? '' : ` filter:drop-shadow(0 0 6px ${COLORS[avatar.color]}66);`;
    return `<svg viewBox="${viewBox}" width="100%" height="100%" style="display:block;${glow}" role="img" aria-label="${avatar.name}">` +
      `<use href="#bh-av-${avatar.id}"></use></svg>`;
  }

  return { ROSTER, COLORS, byId, markup, ensureSprite };
})();
'''

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(HEADER)
    fh.write("  const COLORS = " + json.dumps({
        "purple": "#7C3AED", "pink": "#FF2DA6", "cyan": "#22D3EE",
        "green": "#39FF88", "yellow": "#FFE600", "white": "#F7F7FF",
    }, indent=4).replace("\n", "\n  ") + ";\n\n")
    fh.write("  // id, display name, accent colour and the handoff's one-line trait.\n")
    fh.write("  const ROSTER = [\n")
    for a in roster:
        fh.write("    " + json.dumps(a) + ",\n")
    fh.write("  ];\n\n")
    fh.write("  const SPRITE = " + json.dumps(sprite) + ";\n")
    fh.write(FOOTER)

print(f"{len(roster)} avatars, {len(grads)} gradients, sprite {len(sprite)} chars")
print("ids:", " ".join(a["id"] for a in roster))
