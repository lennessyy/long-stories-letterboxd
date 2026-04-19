import io
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageDraw, ImageFont

app = Flask(__name__)

STORY_W, STORY_H = 1080, 1920
FONT_DIR = Path(__file__).parent / "static" / "fonts"

SAMPLE_REVIEW = {
    "movie_title": "Fargo",
    "year": "1996",
    "rating": 4.5,
    "backdrop_url": "https://a.ltrbxd.com/resized/sm/upload/ww/kz/nd/19/fargo-1200-1200-675-675-crop-000000.jpg?v=683482948f",
    "reviewer_handle": "lennessy",
    "reviewer_avatar_url": None,
    "review_text": (
        "I'm not sure whether I should watch this, because this movie was only 77% "
        "fresh on Rotten Tomatoes and I usually go for 78% and above overall a well "
        "built on a thoughtfully absurd premise, which made up for its underdeveloped "
        "characters.\n\n"
        "This may be the only time where you see both Minnesotans being the most violent "
        "people in the same film? There were lots of Fargo references, but it's obviously "
        "a very different movie. I don't know, it's thoughtful and convenient to say that "
        "this is what Fargo would have turned out in today's society. The story, after all, "
        "was set in the Reagan era, so whatever riches they had would have inevitably led "
        "to where we are today.\n\n"
        "Bob Odenkirk plays more or less the same character he did in Nobody. Doesn't "
        "mean I mean it negatively — him lobbing explosives on crowds of people somehow "
        "righteously. Lena Headey speaks with a terrific midwestern accent and that terrible "
        "wig, which oddly worked for her. I just felt like both looks like Cersei. I'm just "
        "glad they both made it. Carrie Coon is also having fun.\n\n"
        "Just logged this on letterboxd and got an intimate direct greeting from Bob "
        "Odenkirk saying he is the 'letterboxd person.' why thank you."
    ),
}


