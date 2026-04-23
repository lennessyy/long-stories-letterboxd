// Story templates for Letterboxd reviews → 1080x1920 Instagram stories
//
// Each template is a React component that accepts:
//   { review, opts }  where opts can tweak accent, fonts, etc.
//
// All templates are designed at 1080×1920; canvas artboards will scale them.

const STORY_W = 1080;
const STORY_H = 1920;

// Render star rating as text: ★★★½
window.starString = function (rating) {
  const full = Math.floor(rating || 0);
  const half = (rating || 0) - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// Fit review text by auto-shrinking font size if needed.
// Measures via a hidden ref'd div; picks the largest size that fits container height.
function useFitFont({ text, minSize = 22, maxSize = 56, step = 2, deps = [] }) {
  const measureRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState(maxSize);
  const [truncated, setTruncated] = React.useState(false);
  const [shown, setShown] = React.useState(text);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const availH = container.clientHeight;

    // Try largest -> smallest
    let chosen = minSize;
    for (let s = maxSize; s >= minSize; s -= step) {
      measure.style.fontSize = s + "px";
      measure.textContent = text;
      if (measure.scrollHeight <= availH) {
        chosen = s;
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
      measure.textContent = text.slice(0, mid).trimEnd() + "…";
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
  }, [text, minSize, maxSize, step, ...deps]);

  return { size, truncated, shown, containerRef, measureRef };
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
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
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

  return (
    <StoryFrame bg="#0d0d0f">
      {/* Blurred backdrop — large overflow + heavy blur hides image edges */}
      <div style={{
        position: "absolute", top: -100, left: -100, right: -100, bottom: -100,
        backgroundImage: `url(${review.backdrop || review.poster})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(80px) brightness(0.65) saturate(1.3)",
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
          width: 380, height: 570, objectFit: "cover", borderRadius: 12,
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
          <div style={{ marginTop: 16 }}>
            <StarRow rating={review.rating} color={review.accent} size={56} />
          </div>
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
      {/* Subtle blurred poster for color context */}
      <div style={{
        position: "absolute", top: -100, left: -100, right: -100, bottom: -100,
        backgroundImage: `url(${review.backdrop || review.poster})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(100px) brightness(0.5) saturate(1.6)",
        opacity: 0.4,
        mixBlendMode: "screen",
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
          position: "relative",
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
          <div style={{ padding: "52px 64px 36px", borderBottom: "3px dashed #1a0f0a", display: "flex", gap: 40, alignItems: "center" }}>
            <img src={review.poster} style={{
              width: 220, height: 330, objectFit: "cover",
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
              <div style={{ marginTop: 20 }}>
                <StarRow rating={review.rating} color="#c8441a" size={46} />
              </div>
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

  return (
    <StoryFrame>
      {/* Full bleed poster */}
      <img src={review.poster} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover",
      }} />
      {/* Dark gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.95) 100%)",
      }} />

      {/* Top chip - rating badge */}
      <div style={{ position: "absolute", top: 80, left: 80, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          padding: "14px 22px", borderRadius: 100,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <StarRow rating={review.rating} color={review.accent} size={30} />
        </div>
      </div>

      {/* Bottom content */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "80px 80px 70px",
        display: "flex", flexDirection: "column", gap: 32,
      }}>
        <div>
          <div style={{
            fontSize: 22, letterSpacing: 6, textTransform: "uppercase",
            opacity: 0.6, marginBottom: 16, fontWeight: 500,
          }}>
            {review.year}
          </div>
          <h1 style={{
            fontSize: 140, fontWeight: 900, letterSpacing: -4,
            margin: 0, lineHeight: 0.9,
            fontFamily: "'Inter', sans-serif",
          }}>
            {review.title}
          </h1>
        </div>

        <div style={{
          width: 80, height: 3, background: review.accent,
        }} />

        <p style={{
          fontSize: reviewSize, lineHeight: 1.4, margin: 0,
          color: "rgba(255,255,255,0.92)",
          fontWeight: 300, letterSpacing: 0.2,
          maxWidth: 900,
        }}>
          {review.review}
        </p>

        <div style={{ marginTop: 12 }}>
          <ReviewerFooter handle={review.reviewer} />
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

  return (
    <StoryFrame bg="#f4efe6">
      {/* Paper texture */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.08,
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.85' /></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }} />

      <div style={{
        position: "relative", height: "100%",
        padding: "80px 90px", display: "flex", flexDirection: "column",
        color: "#1a1918",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          paddingBottom: 32, borderBottom: "3px solid #1a1918",
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
          <img src={review.poster} style={{
            width: 140, height: 210, objectFit: "cover",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }} />
        </div>

        {/* Title */}
        <div style={{ marginTop: 48, marginBottom: 32 }}>
          <h1 style={{
            fontSize: 112, fontWeight: 900, letterSpacing: -3,
            margin: 0, lineHeight: 0.92,
            fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif",
          }}>
            {review.title}
          </h1>
          <div style={{
            marginTop: 20, display: "flex", alignItems: "baseline",
            gap: 24, fontSize: 28,
          }}>
            <span style={{ opacity: 0.6, fontStyle: "italic" }}>{review.year}</span>
            <span style={{ color: review.accent, fontSize: 40 }}>{window.starString(review.rating)}</span>
          </div>
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
        padding: "90px 80px", display: "flex", flexDirection: "column", gap: 40,
      }}>
        {/* Header: small poster + title */}
        <div style={{ display: "flex", gap: 32, alignItems: "flex-end" }}>
          <img src={review.poster} style={{
            width: 180, height: 270, objectFit: "cover", borderRadius: 8,
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, paddingBottom: 8 }}>
            <div style={{
              fontSize: 22, letterSpacing: 5, textTransform: "uppercase",
              opacity: 0.5, marginBottom: 14, fontWeight: 500,
            }}>
              {review.year}
            </div>
            <h1 style={{
              fontSize: 76, fontWeight: 800, letterSpacing: -2,
              margin: 0, lineHeight: 0.95,
            }}>
              {review.title}
            </h1>
            <div style={{ marginTop: 16 }}>
              <StarRow rating={review.rating} color={review.accent} size={38} />
            </div>
          </div>
        </div>

        {/* Accent line */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }} />

        {/* Review body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.48,
            fontWeight: 300, letterSpacing: 0.2,
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "pre-wrap",
          }}>
            <span style={{
              fontSize: fit.size * 1.8, color: review.accent,
              lineHeight: 0.8, marginRight: 6, fontFamily: "Georgia, serif",
              verticalAlign: "-0.3em",
            }}>"</span>
            {fit.shown}
          </div>
          <div ref={fit.measureRef} style={{
            position: "absolute", visibility: "hidden", pointerEvents: "none",
            left: 0, top: 0, right: 0,
            fontSize: fit.size, lineHeight: 1.48,
            fontWeight: 300, letterSpacing: 0.2,
            whiteSpace: "pre-wrap",
          }} />
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
        padding: "90px 80px 80px", display: "flex", flexDirection: "column",
        color: "#1a1918",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 44 }}>
          <img src={review.poster} style={{
            width: 110, height: 165, objectFit: "cover", borderRadius: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: 58, fontWeight: 800, letterSpacing: -1.5,
              margin: 0, lineHeight: 1,
              fontFamily: "'Inter', sans-serif",
            }}>
              {review.title}
            </h1>
            <div style={{
              marginTop: 10, fontSize: 24, opacity: 0.55, letterSpacing: 0.5,
            }}>
              {review.year} · <span style={{ color: review.accent, fontWeight: 600 }}>{window.starString(review.rating)}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div ref={fit.containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            fontSize: fit.size, lineHeight: 1.4,
            fontFamily: "'DM Serif Text', 'Source Serif Pro', Georgia, serif",
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
  ],
};

window.STORY_W = STORY_W;
window.STORY_H = STORY_H;
