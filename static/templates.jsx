// Story templates for Letterboxd reviews → 1080x1920 Instagram stories
//
// Each template is a React component that accepts:
//   { review, opts }  where opts can tweak accent, fonts, etc.
//
// All templates are designed at 1080×1920; canvas artboards will scale them.

const STORY_W = 1080;
const STORY_H = 1920;
const LONG_TOP_SAFE = 150;
const LONG_RIGHT_POSTER_LIFT = 44;

function hasRating(rating) {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0;
}

// Render star rating as text: ★★★½
window.starString = function (rating) {
  if (!hasRating(rating)) return "";
  const value = Math.min(Number(rating), 5);
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// Fit review text by auto-shrinking font size if needed.
// Measures via a hidden ref'd div; picks the largest size that fits container height.
function useFitFont({ text, minSize = 22, maxSize = 56, step = 2, deps = [] }) {
  const measureRef = React.useRef(null);
  // Optional inner target. If the template provides this (e.g. a <span> living
  // alongside a decorative prefix like a quote mark inside measureRef), we set
  // textContent on it instead of on measureRef itself — so the prefix stays in
  // place and contributes its real width to the wrapped-text measurement.
  const measureTextRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState(maxSize);
  const [truncated, setTruncated] = React.useState(false);
  const [shown, setShown] = React.useState(text);

  React.useLayoutEffect(() => {
    let cancelled = false;
    const measureAndFit = () => {
      if (cancelled) return;
      const container = containerRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;
      const textTarget = measureTextRef.current || measure;
      const availH = container.clientHeight;

      // Try largest -> smallest
      for (let s = maxSize; s >= minSize; s -= step) {
        measure.style.fontSize = s + "px";
        textTarget.textContent = text;
        if (measure.scrollHeight <= availH) {
          setTruncated(false);
          setShown(text);
          setSize(s);
          return;
        }
      }
      // Still too long at min — truncate with ellipsis
      measure.style.fontSize = minSize + "px";
      let lo = 0, hi = text.length, best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        textTarget.textContent = text.slice(0, mid).trimEnd() + "…";
        if (measure.scrollHeight <= availH) {
          best = mid; lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      // Prefer last sentence boundary
      const slice = text.slice(0, best);
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
      const finalText = (lastBreak > best * 0.6 ? slice.slice(0, lastBreak + 1) : slice.trimEnd()) + "…";
      setShown(finalText);
      setTruncated(true);
      setSize(minSize);
    };

    // Wait for web fonts before measuring — otherwise the fallback font's
    // metrics produce a stale fit and the real font overflows the container
    // once it swaps in, causing the body to get clipped without an ellipsis.
    if (document.fonts?.ready) {
      document.fonts.ready.then(measureAndFit);
    } else {
      measureAndFit();
    }
    return () => { cancelled = true; };
  }, [text, minSize, maxSize, step, ...deps]);

  return { size, truncated, shown, containerRef, measureRef, measureTextRef };
}

// Compute smart object-position for an image by finding its visual focal point.
// Returns e.g. "35% 20%" so CSS object-fit: cover crops around the subject.
function useSmartCrop(src, cropWidth, cropHeight) {
  const [pos, setPos] = React.useState("center");

  React.useEffect(() => {
    if (!src || typeof smartcrop === "undefined") return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      smartcrop.crop(img, { width: cropWidth, height: cropHeight }).then(result => {
        if (cancelled) return;
        const c = result.topCrop;
        const cx = (c.x + c.width / 2) / img.naturalWidth * 100;
        const cy = (c.y + c.height / 2) / img.naturalHeight * 100;
        setPos(`${Math.round(cx)}% ${Math.round(cy)}%`);
      });
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, cropWidth, cropHeight]);

  return pos;
}

// Extract a color palette from an image for reactive theming.
// Returns { dominant, accent, palette, isDark } where colors are "r,g,b" strings.
function useImagePalette(src) {
  const [result, setResult] = React.useState({
    dominant: null, accent: null, palette: [], isDark: true,
  });

  React.useEffect(() => {
    if (!src || typeof ColorThief === "undefined") return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const ct = new ColorThief();
        const dom = ct.getColor(img);
        const pal = ct.getPalette(img, 6);
        const lum = (0.299 * dom[0] + 0.587 * dom[1] + 0.114 * dom[2]) / 255;
        // Pick the most saturated color from the palette as accent
        const sat = ([r, g, b]) => {
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          return mx === 0 ? 0 : (mx - mn) / mx;
        };
        const accent = pal.slice().sort((a, b) => sat(b) - sat(a))[0] || dom;
        setResult({
          dominant: dom,
          accent,
          palette: pal,
          isDark: lum < 0.5,
        });
      } catch (_) {}
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return result;
}

const STAR_ORANGE = [255, 128, 0];
function starColor(bgRgb) {
  if (!bgRgb) return "#ff8000";
  const dr = bgRgb[0] - STAR_ORANGE[0], dg = bgRgb[1] - STAR_ORANGE[1], db = bgRgb[2] - STAR_ORANGE[2];
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  return dist < 120 ? "#ffffff" : "#ff8000";
}

// Tiny SVG Letterboxd logo (3 dots)
function LetterboxdMark({ size = 56 }) {
  const r = size * 0.2;
  return (
    <svg width={size} height={size * 0.4} viewBox="0 0 100 40">
      <circle cx="20" cy="20" r="16" fill="#00e054" />
      <circle cx="50" cy="20" r="16" fill="#40bcf4" />
      <circle cx="80" cy="20" r="16" fill="#ff8000" opacity="0.95" />
    </svg>
  );
}

// Reviewer footer chip used by several templates
function ReviewerFooter({ handle, color = "rgba(255,255,255,0.85)", align = "left" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      color, fontSize: 26, letterSpacing: 0.5,
      justifyContent: align === "center" ? "center" : "flex-start",
    }}>
      <LetterboxdMark size={44} />
      <span style={{ opacity: 0.9 }}>review by <strong style={{ fontWeight: 700 }}>@{handle}</strong></span>
    </div>
  );
}

// Convert rating into filled + half + empty star glyphs with subtle visual weight
function StarRow({ rating, color = "#ff8000", size = 56, opacity = 1 }) {
  if (!hasRating(rating)) return null;
  const value = Math.min(Number(rating), 5);
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div style={{ fontSize: size, lineHeight: 1, color, letterSpacing: 2, opacity, fontFamily: "serif" }}>
      {"★".repeat(full)}{half ? "½" : ""}
      <span style={{ opacity: 0.22 }}>{"★".repeat(empty)}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared frame
// ─────────────────────────────────────────────────────────────
function StoryFrame({ children, bg = "#0d0d0f", style }) {
  return (
    <div style={{
      width: STORY_W, height: STORY_H, position: "relative",
      overflow: "hidden", background: bg, color: "white",
      fontFamily: "'Inter', system-ui, sans-serif",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SHORT TEMPLATES (poster can breathe)
// ═════════════════════════════════════════════════════════════

// ── SHORT 1: Poster hero with floating glass card ─────────────
// Refined version of user's reference image
function ShortPosterHero({ review }) {
  const len = review.review.length;
  const reviewSize = len < 100 ? 48 : len < 200 ? 40 : 32;
  const titleSize = len < 100 ? 84 : 72;
  const posterPos = useSmartCrop(review.poster, 380, 570);

  return (
    <StoryFrame bg="#0d0d0f">
      {/* Blurred backdrop — scale up to hide image edges within overflow:hidden */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${review.backdrop || review.poster})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(80px) brightness(0.65) saturate(1.3)",
        transform: "scale(1.5)",
      }} />
      {/* Color wash from accent */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 30% 20%, ${review.accent}33 0%, transparent 55%),
                     radial-gradient(ellipse at 70% 90%, ${review.accent}22 0%, transparent 60%)`,
        mixBlendMode: "screen",
      }} />
      {/* Film grain overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.18, mixBlendMode: "overlay",
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }} />
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.55) 100%)",
      }} />

      {/* Content */}
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 80px 100px", gap: 32 }}>
        {/* Poster */}
        <img src={review.poster} style={{
          width: 380, height: 570, objectFit: "cover", objectPosition: posterPos, borderRadius: 12,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)",
        }} />

        {/* Title + stars */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{
            fontSize: titleSize, fontWeight: 700, letterSpacing: -1.5,
            textAlign: "center", margin: 0, lineHeight: 1.05,
          }}>
            {review.title}
            <span style={{ fontWeight: 300, opacity: 0.7 }}>, {review.year}</span>
          </h1>
          {hasRating(review.rating) && (
            <div style={{ marginTop: 16 }}>
              <StarRow rating={review.rating} color={review.accent} size={56} />
            </div>
          )}
        </div>

        {/* Review text */}
        <p style={{
          fontSize: reviewSize, lineHeight: 1.45, textAlign: "center",
          color: "rgba(255,255,255,0.93)", maxWidth: 820, margin: 0,
          fontWeight: 300, letterSpacing: 0.1,
        }}>
          {review.review}
        </p>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 60, left: 0, right: 0 }}>
        <ReviewerFooter handle={review.reviewer} align="center" />
      </div>
    </StoryFrame>
  );
}

// ── SHORT 2: Ticket stub ──────────────────────────────────────
function ShortTicketStub({ review }) {
  const len = review.review.length;
  const reviewSize = len < 100 ? 38 : len < 200 ? 32 : 26;

  return (
    <StoryFrame bg="#1a0f0a">
      {/* Warm cinema-curtain gradient backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at top, #4a2616 0%, #2a130a 45%, #140806 100%)",
      }} />
      {/* Color wash from poster — rendered as a tiny hidden img to extract palette feel */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, rgba(180,100,60,0.25) 0%, transparent 70%)",
      }} />
      {/* Warm spotlight from above */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,180,120,0.18) 0%, transparent 70%)",
      }} />
      {/* Grain */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.14, mixBlendMode: "overlay",
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.8'/></svg>\")",
      }} />

      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
        {/* Ticket */}
        <div style={{
          width: 900, background: "#f4ede0", color: "#1a0f0a",
          borderRadius: 14,
          display: "flex", flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,0,0,0.1)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Perforation dots on sides */}
          <div style={{ position: "absolute", left: -10, top: "52%", bottom: 0, width: 20 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: "#1a0f0a", margin: "14px 0" }} />
            ))}
          </div>
          <div style={{ position: "absolute", right: -10, top: "52%", bottom: 0, width: 20 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: "#1a0f0a", margin: "14px 0" }} />
            ))}
          </div>

          {/* Top part - poster hero */}
          <div style={{ padding: "52px 64px 36px", borderBottom: "3px dashed #1a0f0a", display: "flex", gap: 40, alignItems: "center", overflow: "hidden" }}>
            <img src={review.poster} style={{
              width: 220, height: 330, objectFit: "cover", flexShrink: 0,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 18, textTransform: "uppercase", letterSpacing: 4,
                color: "#8b5a3c", fontWeight: 600, marginBottom: 14,
              }}>
                Admit One · Showing
              </div>
              <h1 style={{
                fontSize: 64, fontWeight: 800, letterSpacing: -1,
                margin: 0, lineHeight: 0.95,
                fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
              }}>
                {review.title}
              </h1>
              <div style={{ fontSize: 26, opacity: 0.65, marginTop: 8, fontStyle: "italic" }}>{review.year}</div>
              {hasRating(review.rating) && (
                <div style={{ marginTop: 20 }}>
                  <StarRow rating={review.rating} color="#c8441a" size={46} />
                </div>
              )}
            </div>
          </div>

          {/* Bottom part - review */}
          <div style={{ padding: "44px 64px 54px" }}>
            <div style={{
              fontSize: 15, textTransform: "uppercase", letterSpacing: 4,
              color: "#8b5a3c", fontWeight: 600, marginBottom: 18,
            }}>
              ── The Review ──
            </div>
            <p style={{
              fontSize: reviewSize, lineHeight: 1.45, margin: 0,
              fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
              fontWeight: 400,
            }}>
              {review.review}
            </p>
            <div style={{
              marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(26,15,10,0.15)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 20, color: "#1a0f0a", opacity: 0.6, letterSpacing: 1,
            }}>
              <span style={{ textTransform: "uppercase" }}>Seat · @{review.reviewer}</span>
              <span style={{ fontFamily: "monospace" }}>№ {String(Math.abs(review.title.length * 997 + review.year)).slice(0, 6)}</span>
            </div>
          </div>
        </div>
      </div>
    </StoryFrame>
  );
}

// ── SHORT 3: Full-bleed poster with type overlay ──────────────
function ShortFullBleed({ review }) {
  const len = review.review.length;
  const reviewSize = len < 100 ? 48 : len < 200 ? 40 : 32;
  const posterPos = useSmartCrop(review.poster, STORY_W, STORY_H);
  const palette = useImagePalette(review.poster);

  const dom = palette.dominant || [0, 0, 0];
  const gradDark = `rgba(${Math.round(dom[0]*0.25)},${Math.round(dom[1]*0.25)},${Math.round(dom[2]*0.25)}`;
  const textColor = palette.isDark ? "rgba(255,255,255,0.93)" : "rgba(20,20,20,0.92)";
  const textSub = palette.isDark ? "rgba(255,255,255,0.72)" : "rgba(20,20,20,0.65)";
  const footerColor = palette.isDark ? "rgba(255,255,255,0.85)" : "rgba(20,20,20,0.8)";
  const stars = starColor(dom);

  return (
    <StoryFrame>
      {/* Full bleed poster */}
      <img src={review.poster} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", objectPosition: posterPos,
      }} />
      {/* Gradient overlay tinted to dominant color */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${gradDark},0.15) 0%, ${gradDark},0.05) 30%, ${gradDark},0.8) 65%, ${gradDark},0.97) 100%)`,
      }} />

      {/* Bottom content */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "80px 80px 70px",
        display: "flex", flexDirection: "column", gap: 32,
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 18,
            fontSize: 22, letterSpacing: 6, textTransform: "uppercase",
            color: textSub, marginBottom: 16, fontWeight: 500,
          }}>
            <span>{review.year}</span>
            <StarRow rating={review.rating} color={stars} size={30} />
          </div>
          <h1 style={{
            fontSize: 140, fontWeight: 900, letterSpacing: -4,
            margin: 0, lineHeight: 0.9, color: textColor,
            fontFamily: "'Inter', sans-serif",
          }}>
            {review.title}
          </h1>
        </div>

        <div style={{
          width: 80, height: 3, background: stars,
        }} />

        <p style={{
          fontSize: reviewSize, lineHeight: 1.4, margin: 0,
          color: textColor,
          fontWeight: 300, letterSpacing: 0.2,
          maxWidth: 900,
        }}>
          {review.review}
        </p>

        <div style={{ marginTop: 12 }}>
          <ReviewerFooter handle={review.reviewer} color={footerColor} />
        </div>
      </div>
    </StoryFrame>
  );
}

// ═════════════════════════════════════════════════════════════
// LONG TEMPLATES (text priority, auto-fit)
// ═════════════════════════════════════════════════════════════

// ── LONG 1: Editorial / Criterion ─────────────────────────────
function LongEditorial({ review }) {
  const fit = useFitFont({
    text: review.review, minSize: 18, maxSize: 36, step: 1,
    deps: [review.id],
  });

  // Auto-fit title size based on character count. Short titles (≤30 chars) are
  // shrunk until they fit on a single line within the column; longer titles are
  // allowed to wrap to two lines. The wide safety margin (0.78) absorbs the
  // font-metric drift we see in html-to-image's export — the export sometimes
  // renders the title wider than the live page, so we shrink the page-side
  // title enough that even a drifted export still fits within the column.
  const TITLE_COL_W = 694;
  const TITLE_SAFETY = 0.78;
  const TITLE_MAX_LINES = review.title.length <= 18 ? 1 : 2;
  const [titleSize, setTitleSize] = React.useState(92);
  const titleProbeRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const probe = titleProbeRef.current;
    if (!probe) return;
    const fitTitle = () => {
      probe.style.width = TITLE_COL_W * TITLE_SAFETY + "px";
      let size = 92;
      while (size > 44) {
        probe.style.fontSize = size + "px";
        const lines = Math.max(1, Math.round(probe.scrollHeight / size));
        if (lines <= TITLE_MAX_LINES) break;
        size -= 2;
      }
      setTitleSize(size);
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(fitTitle);
    } else {
      fitTitle();
    }
  }, [review.title, review.id, TITLE_MAX_LINES]);

  return (
    <StoryFrame bg="#f4efe6">
      {/* html-to-image clones each element's computed pixel dimensions as
          inline styles, which freezes the layout to whatever the live page
          rendered. When the SVG export then reflows text with slightly
          different font metrics, the title's visual content overflows its
          pinned box but the year row stays at the page-pinned offset, causing
          overlap. This <style> rides inside the cloned tree so its
          !important rules win against the cloned inline styles, restoring
          content-driven sizing in the export. */}
      <style>{`
        .editorial-fluid {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
        }
      `}</style>

      {/* Paper texture */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.08,
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.85' /></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }} />

      <div style={{
        position: "relative", height: "100%",
        padding: `${LONG_TOP_SAFE}px 90px 80px`, display: "flex", flexDirection: "column",
        color: "#1a1918",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          paddingBottom: 24, borderBottom: "3px solid #1a1918",
        }}>
          <div>
            <div style={{
              fontSize: 20, letterSpacing: 5, textTransform: "uppercase",
              fontWeight: 700, marginBottom: 8,
            }}>
              A Review · Vol. {review.year.toString().slice(-2)}
            </div>
            <div style={{ fontSize: 22, fontStyle: "italic", opacity: 0.7 }}>
              by @{review.reviewer}
            </div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 2, textTransform: "uppercase", opacity: 0.55 }}>
            Letterboxd
          </div>
        </div>

        {/* Title */}
        <div className="editorial-fluid" style={{ marginTop: 34, marginBottom: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 170px", gap: 36, alignItems: "start" }}>
          <div className="editorial-fluid" style={{ minWidth: 0 }}>
            <h1 className="editorial-fluid" style={{
              fontSize: titleSize, fontWeight: 900, letterSpacing: -2.3,
              margin: 0, lineHeight: 1,
              fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
              overflowWrap: "break-word",
            }}>
              {review.title}
            </h1>
            {/* Hidden probe used to measure wrapped title height at each font-size. */}
            <h1 ref={titleProbeRef} aria-hidden="true" style={{
              position: "absolute", visibility: "hidden", pointerEvents: "none",
              top: 0, left: 0, margin: 0, padding: 0,
              fontWeight: 900, letterSpacing: -2.3, lineHeight: 1,
              fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
            }}>
              {review.title}
            </h1>
            <div className="editorial-fluid" style={{
              marginTop: 14, display: "flex", alignItems: "baseline",
              gap: 24, fontSize: 28,
            }}>
              <span style={{ opacity: 0.6, fontStyle: "italic" }}>{review.year}</span>
              {hasRating(review.rating) && (
                <span style={{ color: review.accent, fontSize: 38 }}>{window.starString(review.rating)}</span>
              )}
            </div>
          </div>
          <img src={review.poster} style={{
            width: 170, height: 255, objectFit: "cover",
            boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
          }} />
        </div>

        {/* Body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.42,
            fontFamily: "'Source Serif Pro', 'DM Serif Text', Georgia, serif",
            columnCount: 2, columnGap: 48, columnRule: "1px solid rgba(0,0,0,0.15)",
            whiteSpace: "pre-wrap",
          }}>
            {/* drop cap on first letter */}
            <span style={{
              float: "left", fontSize: fit.size * 3.2, lineHeight: 0.82,
              fontWeight: 900, paddingRight: 10, paddingTop: 6,
              fontFamily: "'DM Serif Display', Georgia, serif",
            }}>{fit.shown.charAt(0)}</span>
            {fit.shown.slice(1)}
          </div>
          {/* hidden measurer */}
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.42,
            fontFamily: "'Source Serif Pro', Georgia, serif",
            columnCount: 2, columnGap: 48,
            whiteSpace: "pre-wrap",
          }} />
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 28, borderTop: "1px solid rgba(0,0,0,0.15)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 20, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7,
        }}>
          <span>Letterboxd</span>
          <span>{fit.truncated ? "continued on profile →" : "fin."}</span>
        </div>
      </div>
    </StoryFrame>
  );
}