def load_font(size, bold=False):
    candidates = [
        FONT_DIR / ("Inter-Bold.ttf" if bold else "Inter-Regular.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
             else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def fetch_image(url: str) -> Image.Image | None:
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception:
        return None


def make_circle_avatar(img: Image.Image, size: int) -> Image.Image:
    img = img.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    return result


def star_string(rating: float) -> str:
    full = int(rating)
    half = (rating - full) >= 0.5
    return "★" * full + ("½" if half else "")


def wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines, current = [], []
    for word in words:
        test = " ".join(current + [word])
        if draw.textbbox((0, 0), test, font=font)[2] > max_width and current:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def measure_review_height(draw, review_text: str, font, max_width: int, line_spacing: float) -> float:
    line_h = font.size * line_spacing
    paragraphs = review_text.split("\n\n")
    total = 0.0
    for i, para in enumerate(paragraphs):
        if i > 0:
            total += line_h * 0.5  # paragraph gap
        total += len(wrap_text(draw, para.strip(), font, max_width)) * line_h
    return total


def draw_review_text(draw, review_text: str, font, x: int, y: float, max_width: int,
                     line_spacing: float, fill) -> float:
    line_h = font.size * line_spacing
    for i, para in enumerate(review_text.split("\n\n")):
        if i > 0:
            y += line_h * 0.5
        for line in wrap_text(draw, para.strip(), font, max_width):
            draw.text((x, y), line, font=font, fill=fill)
            y += line_h
    return y


def generate_story_image(review: dict) -> Image.Image:
    img = Image.new("RGBA", (STORY_W, STORY_H), (20, 20, 25, 255))

    # Backdrop — show it clearly, minimal overlay
    if review.get("backdrop_url"):
        backdrop = fetch_image(review["backdrop_url"])
        if backdrop:
            scale = STORY_W / backdrop.width
            new_h = int(backdrop.height * scale)
            backdrop = backdrop.resize((STORY_W, new_h), Image.LANCZOS)
            top = max(0, (new_h - STORY_H) // 3)
            backdrop = backdrop.crop((0, top, STORY_W, min(top + STORY_H, new_h)))
            if backdrop.height < STORY_H:
                full = Image.new("RGBA", (STORY_W, STORY_H), (20, 20, 25, 255))
                full.paste(backdrop, (0, 0))
                backdrop = full
            img.paste(backdrop, (0, 0))

    # Subtle vignette only — keep the poster visible
    vignette = Image.new("RGBA", (STORY_W, STORY_H), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    for row in range(STORY_H):
        alpha = int(60 + 80 * (row / STORY_H))
        vdraw.line([(0, row), (STORY_W, row)], fill=(0, 0, 0, alpha))
    img = Image.alpha_composite(img, vignette)

    draw = ImageDraw.Draw(img)

    H_PAD = 64          # horizontal padding inside glass boxes
    BOX_PAD = 52        # horizontal margin from edge of story to boxes
    BOX_W = STORY_W - BOX_PAD * 2
    LINE_SPACING = 1.55

    # ── TOP BOX: movie title + stars ──────────────────────────────────────
    title_font = load_font(58, bold=True)
    stars_font = load_font(44)

    year = review.get("year", "")
    title = f"{review['movie_title']} ({year})" if year else review["movie_title"]
    stars = star_string(review["rating"])

    title_lines = wrap_text(draw, title, title_font, BOX_W - H_PAD * 2)
    title_h = len(title_lines) * title_font.size * 1.2
    stars_h = stars_font.size * 1.3
    top_box_inner_h = title_h + 16 + stars_h
    top_box_h = int(top_box_inner_h + 48)
    top_box_y = 80

    overlay = Image.new("RGBA", (STORY_W, STORY_H), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rounded_rectangle(
        [BOX_PAD, top_box_y, BOX_PAD + BOX_W, top_box_y + top_box_h],
        radius=20, fill=(0, 0, 0, 185)
    )
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    ty = top_box_y + 24
    for line in title_lines:
        draw.text((BOX_PAD + H_PAD, ty), line, font=title_font, fill=(255, 255, 255, 255))
        ty += title_font.size * 1.2
    # Letterboxd orange for stars
    draw.text((BOX_PAD + H_PAD, ty + 4), stars, font=stars_font, fill=(255, 136, 0, 255))

    # ── BOTTOM BOX: avatar + handle ────────────────────────────────────────
    AVATAR_SIZE = 80
    bottom_box_h = AVATAR_SIZE + 40
    bottom_box_y = STORY_H - 80 - bottom_box_h

    overlay2 = Image.new("RGBA", (STORY_W, STORY_H), (0, 0, 0, 0))
    ImageDraw.Draw(overlay2).rounded_rectangle(
        [BOX_PAD, bottom_box_y, BOX_PAD + BOX_W, bottom_box_y + bottom_box_h],
        radius=20, fill=(0, 0, 0, 185)
    )
    img = Image.alpha_composite(img, overlay2)
    draw = ImageDraw.Draw(img)

    avatar_x = BOX_PAD + H_PAD
    avatar_y = bottom_box_y + (bottom_box_h - AVATAR_SIZE) // 2

    if review.get("reviewer_avatar_url"):
        av_img = fetch_image(review["reviewer_avatar_url"])
        if av_img:
            circle = make_circle_avatar(av_img, AVATAR_SIZE)
            img.paste(circle, (avatar_x, avatar_y), circle)

    handle_font = load_font(36, bold=True)
    subtext_font = load_font(28)
    handle = review.get("reviewer_handle", "")
    text_x = avatar_x + (AVATAR_SIZE + 20 if review.get("reviewer_avatar_url") else 0)
    text_cy = bottom_box_y + bottom_box_h // 2
    draw = ImageDraw.Draw(img)
    draw.text((text_x, text_cy - handle_font.size // 2 - 4),
              f"@{handle}", font=handle_font, fill=(255, 255, 255, 255))
    draw.text((text_x, text_cy + handle_font.size // 2 - 4),
              "letterboxd.com", font=subtext_font, fill=(0, 200, 80, 220))

    # ── MIDDLE BOX: review text ────────────────────────────────────────────
    text_box_top = top_box_y + top_box_h + 32
    text_box_bottom = bottom_box_y - 32
    available_h = text_box_bottom - text_box_top
    text_max_w = BOX_W - H_PAD * 2

    # Pick largest font size that fits
    chosen_font = load_font(22)
    for font_size in range(40, 21, -2):
        f = load_font(font_size)
        h = measure_review_height(draw, review["review_text"], f, text_max_w, LINE_SPACING)
        if h <= available_h - 64:  # 64px vertical padding inside box
            chosen_font = f
            break

    review_h = measure_review_height(draw, review["review_text"], chosen_font, text_max_w, LINE_SPACING)
    text_box_h = int(review_h + 64)
    # Vertically center the box in the available space
    text_box_y = text_box_top + (available_h - text_box_h) // 2

    overlay3 = Image.new("RGBA", (STORY_W, STORY_H), (0, 0, 0, 0))
    ImageDraw.Draw(overlay3).rounded_rectangle(
        [BOX_PAD, text_box_y, BOX_PAD + BOX_W, text_box_y + text_box_h],
        radius=20, fill=(0, 0, 0, 185)
    )
    img = Image.alpha_composite(img, overlay3)
    draw = ImageDraw.Draw(img)

    draw_review_text(draw, review["review_text"], chosen_font,
                     BOX_PAD + H_PAD, text_box_y + 32,
                     text_max_w, LINE_SPACING, fill=(255, 255, 255, 240))

    return img.convert("RGB")


def scrape_letterboxd(url: str) -> dict:
    import xml.etree.ElementTree as ET

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    # Follow redirects to get canonical URL (handles boxd.it short links etc.)
    canonical = requests.head(url, allow_redirects=True, timeout=10, headers=headers).url

    m = re.search(r"letterboxd\.com/([^/]+)/film/([^/]+)", canonical)
    if not m:
        raise ValueError(f"Could not parse Letterboxd URL: {url}")
    username, film_slug = m.group(1), m.group(2)

    # Fetch RSS feed — designed for external consumption, won't get blocked
    rss = requests.get(f"https://letterboxd.com/{username}/rss/", headers=headers, timeout=15)
    rss.raise_for_status()
    root = ET.fromstring(rss.content)

    # Letterboxd RSS namespace
    LB = "https://letterboxd.com"

    # Find the review entry matching the film slug
    item = None
    for candidate in root.findall(".//item"):
        link = candidate.findtext("link", "")
        if f"/film/{film_slug}/" in link:
            item = candidate
            break
    if item is None:
        raise ValueError(f"Review for '{film_slug}' not found in your RSS feed (only recent reviews are included)")

    movie_title = item.findtext(f"{{{LB}}}filmTitle", "")
    year        = item.findtext(f"{{{LB}}}filmYear", "")
    rating_str  = item.findtext(f"{{{LB}}}memberRating", "0")
    rating      = float(rating_str) if rating_str else 0.0

    # Review text lives in <description> as HTML
    desc_html = item.findtext("description", "")
    desc_soup = BeautifulSoup(desc_html, "lxml")
    review_text = "\n\n".join(p.get_text() for p in desc_soup.find_all("p"))

    # Poster from RSS enclosure; also try the film page og:image for a higher-res backdrop
    backdrop_url = None
    enclosure = item.find("enclosure")
    if enclosure is not None:
        backdrop_url = enclosure.get("url")

    # Try film page for a better quality image
    try:
        film_page = requests.get(f"https://letterboxd.com/film/{film_slug}/",
                                 headers=headers, timeout=10)
        film_soup = BeautifulSoup(film_page.text, "lxml")
        og_img = film_soup.select_one("meta[property='og:image']")
        if og_img and og_img.get("content"):
            backdrop_url = og_img["content"]
    except Exception:
        pass

    # Avatar from profile page
    reviewer_avatar_url = None
    try:
        profile = requests.get(f"https://letterboxd.com/{username}/",
                               headers=headers, timeout=10)
        profile_soup = BeautifulSoup(profile.text, "lxml")
        av = profile_soup.select_one(".profile-avatar img, .avatar img")
        if av and av.get("src", "").startswith("http"):
            reviewer_avatar_url = av["src"]
    except Exception:
        pass

    return {
        "movie_title": movie_title,
        "year": year,
        "rating": rating,
        "backdrop_url": backdrop_url,
        "reviewer_handle": username,
        "reviewer_avatar_url": reviewer_avatar_url,
        "review_text": review_text,
    }




@app.route("/")
def index():
    return render_template("index.html")


@app.route("/preview", methods=["POST"])
def preview():
    data = request.json
    url = data.get("url", "").strip()
    review = SAMPLE_REVIEW if url == "__sample__" else scrape_letterboxd(url)
    img = generate_story_image(review)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    buf.seek(0)
    resp = send_file(buf, mimetype="image/jpeg")
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    return resp


@app.route("/review-data", methods=["POST"])
def review_data():
    data = request.json
    url = data.get("url", "").strip()
    if url == "__sample__":
        return jsonify(SAMPLE_REVIEW)
    try:
        return jsonify(scrape_letterboxd(url))
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    ssl_ctx = None
    if os.path.exists("cert.pem") and os.path.exists("key.pem"):
        import ssl
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain("cert.pem", "key.pem")
    app.run(debug=False, host="0.0.0.0", port=port, ssl_context=ssl_ctx)