// ── LONG 2: Dark cinematic with sidebar poster ───────────────
function LongCinematic({ review }) {
  const fit = useFitFont({
    text: review.review, minSize: 20, maxSize: 40, step: 1,
    deps: [review.id],
  });

  return (
    <StoryFrame bg="#0a0a0c">
      {/* Subtle gradient */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${review.backdrop || review.poster})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(80px) brightness(0.3) saturate(1.4)",
        opacity: 0.7, transform: "scale(1.2)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(10,10,12,0.6) 0%, rgba(10,10,12,0.92) 100%)",
      }} />

      <div style={{
        position: "relative", height: "100%",
        padding: `${LONG_TOP_SAFE}px 80px 90px`, display: "flex", flexDirection: "column", gap: 30,
      }}>
        {/* Header: aligned title column with poster safely biased right */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 185px", gap: 34,
          alignItems: "end", marginTop: -LONG_RIGHT_POSTER_LIFT,
        }}>
          <div style={{ paddingTop: LONG_RIGHT_POSTER_LIFT }}>
            <div style={{
              fontSize: 22, letterSpacing: 5, textTransform: "uppercase",
              opacity: 0.5, marginBottom: 10, fontWeight: 500,
            }}>
              {review.year}
            </div>
            <h1 style={{
              fontSize: 68, fontWeight: 800, letterSpacing: -1.5,
              margin: 0, lineHeight: 0.95,
            }}>
              {review.title}
            </h1>
            {hasRating(review.rating) && (
              <div style={{ marginTop: 12 }}>
                <StarRow rating={review.rating} color={review.accent} size={34} />
              </div>
            )}
          </div>
          <img src={review.poster} style={{
            width: 185, height: 278, objectFit: "cover", borderRadius: 8,
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          }} />
        </div>

        {/* Accent line */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }} />

        {/* Review body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.48,
            fontWeight: 300, letterSpacing: 0.2,
            color: "rgba(255,255,255,0.92)",
            textAlign: "justify",
            whiteSpace: "pre-wrap",
          }}>
            <span style={{
              fontSize: "1.8em", color: review.accent,
              lineHeight: 0.8, marginRight: "0.2em", fontFamily: "Georgia, serif",
              verticalAlign: "-0.3em",
            }}>"</span>
            {fit.shown}
          </div>
          {/* Measure mirrors the rendered structure (including the leading
              quote span) so its scrollHeight reflects the width the quote
              steals from the first line. Em-based sizing on the quote keeps
              it in sync when useFitFont mutates the wrapper's fontSize. */}
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.48,
            fontWeight: 300, letterSpacing: 0.2,
            whiteSpace: "pre-wrap",
          }}>
            <span style={{
              fontSize: "1.8em", lineHeight: 0.8,
              marginRight: "0.2em", fontFamily: "Georgia, serif",
              verticalAlign: "-0.3em",
            }}>"</span>
            <span ref={fit.measureTextRef} />
          </div>
        </div>

        {/* Footer */}
        <ReviewerFooter handle={review.reviewer} />
      </div>
    </StoryFrame>
  );
}

// ── LONG 3: Minimal type-driven with poster chip ─────────────
function LongMinimal({ review }) {
  const fit = useFitFont({
    text: review.review, minSize: 22, maxSize: 44, step: 1,
    deps: [review.id],
  });

  return (
    <StoryFrame bg="#ece7dd">
      <div style={{
        position: "relative", height: "100%",
        padding: `${LONG_TOP_SAFE}px 80px 80px`, display: "flex", flexDirection: "column",
        color: "#1a1918",
      }}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 160px", gap: 32,
          alignItems: "end", marginTop: -LONG_RIGHT_POSTER_LIFT, marginBottom: 30,
        }}>
          <div style={{ minWidth: 0, paddingTop: LONG_RIGHT_POSTER_LIFT }}>
            <h1 style={{
              fontSize: 52, fontWeight: 800, letterSpacing: -1.2,
              margin: 0, lineHeight: 1,
              fontFamily: "'Inter', sans-serif",
            }}>
              {review.title}
            </h1>
            <div style={{
              marginTop: 8, fontSize: 22, opacity: 0.55, letterSpacing: 0.5,
            }}>
              {review.year}
              {hasRating(review.rating) && (
                <> · <span style={{ color: review.accent, fontWeight: 600 }}>{window.starString(review.rating)}</span></>
              )}
            </div>
          </div>
          <img src={review.poster} style={{
            width: 160, height: 240, objectFit: "cover", borderRadius: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }} />
        </div>

        {/* Body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.4,
            fontFamily: "'DM Serif Text', 'Source Serif Pro', Georgia, serif",
            textAlign: "justify",
            whiteSpace: "pre-wrap",
            color: "#1a1918",
          }}>
            {fit.shown}
          </div>
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.4,
            fontFamily: "'DM Serif Text', Georgia, serif",
            whiteSpace: "pre-wrap",
          }} />
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 36, paddingTop: 24, borderTop: "1px solid rgba(26,25,24,0.2)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 22, opacity: 0.6, letterSpacing: 2, textTransform: "uppercase" }}>
            @{review.reviewer}
          </div>
          <LetterboxdMark size={36} />
        </div>
      </div>
    </StoryFrame>
  );
}

// ── LONG 4: Vertical split — poster bleed left, text right ──
function LongVerticalSplit({ review }) {
  const fit = useFitFont({
    text: review.review, minSize: 20, maxSize: 38, step: 1,
    deps: [review.id],
  });
  const posterPos = useSmartCrop(review.poster, 410, 1920);
  const palette = useImagePalette(review.poster);

  const dom = palette.dominant || [24, 22, 24];
  const bgCSS = `rgb(${Math.round(dom[0]*0.15)},${Math.round(dom[1]*0.15)},${Math.round(dom[2]*0.15)})`;
  const gradCSS = `rgba(${Math.round(dom[0]*0.15)},${Math.round(dom[1]*0.15)},${Math.round(dom[2]*0.15)}`;
  const stars = starColor(dom);

  return (
    <StoryFrame bg={bgCSS}>
      {/* Left poster bleed */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "38%",
        overflow: "hidden",
      }}>
        <img src={review.poster} style={{
          width: "100%", height: "100%", objectFit: "cover",
          objectPosition: posterPos,
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, transparent 50%, ${bgCSS} 100%)`,
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg, ${gradCSS},0.3) 0%, transparent 20%, transparent 80%, ${gradCSS},0.4) 100%)`,
        }} />
      </div>

      {/* Right content */}
      <div style={{
        position: "absolute", left: "38%", top: 0, right: 0, bottom: 0,
        padding: `${LONG_TOP_SAFE}px 72px 80px 48px`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Year */}
        <div style={{
          fontSize: 22, letterSpacing: 6, textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)", fontWeight: 500, marginBottom: 8,
        }}>
          {review.year}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 64, fontWeight: 800, letterSpacing: -1.5,
          margin: 0, lineHeight: 0.95, color: "#fff",
        }}>
          {review.title}
        </h1>

        {/* Stars */}
        {hasRating(review.rating) && (
          <div style={{ marginTop: 14 }}>
            <StarRow rating={review.rating} color={stars} size={34} />
          </div>
        )}

        {/* Accent divider */}
        <div style={{
          width: 50, height: 3, background: stars,
          marginTop: 20, marginBottom: 24,
        }} />

        {/* Body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.45,
            fontWeight: 300, letterSpacing: 0.2,
            color: "rgba(255,255,255,0.88)",
            whiteSpace: "pre-wrap",
          }}>
            {fit.shown}
          </div>
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.45,
            fontWeight: 300, letterSpacing: 0.2,
            whiteSpace: "pre-wrap",
          }} />
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <ReviewerFooter handle={review.reviewer} />
        </div>
      </div>
    </StoryFrame>
  );
}

// ── LONG 5: Editorial Dark ──────────────────────────────────
function LongEditorialDark({ review }) {
  const fit = useFitFont({
    text: review.review, minSize: 18, maxSize: 36, step: 1,
    deps: [review.id],
  });

  const TITLE_COL_W = 694;
  const TITLE_SAFETY = 0.78;
  const TITLE_MAX_LINES = review.title.length <= 18 ? 1 : 2;
  const [titleSize, setTitleSize] = React.useState(92);
  const titleProbeRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const probe = titleProbeRef.current;
    if (!probe) return;
    const fitTitle = () => {
      probe.style.width = TITLE_COL_W * TITLE_SAFETY + "px";
      let size = 92;
      while (size > 44) {
        probe.style.fontSize = size + "px";
        const lines = Math.max(1, Math.round(probe.scrollHeight / size));
        if (lines <= TITLE_MAX_LINES) break;
        size -= 2;
      }
      setTitleSize(size);
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(fitTitle);
    } else {
      fitTitle();
    }
  }, [review.title, review.id, TITLE_MAX_LINES]);

  return (
    <StoryFrame bg="#111111">
      <style>{`
        .editorial-dark-fluid {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
        }
      `}</style>

      <div style={{
        position: "relative", height: "100%",
        padding: `${LONG_TOP_SAFE}px 90px 80px`, display: "flex", flexDirection: "column",
        color: "#d4c9b8",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          paddingBottom: 24, borderBottom: "1px solid rgba(212,201,184,0.2)",
        }}>
          <div>
            <div style={{
              fontSize: 20, letterSpacing: 5, textTransform: "uppercase",
              fontWeight: 700, marginBottom: 8, color: "#b8a88a",
            }}>
              A Review · Vol. {review.year.toString().slice(-2)}
            </div>
            <div style={{ fontSize: 22, fontStyle: "italic", opacity: 0.6 }}>
              by @{review.reviewer}
            </div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 2, textTransform: "uppercase", opacity: 0.35 }}>
            Letterboxd
          </div>
        </div>

        {/* Title + poster grid — matches light editorial layout */}
        <div className="editorial-dark-fluid" style={{ marginTop: 34, marginBottom: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 170px", gap: 36, alignItems: "start" }}>
          <div className="editorial-dark-fluid" style={{ minWidth: 0 }}>
            <h1 className="editorial-dark-fluid" style={{
              fontSize: titleSize, fontWeight: 900, letterSpacing: -2.3,
              margin: 0, lineHeight: 1, color: "#f0ebe4",
              fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
              overflowWrap: "break-word",
            }}>
              {review.title}
            </h1>
            <h1 ref={titleProbeRef} aria-hidden="true" style={{
              position: "absolute", visibility: "hidden", pointerEvents: "none",
              top: 0, left: 0, margin: 0, padding: 0,
              fontWeight: 900, letterSpacing: -2.3, lineHeight: 1,
              fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
            }}>
              {review.title}
            </h1>
            <div className="editorial-dark-fluid" style={{
              marginTop: 14, display: "flex", alignItems: "baseline",
              gap: 24, fontSize: 28,
            }}>
              <span style={{ opacity: 0.5, fontStyle: "italic" }}>{review.year}</span>
              {hasRating(review.rating) && (
                <span style={{ color: "#c8a050", fontSize: 38 }}>{window.starString(review.rating)}</span>
              )}
            </div>
          </div>
          <img src={review.poster} style={{
            width: 170, height: 255, objectFit: "cover",
            boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
          }} />
        </div>

        {/* Body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.42,
            fontFamily: "'Source Serif Pro', 'DM Serif Text', Georgia, serif",
            columnCount: 2, columnGap: 48, columnRule: "1px solid rgba(212,201,184,0.12)",
            whiteSpace: "pre-wrap",
            color: "rgba(212,201,184,0.9)",
          }}>
            <span style={{
              float: "left", fontSize: fit.size * 3.2, lineHeight: 0.82,
              fontWeight: 900, paddingRight: 10, paddingTop: 6,
              fontFamily: "'DM Serif Display', Georgia, serif",
              color: "#f0ebe4",
            }}>{fit.shown.charAt(0)}</span>
            {fit.shown.slice(1)}
          </div>
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.42,
            fontFamily: "'Source Serif Pro', Georgia, serif",
            columnCount: 2, columnGap: 48,
            whiteSpace: "pre-wrap",
          }} />
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 28, borderTop: "1px solid rgba(212,201,184,0.15)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 20, letterSpacing: 2, textTransform: "uppercase", opacity: 0.5,
        }}>
          <span>Letterboxd</span>
          <span>{fit.truncated ? "continued on profile →" : "fin."}</span>
        </div>
      </div>
    </StoryFrame>
  );
}

// ── LONG 6: Screenplay ─────────────────────────────────────
function LongScreenplay({ review }) {
  const fit = useFitFont({
    text: review.review, minSize: 22, maxSize: 42, step: 1,
    deps: [review.id],
  });

  return (
    <StoryFrame bg="#f0ead8">
      {/* Subtle paper lines */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 47px, #888 47px, #888 48px)",
      }} />
      {/* Left margin line */}
      <div style={{
        position: "absolute", left: 62, top: 0, bottom: 0,
        width: 1, background: "rgba(180,60,60,0.15)",
      }} />
      {/* Hole punches */}
      {[320, 960, 1600].map((y) => (
        <div key={y} style={{
          position: "absolute", left: 20, top: y,
          width: 28, height: 28, borderRadius: "50%",
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(0,0,0,0.03)",
        }} />
      ))}

      <div style={{
        position: "relative", height: "100%",
        padding: `${LONG_TOP_SAFE}px 80px 80px 90px`,
        display: "flex", flexDirection: "column",
        color: "#1a1816",
      }}>
        {/* Header — right aligned */}
        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <div style={{
            fontSize: 22, letterSpacing: 4, textTransform: "uppercase",
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            opacity: 0.5, marginBottom: 20,
            textAlign: "left",
          }}>
            FADE IN:
          </div>
          <div style={{
            fontSize: 24, letterSpacing: 3, textTransform: "uppercase",
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            fontWeight: 700, opacity: 0.6, marginBottom: 6,
          }}>
            INT. CINEMA — {review.year}
          </div>
          <h1 style={{
            fontSize: 72, fontWeight: 800, letterSpacing: -1.5,
            margin: 0, lineHeight: 0.95,
            fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
          }}>
            {review.title}
          </h1>
          <div style={{
            marginTop: 12, display: "flex", alignItems: "center",
            justifyContent: "flex-end", gap: 16,
          }}>
            <StarRow rating={review.rating} color="#c8441a" size={28} />
            <span style={{
              fontSize: 18, letterSpacing: 3, textTransform: "uppercase",
              opacity: 0.45,
            }}>
              — reviewed by @{review.reviewer}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: 2, background: "#1a1816", marginTop: 20, marginBottom: 28,
        }} />

        {/* Body — justified like other reviews */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.52,
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            textAlign: "justify",
            whiteSpace: "pre-wrap",
            color: "#1a1816",
          }}>
            {fit.shown}
          </div>
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.52,
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            whiteSpace: "pre-wrap",
          }} />
        </div>
      </div>
    </StoryFrame>
  );
}

// ═════════════════════════════════════════════════════════════
// Registry
// ═════════════════════════════════════════════════════════════

window.STORY_TEMPLATES = {
  short: [
    { id: "short-hero", name: "Poster Hero", component: ShortPosterHero },
    { id: "short-ticket", name: "Ticket Stub", component: ShortTicketStub },
    { id: "short-bleed", name: "Full Bleed", component: ShortFullBleed },
  ],
  long: [
    { id: "long-editorial", name: "Editorial", component: LongEditorial },
    { id: "long-cinematic", name: "Cinematic", component: LongCinematic },
    { id: "long-minimal", name: "Minimal Serif", component: LongMinimal },
    { id: "long-vertical-split", name: "Vertical Split", component: LongVerticalSplit },
    { id: "long-editorial-dark", name: "Editorial Dark", component: LongEditorialDark },
    { id: "long-screenplay", name: "Screenplay", component: LongScreenplay },
  ],
};

window.STORY_W = STORY_W;
window.STORY_H = STORY_H;
